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

// Simulate a Filecoin/IPFS CID generation
function generateCid(data: object): string {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(data) + Date.now())
    .digest("hex");
  return `bafybeig${hash.substring(0, 46)}`;
}

router.post("/filecoin/store", async (req, res): Promise<void> => {
  const parsed = StoreOnFilecoinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dataType, data } = parsed.data;

  // Generate a simulated CID (in production this would use web3.storage)
  const cid = generateCid({ dataType, data });
  const url = `https://ipfs.io/ipfs/${cid}`;
  const storedAt = new Date();

  // Save record to DB
  await db.insert(filecoinRecordsTable).values({
    cid,
    url,
    dataType,
  });

  await logEvent("filecoin", `Data stored on Filecoin: ${dataType} - CID: ${cid}`);

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
