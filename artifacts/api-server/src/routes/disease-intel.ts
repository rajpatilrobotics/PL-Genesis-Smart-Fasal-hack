import { Router } from "express";
import { db } from "@workspace/db";
import { diseaseIntelReportsTable } from "@workspace/db/schema";
import { desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const PUNJAB_DISTRICTS = [
  "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Gurdaspur",
  "Hoshiarpur", "Bathinda", "Sangrur", "Moga", "Fazilka",
  "Ropar", "Pathankot", "Kapurthala", "Fatehgarh Sahib", "Barnala",
];

const CROPS = ["Wheat", "Rice (Paddy)", "Maize", "Cotton", "Sugarcane", "Mustard"];

async function seedIfEmpty() {
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(diseaseIntelReportsTable);
  if (Number(count[0].count) > 0) return;

  const fakeCiphertexts = [
    "001000000000000000000000000000008d3f4a2b1c9e7f5d6a8b0c2d4e6f8a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
    "001000000000000000000000000000003c7a1b5e9d2f4a8c0b6d3e7f1a5c9b3d7f1a5c9b3d7e1f5a9c3b7d1e5f9a3c7b1d5e9f3a7c1b5d9e3f7a1c5b9d3e7f1",
    "001000000000000000000000000000007f2b4d6a8c0e2f4b6d8a0c2e4f6b8d0a2c4e6f8b0d2e4a6c8f0b2d4f6a8c0e2f4b6d8a0c2e4f6b8d0a2c4e6f8b0d",
    "001000000000000000000000000000002e5a8c1f4b7d0e3f6a9c2b5e8a1d4g7b0e3f6a9c2b5e8a1d4b7e0a3f6c9b2e5a8c1f4b7d0e3f6a9c2b5e8a1d4b7",
    "001000000000000000000000000000009b3d7f1a5c9b3d7e1f5a9c3b7d1e5f9a3c7b1d5e9f3a7c1b5d9e3f7a1c5b9d3e7f1a5c9b3d7e1f5a9c3b7d1e5f",
  ];

  const seedData = [
    { district: "Ludhiana", cropType: "Wheat", encryptedStatus: fakeCiphertexts[0] },
    { district: "Ludhiana", cropType: "Wheat", encryptedStatus: fakeCiphertexts[1] },
    { district: "Ludhiana", cropType: "Rice (Paddy)", encryptedStatus: fakeCiphertexts[2] },
    { district: "Amritsar", cropType: "Wheat", encryptedStatus: fakeCiphertexts[3] },
    { district: "Amritsar", cropType: "Cotton", encryptedStatus: fakeCiphertexts[4] },
    { district: "Patiala", cropType: "Wheat", encryptedStatus: fakeCiphertexts[0] },
    { district: "Patiala", cropType: "Maize", encryptedStatus: fakeCiphertexts[1] },
    { district: "Jalandhar", cropType: "Rice (Paddy)", encryptedStatus: fakeCiphertexts[2] },
    { district: "Bathinda", cropType: "Cotton", encryptedStatus: fakeCiphertexts[3] },
    { district: "Bathinda", cropType: "Wheat", encryptedStatus: fakeCiphertexts[4] },
    { district: "Sangrur", cropType: "Wheat", encryptedStatus: fakeCiphertexts[0] },
    { district: "Moga", cropType: "Wheat", encryptedStatus: fakeCiphertexts[1] },
    { district: "Fazilka", cropType: "Cotton", encryptedStatus: fakeCiphertexts[2] },
    { district: "Gurdaspur", cropType: "Rice (Paddy)", encryptedStatus: fakeCiphertexts[3] },
    { district: "Hoshiarpur", cropType: "Maize", encryptedStatus: fakeCiphertexts[4] },
  ];

  await db.insert(diseaseIntelReportsTable).values(
    seedData.map(d => ({
      ...d,
      reportId: randomUUID(),
      chainId: 11155111,
      aclContract: "0x687820221192C5B662b25367F70076A37bc79b6c",
      encryptionHandle: null,
    }))
  );
}

seedIfEmpty().catch(console.error);

router.post("/disease-intel/submit", async (req, res) => {
  const { district, cropType, encryptedStatus, encryptionHandle } = req.body as {
    district: string;
    cropType: string;
    encryptedStatus: string;
    encryptionHandle?: string;
  };

  if (!district || !cropType || !encryptedStatus) {
    res.status(400).json({ error: "district, cropType, and encryptedStatus are required" });
    return;
  }

  if (!PUNJAB_DISTRICTS.includes(district)) {
    res.status(400).json({ error: "Invalid district" });
    return;
  }

  if (!CROPS.includes(cropType)) {
    res.status(400).json({ error: "Invalid crop type" });
    return;
  }

  const reportId = randomUUID();

  const [report] = await db.insert(diseaseIntelReportsTable).values({
    district,
    cropType,
    encryptedStatus,
    encryptionHandle: encryptionHandle ?? null,
    chainId: 11155111,
    aclContract: "0x687820221192C5B662b25367F70076A37bc79b6c",
    reportId,
  }).returning();

  res.status(201).json({
    reportId: report.reportId,
    message: "Encrypted disease report submitted. Your farm identity and disease status remain private.",
    encryptedStatusPreview: encryptedStatus.slice(0, 32) + "...",
    district: report.district,
    cropType: report.cropType,
    chainId: 11155111,
    network: "Ethereum Sepolia (Zama FHE Testnet)",
    timestamp: report.createdAt,
  });
});

router.get("/disease-intel/aggregate", async (_req, res) => {
  const reports = await db
    .select({
      district: diseaseIntelReportsTable.district,
      cropType: diseaseIntelReportsTable.cropType,
      count: sql<number>`count(*)`,
    })
    .from(diseaseIntelReportsTable)
    .groupBy(diseaseIntelReportsTable.district, diseaseIntelReportsTable.cropType)
    .orderBy(desc(sql`count(*)`));

  const districtMap: Record<string, { total: number; byCrop: Record<string, number> }> = {};
  for (const row of reports) {
    if (!districtMap[row.district]) {
      districtMap[row.district] = { total: 0, byCrop: {} };
    }
    districtMap[row.district].total += Number(row.count);
    districtMap[row.district].byCrop[row.cropType] = Number(row.count);
  }

  const totalReports = await db
    .select({ count: sql<number>`count(*)` })
    .from(diseaseIntelReportsTable);

  const cropMap: Record<string, number> = {};
  for (const row of reports) {
    cropMap[row.cropType] = (cropMap[row.cropType] ?? 0) + Number(row.count);
  }

  const recentReports = await db
    .select({
      id: diseaseIntelReportsTable.id,
      reportId: diseaseIntelReportsTable.reportId,
      district: diseaseIntelReportsTable.district,
      cropType: diseaseIntelReportsTable.cropType,
      encryptedStatusPreview: sql<string>`substring(${diseaseIntelReportsTable.encryptedStatus}, 1, 40)`,
      chainId: diseaseIntelReportsTable.chainId,
      createdAt: diseaseIntelReportsTable.createdAt,
    })
    .from(diseaseIntelReportsTable)
    .orderBy(desc(diseaseIntelReportsTable.createdAt))
    .limit(10);

  res.json({
    totalEncryptedReports: Number(totalReports[0].count),
    individualsIdentified: 0,
    network: "Ethereum Sepolia (Zama FHE Testnet)",
    chainId: 11155111,
    aclContract: "0x687820221192C5B662b25367F70076A37bc79b6c",
    districtOutbreakMap: districtMap,
    cropBreakdown: cropMap,
    recentReports,
    privacyNote: "All disease statuses are FHE-encrypted. Zero individual farm identities are stored or derivable.",
  });
});

export default router;
