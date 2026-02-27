import prismadb from "./prismadb";
import { logMetricEventSafe, type MetricEventInput } from "./metrics";

// Re-export types for callers who only need to import from one place
export type { MetricLevel, MetricEventInput } from "./metrics";

const RETENTION_MAX = 10_000;
const RETENTION_BATCH = 100; // delete this many extras when over limit

async function pruneIfNeeded(userId: string): Promise<void> {
  const count = await prismadb.internalMetricEvent.count({ where: { userId } });
  if (count <= RETENTION_MAX) return;

  const excess = count - RETENTION_MAX + RETENTION_BATCH;
  const oldest = await prismadb.internalMetricEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: excess,
    select: { id: true },
  });

  if (oldest.length > 0) {
    await prismadb.internalMetricEvent.deleteMany({
      where: { id: { in: oldest.map((e) => e.id) } },
    });
  }
}

/**
 * Production server-side metric logger.
 * Uses the real DB, never throws, and triggers best-effort retention pruning.
 */
export async function serverLogMetric(input: MetricEventInput): Promise<void> {
  await logMetricEventSafe(prismadb, input);
  // Non-blocking pruning — does not block the response
  pruneIfNeeded(input.userId).catch((err) => {
    console.log("[METRICS_PRUNE_ERROR]", err);
  });
}
