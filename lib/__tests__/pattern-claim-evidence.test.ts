/**
 * Pattern Claim Evidence (V1 receipt materialization pipeline) tests (P3-05)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PatternRerunDebugCollector } from "../pattern-rerun-debug";

import {
  extractQuote,
  materializeReceipt,
  materializeReceiptsFromEntries,
} from "../pattern-claim-evidence";

// ── extractQuote ──────────────────────────────────────────────────────────────

describe("extractQuote", () => {
  it("extracts the first sentence ending in a period", () => {
    const result = extractQuote("I always procrastinate. But I try harder.");
    expect(result).toBe("I always procrastinate.");
  });

  it("prefers a later sentence when the opener has no behavioral signal", () => {
    expect(
      extractQuote(
        "For context, this came up in therapy. When pressure rises, I start appeasing people instead of staying honest."
      )
    ).toBe("When pressure rises, I start appeasing people instead of staying honest.");
  });

  it("prefers a later transcript-style chunk when it contains the behavioral signal", () => {
    expect(
      extractQuote(
        "Conversation excerpt. User: I struggle to trust my own judgment when I have to commit. Assistant: Thanks for sharing that."
      )
    ).toBe("User: I struggle to trust my own judgment when I have to commit.");
  });

  it("extracts the first sentence ending in an exclamation mark", () => {
    expect(extractQuote("I did it! And then some.")).toBe("I did it!");
  });

  it("extracts the first sentence ending in a question mark", () => {
    expect(extractQuote("Why do I keep doing this? I don't know.")).toBe(
      "Why do I keep doing this?"
    );
  });

  it("falls back to truncated content when no sentence terminator found at 10+ chars", () => {
    const short = "No period here";
    expect(extractQuote(short)).toBe("No period here");
  });

  it("caps output at 200 chars", () => {
    const long = "A".repeat(250) + ".";
    const result = extractQuote(long);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("trims leading/trailing whitespace", () => {
    expect(extractQuote("  Hello world.  ")).toBe("Hello world.");
  });
});

// ── materializeReceipt ────────────────────────────────────────────────────────

type EvidenceRow = {
  id: string;
  claimId: string;
  messageId: string | null;
  journalEntryId: string | null;
  quote: string | null;
  source?: string;
};

function makeMockDb(opts: { existingRow?: EvidenceRow | null } = {}) {
  const rows: EvidenceRow[] = opts.existingRow ? [opts.existingRow] : [];
  let lastCreated: Partial<EvidenceRow> | null = null;

  const db = {
    patternClaimEvidence: {
      findFirst: async () => (rows.length > 0 ? rows[0] : null),
      create: async ({ data }: { data: Record<string, unknown>; select: unknown }) => {
        const row: EvidenceRow = {
          id: `ev_${Date.now()}`,
          claimId: data.claimId as string,
          messageId: (data.messageId as string | null) ?? null,
          journalEntryId: (data.journalEntryId as string | null) ?? null,
          quote: (data.quote as string | null) ?? null,
          source: data.source as string | undefined,
        };
        lastCreated = row as Partial<EvidenceRow>;
        rows.push(row);
        return row;
      },
    },
    _state: {
      get lastCreated() {
        return lastCreated;
      },
      get rows() {
        return rows;
      },
    },
  };

  return db as unknown as PrismaClient & { _state: typeof db._state };
}

describe("materializeReceipt", () => {
  it("creates a PatternClaimEvidence record and returns created=true", async () => {
    const db = makeMockDb();
    const result = await materializeReceipt({
      claimId: "claim1",
      sessionId: "sess1",
      messageId: "msg1",
      quote: "I keep avoiding it.",
      db,
    });
    expect(result.created).toBe(true);
    expect(result.evidenceId).toBeTruthy();
  });

  it("is idempotent — returns existing record with created=false", async () => {
    const existing: EvidenceRow = {
      id: "ev_existing",
      claimId: "claim1",
      messageId: "msg1",
      journalEntryId: null,
      quote: "same quote",
    };
    const db = makeMockDb({ existingRow: existing });
    const result = await materializeReceipt({
      claimId: "claim1",
      messageId: "msg1",
      quote: "same quote",
      db,
    });
    expect(result.created).toBe(false);
    expect(result.evidenceId).toBe("ev_existing");
  });

  it("uses 'derivation' as default source", async () => {
    const db = makeMockDb();
    await materializeReceipt({ claimId: "claim1", db });
    expect(db._state.lastCreated?.source).toBe("derivation");
  });

  it("accepts user_input as source", async () => {
    const db = makeMockDb();
    await materializeReceipt({ claimId: "claim1", source: "user_input", db });
    expect(db._state.lastCreated?.source).toBe("user_input");
  });

  it("creates record when neither messageId nor quote is supplied (no dedup check)", async () => {
    const db = makeMockDb();
    const result = await materializeReceipt({ claimId: "claim1", db });
    expect(result.created).toBe(true);
  });

  it("stores journalEntryId provenance on journal-backed receipts", async () => {
    const db = makeMockDb();
    const result = await materializeReceipt({
      claimId: "claim1",
      journalEntryId: "journal-entry-1",
      quote: "I felt calmer today after writing.",
      db,
    });

    expect(result.created).toBe(true);
    expect(db._state.lastCreated?.journalEntryId).toBe("journal-entry-1");
    expect(db._state.lastCreated?.messageId).toBeNull();
  });

  it("emits created/duplicate debug materialization events", async () => {
    const db = makeMockDb();
    const debugCollector = {
      recordReceiptMaterialization: vi.fn(),
    } as unknown as PatternRerunDebugCollector;

    await materializeReceipt({
      claimId: "claim-debug",
      messageId: "msg-new",
      quote: "I keep avoiding this.",
      sourceKind: "chat_message",
      debugCollector,
      db,
    });

    expect(debugCollector.recordReceiptMaterialization).toHaveBeenNthCalledWith(
      1,
      {
        created: true,
        sourceKind: "chat_message",
      }
    );

    const dbWithExisting = makeMockDb({
      existingRow: {
        id: "ev-existing",
        claimId: "claim-debug",
        messageId: "msg-new",
        journalEntryId: null,
        quote: "I keep avoiding this.",
      },
    });

    await materializeReceipt({
      claimId: "claim-debug",
      messageId: "msg-new",
      quote: "I keep avoiding this.",
      sourceKind: "chat_message",
      debugCollector,
      db: dbWithExisting,
    });

    expect(debugCollector.recordReceiptMaterialization).toHaveBeenNthCalledWith(
      2,
      {
        created: false,
        sourceKind: "chat_message",
      }
    );
  });
});

// ── materializeReceiptsFromEntries ────────────────────────────────────────────

function makeBulkMockDb() {
  const rows: EvidenceRow[] = [];

  const db = {
    patternClaimEvidence: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return (
          rows.find(
            (r) =>
              r.claimId === where.claimId &&
              r.messageId === (where.messageId ?? null) &&
              r.journalEntryId === (where.journalEntryId ?? null) &&
              r.quote === (where.quote ?? null)
          ) ?? null
        );
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: EvidenceRow = {
          id: `ev_${rows.length}`,
          claimId: data.claimId as string,
          messageId: (data.messageId as string | null) ?? null,
          journalEntryId: (data.journalEntryId as string | null) ?? null,
          quote: (data.quote as string | null) ?? null,
          source: data.source as string | undefined,
        };
        rows.push(row);
        return row;
      },
    },
    _rows: rows,
  };

  return db as unknown as PrismaClient & { _rows: EvidenceRow[] };
}

describe("materializeReceiptsFromEntries", () => {
  it("creates one receipt per entry", async () => {
    const db = makeBulkMockDb();
    const entries = [
      { messageId: "m1", sessionId: "s1", content: "I always procrastinate." },
      { messageId: "m2", sessionId: "s1", content: "I keep avoiding hard tasks." },
    ];

    const count = await materializeReceiptsFromEntries({ claimId: "c1", entries, db });

    expect(count).toBe(2);
    expect(db._rows).toHaveLength(2);
  });

  it("returns 0 for empty entries", async () => {
    const db = makeBulkMockDb();
    const count = await materializeReceiptsFromEntries({
      claimId: "c1",
      entries: [],
      db,
    });
    expect(count).toBe(0);
  });

  it("deduplicates — second call with same entries returns 0 new", async () => {
    const db = makeBulkMockDb();
    const entries = [
      { messageId: "m1", sessionId: "s1", content: "I always procrastinate." },
    ];

    const first = await materializeReceiptsFromEntries({ claimId: "c1", entries, db });
    const second = await materializeReceiptsFromEntries({ claimId: "c1", entries, db });

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(db._rows).toHaveLength(1);
  });

  it("persists the later behavioral sentence instead of an irrelevant opener", async () => {
    const db = makeBulkMockDb();
    const entries = [
      {
        messageId: "m1",
        sessionId: "s1",
        content:
          "Quick note before the real point. The same confidence-related regret keeps resurfacing whenever I look back at what I avoided.",
      },
    ];

    const count = await materializeReceiptsFromEntries({ claimId: "c1", entries, db });

    expect(count).toBe(1);
    expect(db._rows[0]?.quote).toBe(
      "The same confidence-related regret keeps resurfacing whenever I look back at what I avoided."
    );
  });

  it("materializes journal-backed support entries with journalEntryId provenance", async () => {
    const db = makeBulkMockDb();
    const entries = [
      {
        sourceKind: "journal_entry" as const,
        journalEntryId: "journal-1",
        content: "I keep defaulting to people-pleasing when conflict appears.",
        timestamp: new Date("2026-01-01T10:00:00.000Z"),
      },
      {
        sourceKind: "journal_entry" as const,
        journalEntryId: "journal-2",
        content: "When pressure builds I abandon my own plan.",
        timestamp: new Date("2026-01-02T10:00:00.000Z"),
      },
    ];

    const count = await materializeReceiptsFromEntries({ claimId: "c-journal", entries, db });

    expect(count).toBe(2);
    expect(db._rows).toHaveLength(2);
    expect(db._rows[0]?.journalEntryId).toBe("journal-1");
    expect(db._rows[0]?.messageId).toBeNull();
    expect(db._rows[1]?.journalEntryId).toBe("journal-2");
    expect(db._rows[1]?.messageId).toBeNull();
  });

  it("reports journal receipt source kind in debug instrumentation", async () => {
    const db = makeBulkMockDb();
    const debugCollector = {
      recordReceiptMaterialization: vi.fn(),
    } as unknown as PatternRerunDebugCollector;

    await materializeReceiptsFromEntries({
      claimId: "c-journal",
      entries: [
        {
          sourceKind: "journal_entry" as const,
          journalEntryId: "journal-1",
          content: "I keep defaulting to people-pleasing when conflict appears.",
          timestamp: new Date("2026-01-01T10:00:00.000Z"),
        },
      ],
      debugCollector,
      db,
    });

    expect(debugCollector.recordReceiptMaterialization).toHaveBeenCalledWith({
      created: true,
      sourceKind: "journal_entry",
    });
  });
});
