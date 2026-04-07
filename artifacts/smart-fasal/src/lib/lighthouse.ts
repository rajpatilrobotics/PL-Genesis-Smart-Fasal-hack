import { apiUrl } from "@/lib/api";

let cachedApiKey: string | null = null;
let cacheChecked = false;
let lighthouseReachable: boolean | null = null;

const UPLOAD_TIMEOUT_MS = 3000;

async function getApiKey(): Promise<string | null> {
  if (cacheChecked) return cachedApiKey;
  try {
    const res = await fetch(apiUrl("/api/filecoin/upload-token"));
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

async function doLighthouseUpload(
  formData: FormData,
  apiKey: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch("https://node.lighthouse.storage/api/v0/add", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = (await res.json()) as { Hash?: string };
    return result.Hash ?? null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function simulateCid(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `bafybeig${hex}${Date.now().toString(16)}${"0".repeat(30)}`.substring(0, 59);
}

export async function lighthouseUpload(
  dataType: string,
  data: object
): Promise<{ cid: string; url: string; real: boolean }> {
  if (lighthouseReachable === false) {
    const cid = simulateCid(dataType + JSON.stringify(data));
    return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
  }

  const apiKey = await getApiKey();
  if (apiKey) {
    try {
      const payload = JSON.stringify({ dataType, data, timestamp: new Date().toISOString(), source: "SmartFasal" });
      const formData = new FormData();
      formData.append("file", new Blob([payload], { type: "application/json" }), `smartfasal-${dataType}-${Date.now()}.json`);
      const cid = await doLighthouseUpload(formData, apiKey);
      if (!cid) throw new Error("No CID");
      lighthouseReachable = true;
      console.log(`[Lighthouse] ✅ Real upload — CID: ${cid}`);
      return { cid, url: `https://gateway.lighthouse.storage/ipfs/${cid}`, real: true };
    } catch (err) {
      lighthouseReachable = false;
      console.warn("[Lighthouse] Upload failed, falling back to simulated:", err);
    }
  }

  const cid = simulateCid(dataType + JSON.stringify(data));
  return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
}

export async function lighthouseUploadFile(
  file: File
): Promise<{ cid: string; url: string; real: boolean }> {
  if (lighthouseReachable === false) {
    const cid = simulateCid(file.name + file.size);
    return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
  }

  const apiKey = await getApiKey();
  if (apiKey) {
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const cid = await doLighthouseUpload(formData, apiKey);
      if (!cid) throw new Error("No CID");
      lighthouseReachable = true;
      console.log(`[Lighthouse] ✅ File uploaded — CID: ${cid}`);
      return { cid, url: `https://gateway.lighthouse.storage/ipfs/${cid}`, real: true };
    } catch (err) {
      lighthouseReachable = false;
      console.warn("[Lighthouse] File upload failed:", err);
    }
  }

  const cid = simulateCid(file.name + file.size);
  return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
}
