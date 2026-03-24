/**
 * Pattern Claim Evidence (V1 receipt materialization pipeline) tests (P3-05)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

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

type EvidenceRow = { id: string; claimId: string; messageId: string | null; quote: string | null; source?: string };

function makeMockDb(opts: { existingRow?: EvidenceRow | null } = {}) {
  const rows: EvidenceRow[] = opts.existingRow ? [opts.existingRow] : [];
  let lastCreated: Partial<EvidenceRow> | null = null;

  const db = {
    patternClaimEvidence: {
      findFirst: async () => (rows.length > 0 ? rows[0] : null),
      create: async ({ data }: { data: Record<string, unknown>; select: unknown }) => {
        const row = { id: `ev_${Date.now()}`, ...data };
        lastCreated = row as Partial<EvidenceRow>;
        rows.push(row as EvidenceRow);
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
              r.quote === (where.quote ?? null)
          ) ?? null
        );
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ev_${rows.length}`, ...data } as EvidenceRow;
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
});
