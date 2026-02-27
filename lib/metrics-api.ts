export type ClientMetricPayload = {
  name: string;
  level?: "debug" | "info" | "warn" | "error";
  value?: number | null;
  meta?: Record<string, unknown> | null;
  sessionId?: string | null;
  route?: string | null;
};

/**
 * Fire-and-forget client metric logger. Never throws.
 * Silently swallows errors so UI actions are never blocked.
 */
export async function postMetricEvent(payload: ClientMetricPayload): Promise<void> {
  try {
    const response = await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.debug("[metrics] non-ok response", response.status, payload.name);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[metrics] failed to post event", payload.name, error);
    }
  }
}
