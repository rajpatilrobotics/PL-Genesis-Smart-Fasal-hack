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
}

let fheKeyCache: FheKeyCache | null = null;

router.get("/fhe/public-key", async (_req, res) => {
  try {
    if (fheKeyCache && Date.now() - fheKeyCache.fetchedAt < CACHE_TTL_MS) {
      return res.json(fheKeyCache);
    }

    const keyurlRes = await fetch(`${GATEWAY_URL}keyurl`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
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
    };

    return res.json(fheKeyCache);
  } catch (err) {
    console.error("FHE gateway fetch error:", err);
    return res.status(503).json({ error: "FHE gateway unavailable", details: String(err) });
  }
});

export default router;
