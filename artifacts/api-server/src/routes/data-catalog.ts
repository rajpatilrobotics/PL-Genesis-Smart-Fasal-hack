import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dataCatalogTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

async function uploadToLighthouse(payload: object): Promise<{ cid: string; url: string; real: boolean }> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (apiKey) {
    try {
      const body_str = JSON.stringify(payload);
      const fileName = `smartfasal-dataset-${Date.now()}.json`;
      const boundary = `----FormBoundary${crypto.randomBytes(8).toString("hex")}`;
      const body = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
        "Content-Type: application/json",
        "",
        body_str,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await fetch("https://node.lighthouse.storage/api/v0/add", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      if (response.ok) {
        const result = (await response.json()) as { Hash?: string };
        if (result.Hash) {
          return { cid: result.Hash, url: `https://gateway.lighthouse.storage/ipfs/${result.Hash}`, real: true };
        }
      }
    } catch {
    }
  }

  const hash = crypto.createHash("sha256").update(JSON.stringify(payload) + Date.now()).digest("hex");
  const cid = `bafybeig${hash.substring(0, 46)}`;
  return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
}

router.post("/data-catalog/publish", async (req, res): Promise<void> => {
  const {
    farmerWallet,
    location,
    device,
    recordCount,
    avgNitrogen,
    avgPhosphorus,
    avgPotassium,
    avgPh,
    avgMoisture,
  } = req.body as {
    farmerWallet?: string;
    location?: string;
    device?: string;
    recordCount: number;
    avgNitrogen: number;
    avgPhosphorus: number;
    avgPotassium: number;
    avgPh: number;
    avgMoisture: number;
  };

  const loc = location ?? "India";
  const dev = device ?? "ESP32-FARM-001";

  const datasetPayload = {
    schema: "smartfasal/soil-sensor/v1",
    source: "SmartFasal Platform",
    device: dev,
    location: loc,
    farmerWallet: farmerWallet ?? "anonymous",
    recordCount,
    averages: {
      nitrogen_mg_per_kg: avgNitrogen,
      phosphorus_mg_per_kg: avgPhosphorus,
      potassium_mg_per_kg: avgPotassium,
      soil_ph: avgPh,
      moisture_percent: avgMoisture,
    },
    license: "CC BY 4.0 — Open Data",
    publishedAt: new Date().toISOString(),
  };

  const { cid, url, real } = await uploadToLighthouse(datasetPayload);

  const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const title = `Soil Dataset · ${loc} · ${dateStr}`;

  const [entry] = await db.insert(dataCatalogTable).values({
    datasetTitle: title,
    farmerWallet: farmerWallet ?? null,
    location: loc,
    device: dev,
    recordCount,
    avgNitrogen,
    avgPhosphorus,
    avgPotassium,
    avgPh,
    avgMoisture,
    cid,
    ipfsUrl: url,
    isReal: real ? "true" : "false",
    accessCount: 0,
  }).returning();

  res.json({ ...entry, real });
});

router.get("/data-catalog", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(dataCatalogTable)
    .orderBy(desc(dataCatalogTable.createdAt))
    .limit(20);

  res.json(rows);
});

router.post("/data-catalog/:id/access", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db
    .update(dataCatalogTable)
    .set({ accessCount: sql`${dataCatalogTable.accessCount} + 1` })
    .where(sql`${dataCatalogTable.id} = ${id}`);
  res.json({ ok: true });
});

export default router;
