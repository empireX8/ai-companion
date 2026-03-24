/**
 * History Synthesis Substrate (P3-02)
 *
 * Produces one normalized history format for downstream pattern detectors.
 * Covers both native sessions (SessionOrigin.APP) and imported sessions
 * (SessionOrigin.IMPORTED_ARCHIVE) in a single unified output.
 *
 * Session and date context is always preserved in the output — detectors
 * can filter or group by sessionOrigin, sessionId, or date window as needed.
 *
 * This module is pure data synthesis. It does not run any detection logic.
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";

// ── Normalized entry type ─────────────────────────────────────────────────────

export type NormalizedHistoryEntry = {
  messageId: string;
  sessionId: string;
  /** "APP" for native sessions, "IMPORTED_ARCHIVE" for imported sessions */
  sessionOrigin: string;
  sessionStartedAt: Date;
  /** "user" | "assistant" | "system" */
  role: string;
  content: string;
  createdAt: Date;
};

// ── Synthesis query ───────────────────────────────────────────────────────────

export type HistorySynthesisOptions = {
  userId: string;
  /** Optional lower bound on message createdAt */
  windowStart?: Date;
  /** Optional upper bound on message createdAt */
  windowEnd?: Date;
  db?: PrismaClient;
};

/**
 * Synthesize a user's full normalized message history.
 *
 * Queries all Message rows for the user, joined to their parent Session
 * for origin and startedAt context. Results are sorted oldest-first.
 *
 * Both APP (native) and IMPORTED_ARCHIVE sessions are included.
 * windowStart / windowEnd optionally bound the result by createdAt.
 */
export async function synthesizeHistory({
  userId,
  windowStart,
  windowEnd,
  db = prismadb,
}: HistorySynthesisOptions): Promise<NormalizedHistoryEntry[]> {
  const messages = await db.message.findMany({
    where: {
      userId,
      ...(windowStart !== undefined || windowEnd !== undefined
        ? {
            createdAt: {
              ...(windowStart !== undefined ? { gte: windowStart } : {}),
              ...(windowEnd !== undefined ? { lte: windowEnd } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      sessionId: true,
      role: true,
      content: true,
      createdAt: true,
      session: {
        select: {
          origin: true,
          startedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((m) => ({
    messageId: m.id,
    sessionId: m.sessionId,
    sessionOrigin: m.session.origin as string,
    sessionStartedAt: m.session.startedAt,
    role: m.role as string,
    content: m.content,
    createdAt: m.createdAt,
  }));
}

// ── Helper utilities ──────────────────────────────────────────────────────────

/** Extract the ordered list of message IDs from a synthesized history. */
export function extractMessageIds(entries: NormalizedHistoryEntry[]): string[] {
  return entries.map((e) => e.messageId);
}

/** Count distinct sessions represented in the history. */
export function extractSessionCount(entries: NormalizedHistoryEntry[]): number {
  return new Set(entries.map((e) => e.sessionId)).size;
}

/**
 * Return the temporal window (min/max createdAt) of the history entries.
 * Returns null bounds for an empty history.
 */
export function extractWindowBounds(entries: NormalizedHistoryEntry[]): {
  windowStart: Date | null;
  windowEnd: Date | null;
} {
  if (entries.length === 0) return { windowStart: null, windowEnd: null };
  const times = entries.map((e) => e.createdAt.getTime());
  return {
    windowStart: new Date(Math.min(...times)),
    windowEnd: new Date(Math.max(...times)),
  };
}

/**
 * Filter to only user-role messages (skip assistant/system).
 * Detectors that only process user-authored content can call this first.
 */
export function filterUserMessages(
  entries: NormalizedHistoryEntry[]
): NormalizedHistoryEntry[] {
  return entries.filter((e) => e.role === "user");
}
