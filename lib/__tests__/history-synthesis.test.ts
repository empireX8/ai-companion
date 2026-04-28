/**
 * History Synthesis Substrate tests (P3-02)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  extractMessageIds,
  extractSessionCount,
  extractWindowBounds,
  filterUserMessages,
  synthesizeHistory,
  type NormalizedHistoryEntry,
} from "../history-synthesis";

// ── Pure helper tests (no DB needed) ─────────────────────────────────────────

const makeEntry = (
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry => ({
  sourceKind: "chat_message",
  messageId: "msg1",
  sessionId: "sess1",
  journalEntryId: null,
  sessionOrigin: "APP",
  sessionStartedAt: new Date("2024-01-01"),
  role: "user",
  content: "hello",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  ...overrides,
});

describe("extractMessageIds", () => {
  it("returns ids in input order", () => {
    const entries = [
      makeEntry({ messageId: "m1" }),
      makeEntry({ messageId: "m2" }),
      makeEntry({ messageId: "m3" }),
    ];
    expect(extractMessageIds(entries)).toEqual(["m1", "m2", "m3"]);
  });

  it("returns empty array for empty input", () => {
    expect(extractMessageIds([])).toEqual([]);
  });

  it("excludes journal-backed entries that have no messageId", () => {
    const entries = [
      makeEntry({ messageId: "m1" }),
      makeEntry({
        sourceKind: "journal_entry",
        messageId: null,
        sessionId: null,
        journalEntryId: "journal-1",
        sessionOrigin: null,
        sessionStartedAt: null,
      }),
      makeEntry({ messageId: "m2" }),
    ];
    expect(extractMessageIds(entries)).toEqual(["m1", "m2"]);
  });
});

describe("extractSessionCount", () => {
  it("counts distinct sessions", () => {
    const entries = [
      makeEntry({ sessionId: "s1" }),
      makeEntry({ sessionId: "s2" }),
      makeEntry({ sessionId: "s1" }), // duplicate
    ];
    expect(extractSessionCount(entries)).toBe(2);
  });

  it("returns 0 for empty input", () => {
    expect(extractSessionCount([])).toBe(0);
  });

  it("ignores entries without sessionId (for example journal entries)", () => {
    const entries = [
      makeEntry({ sessionId: "s1" }),
      makeEntry({
        sourceKind: "journal_entry",
        sessionId: null,
        messageId: null,
        journalEntryId: "journal-1",
        sessionOrigin: null,
        sessionStartedAt: null,
      }),
    ];
    expect(extractSessionCount(entries)).toBe(1);
  });
});

describe("extractWindowBounds", () => {
  it("returns min and max createdAt across entries", () => {
    const entries = [
      makeEntry({ createdAt: new Date("2024-01-05T10:00:00Z") }),
      makeEntry({ createdAt: new Date("2024-01-01T08:00:00Z") }),
      makeEntry({ createdAt: new Date("2024-01-10T12:00:00Z") }),
    ];
    const { windowStart, windowEnd } = extractWindowBounds(entries);
    expect(windowStart!.toISOString()).toBe("2024-01-01T08:00:00.000Z");
    expect(windowEnd!.toISOString()).toBe("2024-01-10T12:00:00.000Z");
  });

  it("returns null bounds for empty input", () => {
    const { windowStart, windowEnd } = extractWindowBounds([]);
    expect(windowStart).toBeNull();
    expect(windowEnd).toBeNull();
  });

  it("handles single entry — windowStart equals windowEnd", () => {
    const t = new Date("2024-03-15T09:00:00Z");
    const { windowStart, windowEnd } = extractWindowBounds([makeEntry({ createdAt: t })]);
    expect(windowStart!.getTime()).toBe(t.getTime());
    expect(windowEnd!.getTime()).toBe(t.getTime());
  });
});

describe("filterUserMessages", () => {
  it("retains only user-role entries", () => {
    const entries = [
      makeEntry({ role: "user" }),
      makeEntry({ role: "assistant" }),
      makeEntry({ role: "system" }),
      makeEntry({ role: "user" }),
    ];
    const filtered = filterUserMessages(entries);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.role === "user")).toBe(true);
  });

  it("returns empty array when no user messages", () => {
    const entries = [makeEntry({ role: "assistant" })];
    expect(filterUserMessages(entries)).toHaveLength(0);
  });
});

// ── synthesizeHistory DB tests ────────────────────────────────────────────────

type MockMessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
  session: { origin: string; startedAt: Date };
};

type MockJournalEntryRow = {
  id: string;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
};

function makeMockDb(rows: MockMessageRow[], journalRows: MockJournalEntryRow[] = []) {
  const db = {
    message: {
      findMany: async () => rows,
    },
    journalEntry: {
      findMany: async () => journalRows,
    },
  };
  return db as unknown as PrismaClient;
}

describe("synthesizeHistory", () => {
  it("maps DB rows to NormalizedHistoryEntry shape", async () => {
    const db = makeMockDb([
      {
        id: "msg1",
        sessionId: "sess1",
        role: "user",
        content: "Hello",
        createdAt: new Date("2024-01-01T10:00:00Z"),
        session: { origin: "APP", startedAt: new Date("2024-01-01T09:00:00Z") },
      },
    ]);

    const entries = await synthesizeHistory({ userId: "u1", db });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sourceKind: "chat_message",
      messageId: "msg1",
      sessionId: "sess1",
      journalEntryId: null,
      sessionOrigin: "APP",
      role: "user",
      content: "Hello",
    });
  });

  it("preserves IMPORTED_ARCHIVE origin for imported sessions", async () => {
    const db = makeMockDb([
      {
        id: "msg2",
        sessionId: "sess2",
        role: "user",
        content: "Imported content",
        createdAt: new Date("2023-06-01T10:00:00Z"),
        session: {
          origin: "IMPORTED_ARCHIVE",
          startedAt: new Date("2023-06-01T09:00:00Z"),
        },
      },
    ]);

    const entries = await synthesizeHistory({ userId: "u1", db });

    expect(entries[0]!.sessionOrigin).toBe("IMPORTED_ARCHIVE");
  });

  it("returns empty array for a user with no messages", async () => {
    const db = makeMockDb([]);
    const entries = await synthesizeHistory({ userId: "u1", db });
    expect(entries).toHaveLength(0);
  });

  it("includes both APP and IMPORTED_ARCHIVE entries in the same result", async () => {
    const db = makeMockDb([
      {
        id: "m1",
        sessionId: "s1",
        role: "user",
        content: "native",
        createdAt: new Date("2024-01-01"),
        session: { origin: "APP", startedAt: new Date("2024-01-01") },
      },
      {
        id: "m2",
        sessionId: "s2",
        role: "user",
        content: "imported",
        createdAt: new Date("2023-01-01"),
        session: { origin: "IMPORTED_ARCHIVE", startedAt: new Date("2023-01-01") },
      },
    ]);

    const entries = await synthesizeHistory({ userId: "u1", db });

    expect(entries).toHaveLength(2);
    const origins = entries.map((e) => e.sessionOrigin);
    expect(origins).toContain("APP");
    expect(origins).toContain("IMPORTED_ARCHIVE");
  });

  it("preserves sessionStartedAt from the session", async () => {
    const startedAt = new Date("2024-02-15T08:30:00Z");
    const db = makeMockDb([
      {
        id: "m1",
        sessionId: "s1",
        role: "user",
        content: "hello",
        createdAt: new Date("2024-02-15T08:45:00Z"),
        session: { origin: "APP", startedAt },
      },
    ]);

    const entries = await synthesizeHistory({ userId: "u1", db });

    expect(entries[0]!.sessionStartedAt!.getTime()).toBe(startedAt.getTime());
  });

  it("includes journal entries as source-aware user history units", async () => {
    const db = makeMockDb(
      [],
      [
        {
          id: "journal-1",
          body: "I keep defaulting to people-pleasing when conflict appears.",
          authoredAt: new Date("2024-02-01T09:00:00Z"),
          createdAt: new Date("2024-02-01T09:05:00Z"),
        },
      ]
    );

    const entries = await synthesizeHistory({ userId: "u1", db });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sourceKind: "journal_entry",
      messageId: null,
      sessionId: null,
      journalEntryId: "journal-1",
      sessionOrigin: null,
      role: "user",
      content: "I keep defaulting to people-pleasing when conflict appears.",
    });
    expect(entries[0]?.createdAt.toISOString()).toBe("2024-02-01T09:00:00.000Z");
  });

  it("orders mixed message + journal history by canonical timestamp", async () => {
    const db = makeMockDb(
      [
        {
          id: "message-1",
          sessionId: "sess-1",
          role: "user",
          content: "Message row",
          createdAt: new Date("2024-02-01T10:00:00Z"),
          session: { origin: "APP", startedAt: new Date("2024-02-01T08:00:00Z") },
        },
      ],
      [
        {
          id: "journal-authored",
          body: "Journal authored timestamp should drive ordering.",
          authoredAt: new Date("2024-02-01T09:00:00Z"),
          createdAt: new Date("2024-02-01T11:00:00Z"),
        },
        {
          id: "journal-created",
          body: "Journal without authoredAt falls back to createdAt.",
          authoredAt: null,
          createdAt: new Date("2024-02-01T12:00:00Z"),
        },
      ]
    );

    const entries = await synthesizeHistory({ userId: "u1", db });
    expect(entries.map((entry) => entry.messageId ?? entry.journalEntryId)).toEqual([
      "journal-authored",
      "message-1",
      "journal-created",
    ]);
  });
});
