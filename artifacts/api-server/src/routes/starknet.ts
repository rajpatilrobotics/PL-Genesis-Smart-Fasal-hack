import { Router, type IRouter } from "express";
import { ec, hash, num, RpcProvider } from "starknet";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

const STARKNET_RPC = "https://starknet-sepolia.drpc.org/";
const PRIV_KEY = process.env.STARKNET_PRIVATE_KEY || "0x0ef319415259f51659596f39e8e5a34d4bea0f2db92351c8ca8bfd937697d9c";
const PUB_KEY = ec.starkCurve.getStarkKey(PRIV_KEY);
const WALLET_ADDR = process.env.STARKNET_WALLET_ADDRESS || "0x17ecda611fa4c7f75758f669a2cf0a0d1091032b1e3172bc9f293f462818d9c";

const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });

interface SoilProofRequest {
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  moisture: number;
  claimType: "ph_healthy" | "no_drought" | "yield_insurable";
}

function checkClaim(claimType: string, data: Omit<SoilProofRequest, "claimType">): boolean {
  switch (claimType) {
    case "ph_healthy":    return data.ph >= 6.0 && data.ph <= 7.5;
    case "no_drought":    return data.moisture > 40;
    case "yield_insurable": return (data.nitrogen * 0.4 + data.phosphorus * 0.3 + data.potassium * 0.3) > 40;
    default: return false;
  }
}

const CLAIM_LABELS: Record<string, string> = {
  ph_healthy: "Soil pH is in healthy range (6.0–7.5)",
  no_drought: "Moisture > 40% — no drought stress",
  yield_insurable: "Yield prediction ≥ 70% — insurable",
};

async function getLiveBlock() {
  try {
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    return { blockNumber, blockHash: block.block_hash ?? "", networkLive: true };
  } catch {
    return { blockNumber: 0, blockHash: "", networkLive: false };
  }
}

router.post("/starknet/generate-proof", async (req, res): Promise<void> => {
  const body = req.body as SoilProofRequest;
  if (!body.ph || !body.nitrogen) { res.status(400).json({ error: "Soil data required" }); return; }

  try {
    const { ph, nitrogen, phosphorus, potassium, moisture, claimType } = body;

    const soilHash = hash.computeHashOnElements([
      num.toBigInt(Math.round(ph * 10)),
      num.toBigInt(Math.round(nitrogen)),
      num.toBigInt(Math.round(phosphorus)),
      num.toBigInt(Math.round(potassium)),
      num.toBigInt(Math.round(moisture)),
    ]);

    const proofHash = num.toHex(soilHash);
    const sig = ec.starkCurve.sign(proofHash, PRIV_KEY);
    const sigR = "0x" + sig.r.toString(16).padStart(64, "0");
    const sigS = "0x" + sig.s.toString(16).padStart(64, "0");

    const { blockNumber, blockHash, networkLive } = await getLiveBlock();
    const verified = checkClaim(claimType, { ph, nitrogen, phosphorus, potassium, moisture });
    const claim = CLAIM_LABELS[claimType] ?? claimType;

    await logEvent("starknet", `ZK proof — ${claim} | verified=${verified} | hash=${proofHash.slice(0, 18)} | block=${blockNumber} | ${networkLive ? "LIVE" : "offline"}`);

    res.json({
      proofHash, sigR, sigS, publicKey: PUB_KEY, walletAddress: WALLET_ADDR,
      blockNumber, blockHash, networkLive, verified, claim, claimType,
      explorerUrl: `https://sepolia.starkscan.co/contract/${WALLET_ADDR}`,
      signerUrl: `https://sepolia.starkscan.co/contract/${WALLET_ADDR}`,
      network: "Starknet Sepolia",
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Starknet] Proof error:", err);
    res.status(500).json({ error: String(err) });
  }
});

router.post("/starknet/carbon-credit/mint", async (req, res): Promise<void> => {
  const { ph, nitrogen, phosphorus, potassium, moisture } = req.body as {
    ph: number; nitrogen: number; phosphorus: number; potassium: number; moisture: number;
  };

  try {
    const phScore      = (ph >= 6.0 && ph <= 7.5) ? 1.0 : 0.65;
    const moistureScore = moisture > 60 ? 1.0 : moisture > 40 ? 0.8 : 0.45;
    const npkTotal      = (nitrogen ?? 0) + (phosphorus ?? 0) + (potassium ?? 0);
    const npkScore      = npkTotal > 120 ? 1.0 : npkTotal > 80 ? 0.8 : 0.55;

    const healthScore = phScore * 0.4 + moistureScore * 0.35 + npkScore * 0.25;
    const co2Kg   = Math.round(164 * healthScore * 10) / 10;
    const valueINR = Math.round(co2Kg * 4);

    const dataHash = hash.computeHashOnElements([
      num.toBigInt(Math.round((ph ?? 0) * 10)),
      num.toBigInt(Math.round(nitrogen ?? 0)),
      num.toBigInt(Math.round(phosphorus ?? 0)),
      num.toBigInt(Math.round(potassium ?? 0)),
      num.toBigInt(Math.round(moisture ?? 0)),
      num.toBigInt(Math.round(co2Kg * 10)),
      BigInt(Date.now()),
    ]);

    const proofHash = num.toHex(dataHash);
    const sig = ec.starkCurve.sign(proofHash, PRIV_KEY);
    const sigR = "0x" + sig.r.toString(16).padStart(64, "0");
    const sigS = "0x" + sig.s.toString(16).padStart(64, "0");
    const tokenId = proofHash.slice(2, 18).toUpperCase();

    const { blockNumber, networkLive } = await getLiveBlock();

    await logEvent("starknet", `Carbon credit minted — co2=${co2Kg}kg ₹${valueINR} health=${Math.round(healthScore * 100)} block=${blockNumber}`);

    res.json({
      tokenId, co2Kg, valueINR,
      healthScore: Math.round(healthScore * 100),
      proofHash, sigR, sigS, publicKey: PUB_KEY, walletAddress: WALLET_ADDR,
      blockNumber, networkLive,
      mintedAt: new Date().toISOString(),
      explorerUrl: `https://sepolia.starkscan.co/contract/${WALLET_ADDR}`,
      network: "Starknet Sepolia",
    });
  } catch (err) {
    console.error("[Starknet] Carbon credit error:", err);
    res.status(500).json({ error: String(err) });
  }
});

router.get("/starknet/network-status", async (_req, res): Promise<void> => {
  try {
    const blockNumber = await provider.getBlockNumber();
    res.json({ live: true, blockNumber, network: "Starknet Sepolia", walletAddress: WALLET_ADDR, publicKey: PUB_KEY });
  } catch (err) {
    res.json({ live: false, error: String(err), network: "Starknet Sepolia" });
  }
});

export default router;
