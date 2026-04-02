import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { loanApplicationsTable, creditSeasonsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logEvent } from "../lib/event-logger.js";
import crypto from "crypto";

const router: IRouter = Router();

// ─── Lighthouse / IPFS upload helper ─────────────────────────────────────────

async function uploadToIPFS(
  dataType: string,
  payload: object
): Promise<{ cid: string | null; url: string | null; real: boolean }> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  const content = JSON.stringify(payload, null, 2);

  if (apiKey) {
    try {
      const fileName = `smartfasal-${dataType}-${Date.now()}.json`;
      const boundary = `----FormBoundary${crypto.randomBytes(8).toString("hex")}`;
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch("https://node.lighthouse.storage/api/v0/add", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Lighthouse HTTP ${response.status}`);
      const result = (await response.json()) as { Hash?: string };
      const cid = result.Hash;
      if (!cid) throw new Error("No CID returned");
      console.log(`[IPFS/Filecoin] ✅ Loan agreement on Lighthouse (Protocol Labs) — CID: ${cid}`);
      return { cid, url: `https://gateway.lighthouse.storage/ipfs/${cid}`, real: true };
    } catch (err) {
      console.error("[IPFS] Lighthouse unavailable for loan:", (err as Error).message);
    }
  }
  return { cid: null, url: null, real: false };
}

// ─── Loan tier logic (credit score → approved amount + rate) ─────────────────

function computeLoanTerms(creditScore: number, requestedAmount: number) {
  let maxAmount: number;
  let interestRate: number;
  let tenureMonths: number;

  if (creditScore >= 850) {
    maxAmount = 500000;
    interestRate = 7.0;
    tenureMonths = 36;
  } else if (creditScore >= 750) {
    maxAmount = 300000;
    interestRate = 9.5;
    tenureMonths = 24;
  } else if (creditScore >= 650) {
    maxAmount = 100000;
    interestRate = 12.0;
    tenureMonths = 18;
  } else if (creditScore >= 550) {
    maxAmount = 30000;
    interestRate = 16.0;
    tenureMonths = 12;
  } else {
    return null; // Not eligible
  }

  const approvedAmount = Math.min(requestedAmount, maxAmount);
  const monthlyRate = interestRate / 100 / 12;
  const emi = Math.round(
    (approvedAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  );

  return { approvedAmount, interestRate, tenureMonths, maxAmount, emi };
}

// ─── POST /api/loans/apply ────────────────────────────────────────────────────
// Applies for a microloan — credit score gates eligibility, agreement stored on IPFS

router.post("/loans/apply", async (req, res): Promise<void> => {
  const { farmerId = "default", requestedAmount, purpose } = req.body;

  if (!requestedAmount || !purpose) {
    res.status(400).json({ error: "requestedAmount and purpose are required" });
    return;
  }

  // Fetch current credit profile
  const seasons = await db
    .select()
    .from(creditSeasonsTable)
    .where(eq(creditSeasonsTable.farmerId, farmerId))
    .orderBy(desc(creditSeasonsTable.createdAt));

  if (seasons.length === 0) {
    res.status(400).json({
      error: "No credit history found. Submit at least one season to apply for a loan.",
      code: "NO_CREDIT_HISTORY",
    });
    return;
  }

  const creditScore = Math.round(
    seasons.reduce((a, s) => a + s.creditScore, 0) / seasons.length
  );

  const getRating = (s: number) =>
    s >= 850 ? "Excellent" : s >= 750 ? "Very Good" : s >= 650 ? "Good" : s >= 550 ? "Average" : "Poor";

  const terms = computeLoanTerms(creditScore, requestedAmount);

  if (!terms) {
    res.status(400).json({
      error: "Credit score too low for loan eligibility. Minimum score: 550.",
      creditScore,
      code: "INELIGIBLE",
    });
    return;
  }

  const { approvedAmount, interestRate, tenureMonths, maxAmount, emi } = terms;
  const creditRating = getRating(creditScore);

  // Build the loan agreement document — stored permanently on IPFS (Protocol Labs)
  const loanAgreement = {
    type: "SmartFasal-Filecoin-Microloan-Agreement",
    version: "1.0",
    agreementId: `SF-LOAN-${farmerId}-${Date.now()}`,
    platform: "SmartFasal — Decentralized Agriculture Finance",
    poweredBy: "Protocol Labs — IPFS + Filecoin via Lighthouse",
    farmer: {
      farmerId,
      creditScore,
      creditRating,
      seasonsOnRecord: seasons.length,
      dataVerifiedOn: "Filecoin/IPFS",
    },
    loan: {
      requestedAmount,
      approvedAmount,
      purpose,
      interestRatePercent: interestRate,
      tenureMonths,
      emiAmount: emi,
      currency: "INR",
      totalRepayable: emi * tenureMonths,
    },
    issuedAt: new Date().toISOString(),
    terms: [
      "Loan approved based on on-chain farming credit history archived on Filecoin.",
      "EMI due monthly. Repayment improves future credit score.",
      "This agreement is permanently stored on IPFS as immutable record.",
      "In case of crop failure, insurance claim offsets repayment.",
    ],
    network: "Filecoin-Calibration-Testnet",
  };

  const ipfsResult = await uploadToIPFS("loan-agreement", loanAgreement);

  const [row] = await db.insert(loanApplicationsTable).values({
    farmerId,
    creditScore,
    creditRating,
    requestedAmount,
    approvedAmount,
    interestRate,
    tenureMonths,
    purpose,
    status: "approved",
    ipfsCid: ipfsResult.cid ?? undefined,
    ipfsUrl: ipfsResult.url ?? undefined,
    emiAmount: emi,
  }).returning();

  await logEvent(
    "loan",
    `Loan approved: ${farmerId} | ₹${approvedAmount.toLocaleString()} @ ${interestRate}% | ${tenureMonths}mo${ipfsResult.cid ? ` | IPFS: ${ipfsResult.cid}` : ""}`
  );

  res.status(201).json({
    ...row,
    maxEligible: maxAmount,
    totalRepayable: emi * tenureMonths,
    ipfsReal: ipfsResult.real,
  });
});

// ─── GET /api/loans ───────────────────────────────────────────────────────────

router.get("/loans", async (req, res): Promise<void> => {
  const farmerId = (req.query.farmerId as string) || "default";
  const rows = await db
    .select()
    .from(loanApplicationsTable)
    .where(eq(loanApplicationsTable.farmerId, farmerId))
    .orderBy(desc(loanApplicationsTable.createdAt));
  res.json(rows);
});

// ─── GET /api/loans/eligibility ───────────────────────────────────────────────

router.get("/loans/eligibility", async (req, res): Promise<void> => {
  const farmerId = (req.query.farmerId as string) || "default";

  const seasons = await db
    .select()
    .from(creditSeasonsTable)
    .where(eq(creditSeasonsTable.farmerId, farmerId))
    .orderBy(desc(creditSeasonsTable.createdAt));

  if (seasons.length === 0) {
    res.json({ eligible: false, reason: "No credit history", creditScore: 0, maxAmount: 0 });
    return;
  }

  const creditScore = Math.round(
    seasons.reduce((a, s) => a + s.creditScore, 0) / seasons.length
  );

  const terms = computeLoanTerms(creditScore, 999999);

  if (!terms) {
    res.json({
      eligible: false,
      reason: "Credit score below 550 minimum threshold",
      creditScore,
      maxAmount: 0,
    });
    return;
  }

  res.json({
    eligible: true,
    creditScore,
    maxAmount: terms.maxAmount,
    interestRate: terms.interestRate,
    tenureMonths: terms.tenureMonths,
    tiers: [
      { score: "300–549", maxAmount: 0, rate: "Not eligible", label: "Poor" },
      { score: "550–649", maxAmount: 30000, rate: "16%", label: "Average" },
      { score: "650–749", maxAmount: 100000, rate: "12%", label: "Good" },
      { score: "750–849", maxAmount: 300000, rate: "9.5%", label: "Very Good" },
      { score: "850–900", maxAmount: 500000, rate: "7%", label: "Excellent" },
    ],
  });
});

export default router;
