import { Router } from "express";

const router = Router();

const GATEWAY_URL = "https://gateway.sepolia.zama.ai/";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface FheKeyCache {
  publicKey: string;
  publicKeyId: string;
  publicParams2048: string;
  publicParams2048Id: string;
  fetchedAt: number;
  simulated?: boolean;
}

let fheKeyCache: FheKeyCache | null = null;

function makeMockCache(): FheKeyCache {
  const rand = (len: number) =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
  return {
    publicKey: rand(512),
    publicKeyId: `sim-pk-${Date.now()}`,
    publicParams2048: rand(1024),
    publicParams2048Id: `sim-pp-${Date.now()}`,
    fetchedAt: Date.now(),
    simulated: true,
  };
}

router.get("/fhe/public-key", async (_req, res) => {
  try {
    if (fheKeyCache && Date.now() - fheKeyCache.fetchedAt < CACHE_TTL_MS) {
      return res.json(fheKeyCache);
    }

    const keyurlRes = await fetch(`${GATEWAY_URL}keyurl`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!keyurlRes.ok) throw new Error(`Gateway keyurl returned ${keyurlRes.status}`);

    const data = await keyurlRes.json() as {
      response: {
        fhe_key_info: { fhe_public_key: { urls: string[]; data_id: string } }[];
        crs: { "2048": { urls: string[]; data_id: string } };
      };
    };

    const keyInfo = data.response.fhe_key_info[0];
    const pubKeyUrl = keyInfo.fhe_public_key.urls[0];
    const publicKeyId = keyInfo.fhe_public_key.data_id;

    const publicParamsUrl = data.response.crs["2048"].urls[0];
    const publicParams2048Id = data.response.crs["2048"].data_id;

    const [pubKeyBuf, paramsBuf] = await Promise.all([
      fetch(pubKeyUrl, { signal: AbortSignal.timeout(20000) }).then(r => r.arrayBuffer()),
      fetch(publicParamsUrl, { signal: AbortSignal.timeout(20000) }).then(r => r.arrayBuffer()),
    ]);

    const toHex = (buf: ArrayBuffer) => Buffer.from(buf).toString("hex");

    fheKeyCache = {
      publicKey: toHex(pubKeyBuf),
      publicKeyId,
      publicParams2048: toHex(paramsBuf),
      publicParams2048Id,
      fetchedAt: Date.now(),
      simulated: false,
    };

    return res.json(fheKeyCache);
  } catch (err) {
    console.warn("FHE gateway unreachable, using simulation mode:", (err as Error).message);
    fheKeyCache = makeMockCache();
    return res.json(fheKeyCache);
  }
});

export default router;
