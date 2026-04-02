import { Router, type IRouter } from "express";
import {
  ec, hash, num, RpcProvider, Account, Contract,
  CallData, cairo, type Abi,
} from "starknet";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { logEvent } from "../lib/event-logger.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router: IRouter = Router();

// ─── Config ────────────────────────────────────────────────────────────────
const STARKNET_RPC    = process.env.STARKNET_RPC_URL || "https://starknet-sepolia.drpc.org/";
const PRIV_KEY        = process.env.STARKNET_PRIVATE_KEY || "0x0ef319415259f51659596f39e8e5a34d4bea0f2db92351c8ca8bfd937697d9c";
const WALLET_ADDR     = process.env.STARKNET_WALLET_ADDRESS || "0x17ecda611fa4c7f75758f669a2cf0a0d1091032b1e3172bc9f293f462818d9c";
const STATE_FILE      = join(process.cwd(), "starknet-state.json");
const SIERRA_PATH     = join(process.cwd(), "contracts/insurance.sierra.json");
const CASM_PATH       = join(process.cwd(), "contracts/insurance.casm.json");
const STARKSCAN_BASE  = "https://sepolia.starkscan.co";
const NETWORK_NAME    = "Starknet Sepolia";

const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });

function getAccount() {
  return new Account({ provider, address: WALLET_ADDR, signer: PRIV_KEY, cairoVersion: "1" });
}

// ─── Persisted state ────────────────────────────────────────────────────────
interface StarknetState {
  contractAddress: string | null;
  classHash: string | null;
  deployTxHash: string | null;
  deployedAt: string | null;
  policies: Record<string, { farmerId: string; droughtThreshold: number; heatThreshold: number; registeredAt: string; txHash: string }>;
  claims: Array<{ claimId: number; farmerId: string; trigger: string; soilHash: string; moisture: number; temperature: number; txHash: string; timestamp: string }>;
}

function loadState(): StarknetState {
  if (existsSync(STATE_FILE)) {
    try { return JSON.parse(readFileSync(STATE_FILE, "utf-8")); } catch { /**/ }
  }
  return { contractAddress: null, classHash: null, deployTxHash: null, deployedAt: null, policies: {}, claims: [] };
}

function saveState(s: StarknetState) {
  try { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch { /**/ }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getLiveBlock() {
  try {
    const blockNumber = await provider.getBlockNumber();
    let blockHash = "";
    try {
      const block = await provider.getBlock(blockNumber);
      blockHash = (block as any).block_hash ?? (block as any).blockHash ?? "";
    } catch { /* block hash is optional */ }
    return { blockNumber, blockHash, networkLive: true };
  } catch (e) {
    console.warn("[Starknet] RPC error:", (e as any)?.message?.slice(0, 100));
    return { blockNumber: 0, blockHash: "", networkLive: false };
  }
}

function computeSoilHash(ph: number, n: number, p: number, k: number, moisture: number): string {
  const h = hash.computeHashOnElements([
    num.toBigInt(Math.round(ph * 10)),
    num.toBigInt(Math.round(n)),
    num.toBigInt(Math.round(p)),
    num.toBigInt(Math.round(k)),
    num.toBigInt(Math.round(moisture)),
  ]);
  return num.toHex(h);
}

function getInsuranceContract(state: StarknetState) {
  if (!state.contractAddress) return null;
  const sierra = JSON.parse(readFileSync(SIERRA_PATH, "utf-8"));
  return new Contract(sierra.abi as Abi, state.contractAddress, provider);
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/** GET  /api/starknet/network-status */
router.get("/starknet/network-status", async (_req, res): Promise<void> => {
  const { blockNumber, blockHash, networkLive } = await getLiveBlock();
  const state = loadState();
  res.json({
    live: networkLive, blockNumber, blockHash,
    network: NETWORK_NAME,
    walletAddress: WALLET_ADDR,
    contractAddress: state.contractAddress,
    contractDeployed: !!state.contractAddress,
    deployTxHash: state.deployTxHash,
    explorerUrl: state.contractAddress ? `${STARKSCAN_BASE}/contract/${state.contractAddress}` : null,
  });
});

/** POST /api/starknet/deploy — Deploy the insurance contract (one-time) */
router.post("/starknet/deploy", async (_req, res): Promise<void> => {
  const state = loadState();
  if (state.contractAddress) {
    res.json({ alreadyDeployed: true, contractAddress: state.contractAddress, deployTxHash: state.deployTxHash, explorerUrl: `${STARKSCAN_BASE}/contract/${state.contractAddress}` });
    return;
  }

  try {
    const sierraJson = JSON.parse(readFileSync(SIERRA_PATH, "utf-8"));
    const casmJson   = JSON.parse(readFileSync(CASM_PATH,   "utf-8"));

    // Declare the class
    const declareResp = await getAccount().declare({ contract: sierraJson, casm: casmJson });
    await provider.waitForTransaction(declareResp.transaction_hash);
    const classHash = declareResp.class_hash;

    // Deploy an instance — oracle = our own wallet address
    const constructorCalldata = CallData.compile({ oracle: WALLET_ADDR });
    const deployResp = await getAccount().deployContract({ classHash, constructorCalldata });
    await provider.waitForTransaction(deployResp.transaction_hash);
    const contractAddress = deployResp.contract_address;

    state.contractAddress = contractAddress;
    state.classHash = classHash;
    state.deployTxHash = deployResp.transaction_hash;
    state.deployedAt = new Date().toISOString();
    saveState(state);

    await logEvent("starknet", `Contract deployed — ${contractAddress} | class=${classHash.slice(0, 18)} | tx=${deployResp.transaction_hash.slice(0, 18)}`);

    res.json({
      success: true, contractAddress, classHash,
      deployTxHash: deployResp.transaction_hash,
      explorerUrl: `${STARKSCAN_BASE}/contract/${contractAddress}`,
      txUrl: `${STARKSCAN_BASE}/tx/${deployResp.transaction_hash}`,
      network: NETWORK_NAME,
      deployedAt: state.deployedAt,
    });
  } catch (err: any) {
    console.error("[Starknet] Deploy error:", err);
    const msg: string = err?.message ?? String(err);
    const isNotDeployed = msg.includes("is not deployed") || msg.includes("Contract not found");
    const isInsufficientFunds = msg.includes("insufficient") || msg.includes("Insufficient") || msg.includes("balance");
    let userError = msg;
    let hint = "Make sure the wallet has Starknet Sepolia ETH from https://faucet.starknet.io/";
    if (isNotDeployed) {
      userError = "Wallet account is not deployed on Starknet Sepolia";
      hint = "The wallet address must be a deployed Argent X or Braavos account on Starknet Sepolia. Visit https://www.starknet.io/en/ecosystem/wallets to create and fund one, then update STARKNET_WALLET_ADDRESS and STARKNET_PRIVATE_KEY in environment variables.";
    } else if (isInsufficientFunds) {
      userError = "Insufficient Starknet Sepolia ETH for gas fees";
      hint = "Fund your Starknet Sepolia wallet at https://faucet.starknet.io/ and try again.";
    }
    res.status(500).json({ error: userError, hint });
  }
});

/** POST /api/starknet/register-policy — Register a farmer insurance policy on-chain */
router.post("/starknet/register-policy", async (req, res): Promise<void> => {
  const { farmerId = "SmartFasal_Farm_001", droughtThreshold = 30, heatThreshold = 35 } = req.body;
  const state = loadState();

  if (!state.contractAddress) {
    res.status(400).json({ error: "Contract not yet deployed. Call /api/starknet/deploy first." });
    return;
  }

  try {
    const sierra = JSON.parse(readFileSync(SIERRA_PATH, "utf-8"));
    const contract = new Contract(sierra.abi as Abi, state.contractAddress, account);

    const farmerIdFelt = cairo.felt(farmerId);
    const calldata = CallData.compile({
      farmer_id: farmerIdFelt,
      drought_moisture_threshold: cairo.uint256(droughtThreshold),
      heat_temp_threshold: cairo.uint256(heatThreshold),
    });

    const resp = await getAccount().execute({
      contractAddress: state.contractAddress,
      entrypoint: "register_policy",
      calldata,
    });
    await provider.waitForTransaction(resp.transaction_hash);

    const { blockNumber, networkLive } = await getLiveBlock();
    state.policies[farmerId] = {
      farmerId, droughtThreshold, heatThreshold,
      registeredAt: new Date().toISOString(),
      txHash: resp.transaction_hash,
    };
    saveState(state);

    await logEvent("starknet", `Policy registered — farmer=${farmerId} drought<${droughtThreshold}% heat>${heatThreshold}°C | tx=${resp.transaction_hash.slice(0, 18)} | block=${blockNumber}`);

    res.json({
      success: true, farmerId, droughtThreshold, heatThreshold,
      txHash: resp.transaction_hash,
      txUrl: `${STARKSCAN_BASE}/tx/${resp.transaction_hash}`,
      contractAddress: state.contractAddress,
      explorerUrl: `${STARKSCAN_BASE}/contract/${state.contractAddress}`,
      blockNumber, network: NETWORK_NAME, networkLive,
      registeredAt: state.policies[farmerId].registeredAt,
    });
  } catch (err: any) {
    console.error("[Starknet] Register policy error:", err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

/** POST /api/starknet/submit-claim — Trigger parametric claim from sensor data */
router.post("/starknet/submit-claim", async (req, res): Promise<void> => {
  const {
    farmerId = "SmartFasal_Farm_001",
    ph = 6.5, nitrogen = 45, phosphorus = 30, potassium = 40,
    moisture, temperature,
  } = req.body;

  const state = loadState();
  if (!state.contractAddress) {
    res.status(400).json({ error: "Contract not deployed. Call /api/starknet/deploy first." });
    return;
  }

  const policy = state.policies[farmerId];
  if (!policy) {
    res.status(400).json({ error: "No policy registered for this farmer. Call /api/starknet/register-policy first." });
    return;
  }

  // Determine trigger from sensor data
  const isDrought   = moisture   !== undefined && moisture   < policy.droughtThreshold;
  const isHeat      = temperature !== undefined && temperature > policy.heatThreshold;
  if (!isDrought && !isHeat) {
    const { blockNumber, networkLive } = await getLiveBlock();
    res.json({
      triggered: false,
      reason: `Conditions normal — moisture=${moisture}% (threshold <${policy.droughtThreshold}%), temp=${temperature}°C (threshold >${policy.heatThreshold}°C)`,
      blockNumber, network: NETWORK_NAME, networkLive,
    });
    return;
  }

  const trigger    = isDrought ? "drought" : "heat_stress";
  const soilHash   = computeSoilHash(ph, nitrogen, phosphorus, potassium, moisture ?? 0);

  try {
    const farmerIdFelt  = cairo.felt(farmerId);
    const triggerFelt   = cairo.felt(trigger);
    const soilHashFelt  = cairo.felt(soilHash.slice(0, 31)); // felt252 max

    const calldata = CallData.compile({
      farmer_id:    farmerIdFelt,
      trigger:      triggerFelt,
      soil_data_hash: soilHashFelt,
      moisture:     cairo.uint256(Math.round(moisture ?? 0)),
      temperature:  cairo.uint256(Math.round(temperature ?? 0)),
    });

    const resp = await getAccount().execute({
      contractAddress: state.contractAddress,
      entrypoint: "submit_claim",
      calldata,
    });
    await provider.waitForTransaction(resp.transaction_hash);

    const { blockNumber, networkLive } = await getLiveBlock();
    const claimId = state.claims.length;
    const claimRecord = {
      claimId, farmerId, trigger, soilHash, moisture, temperature,
      txHash: resp.transaction_hash,
      timestamp: new Date().toISOString(),
    };
    state.claims.push(claimRecord);
    saveState(state);

    await logEvent("starknet", `Claim submitted ON-CHAIN — trigger=${trigger} moisture=${moisture}% temp=${temperature}°C hash=${soilHash.slice(0, 18)} tx=${resp.transaction_hash.slice(0, 18)} block=${blockNumber}`);

    res.json({
      triggered: true, trigger, claimId,
      soilDataHash: soilHash,
      txHash: resp.transaction_hash,
      txUrl: `${STARKSCAN_BASE}/tx/${resp.transaction_hash}`,
      contractAddress: state.contractAddress,
      explorerUrl: `${STARKSCAN_BASE}/contract/${state.contractAddress}`,
      blockNumber, network: NETWORK_NAME, networkLive,
      moisture, temperature, farmerId,
      timestamp: claimRecord.timestamp,
      message: `${trigger === "drought" ? "Drought" : "Heat stress"} confirmed on-chain. Parametric payout triggered automatically.`,
    });
  } catch (err: any) {
    console.error("[Starknet] Submit claim error:", err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

/** POST /api/starknet/generate-proof — ZK-style soil data proof (ECDSA on Starknet curve) */
router.post("/starknet/generate-proof", async (req, res): Promise<void> => {
  const { ph, nitrogen, phosphorus, potassium, moisture, claimType } = req.body;
  if (!ph || !nitrogen) { res.status(400).json({ error: "Soil data required" }); return; }

  type ClaimType = "ph_healthy" | "no_drought" | "yield_insurable";
  const CLAIM_CHECKS: Record<ClaimType, (d: typeof req.body) => boolean> = {
    ph_healthy:       d => d.ph >= 6.0 && d.ph <= 7.5,
    no_drought:       d => d.moisture > 40,
    yield_insurable:  d => (d.nitrogen * 0.4 + d.phosphorus * 0.3 + d.potassium * 0.3) > 40,
  };
  const CLAIM_LABELS: Record<ClaimType, string> = {
    ph_healthy:      "Soil pH healthy (6.0–7.5)",
    no_drought:      "Moisture > 40% — no drought stress",
    yield_insurable: "NPK score ≥ 70% — insurable",
  };

  const soilHash  = computeSoilHash(ph, nitrogen, phosphorus, potassium, moisture);
  const sig       = ec.starkCurve.sign(soilHash, PRIV_KEY);
  const sigR      = "0x" + sig.r.toString(16).padStart(64, "0");
  const sigS      = "0x" + sig.s.toString(16).padStart(64, "0");
  const pubKey    = ec.starkCurve.getStarkKey(PRIV_KEY);
  const verified  = CLAIM_CHECKS[claimType as ClaimType]?.(req.body) ?? false;
  const claim     = CLAIM_LABELS[claimType as ClaimType] ?? claimType;
  const { blockNumber, blockHash, networkLive } = await getLiveBlock();

  await logEvent("starknet", `Proof generated — ${claim} | verified=${verified} | hash=${soilHash.slice(0, 18)} | block=${blockNumber}`);

  res.json({
    proofHash: soilHash, sigR, sigS, publicKey: pubKey, walletAddress: WALLET_ADDR,
    blockNumber, blockHash, networkLive, verified, claim, claimType,
    explorerUrl: `${STARKSCAN_BASE}/contract/${WALLET_ADDR}`,
    network: NETWORK_NAME, generatedAt: new Date().toISOString(),
  });
});

/** POST /api/starknet/carbon-credit/mint */
router.post("/starknet/carbon-credit/mint", async (req, res): Promise<void> => {
  const { ph, nitrogen, phosphorus, potassium, moisture } = req.body;
  try {
    const phScore      = (ph >= 6.0 && ph <= 7.5) ? 1.0 : 0.65;
    const moistScore   = moisture > 60 ? 1.0 : moisture > 40 ? 0.8 : 0.45;
    const npkTotal     = (nitrogen ?? 0) + (phosphorus ?? 0) + (potassium ?? 0);
    const npkScore     = npkTotal > 120 ? 1.0 : npkTotal > 80 ? 0.8 : 0.55;
    const healthScore  = phScore * 0.4 + moistScore * 0.35 + npkScore * 0.25;
    const co2Kg        = Math.round(164 * healthScore * 10) / 10;
    const valueINR     = Math.round(co2Kg * 4);
    const soilHash     = computeSoilHash(ph, nitrogen, phosphorus, potassium, moisture);
    const sig          = ec.starkCurve.sign(soilHash, PRIV_KEY);
    const sigR         = "0x" + sig.r.toString(16).padStart(64, "0");
    const sigS         = "0x" + sig.s.toString(16).padStart(64, "0");
    const tokenId      = soilHash.slice(2, 18).toUpperCase();
    const { blockNumber, networkLive } = await getLiveBlock();

    await logEvent("starknet", `Carbon credit — co2=${co2Kg}kg ₹${valueINR} health=${Math.round(healthScore * 100)}% block=${blockNumber}`);

    res.json({
      tokenId, co2Kg, valueINR,
      healthScore: Math.round(healthScore * 100),
      proofHash: soilHash, sigR, sigS,
      publicKey: ec.starkCurve.getStarkKey(PRIV_KEY),
      walletAddress: WALLET_ADDR,
      blockNumber, networkLive,
      mintedAt: new Date().toISOString(),
      explorerUrl: `${STARKSCAN_BASE}/contract/${WALLET_ADDR}`,
      network: NETWORK_NAME,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** GET /api/starknet/claims — All recorded on-chain claims */
router.get("/starknet/claims", async (_req, res): Promise<void> => {
  const state = loadState();
  const { blockNumber, networkLive } = await getLiveBlock();
  res.json({
    claims: state.claims,
    totalClaims: state.claims.length,
    contractAddress: state.contractAddress,
    explorerUrl: state.contractAddress ? `${STARKSCAN_BASE}/contract/${state.contractAddress}` : null,
    blockNumber, networkLive, network: NETWORK_NAME,
  });
});

export default router;
