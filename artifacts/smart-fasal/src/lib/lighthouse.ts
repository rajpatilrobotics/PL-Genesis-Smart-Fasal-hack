
let cachedApiKey: string | null = null;
let cacheChecked = false;
let lighthouseReachable: boolean | null = null; // null = not tested yet

const UPLOAD_TIMEOUT_MS = 3000; // short timeout — if it doesn't respond in 3s, it's blocked

async function getApiKey(): Promise<string | null> {
  if (cacheChecked) return cachedApiKey;
  try {
    const res = await fetch("/api/filecoin/upload-token");
    if (!res.ok) return null;
    const json = (await res.json()) as { available: boolean; apiKey?: string };
    cachedApiKey = json.available && json.apiKey ? json.apiKey : null;
    cacheChecked = true;
    return cachedApiKey;
  } catch {
    cacheChecked = true;
    return null;
  }
}

export async function lighthouseUpload(
  dataType: string,
  data: object
): Promise<{ cid: string; url: string; real: boolean }> {
  // If we already know Lighthouse is unreachable, skip immediately
  if (lighthouseReachable === false) {
    return { cid: "", url: "", real: false };
  }

  const apiKey = await getApiKey();

  if (apiKey) {
    try {
      const payload = JSON.stringify({
        dataType,
        data,
        timestamp: new Date().toISOString(),
        source: "SmartFasal",
      });
      const fileName = `smartfasal-${dataType}-${Date.now()}.json`;
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([payload], { type: "application/json" }),
        fileName
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch("https://node.lighthouse.storage/api/v0/add", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) throw new Error(`Lighthouse HTTP ${res.status}`);
      const result = (await res.json()) as { Hash?: string };
      const cid = result.Hash;
      if (!cid) throw new Error("No CID in response");

      lighthouseReachable = true;
      console.log(`[Lighthouse] ✅ Real upload — CID: ${cid}`);
      return {
        cid,
        url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
        real: true,
      };
    } catch (err) {
      lighthouseReachable = false; // cache: don't try again this session
      console.warn("[Lighthouse] Upload failed, falling back to simulated:", err);
    }
  }

  return { cid: "", url: "", real: false };
}
