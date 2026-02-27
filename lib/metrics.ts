export type MetricLevel = "debug" | "info" | "warn" | "error";
export type MetricSource = "client" | "server";

/** Input type for the injectable server logger */
export type MetricEventInput = {
  userId: string;
  sessionId?: string | null;
  name: string;
  level?: MetricLevel;
  value?: number | null;
  meta?: Record<string, unknown> | null;
  source: MetricSource;
  route?: string | null;
};

/** Canonical client-facing event type (userId filled server-side) */
export type MetricEvent = {
  name: string;
  level?: MetricLevel;
  sessionId?: string | null;
  meta?: Record<string, unknown> | null;
};

// Injectable minimal db interface — compatible with the generated Prisma client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MinimalDb = { internalMetricEvent: { create(args: { data: any }): Promise<unknown> } };

const MAX_STRING_LENGTH = 200;
const MAX_ARRAY_LENGTH = 50;
const MAX_META_BYTES = 8 * 1024; // 8 KB hard cap

export function sanitizeMetaForStorage(
  meta: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (meta === null || meta === undefined) return null;
  if (typeof meta !== "object" || Array.isArray(meta)) return null;

  // Field-level truncation
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(meta)) {
    if (typeof val === "string") {
      out[key] = val.length > MAX_STRING_LENGTH ? val.slice(0, MAX_STRING_LENGTH) : val;
    } else if (Array.isArray(val)) {
      out[key] = val.slice(0, MAX_ARRAY_LENGTH);
    } else {
      out[key] = val;
    }
  }

  // Total JSON size cap — drop meta entirely if still too large after truncation
  const serialized = JSON.stringify(out);
  if (serialized.length > MAX_META_BYTES) {
    console.warn(`[metrics] meta dropped — ${serialized.length} bytes exceeds ${MAX_META_BYTES} byte cap`);
    return null;
  }

  return out;
}

export async function logMetricEvent(db: MinimalDb, input: MetricEventInput): Promise<void> {
  const sanitizedMeta = sanitizeMetaForStorage(input.meta);

  await db.internalMetricEvent.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      name: input.name,
      level: input.level ?? "info",
      value: input.value ?? null,
      meta: sanitizedMeta,
      source: input.source,
      route: input.route ?? null,
    },
  });
}

export async function logMetricEventSafe(db: MinimalDb, input: MetricEventInput): Promise<void> {
  try {
    await logMetricEvent(db, input);
  } catch (error) {
    console.log("[METRICS_LOG_ERROR]", error);
  }
}
