
let cachedApiKey: string | null = null;
let cacheChecked = false;

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

      const res = await fetch("https://node.lighthouse.storage/api/v0/add", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

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
      console.warn("[Lighthouse] Client-side upload failed, falling back to server:", err);
    }
  }

  return { cid: "", url: "", real: false };
}
