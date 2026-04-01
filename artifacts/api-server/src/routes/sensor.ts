import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sensorDataTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  SubmitSensorDataBody,
  GetLatestSensorDataResponse,
  GetSensorHistoryResponse,
} from "@workspace/api-zod";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

router.post("/sensor-data", async (req, res): Promise<void> => {
  const parsed = SubmitSensorDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(sensorDataTable).values(parsed.data).returning();
  await logEvent("sensor", `Sensor data received: N=${parsed.data.nitrogen} P=${parsed.data.phosphorus} K=${parsed.data.potassium} pH=${parsed.data.ph} moisture=${parsed.data.moisture}`);

  res.status(201).json(GetLatestSensorDataResponse.parse(row));
});

router.get("/sensor-data", async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(sensorDataTable)
    .orderBy(desc(sensorDataTable.createdAt))
    .limit(1);

  if (!row) {
    res.json(GetLatestSensorDataResponse.parse({
      id: 0,
      nitrogen: 45,
      phosphorus: 30,
      potassium: 55,
      ph: 6.8,
      moisture: 65,
      deviceId: "demo-device",
      createdAt: new Date(),
    }));
    return;
  }

  res.json(GetLatestSensorDataResponse.parse(row));
});

router.get("/sensor-data/history", async (req, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;

  const rows = await db
    .select()
    .from(sensorDataTable)
    .orderBy(desc(sensorDataTable.createdAt))
    .limit(limit);

  res.json(GetSensorHistoryResponse.parse(rows));
});

export default router;
