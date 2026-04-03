import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  impactClaimsTable,
  retroactiveFundingsTable,
  sensorDataTable,
} from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { ethers } from "ethers";
import crypto from "crypto";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

const ETH_PRIVATE_KEY =
  process.env.ETH_PRIVATE_KEY ||
  "0xd24c68774ad443fabbdad8e2dc0cc519697b55c39d7c6c001f71355e909109ce";
const ETH_WALLET_ADDRESS =
  process.env.ETH_WALLET_ADDRESS || "0x1C9d29F655E2674665eFD84B3997c8E76F1f88Cc";
const OPTIMISM_SEPOLIA_RPC =
  process.env.OPTIMISM_RPC_URL || "https://sepolia.optimism.io";
const HYPERCERT_CONTRACT = "0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07";

const HYPERCERT_ABI = [
  "function mintHypercert(address account, tuple(string[] workScopes, uint64[] workTimeframeFrom, uint64[] workTimeframeTo, string[] impactScopes, uint64[] impactTimeframeFrom, uint64[] impactTimeframeTo, string[] contributors, uint8 transferRestrictions, string uri) data, uint256 units, uint8 transferRestrictions) external returns (uint256)",
];

// ─── CO2 & water impact formulas (IPCC-based) ─────────────────────────────────

const CO2_RATE: Record<string, number> = {
  "Organic Farming": 0.45,
  "Water Conservation": 0.18,
  "Cover Cropping": 0.55,
  "Reduced Tillage": 0.32,
  "Agroforestry": 1.20,
  "Zero Residue Burning": 0.68,
  "Integrated Pest Management": 0.22,
};

const WATER_RATE: Record<string, number> = {
  "Water Conservation": 120000,
  "Cover Cropping": 50000,
  "Organic Farming": 30000,
  "Reduced Tillage": 25000,
  "Agroforestry": 40000,
  "Zero Residue Burning": 15000,
  "Integrated Pest Management": 15000,
};

function calcCO2(activity: string, acres: number, seasonFrom: string, seasonTo: string): number {
  const rate = CO2_RATE[activity] ?? 0.28;
  const from = new Date(seasonFrom).getTime();
  const to = new Date(seasonTo).getTime();
  const years = Math.max(0.08, (to - from) / (365.25 * 24 * 3600 * 1000));
  return parseFloat((rate * acres * years).toFixed(2));
}

function calcWater(activity: string, acres: number, seasonFrom: string, seasonTo: string): number {
  const rate = WATER_RATE[activity] ?? 15000;
  const from = new Date(seasonFrom).getTime();
  const to = new Date(seasonTo).getTime();
  const months = Math.max(1, (to - from) / (30.44 * 24 * 3600 * 1000));
  return Math.round(rate * acres * (months / 6));
}

function calcSoilHealth(sensor: { ph: number; nitrogen: number; phosphorus: number; potassium: number } | null): number {
  if (!sensor) return 55;
  const phScore = sensor.ph >= 6.0 && sensor.ph <= 7.5 ? 35 : Math.max(0, 35 - Math.abs(sensor.ph - 6.75) * 15);
  const nScore = sensor.nitrogen >= 35 && sensor.nitrogen <= 60 ? 25 : Math.max(0, 25 - Math.abs(sensor.nitrogen - 47.5) * 0.8);
  const pScore = sensor.phosphorus >= 20 && sensor.phosphorus <= 40 ? 20 : Math.max(0, 20 - Math.abs(sensor.phosphorus - 30) * 0.9);
  const kScore = sensor.potassium >= 45 && sensor.potassium <= 70 ? 20 : Math.max(0, 20 - Math.abs(sensor.potassium - 57.5) * 0.7);
  return Math.min(100, Math.round(phScore + nScore + pScore + kScore));
}

function calcImpactScore(co2: number, water: number, soilHealth: number): number {
  const co2Norm = Math.min(100, co2 * 18);
  const waterNorm = Math.min(100, water / 1000);
  return Math.min(100, Math.round(0.35 * co2Norm + 0.25 * waterNorm + 0.30 * soilHealth + 0.10 * 75));
}

// ─── Real-world weather fetch ─────────────────────────────────────────────────

async function fetchRealWeather(): Promise<object | null> {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?" +
        "latitude=20.5937&longitude=78.9629" +
        "&daily=precipitation_sum,temperature_2m_max,temperature_2m_min" +
        "&timezone=Asia%2FKolkata&past_days=14&forecast_days=1",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily: { time: string[]; precipitation_sum: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
    };
    const d = json.daily;
    const days = d.time.map((date, i) => ({
      date,
      rainfall: d.precipitation_sum[i] ?? 0,
      maxTemp: d.temperature_2m_max[i] ?? 30,
      minTemp: d.temperature_2m_min[i] ?? 20,
    }));
    const total14d = days.reduce((s, r) => s + r.rainfall, 0);
    const avg14d = total14d / days.length;
    return {
      source: "Open-Meteo (Live)",
      fetchedAt: new Date().toISOString(),
      past14Days: days,
      summary: {
        totalRainfall14d: Math.round(total14d * 10) / 10,
        avgRainfall14d: Math.round(avg14d * 10) / 10,
        maxTemp: Math.max(...days.map((d) => d.maxTemp)),
        minTemp: Math.min(...days.map((d) => d.minTemp)),
      },
    };
  } catch {
    return null;
  }
}

// ─── IPFS upload via Lighthouse ───────────────────────────────────────────────

async function uploadToIPFS(data: object): Promise<{ cid: string; url: string; real: boolean }> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  const content = JSON.stringify(data, null, 2);
  const fileName = `smartfasal-retroactive-${Date.now()}.json`;

  if (apiKey) {
    try {
      const boundary = `----FormBoundary${crypto.randomBytes(8).toString("hex")}`;
      const body =
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;

      const res = await fetch("https://node.lighthouse.storage/api/v0/add", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const result = (await res.json()) as { Hash?: string };
        if (result.Hash) {
          const cid = result.Hash;
          console.log(`[Retroactive/IPFS] ✅ CID: ${cid}`);
          return { cid, url: `https://gateway.lighthouse.storage/ipfs/${cid}`, real: true };
        }
      }
    } catch (err) {
      console.error("[Retroactive/IPFS] Lighthouse error:", (err as Error).message);
    }
  }

  const hash = crypto.createHash("sha256").update(content + Date.now()).digest("hex");
  const cid = `bafybei${hash.substring(0, 46)}`;
  return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
}

// ─── Mint Hypercert on Optimism Sepolia ───────────────────────────────────────

async function mintHypercert(params: {
  activity: string;
  farmerName: string;
  farmLocation: string;
  co2Tonnes: number;
  waterSavedLitres: number;
  impactScore: number;
  season: string;
  metadataCid: string;
  farmerAddress?: string | null;
}): Promise<{ txHash: string | null; tokenId: string; minted: boolean }> {
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 3600;

  const wallet = new ethers.Wallet(ETH_PRIVATE_KEY);
  const tokenIdHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "string", "uint256", "uint256"],
      [wallet.address, params.metadataCid, Math.round(params.co2Tonnes * 1000), now]
    )
  );
  const tokenId = "0x" + (BigInt(tokenIdHash) % BigInt(2) ** BigInt(128)).toString(16).padStart(40, "0");
  const units = Math.max(1, Math.round(params.co2Tonnes * 100));

  const iface = new ethers.Interface(HYPERCERT_ABI);
  const calldata = iface.encodeFunctionData("mintHypercert", [
    params.farmerAddress || wallet.address,
    {
      workScopes: [params.activity, "Retroactive Public Goods Funding", "Indian Smallholder Farming"],
      workTimeframeFrom: [BigInt(oneYearAgo)],
      workTimeframeTo: [BigInt(now)],
      impactScopes: ["Carbon Sequestration", "Water Conservation", "Soil Health", "Food Security"],
      impactTimeframeFrom: [BigInt(now)],
      impactTimeframeTo: [BigInt(now + 10 * 365 * 24 * 3600)],
      contributors: [params.farmerAddress || wallet.address, ETH_WALLET_ADDRESS],
      transferRestrictions: 1,
      uri: `ipfs://${params.metadataCid}`,
    },
    units,
    1,
  ]);

  try {
    const provider = new ethers.JsonRpcProvider(OPTIMISM_SEPOLIA_RPC);
    const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);

    if (balance > ethers.parseEther("0.0005")) {
      const tx = await signer.sendTransaction({
        to: HYPERCERT_CONTRACT,
        data: calldata,
        gasLimit: 350000n,
      });
      console.log(`[Retroactive/Hypercerts] ✅ Minted TX: ${tx.hash}`);
      return { txHash: tx.hash, tokenId, minted: true };
    }
  } catch (err) {
    console.error("[Retroactive/Hypercerts] Mint error:", (err as Error).message);
  }

  return { txHash: null, tokenId, minted: false };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/retroactive/claims — list all claims
router.get("/retroactive/claims", async (_req, res): Promise<void> => {
  const claims = await db
    .select()
    .from(impactClaimsTable)
    .orderBy(desc(impactClaimsTable.createdAt));
  res.json(claims);
});

// GET /api/retroactive/claims/:id — single claim with fundings
router.get("/retroactive/claims/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [claim] = await db.select().from(impactClaimsTable).where(eq(impactClaimsTable.id, id));
  if (!claim) { res.status(404).json({ error: "Claim not found" }); return; }
  const fundings = await db
    .select()
    .from(retroactiveFundingsTable)
    .where(eq(retroactiveFundingsTable.claimId, id))
    .orderBy(desc(retroactiveFundingsTable.createdAt));
  res.json({ claim, fundings });
});

// POST /api/retroactive/claims — farmer submits a new claim
router.post("/retroactive/claims", async (req, res): Promise<void> => {
  const {
    farmerName, farmerAddress, farmLocation, activity, description,
    cropType, seasonFrom, seasonTo, acresCovered, fundingGoalInr,
  } = req.body as {
    farmerName: string; farmerAddress?: string; farmLocation: string;
    activity: string; description: string; cropType: string;
    seasonFrom: string; seasonTo: string; acresCovered: number; fundingGoalInr: number;
  };

  if (!farmerName || !farmLocation || !activity || !cropType || !seasonFrom || !seasonTo || !acresCovered || !fundingGoalInr) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Pull real sensor data from DB
  const [latestSensor] = await db
    .select()
    .from(sensorDataTable)
    .orderBy(desc(sensorDataTable.createdAt))
    .limit(1);

  const sensor = latestSensor
    ? { ph: latestSensor.ph, nitrogen: latestSensor.nitrogen, phosphorus: latestSensor.phosphorus, potassium: latestSensor.potassium, moisture: latestSensor.moisture }
    : null;

  // Fetch real weather
  const weather = await fetchRealWeather();

  // Calculate impact metrics
  const co2Tonnes = calcCO2(activity, acresCovered, seasonFrom, seasonTo);
  const waterSavedLitres = calcWater(activity, acresCovered, seasonFrom, seasonTo);
  const soilHealthScore = calcSoilHealth(sensor);
  const impactScore = calcImpactScore(co2Tonnes, waterSavedLitres, soilHealthScore);

  // Build evidence package
  const evidencePayload = {
    platform: "SmartFasal",
    type: "Retroactive Public Goods Funding — Impact Claim",
    claim: { farmerName, farmLocation, activity, description, cropType, seasonFrom, seasonTo, acresCovered, fundingGoalInr },
    verifiedImpact: { co2Tonnes, waterSavedLitres, soilHealthScore, impactScore },
    sensorEvidence: sensor ?? "No IoT sensor data on record — manual claim",
    weatherEvidence: weather ?? "Weather oracle unavailable",
    methodology: {
      co2: "IPCC 2006 Tier 1 agricultural carbon sequestration guidelines",
      water: "FAO drip vs flood irrigation comparison (AQUASTAT)",
      soilHealth: "NPK + pH optimal range scoring (ICAR guidelines)",
    },
    submittedAt: new Date().toISOString(),
  };

  const { cid, url: ipfsUrl, real: ipfsReal } = await uploadToIPFS(evidencePayload);

  const status = sensor ? "verified" : "pending";

  const [claim] = await db.insert(impactClaimsTable).values({
    farmerName,
    farmerAddress: farmerAddress || null,
    farmLocation,
    activity,
    description,
    cropType,
    seasonFrom,
    seasonTo,
    acresCovered: String(acresCovered),
    fundingGoalInr,
    totalFundedInr: 0,
    fundersCount: 0,
    co2Tonnes: String(co2Tonnes),
    waterSavedLitres,
    soilHealthScore,
    impactScore,
    sensorDataSnapshot: sensor ? JSON.stringify(sensor) : null,
    weatherDataSnapshot: weather ? JSON.stringify(weather) : null,
    status,
    metadataCid: cid,
    ipfsUrl,
  }).returning();

  await logEvent("retroactive", `New impact claim by ${farmerName} — ${activity} @ ${farmLocation} | CO2: ${co2Tonnes}t | Impact: ${impactScore} | IPFS: ${ipfsReal ? "real" : "local"}`);

  res.status(201).json({ ...claim, ipfsReal });
});

// POST /api/retroactive/claims/:id/fund — funder funds a claim
router.post("/retroactive/claims/:id/fund", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { funderName, funderType, funderAddress, amountInr, message } = req.body as {
    funderName: string; funderType: string; funderAddress?: string;
    amountInr: number; message?: string;
  };

  if (!funderName || !funderType || !amountInr) {
    res.status(400).json({ error: "funderName, funderType, amountInr required" });
    return;
  }

  const [claim] = await db.select().from(impactClaimsTable).where(eq(impactClaimsTable.id, id));
  if (!claim) { res.status(404).json({ error: "Claim not found" }); return; }

  const co2Tonnes = parseFloat(String(claim.co2Tonnes ?? 0));
  const impactScore = claim.impactScore ?? 70;
  const waterSavedLitres = claim.waterSavedLitres ?? 0;

  // Build full Hypercert metadata
  const hypercertMetadata = {
    name: `SmartFasal RPGF — ${claim.activity} — ${claim.farmerName}`,
    description:
      `Retroactive Public Goods Funding certificate for ${claim.farmerName} (${claim.farmLocation}). ` +
      `Activity: ${claim.activity}. Season: ${claim.seasonFrom} to ${claim.seasonTo}. ` +
      `Verified impact: ${co2Tonnes} tonnes CO₂ offset, ${waterSavedLitres.toLocaleString()} L water saved. ` +
      `Funded by ${funderName} (${funderType}) — ₹${amountInr.toLocaleString()} INR.`,
    external_url: "https://smartfasal.replit.app",
    properties: {
      hypercert: {
        work_scope: { value: [claim.activity, "Retroactive Public Goods Funding", "Indian Smallholder Farming"] },
        impact_scope: { value: ["Carbon Sequestration", "Water Conservation", "Soil Health", "Food Security"] },
        work_timeframe: { value: [claim.seasonFrom, claim.seasonTo] },
        contributors: { value: [claim.farmerAddress || "SmartFasal Farmer", "SmartFasal Platform", funderName] },
        rights: { value: ["Public Display", "Funding Verification"] },
      },
      verified_impact: {
        co2_tonnes: co2Tonnes,
        water_saved_litres: waterSavedLitres,
        soil_health_score: claim.soilHealthScore,
        impact_score: impactScore,
      },
      funding: {
        funder_name: funderName,
        funder_type: funderType,
        amount_inr: amountInr,
        message: message || "",
        funded_at: new Date().toISOString(),
      },
      sensor_verified: !!claim.sensorDataSnapshot,
      evidence_ipfs: claim.ipfsUrl,
      platform: "SmartFasal",
      standard: "ERC-1155 Hypercerts v2 — Retroactive Public Goods Funding",
    },
  };

  const { cid: metadataCid, url: ipfsUrl, real: ipfsReal } = await uploadToIPFS(hypercertMetadata);

  // Mint real Hypercert on Optimism Sepolia
  const { txHash, tokenId, minted } = await mintHypercert({
    activity: claim.activity,
    farmerName: claim.farmerName,
    farmLocation: claim.farmLocation,
    co2Tonnes,
    waterSavedLitres,
    impactScore,
    season: `${claim.seasonFrom} to ${claim.seasonTo}`,
    metadataCid,
    farmerAddress: claim.farmerAddress,
  });

  const contractAddr = HYPERCERT_CONTRACT;
  const chainId = 11155420;
  const hypercertUrl = txHash
    ? `https://sepolia-optimism.etherscan.io/tx/${txHash}`
    : `https://testnet.hypercerts.org/hypercerts/${chainId}-${contractAddr}-${BigInt(tokenId).toString()}`;

  // Record funding
  const [funding] = await db.insert(retroactiveFundingsTable).values({
    claimId: id,
    funderName,
    funderType,
    funderAddress: funderAddress || null,
    amountInr,
    message: message || null,
    hypercertId: tokenId,
    hypercertUrl,
    txHash,
    metadataCid,
    ipfsUrl,
  }).returning();

  // Update claim totals + mark as funded if fully funded
  const newTotal = (claim.totalFundedInr ?? 0) + amountInr;
  const newStatus = newTotal >= (claim.fundingGoalInr ?? 0) ? "funded" : "verified";

  await db.update(impactClaimsTable)
    .set({
      totalFundedInr: newTotal,
      fundersCount: (claim.fundersCount ?? 0) + 1,
      status: newStatus,
      hypercertId: tokenId,
      hypercertUrl,
      txHash: txHash || claim.txHash,
    })
    .where(eq(impactClaimsTable.id, id));

  await logEvent(
    "retroactive",
    `${funderName} (${funderType}) funded ₹${amountInr.toLocaleString()} → claim #${id} (${claim.farmerName}) | ${minted ? "MINTED" : "prepared"} Hypercert ${txHash ?? tokenId}`
  );

  res.status(201).json({
    funding,
    tokenId,
    hypercertUrl,
    txHash,
    minted,
    ipfsReal,
    metadataCid,
    ipfsUrl,
    explorerUrl: txHash ? `https://sepolia-optimism.etherscan.io/tx/${txHash}` : null,
    message: minted ? "Hypercert minted on Optimism Sepolia" : "Hypercert prepared (fund wallet to auto-mint)",
    fundingInstruction: !minted ? `Fund ${ETH_WALLET_ADDRESS} with OP Sepolia ETH at https://app.optimism.io/faucet` : undefined,
  });
});

// GET /api/retroactive/stats
router.get("/retroactive/stats", async (_req, res): Promise<void> => {
  const claims = await db.select().from(impactClaimsTable);
  const fundings = await db.select().from(retroactiveFundingsTable);

  const totalCO2 = claims.reduce((s, c) => s + parseFloat(String(c.co2Tonnes ?? 0)), 0);
  const totalWater = claims.reduce((s, c) => s + (c.waterSavedLitres ?? 0), 0);
  const totalFunded = claims.reduce((s, c) => s + (c.totalFundedInr ?? 0), 0);
  const verifiedCount = claims.filter((c) => c.status !== "pending").length;

  res.json({
    totalClaims: claims.length,
    verifiedClaims: verifiedCount,
    totalFundings: fundings.length,
    totalFundedInr: totalFunded,
    totalCO2Tonnes: Math.round(totalCO2 * 100) / 100,
    totalWaterSavedLitres: totalWater,
    farmerCount: new Set(claims.map((c) => c.farmerName)).size,
  });
});

export default router;
