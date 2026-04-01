import { db } from "@workspace/db";
import { eventLogsTable } from "@workspace/db";

export async function logEvent(eventType: string, description: string, metadata?: object): Promise<void> {
  try {
    await db.insert(eventLogsTable).values({
      eventType,
      description,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
  } catch {
    // silently fail so logging never breaks the main request
  }
}
