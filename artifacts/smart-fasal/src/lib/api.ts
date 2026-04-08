const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function apiFetch(path: string, options?: RequestInit, retries = 3): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(apiUrl(path), {
        ...options,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      return res.json();
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

// Wakes up the Render backend if it's sleeping — called once on app start
export async function wakeUpServer(): Promise<void> {
  if (!API_BASE) return;
  try {
    await fetch(apiUrl("/api/healthz"), { method: "GET", credentials: "include" });
  } catch {
    // Silent — server is starting up, retries in apiFetch will handle it
  }
}
