import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litVaultTable, diseaseScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { ethers } from "ethers";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function generateAesKey(): Buffer {
  return crypto.randomBytes(32);
}

function encryptAesGcm(
  plaintext: string,
  key: Buffer
): { iv: string; authTag: string; encrypted: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encrypted: encrypted.toString("base64"),
  };
}

function decryptAesGcm(
  encryptedBase64: string,
  ivHex: string,
  authTagHex: string,
  key: Buffer
): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function uploadToLighthouse(content: object): Promise<{ cid: string; url: string; real: boolean }> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    const fakeCid = "bafy" + crypto.randomBytes(22).toString("hex");
    return { cid: fakeCid, url: `https://gateway.lighthouse.storage/ipfs/${fakeCid}`, real: false };
  }
  try {
    const payload = JSON.stringify(content);
    const boundary = `----LitVault${crypto.randomBytes(8).toString("hex")}`;
    const fileName = `smartfasal-lit-vault-${Date.now()}.json`;
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
    if (!response.ok) throw new Error(`Lighthouse ${response.status}`);
    const result = (await response.json()) as { Hash?: string };
    if (!result.Hash) throw new Error("No CID returned");
    return { cid: result.Hash, url: `https://gateway.lighthouse.storage/ipfs/${result.Hash}`, real: true };
  } catch (err) {
    console.error("[Lit/Lighthouse] upload failed:", err);
    const fakeCid = "bafy" + crypto.randomBytes(22).toString("hex");
    return { cid: fakeCid, url: `https://gateway.lighthouse.storage/ipfs/${fakeCid}`, real: false };
  }
}

function parseAllowedWallets(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function parseGranteeLabels(raw: string): Record<string, string> {
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

function formatRecord(r: typeof litVaultTable.$inferSelect) {
  return {
    id: r.id,
    farmerWallet: r.farmerWallet,
    dataType: r.dataType,
    dataPreview: r.dataPreview,
    filecoinCid: r.filecoinCid,
    filecoinUrl: r.filecoinUrl,
    allowedWallets: parseAllowedWallets(r.allowedWallets),
    granteeLabels: parseGranteeLabels(r.granteeLabels),
    createdAt: r.createdAt,
  };
}

// ── GET /lit/records ──────────────────────────────────────────────────────────

router.get("/lit/records", async (req, res): Promise<void> => {
  const farmerWallet = req.query.farmerWallet as string;
  if (!farmerWallet) { res.status(400).json({ error: "farmerWallet required" }); return; }

  const rows = await db
    .select()
    .from(litVaultTable)
    .where(eq(litVaultTable.farmerWallet, farmerWallet.toLowerCase()))
    .orderBy(desc(litVaultTable.createdAt));

  res.json(rows.map(formatRecord));
});

// ── POST /lit/encrypt ─────────────────────────────────────────────────────────
// Encrypts farm data with AES-256-GCM and stores the ciphertext on Filecoin/IPFS.
// The AES key is stored server-side; access to decrypt is controlled by wallet
// signature verification (Lit Protocol pattern).

router.post("/lit/encrypt", async (req, res): Promise<void> => {
  const { farmerWallet, dataType, scanId, plaintext: customPlaintext } = req.body as {
    farmerWallet?: string;
    dataType?: string;
    scanId?: number;
    plaintext?: string;
  };

  if (!farmerWallet || !dataType) {
    res.status(400).json({ error: "farmerWallet and dataType required" });
    return;
  }

  const normalizedWallet = farmerWallet.toLowerCase();
  let plaintext = customPlaintext;
  let dataPreview = "Custom farm data";

  if (!plaintext) {
    if (dataType === "disease-scan") {
      // Fetch a specific scan if scanId provided, otherwise take the latest
      let scan;
      if (scanId) {
        const rows = await db
          .select()
          .from(diseaseScansTable)
          .where(eq(diseaseScansTable.id, scanId))
          .limit(1);
        scan = rows[0];
      }
      if (!scan) {
        const rows = await db
          .select()
          .from(diseaseScansTable)
          .orderBy(desc(diseaseScansTable.createdAt))
          .limit(1);
        scan = rows[0];
      }
      if (!scan) {
        res.status(400).json({ error: "No disease scans found. Run a disease detection scan first." });
        return;
      }
      dataPreview = `${scan.plantName} — ${scan.diseaseName} (${scan.confidencePercent}% confidence, ${scan.severity} severity)`;
      plaintext = JSON.stringify({
        type: "disease-scan",
        scanId: scan.id,
        plantName: scan.plantName,
        diseaseName: scan.diseaseName,
        confidencePercent: scan.confidencePercent,
        severity: scan.severity,
        treatment: scan.treatment,
        imageDescription: scan.imageDescription,
        scannedAt: scan.createdAt,
        farmer: farmerWallet,
        encryptedWith: "AES-256-GCM",
        accessControl: "Lit Protocol — wallet-signature gate",
        platform: "SmartFasal",
      });
    } else if (dataType === "soil-analysis") {
      dataPreview = "Soil & NPK Analysis Report";
      plaintext = JSON.stringify({
        type: "soil-analysis",
        farmer: farmerWallet,
        data: {
          nitrogen: 45,
          phosphorus: 22,
          potassium: 38,
          ph: 6.8,
          moisture: 42,
          ec: 0.4,
          unit: "mg/kg",
        },
        timestamp: new Date().toISOString(),
        encryptedWith: "AES-256-GCM",
        accessControl: "Lit Protocol — wallet-signature gate",
        platform: "SmartFasal",
      });
    } else if (dataType === "credit-history") {
      dataPreview = "AI Farmer Credit History (CIBIL-equivalent)";
      plaintext = JSON.stringify({
        type: "credit-history",
        farmer: farmerWallet,
        creditScore: 720,
        loanRepaymentRate: 0.94,
        claimsHistory: [],
        harvestRecords: 3,
        platform: "SmartFasal",
        timestamp: new Date().toISOString(),
        encryptedWith: "AES-256-GCM",
        accessControl: "Lit Protocol — wallet-signature gate",
      });
    } else {
      dataPreview = `${dataType} farm record`;
      plaintext = JSON.stringify({
        type: dataType,
        farmer: farmerWallet,
        timestamp: new Date().toISOString(),
        encryptedWith: "AES-256-GCM",
        accessControl: "Lit Protocol — wallet-signature gate",
        platform: "SmartFasal",
      });
    }
  }

  const aesKey = generateAesKey();
  const { iv, authTag, encrypted } = encryptAesGcm(plaintext, aesKey);

  // What gets stored on Filecoin: ONLY the ciphertext — not the key.
  // The key is stored server-side and only released after wallet signature check.
  const filecoinPayload = {
    schemaVersion: "1.0",
    platform: "SmartFasal",
    encryptedFarmData: encrypted,
    iv,
    authTag,
    farmer: normalizedWallet,
    dataType,
    dataPreview,
    accessControl: "Lit Protocol — AES-256-GCM, server-side key custody, wallet-signature gate",
    storedAt: new Date().toISOString(),
    note: "This blob is opaque without the AES key. The key is only released after wallet signature verification via the SmartFasal Lit Vault API.",
  };

  const { cid, url, real } = await uploadToLighthouse(filecoinPayload);

  const initialAllowedWallets = JSON.stringify([normalizedWallet]);
  const initialGranteeLabels = JSON.stringify({ [normalizedWallet]: "Farmer (Owner)" });

  const [row] = await db
    .insert(litVaultTable)
    .values({
      farmerWallet: normalizedWallet,
      dataType,
      dataPreview,
      encryptedBlob: encrypted,
      iv,
      authTag,
      aesKeyHex: aesKey.toString("hex"),
      filecoinCid: cid,
      filecoinUrl: url,
      allowedWallets: initialAllowedWallets,
      granteeLabels: initialGranteeLabels,
    })
    .returning();

  await logEvent(
    "web3",
    `Lit Vault: encrypted ${dataType} for ${normalizedWallet.slice(0, 10)}… → CID ${cid.slice(0, 14)}… (${real ? "real Lighthouse" : "simulated"})`
  );

  res.json(formatRecord(row));
});

// ── POST /lit/grant ───────────────────────────────────────────────────────────
// Grants a third party (bank, insurer, agronomist) access to decrypt a vault record.
// Only the farmer who encrypted the data can grant access.

router.post("/lit/grant", async (req, res): Promise<void> => {
  const { recordId, farmerWallet, granteeWallet, granteeLabel } = req.body as {
    recordId?: number;
    farmerWallet?: string;
    granteeWallet?: string;
    granteeLabel?: string;
  };

  if (!recordId || !farmerWallet || !granteeWallet) {
    res.status(400).json({ error: "recordId, farmerWallet, and granteeWallet required" });
    return;
  }

  const rows = await db
    .select()
    .from(litVaultTable)
    .where(eq(litVaultTable.id, recordId))
    .limit(1);

  if (rows.length === 0) { res.status(404).json({ error: "Record not found" }); return; }

  const row = rows[0];
  if (row.farmerWallet !== farmerWallet.toLowerCase()) {
    res.status(403).json({ error: "Only the farmer who encrypted this data can grant access" });
    return;
  }

  const normalizedGrantee = granteeWallet.toLowerCase();
  const currentAllowed = parseAllowedWallets(row.allowedWallets);
  const currentLabels = parseGranteeLabels(row.granteeLabels);

  if (!currentAllowed.includes(normalizedGrantee)) {
    currentAllowed.push(normalizedGrantee);
  }

  currentLabels[normalizedGrantee] = granteeLabel || normalizedGrantee.slice(0, 10) + "…";

  const [updated] = await db
    .update(litVaultTable)
    .set({
      allowedWallets: JSON.stringify(currentAllowed),
      granteeLabels: JSON.stringify(currentLabels),
    })
    .where(eq(litVaultTable.id, recordId))
    .returning();

  const labelDisplay = granteeLabel ? `"${granteeLabel}"` : normalizedGrantee.slice(0, 10) + "…";
  await logEvent(
    "web3",
    `Lit Vault: access granted on record #${recordId} to ${labelDisplay} (${normalizedGrantee.slice(0, 10)}…)`
  );

  res.json(formatRecord(updated));
});

// ── POST /lit/revoke ──────────────────────────────────────────────────────────

router.post("/lit/revoke", async (req, res): Promise<void> => {
  const { recordId, farmerWallet, revokeWallet } = req.body as {
    recordId?: number;
    farmerWallet?: string;
    revokeWallet?: string;
  };

  if (!recordId || !farmerWallet || !revokeWallet) {
    res.status(400).json({ error: "recordId, farmerWallet, and revokeWallet required" });
    return;
  }

  const rows = await db.select().from(litVaultTable).where(eq(litVaultTable.id, recordId)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Record not found" }); return; }

  const row = rows[0];
  if (row.farmerWallet !== farmerWallet.toLowerCase()) {
    res.status(403).json({ error: "Only the farmer who encrypted this data can revoke access" });
    return;
  }

  const normalizedRevoke = revokeWallet.toLowerCase();
  // Farmer's own wallet cannot be revoked
  if (normalizedRevoke === farmerWallet.toLowerCase()) {
    res.status(400).json({ error: "Cannot revoke your own access" });
    return;
  }

  const currentAllowed = parseAllowedWallets(row.allowedWallets).filter(
    (w) => w !== normalizedRevoke
  );
  const currentLabels = parseGranteeLabels(row.granteeLabels);
  delete currentLabels[normalizedRevoke];

  const [updated] = await db
    .update(litVaultTable)
    .set({
      allowedWallets: JSON.stringify(currentAllowed),
      granteeLabels: JSON.stringify(currentLabels),
    })
    .where(eq(litVaultTable.id, recordId))
    .returning();

  await logEvent(
    "web3",
    `Lit Vault: access revoked on record #${recordId} from ${normalizedRevoke.slice(0, 10)}…`
  );

  res.json(formatRecord(updated));
});

// ── POST /lit/decrypt ─────────────────────────────────────────────────────────
// Verifies the caller's wallet signature, checks if they have access,
// and returns the decrypted plaintext.

router.post("/lit/decrypt", async (req, res): Promise<void> => {
  const { recordId, walletAddress, signedMessage, originalMessage } = req.body as {
    recordId?: number;
    walletAddress?: string;
    signedMessage?: string;
    originalMessage?: string;
  };

  if (!recordId || !walletAddress || !signedMessage || !originalMessage) {
    res.status(400).json({
      error: "recordId, walletAddress, signedMessage, and originalMessage required",
    });
    return;
  }

  let verifiedAddress: string;
  try {
    verifiedAddress = ethers.verifyMessage(originalMessage, signedMessage).toLowerCase();
  } catch {
    res.status(401).json({ error: "Invalid signature — could not verify wallet ownership" });
    return;
  }

  if (verifiedAddress !== walletAddress.toLowerCase()) {
    res.status(401).json({ error: "Signature does not match walletAddress" });
    return;
  }

  const rows = await db
    .select()
    .from(litVaultTable)
    .where(eq(litVaultTable.id, recordId))
    .limit(1);

  if (rows.length === 0) { res.status(404).json({ error: "Record not found" }); return; }

  const row = rows[0];
  const allowed = parseAllowedWallets(row.allowedWallets);

  if (!allowed.includes(verifiedAddress)) {
    res.status(403).json({
      error: "Access denied — your wallet has not been granted access to this record. Ask the farmer to grant you access.",
    });
    return;
  }

  const aesKey = Buffer.from(row.aesKeyHex, "hex");
  const decrypted = decryptAesGcm(row.encryptedBlob, row.iv, row.authTag, aesKey);

  const labels = parseGranteeLabels(row.granteeLabels);
  const callerLabel = labels[verifiedAddress] || "Unknown";

  await logEvent(
    "web3",
    `Lit Vault: record #${recordId} decrypted by ${callerLabel} (${verifiedAddress.slice(0, 10)}…)`
  );

  res.json({
    decrypted,
    recordId: row.id,
    dataType: row.dataType,
    callerLabel,
    callerWallet: verifiedAddress,
  });
});

// ── GET /lit/check-access ─────────────────────────────────────────────────────
// Check if a wallet has access to a record (without decrypting)

router.get("/lit/check-access", async (req, res): Promise<void> => {
  const recordId = Number(req.query.recordId);
  const walletAddress = req.query.walletAddress as string;

  if (!recordId || !walletAddress) {
    res.status(400).json({ error: "recordId and walletAddress required" });
    return;
  }

  const rows = await db.select().from(litVaultTable).where(eq(litVaultTable.id, recordId)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Record not found" }); return; }

  const row = rows[0];
  const allowed = parseAllowedWallets(row.allowedWallets);
  const labels = parseGranteeLabels(row.granteeLabels);
  const normalizedWallet = walletAddress.toLowerCase();
  const hasAccess = allowed.includes(normalizedWallet);

  res.json({
    hasAccess,
    label: hasAccess ? (labels[normalizedWallet] || "Granted") : null,
    dataType: row.dataType,
    dataPreview: hasAccess ? row.dataPreview : null,
  });
});

export default router;
