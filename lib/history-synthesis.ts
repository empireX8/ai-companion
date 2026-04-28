/**
 * History Synthesis Substrate (P3-02)
 *
 * Produces one normalized history format for downstream pattern detectors.
 * Covers native/imported message history plus first-class JournalEntry history
 * in one unified, source-aware output stream.
 *
 * Session/date context is preserved for message-backed units. Journal-backed
 * units carry journalEntryId and a canonical timestamp with session fields null.
 *
 * This module is pure data synthesis. It does not run any detection logic.
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";

// ── Normalized entry type ─────────────────────────────────────────────────────

export type HistorySourceKind = "chat_message" | "journal_entry";

export type NormalizedHistoryEntry = {
  sourceKind?: HistorySourceKind;
  messageId: string | null;
  sessionId: string | null;
  journalEntryId?: string | null;
  /** "APP" for native sessions, "IMPORTED_ARCHIVE" for imported sessions */
  sessionOrigin: string | null;
  sessionStartedAt: Date | null;
  /** "user" | "assistant" | "system" */
  role: string;
  content: string;
  /**
   * Canonical detection timestamp:
   * - Message rows: Message.createdAt
   * - Journal rows: JournalEntry.authoredAt ?? JournalEntry.createdAt
   */
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
 * Synthesize a user's full normalized detection history.
 *
 * Queries Message + JournalEntry rows for the user, normalizes both shapes,
 * and returns one oldest-first stream.
 *
 * Message rows include APP and IMPORTED_ARCHIVE sessions.
 * Journal rows use authoredAt for temporal placement when present, else
 * createdAt. windowStart/windowEnd are applied to these canonical timestamps.
 */
export async function synthesizeHistory({
  userId,
  windowStart,
  windowEnd,
  db = prismadb,
}: HistorySynthesisOptions): Promise<NormalizedHistoryEntry[]> {
  const [messages, journalEntries] = await Promise.all([
    db.message.findMany({
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
    }),
    db.journalEntry.findMany({
      where: {
        userId,
        ...(windowStart !== undefined || windowEnd !== undefined
          ? {
              OR: [
                {
                  authoredAt: {
                    not: null,
                    ...(windowStart !== undefined ? { gte: windowStart } : {}),
                    ...(windowEnd !== undefined ? { lte: windowEnd } : {}),
                  },
                },
                {
                  authoredAt: null,
                  createdAt: {
                    ...(windowStart !== undefined ? { gte: windowStart } : {}),
                    ...(windowEnd !== undefined ? { lte: windowEnd } : {}),
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        body: true,
        authoredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const messageEntries: NormalizedHistoryEntry[] = messages.map((m) => ({
    sourceKind: "chat_message",
    messageId: m.id,
    sessionId: m.sessionId,
    journalEntryId: null,
    sessionOrigin: m.session.origin as string,
    sessionStartedAt: m.session.startedAt,
    role: m.role as string,
    content: m.content,
    createdAt: m.createdAt,
  }));

  const journalHistoryEntries: NormalizedHistoryEntry[] = journalEntries.map((entry) => ({
    sourceKind: "journal_entry",
    messageId: null,
    sessionId: null,
    journalEntryId: entry.id,
    sessionOrigin: null,
    sessionStartedAt: null,
    role: "user",
    content: entry.body,
    createdAt: entry.authoredAt ?? entry.createdAt,
  }));

  return [...messageEntries, ...journalHistoryEntries].sort((a, b) => {
    const createdAtCompare = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdAtCompare !== 0) return createdAtCompare;
    const sourceA =
      a.sourceKind ?? (a.journalEntryId ? "journal_entry" : "chat_message");
    const sourceB =
      b.sourceKind ?? (b.journalEntryId ? "journal_entry" : "chat_message");
    const sourceCompare = sourceA.localeCompare(sourceB);
    if (sourceCompare !== 0) return sourceCompare;
    const aId = a.messageId ?? a.journalEntryId ?? "";
    const bId = b.messageId ?? b.journalEntryId ?? "";
    return aId.localeCompare(bId);
  });
}

// ── Helper utilities ──────────────────────────────────────────────────────────

/** Extract the ordered list of message IDs from a synthesized history. */
export function extractMessageIds(entries: NormalizedHistoryEntry[]): string[] {
  return entries
    .map((e) => e.messageId)
    .filter((messageId): messageId is string => messageId !== null);
}

/** Count distinct sessions represented in the history. */
export function extractSessionCount(entries: NormalizedHistoryEntry[]): number {
  return new Set(
    entries
      .map((e) => e.sessionId)
      .filter((sessionId): sessionId is string => sessionId !== null)
  ).size;
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
