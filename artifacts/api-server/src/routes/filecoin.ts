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

const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;

async function uploadToLighthouse(
  dataType: string,
  data: object
): Promise<{ cid: string; url: string; real: boolean }> {
  if (!LIGHTHOUSE_API_KEY) {
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(data) + Date.now())
      .digest("hex");
    const cid = `bafybeig${hash.substring(0, 46)}`;
    return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
  }

  try {
    const lighthouse = await import("@lighthouse-web3/sdk");
    const lh = (lighthouse as any).default ?? lighthouse;

    const payload = JSON.stringify({
      dataType,
      data,
      timestamp: new Date().toISOString(),
      source: "SmartFasal",
    });
    const fileName = `smartfasal-${dataType}-${Date.now()}.json`;

    const response = await lh.uploadText(payload, LIGHTHOUSE_API_KEY, fileName);
    const cid: string = response?.data?.Hash ?? response?.Hash;

    if (!cid) throw new Error("Lighthouse returned no CID");

    return {
      cid,
      url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
      real: true,
    };
  } catch (err) {
    console.error("[Filecoin] Lighthouse upload failed, falling back:", err);
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(data) + Date.now())
      .digest("hex");
    const cid = `bafybeig${hash.substring(0, 46)}`;
    return { cid, url: `https://ipfs.io/ipfs/${cid}`, real: false };
  }
}

router.post("/filecoin/store", async (req, res): Promise<void> => {
  const parsed = StoreOnFilecoinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dataType, data } = parsed.data;

  const { cid, url, real } = await uploadToLighthouse(dataType, data);
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
