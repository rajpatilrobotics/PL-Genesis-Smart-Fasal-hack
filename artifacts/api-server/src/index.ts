import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sensorDataTable } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Realistic base values for a Punjab wheat farm (mid-season)
const SENSOR_BASE = {
  nitrogen: 148,
  phosphorus: 72,
  potassium: 198,
  ph: 6.8,
  moisture: 57,
};

function vary(base: number, pct = 0.04): number {
  return Math.round((base * (1 - pct + Math.random() * pct * 2)) * 10) / 10;
}

async function pushLiveReading() {
  try {
    await db.insert(sensorDataTable).values({
      nitrogen: vary(SENSOR_BASE.nitrogen, 0.05),
      phosphorus: vary(SENSOR_BASE.phosphorus, 0.05),
      potassium: vary(SENSOR_BASE.potassium, 0.05),
      ph: Math.round((SENSOR_BASE.ph + (Math.random() * 0.4 - 0.2)) * 10) / 10,
      moisture: vary(SENSOR_BASE.moisture, 0.06),
      deviceId: "ESP32-FARM-001",
    });
    logger.info("[ESP32] Live sensor reading stored");
  } catch (err) {
    logger.warn({ err }, "[ESP32] Failed to store sensor reading");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Push an initial reading right away, then every 30 seconds
  pushLiveReading();
  setInterval(pushLiveReading, 30_000);
});
