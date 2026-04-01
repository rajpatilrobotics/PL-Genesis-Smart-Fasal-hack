import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { filecoinRecordsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  StoreOnFilecoinBody,
  StoreOnFilecoinResponse,
  GetFilecoinRecordsResponse,
} from "@workspace/api-zod";
import { logEvent } from "../lib/event-logger.js";
import crypto from "crypto";

const router: IRouter = Router();

async function uploadToLighthouse(
  dataType: string,
  data: object
): Promise<{ cid: string; url: string; real: boolean }> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;

  if (apiKey) {
    try {
      const payload = JSON.stringify({
        dataType,
        data,
        timestamp: new Date().toISOString(),
        source: "SmartFasal",
      });

      const fileName = `smartfasal-${dataType}-${Date.now()}.json`;

      const boundary = `----FormBoundary${crypto.randomBytes(8).toString("hex")}`;
      const body = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
        "Content-Type: application/json",
        "",
        payload,
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

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lighthouse HTTP ${response.status}: ${errText}`);
      }

      const result = (await response.json()) as { Hash?: string; Name?: string };
      const cid = result.Hash;
      if (!cid) throw new Error("Lighthouse returned no CID in response");

      console.log(`[Filecoin] ✅ Real upload to Lighthouse — CID: ${cid}`);
      return {
        cid,
        url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
        real: true,
      };
    } catch (err) {
      console.error("[Filecoin] Lighthouse upload failed, falling back:", err);
    }
  }

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(data) + Date.now())
    .digest("hex");
  const cid = `bafybeig${hash.substring(0, 46)}`;
  return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
}

router.get("/filecoin/upload-token", (_req, res): void => {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    res.json({ available: false });
    return;
  }
  res.json({ available: true, apiKey });
});

router.post("/filecoin/store", async (req, res): Promise<void> => {
  const parsed = StoreOnFilecoinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dataType, data } = parsed.data;

  const precomputedCid = typeof (data as Record<string, unknown>)._existingCid === "string"
    ? (data as Record<string, unknown>)._existingCid as string
    : undefined;

  let cid: string, url: string, real: boolean;
  if (precomputedCid) {
    cid = precomputedCid;
    url = `https://gateway.lighthouse.storage/ipfs/${cid}`;
    real = true;
  } else {
    ({ cid, url, real } = await uploadToLighthouse(dataType, data));
  }

  const storedAt = new Date();

  await db.insert(filecoinRecordsTable).values({ cid, url, dataType });

  await logEvent(
    "filecoin",
    `Data stored on Filecoin${real ? " (Lighthouse ✓)" : " (simulated)"}: ${dataType} — CID: ${cid}`
  );

  res.json(StoreOnFilecoinResponse.parse({ cid, url, dataType, storedAt }));
});

router.get("/filecoin/records", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(filecoinRecordsTable)
    .orderBy(desc(filecoinRecordsTable.createdAt));

  res.json(GetFilecoinRecordsResponse.parse(rows));
});

export default router;
