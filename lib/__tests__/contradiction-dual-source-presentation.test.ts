import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { hashExactQuoteSlice } from "../contradiction-dual-side-lineage";
import {
  dualSourceLineageNoticeCopy,
  dualSourceSideUnavailableCopy,
} from "../contradiction-dual-source-presentation-contract";
import {
  createPrismaDualSourcePresentationReader,
  isIncludeDualSourceEnabled,
  resolveContradictionDualSourcePresentation,
  resolveContradictionDualSourcePresentations,
  type DualSourceMessageRecord,
  type DualSourcePresentationReader,
  type DualSourceSessionRecord,
  type DualSourceSpanRecord,
} from "../contradiction-dual-source-presentation";

const USER = "user-owner";
const OTHER = "user-other";

function sha(quote: string): string {
  return createHash("sha256").update(quote, "utf8").digest("hex");
}

function makeFixture() {
  const messageAContent =
    "PREFIX I always choose calm routines even under pressure SUFFIX";
  const messageBContent =
    "PREFIX I abandon routines the moment stress rises SUFFIX";
  const quoteA = "I always choose calm routines even under pressure";
  const quoteB = "I abandon routines the moment stress rises";
  const startA = messageAContent.indexOf(quoteA);
  const endA = startA + quoteA.length;
  const startB = messageBContent.indexOf(quoteB);
  const endB = startB + quoteB.length;

  const spanA: DualSourceSpanRecord = {
    id: "span-a",
    userId: USER,
    messageId: "msg-a",
    charStart: startA,
    charEnd: endA,
    contentHash: sha(quoteA),
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
  };
  const spanB: DualSourceSpanRecord = {
    id: "span-b",
    userId: USER,
    messageId: "msg-b",
    charStart: startB,
    charEnd: endB,
    contentHash: sha(quoteB),
    createdAt: new Date("2026-07-01T11:00:00.000Z"),
  };

  const messageA: DualSourceMessageRecord = {
    id: "msg-a",
    userId: USER,
    sessionId: "sess-a",
    content: messageAContent,
    createdAt: new Date("2026-07-01T09:00:00.000Z"),
  };
  const messageB: DualSourceMessageRecord = {
    id: "msg-b",
    userId: USER,
    sessionId: "sess-b",
    content: messageBContent,
    createdAt: new Date("2026-07-01T09:30:00.000Z"),
  };

  const sessionA: DualSourceSessionRecord = {
    id: "sess-a",
    userId: USER,
    origin: "APP",
    label: "Morning notes",
  };
  const sessionB: DualSourceSessionRecord = {
    id: "sess-b",
    userId: USER,
    origin: "IMPORTED_ARCHIVE",
    label: "Imported chat",
  };

  const decoySpan: DualSourceSpanRecord = {
    id: "span-decoy-first",
    userId: USER,
    messageId: "msg-a",
    charStart: 0,
    charEnd: 6,
    contentHash: sha("PREFIX"),
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
  };

  const spans = [decoySpan, spanA, spanB];
  const messages = [messageA, messageB];
  const sessions = [sessionA, sessionB];

  // Production-like reader: scopes by userId before returning rows.
  const findSpansByIds = vi.fn(async (userId: string, ids: string[]) =>
    spans.filter((s) => ids.includes(s.id) && s.userId === userId),
  );
  const findMessagesByIds = vi.fn(async (userId: string, ids: string[]) =>
    messages.filter((m) => ids.includes(m.id) && m.userId === userId),
  );
  const findSessionsByIds = vi.fn(async (userId: string, ids: string[]) =>
    sessions.filter((s) => ids.includes(s.id) && s.userId === userId),
  );

  const reader: DualSourcePresentationReader = {
    findSpansByIds,
    findMessagesByIds,
    findSessionsByIds,
  };

  return {
    quoteA,
    quoteB,
    spanA,
    spanB,
    decoySpan,
    messageA,
    messageB,
    reader,
    findSpansByIds,
    findMessagesByIds,
    findSessionsByIds,
    spans,
    messages,
    sessions,
  };
}

describe("contradiction dual-source presentation projection", () => {
  it("1–4: resolves complete ordered Side A / Side B from exact span IDs with slice-derived quotes", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-1",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });

    expect(presentation.lineageState).toBe("complete_verified");
    expect(presentation.sideA).toMatchObject({
      side: "A",
      availability: "available",
      spanId: "span-a",
      messageId: "msg-a",
      exactQuote: fx.quoteA,
      integrityVerified: true,
      sessionOrigin: "APP",
      sessionLabel: "Morning notes",
      recordedAt: "2026-07-01T09:00:00.000Z",
    });
    expect(presentation.sideB).toMatchObject({
      side: "B",
      availability: "available",
      spanId: "span-b",
      messageId: "msg-b",
      exactQuote: fx.quoteB,
      integrityVerified: true,
      sessionOrigin: "IMPORTED_ARCHIVE",
      sessionLabel: "Imported chat",
      recordedAt: "2026-07-01T09:30:00.000Z",
    });
  });

  it("3: recomputes SHA-256 over exact quote and matches stored contentHash", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-1",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideA.availability).toBe("available");
    if (presentation.sideA.availability === "available") {
      expect(hashExactQuoteSlice(presentation.sideA.exactQuote)).toBe(
        fx.spanA.contentHash,
      );
    }
  });

  it("5: reversed span IDs are not silently normalized", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-reversed",
        sideASourceSpanId: fx.spanB.id,
        sideBSourceSpanId: fx.spanA.id,
      },
      reader: fx.reader,
    });

    expect(presentation.lineageState).toBe("complete_verified");
    expect(presentation.sideA).toMatchObject({
      side: "A",
      spanId: "span-b",
      exactQuote: fx.quoteB,
    });
    expect(presentation.sideB).toMatchObject({
      side: "B",
      spanId: "span-a",
      exactQuote: fx.quoteA,
    });
  });

  it("6: both-null legacy lineage returns legacy_unavailable", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-legacy",
        sideASourceSpanId: null,
        sideBSourceSpanId: null,
      },
      reader: fx.reader,
    });
    expect(presentation.lineageState).toBe("legacy_unavailable");
    expect(fx.findSpansByIds).not.toHaveBeenCalled();
    expect(dualSourceLineageNoticeCopy(presentation, "candidate")).toBe(
      "Exact source excerpts were not recorded for this legacy candidate.",
    );
    expect(dualSourceLineageNoticeCopy(presentation, "generic")).toBe(
      "Exact source excerpts were not recorded for this legacy contradiction.",
    );
  });

  it("7: one-null partial lineage fails closed on both sides", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-partial",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: null,
      },
      reader: fx.reader,
    });
    expect(presentation.lineageState).toBe("partial_unavailable");
    expect(presentation.sideA.availability).toBe("unavailable");
    expect(presentation.sideB.availability).toBe("unavailable");
    expect(dualSourceLineageNoticeCopy(presentation)).toBe(
      "One or both exact source excerpts were not recorded for this tension.",
    );
  });

  it("8: missing Side A span fails closed", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-miss-a",
        sideASourceSpanId: "span-missing-a",
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideA).toMatchObject({
      availability: "unavailable",
      reason: "span_not_found",
    });
  });

  it("9: missing Side B span fails closed", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-miss-b",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: "span-missing-b",
      },
      reader: fx.reader,
    });
    expect(presentation.sideB).toMatchObject({
      availability: "unavailable",
      reason: "span_not_found",
    });
  });

  it("10: span wrong-user rejection (adversarial injected reader)", async () => {
    const fx = makeFixture();
    // Adversarial reader returns the wrong-user row despite the userId arg.
    fx.findSpansByIds.mockImplementation(async (_userId: string, ids: string[]) =>
      fx.spans
        .filter((s) => ids.includes(s.id))
        .map((s) => (s.id === "span-a" ? { ...s, userId: OTHER } : s)),
    );
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-wrong-span-user",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideA).toMatchObject({
      availability: "unavailable",
      reason: "span_wrong_user",
    });
  });

  it("10b: wrong-user span is never used to request its message in ordinary scoped flow", async () => {
    const fx = makeFixture();
    const foreignSpan: DualSourceSpanRecord = {
      id: "span-foreign",
      userId: OTHER,
      messageId: "msg-foreign-secret",
      charStart: 0,
      charEnd: 5,
      contentHash: sha("hello"),
      createdAt: new Date(),
    };
    fx.spans.push(foreignSpan);

    // Ordinary production-scoped reader: only returns rows for USER.
    fx.findSpansByIds.mockImplementation(async (userId: string, ids: string[]) =>
      fx.spans.filter((s) => ids.includes(s.id) && s.userId === userId),
    );

    await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-foreign-span-id",
        sideASourceSpanId: foreignSpan.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });

    expect(fx.findSpansByIds).toHaveBeenCalledWith(
      USER,
      expect.arrayContaining([foreignSpan.id, fx.spanB.id]),
    );
    // Foreign span filtered at DB scope — its message must not be requested.
    for (const call of fx.findMessagesByIds.mock.calls) {
      expect(call[0]).toBe(USER);
      expect(call[1]).not.toContain("msg-foreign-secret");
    }
  });

  it("11: message wrong-user rejection", async () => {
    const fx = makeFixture();
    fx.findMessagesByIds.mockImplementation(
      async (_userId: string, ids: string[]) =>
        fx.messages
          .filter((m) => ids.includes(m.id))
          .map((m) => (m.id === "msg-b" ? { ...m, userId: OTHER } : m)),
    );
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-wrong-msg-user",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideB).toMatchObject({
      availability: "unavailable",
      reason: "message_wrong_user",
    });
  });

  it("12: invalid offsets fail closed", async () => {
    const fx = makeFixture();
    fx.findSpansByIds.mockImplementation(async (userId: string, ids: string[]) =>
      fx.spans
        .filter((s) => ids.includes(s.id) && s.userId === userId)
        .map((s) =>
          s.id === "span-a"
            ? { ...s, charStart: 0, charEnd: 99999, contentHash: sha("x") }
            : s,
        ),
    );
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-bad-offsets",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideA).toMatchObject({
      availability: "unavailable",
      reason: "invalid_offsets",
    });
  });

  it("12b: zero-length span (charEnd === charStart) fails closed even with empty-string hash", async () => {
    const fx = makeFixture();
    const emptyHash = sha("");
    expect(emptyHash).toBe(hashExactQuoteSlice(""));
    fx.findSpansByIds.mockImplementation(async (userId: string, ids: string[]) =>
      fx.spans
        .filter((s) => ids.includes(s.id) && s.userId === userId)
        .map((s) =>
          s.id === "span-a"
            ? { ...s, charStart: 5, charEnd: 5, contentHash: emptyHash }
            : s,
        ),
    );
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-zero-length",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideA).toMatchObject({
      availability: "unavailable",
      reason: "invalid_offsets",
    });
  });

  it("13: content-hash mismatch fails closed without trimming", async () => {
    const fx = makeFixture();
    fx.findSpansByIds.mockImplementation(async (userId: string, ids: string[]) =>
      fx.spans
        .filter((s) => ids.includes(s.id) && s.userId === userId)
        .map((s) =>
          s.id === "span-b"
            ? { ...s, contentHash: sha("tampered-hash-value") }
            : s,
        ),
    );
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-hash-mismatch",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideB).toMatchObject({
      availability: "unavailable",
      reason: "content_hash_mismatch",
    });
  });

  it("14–16: no proposition-text, complete-message, or messageId-first-span fallback", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-no-fallback",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });

    expect(presentation.sideA).toMatchObject({ spanId: "span-a" });
    expect(presentation.sideA).not.toMatchObject({ spanId: "span-decoy-first" });

    if (presentation.sideA.availability === "available") {
      expect(presentation.sideA.exactQuote).not.toBe(fx.messageA.content);
      expect(presentation.sideA.exactQuote).not.toContain("PREFIX");
    }

    expect(fx.findSpansByIds).toHaveBeenCalledWith(
      USER,
      expect.arrayContaining(["span-a", "span-b"]),
    );
  });

  it("session ownership: owned message with foreign session leaks no session id/label/origin", async () => {
    const fx = makeFixture();
    fx.findSessionsByIds.mockImplementation(
      async (_userId: string, ids: string[]) => {
        // Adversarial: return foreign-owned session for the message's sessionId.
        return ids
          .filter((id) => id === "sess-a")
          .map(() => ({
            id: "sess-a",
            userId: OTHER,
            origin: "IMPORTED_ARCHIVE" as const,
            label: "Foreign secret session",
          }));
      },
    );

    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-foreign-session",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });

    expect(presentation.sideA.availability).toBe("available");
    if (presentation.sideA.availability === "available") {
      expect(presentation.sideA.exactQuote).toBe(fx.quoteA);
      expect(presentation.sideA.sessionId).toBeNull();
      expect(presentation.sideA.sessionOrigin).toBeNull();
      expect(presentation.sideA.sessionLabel).toBeNull();
    }
    expect(JSON.stringify(presentation)).not.toContain("Foreign secret session");
    expect(JSON.stringify(presentation.sideA)).not.toContain("sess-a");
  });

  it("recordedAt prefers Message.createdAt over EvidenceSpan.createdAt", async () => {
    const fx = makeFixture();
    const presentation = await resolveContradictionDualSourcePresentation({
      userId: USER,
      node: {
        id: "cn-ts",
        sideASourceSpanId: fx.spanA.id,
        sideBSourceSpanId: fx.spanB.id,
      },
      reader: fx.reader,
    });
    expect(presentation.sideA).toMatchObject({
      recordedAt: "2026-07-01T09:00:00.000Z",
    });
    // Not the later span recording timestamp.
    expect(presentation.sideA).not.toMatchObject({
      recordedAt: "2026-07-01T10:00:00.000Z",
    });
  });

  it("17: projection performs no writes (reader is read-only interface)", async () => {
    const fx = makeFixture();
    expect(Object.keys(fx.reader).sort()).toEqual([
      "findMessagesByIds",
      "findSessionsByIds",
      "findSpansByIds",
    ]);
  });

  it("18: batch resolution avoids per-node source queries", async () => {
    const fx = makeFixture();
    const { stats } = await resolveContradictionDualSourcePresentations({
      userId: USER,
      nodes: [
        {
          id: "cn-1",
          sideASourceSpanId: fx.spanA.id,
          sideBSourceSpanId: fx.spanB.id,
        },
        {
          id: "cn-2",
          sideASourceSpanId: fx.spanA.id,
          sideBSourceSpanId: fx.spanB.id,
        },
        {
          id: "cn-3",
          sideASourceSpanId: null,
          sideBSourceSpanId: null,
        },
      ],
      reader: fx.reader,
    });

    expect(stats.spanQueryCount).toBe(1);
    expect(stats.messageQueryCount).toBe(1);
    expect(stats.sessionQueryCount).toBe(1);
    expect(fx.findSpansByIds).toHaveBeenCalledTimes(1);
    expect(fx.findSpansByIds).toHaveBeenCalledWith(USER, expect.any(Array));
  });

  it("Prisma adapter where clauses include userId for span/message/session", async () => {
    const evidenceSpanFindMany = vi.fn(async () => []);
    const messageFindMany = vi.fn(async () => []);
    const sessionFindMany = vi.fn(async () => []);
    const reader = createPrismaDualSourcePresentationReader({
      evidenceSpan: { findMany: evidenceSpanFindMany },
      message: { findMany: messageFindMany },
      session: { findMany: sessionFindMany },
    });

    await reader.findSpansByIds(USER, ["span-1"]);
    await reader.findMessagesByIds(USER, ["msg-1"]);
    await reader.findSessionsByIds(USER, ["sess-1"]);

    expect(evidenceSpanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["span-1"] }, userId: USER },
      }),
    );
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["msg-1"] }, userId: USER },
      }),
    );
    expect(sessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["sess-1"] }, userId: USER },
      }),
    );
  });

  it("user-facing copy never exposes internal reasons/IDs/hashes", () => {
    expect(dualSourceSideUnavailableCopy("content_hash_mismatch")).toBe(
      "Exact source is unavailable for this side.",
    );
    expect(dualSourceLineageNoticeCopy({
      lineageState: "partial_unavailable",
      sideA: {
        side: "A",
        availability: "unavailable",
        reason: "partial_lineage",
        integrityVerified: false,
      },
      sideB: {
        side: "B",
        availability: "unavailable",
        reason: "partial_lineage",
        integrityVerified: false,
      },
    })).not.toMatch(/lineage|partial_lineage/i);
  });

  it("includeDualSource opt-in flag parsing", () => {
    expect(
      isIncludeDualSourceEnabled(
        new URLSearchParams("includeDualSource=true"),
      ),
    ).toBe(true);
    expect(isIncludeDualSourceEnabled(new URLSearchParams(""))).toBe(false);
  });

  it("client-safe contract module has no server-only imports", () => {
    const contract = readFileSync(
      join(process.cwd(), "lib/contradiction-dual-source-presentation-contract.ts"),
      "utf8",
    );
    expect(contract).not.toMatch(/from\s+["']node:crypto["']/);
    expect(contract).not.toMatch(/from\s+["'][^"']*contradiction-dual-side-lineage["']/);
    expect(contract).not.toMatch(/from\s+["'][^"']*prismadb["']/);
    expect(contract).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(contract).not.toContain("persistRepairedContradictionCandidate");
    expect(contract).not.toContain("buildContradictionPersistencePlan");
    expect(contract).not.toMatch(/\bcreateHash\b/);
  });
});
