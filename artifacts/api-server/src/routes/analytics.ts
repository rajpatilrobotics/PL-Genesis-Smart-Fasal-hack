import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  sensorDataTable,
  aiRecommendationsTable,
  insuranceClaimsTable,
  communityPostsTable,
  marketListingsTable,
  eventLogsTable,
} from "@workspace/db";
import { desc, avg, count } from "drizzle-orm";
import {
  GetAnalyticsSummaryResponse,
  GetAnalyticsLogsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics/summary", async (_req, res): Promise<void> => {
  const [sensorCount] = await db.select({ value: count() }).from(sensorDataTable);
  const [aiCount] = await db.select({ value: count() }).from(aiRecommendationsTable);
  const [insuranceCount] = await db.select({ value: count() }).from(insuranceClaimsTable);
  const [communityCount] = await db.select({ value: count() }).from(communityPostsTable);
  const [marketCount] = await db.select({ value: count() }).from(marketListingsTable);

  const [sensorAvg] = await db.select({
    avgPh: avg(sensorDataTable.ph),
    avgMoisture: avg(sensorDataTable.moisture),
  }).from(sensorDataTable);

  const [aiAvg] = await db.select({
    avgHealth: avg(aiRecommendationsTable.cropHealthPercent),
  }).from(aiRecommendationsTable);

  const recentLogs = await db
    .select()
    .from(eventLogsTable)
    .orderBy(desc(eventLogsTable.createdAt))
    .limit(20);

  const logs = recentLogs.map(l => ({
    ...l,
    metadata: l.metadata ?? undefined,
  }));

  res.json(GetAnalyticsSummaryResponse.parse({
    totalSensorReadings: sensorCount.value || 0,
    totalAiRecommendations: aiCount.value || 0,
    totalInsuranceClaims: insuranceCount.value || 0,
    totalCommunityPosts: communityCount.value || 0,
    totalMarketListings: marketCount.value || 0,
    avgCropHealth: Number(aiAvg.avgHealth) || 0,
    avgSoilPh: Number(sensorAvg.avgPh) || 0,
    avgMoisture: Number(sensorAvg.avgMoisture) || 0,
    recentLogs: logs,
  }));
});

router.get("/analytics/logs", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(eventLogsTable)
    .orderBy(desc(eventLogsTable.createdAt))
    .limit(100);

  const logs = rows.map(r => ({
    ...r,
    metadata: r.metadata ?? undefined,
  }));

  res.json(GetAnalyticsLogsResponse.parse(logs));
});

export default router;
