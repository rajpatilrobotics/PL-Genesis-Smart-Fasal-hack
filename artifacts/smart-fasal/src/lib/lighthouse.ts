
let cachedApiKey: string | null = null;
let cacheChecked = false;

const UPLOAD_TIMEOUT_MS = 12000;

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export async function lighthouseUpload(
  dataType: string,
  data: object
): Promise<{ cid: string; url: string; real: boolean }> {
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
      const blob = new Blob([payload], { type: "application/json" });
      formData.append("file", blob, fileName);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      const doUpload = fetch("https://node.lighthouse.storage/api/v0/add", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: controller.signal,
      });

      const res = await withTimeout(doUpload, UPLOAD_TIMEOUT_MS).finally(() =>
        clearTimeout(timeoutId)
      );

      if (!res.ok) throw new Error(`Lighthouse HTTP ${res.status}`);
      const result = (await res.json()) as { Hash?: string };
      const cid = result.Hash;
      if (!cid) throw new Error("No CID in response");

      console.log(`[Lighthouse] ✅ Real upload — CID: ${cid}`);
      return {
        cid,
        url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
        real: true,
      };
    } catch (err) {
      console.warn("[Lighthouse] Upload failed, falling back to simulated:", err);
    }
  }

  return { cid: "", url: "", real: false };
}
