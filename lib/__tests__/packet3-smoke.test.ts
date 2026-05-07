/**
 * Packet 3 Smoke Tests + Regression Fixtures (P3-11)
 *
 * End-to-end integration tests that exercise the full engine path:
 *
 *   history synthesis → family detectors → upsertPatternClaimFromClue
 *     → materializeReceipt → advanceClaimLifecycle → hooks
 *
 * These tests protect the engine wiring. If any connection in the pipeline
 * breaks, at least one smoke test will fail.
 *
 * Uses a hand-rolled mock DB that supports all operations in the full path.
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { patternClaimHooks } from "../pattern-claim-hooks";
import {
  buildSupportEntryHistoryLookup,
  materializeClueSupport,
  patternDetectorV1,
} from "../pattern-detector-v1";
import { replayPersistedPatternClaim } from "../pattern-claim-replay";
import { materializeReceipt } from "../pattern-claim-evidence";
import { upsertPatternClaimFromClue } from "../pattern-claim-lifecycle";
import type { PatternClaimEvent } from "../pattern-claim-hooks";
import { createPatternRerunDebugCollector } from "../pattern-rerun-debug";

// ── Full pipeline mock DB ─────────────────────────────────────────────────────

type ClaimRow = {
  id: string;
  userId: string;
  patternType: string;
  summaryNorm: string;
  summary: string;
  status: string;
  strengthLevel: string;
  sourceRunId: string | null;
  createdAt: Date;
};

type EvidenceRow = {
  id: string;
  claimId: string;
  source: string;
  sessionId: string | null;
  messageId: string | null;
  journalEntryId: string | null;
  quote: string | null;
  createdAt: Date;
};

type MessageRow = {
  id: string;
  sessionId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: Date;
  session: { origin: string; startedAt: Date };
};

type JournalEntryRow = {
  id: string;
  userId: string;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
};

let rowSeq = 0;
const nextId = () => `row_${++rowSeq}`;

function makePipelineMockDb(opts: {
  messages?: MessageRow[];
  journalEntries?: JournalEntryRow[];
  existingClaims?: ClaimRow[];
  existingEvidence?: EvidenceRow[];
} = {}) {
  const messages: MessageRow[] = opts.messages ?? [];
  const journalEntries: JournalEntryRow[] = opts.journalEntries ?? [];
  const claims: ClaimRow[] = opts.existingClaims ?? [];
  const evidence: EvidenceRow[] = opts.existingEvidence ?? [];

  const db = {
    // history-synthesis
    message: {
      findMany: async () => messages,
    },
    journalEntry: {
      findMany: async () => journalEntries,
    },
    // contradiction-drift-adapter (return empty — no contradictions in smoke tests)
    contradictionNode: {
      findMany: async () => [],
    },
    // pattern-claim-lifecycle
    patternClaim: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const key = where.userId_patternType_summaryNorm as Record<string, string>;
        return (
          claims.find(
            (c) =>
              c.userId === key.userId &&
              c.patternType === key.patternType &&
              c.summaryNorm === key.summaryNorm
          ) ?? null
        );
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        claims.find((c) => c.id === where.id) ?? null,
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        if (!where) return claims;
        return claims.filter((c) => {
          if (where.userId && c.userId !== where.userId) return false;
          return true;
        });
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: ClaimRow = {
          id: nextId(),
          userId: data.userId as string,
          patternType: data.patternType as string,
          summaryNorm: data.summaryNorm as string,
          summary: data.summary as string,
          status: (data.status as string) ?? "candidate",
          strengthLevel: (data.strengthLevel as string) ?? "tentative",
          sourceRunId: (data.sourceRunId as string | null) ?? null,
          createdAt: new Date(),
        };
        claims.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const idx = claims.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error(`claim ${where.id} not found`);
        claims[idx] = { ...claims[idx]!, ...data } as ClaimRow;
        return claims[idx]!;
      },
    },
    // pattern-claim-evidence
    patternClaimEvidence: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return (
          evidence.find(
            (e) =>
              e.claimId === where.claimId &&
              (where.messageId === undefined || e.messageId === where.messageId) &&
              (where.journalEntryId === undefined ||
                e.journalEntryId === where.journalEntryId) &&
              (where.quote === undefined || e.quote === where.quote)
          ) ?? null
        );
      },
      findMany: async ({ where }: { where: { claimId?: string } }) =>
        evidence.filter((e) => !where.claimId || e.claimId === where.claimId),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: EvidenceRow = {
          id: nextId(),
          claimId: data.claimId as string,
          source: (data.source as string) ?? "derivation",
          sessionId: (data.sessionId as string | null) ?? null,
          messageId: (data.messageId as string | null) ?? null,
          journalEntryId: (data.journalEntryId as string | null) ?? null,
          quote: (data.quote as string | null) ?? null,
          createdAt: new Date(),
        };
        evidence.push(row);
        return row;
      },
    },
    _claims: claims,
    _evidence: evidence,
  };

  return db as unknown as PrismaClient & {
    _claims: ClaimRow[];
    _evidence: EvidenceRow[];
  };
}

function makeMessage(
  content: string,
  overrides: Partial<MessageRow> = {}
): MessageRow {
  return {
    id: nextId(),
    sessionId: "sess1",
    userId: "u1",
    role: "user",
    content,
    createdAt: new Date("2026-01-10"),
    session: { origin: "APP", startedAt: new Date("2026-01-01") },
    ...overrides,
  };
}

function makeJournalEntry(
  body: string,
  overrides: Partial<JournalEntryRow> = {}
): JournalEntryRow {
  return {
    id: nextId(),
    userId: "u1",
    body,
    authoredAt: new Date("2026-01-10"),
    createdAt: new Date("2026-01-10"),
    ...overrides,
  };
}

function buildReplayableClaimFromDb(
  db: PrismaClient & {
    _claims: ClaimRow[];
    _evidence: EvidenceRow[];
  },
  claimId: string
) {
  const claim = db._claims.find((row) => row.id === claimId);
  if (!claim) {
    throw new Error(`Claim not found in test DB: ${claimId}`);
  }

  return {
    id: claim.id,
    patternType: claim.patternType as
      | "trigger_condition"
      | "inner_critic"
      | "repetitive_loop"
      | "contradiction_drift"
      | "recovery_stabilizer",
    summary: claim.summary,
    status: claim.status as "candidate" | "active" | "paused" | "dismissed",
    strengthLevel: claim.strengthLevel as "tentative" | "developing" | "established",
    createdAt: claim.createdAt,
    updatedAt: claim.createdAt,
    evidence: db._evidence
      .filter((row) => row.claimId === claimId)
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .map((row) => ({
        id: row.id,
        source: row.source,
        sessionId: row.sessionId,
        messageId: row.messageId,
        journalEntryId: row.journalEntryId,
        quote: row.quote,
        createdAt: row.createdAt,
      })),
    actions: [],
  };
}

describe("Packet 3 smoke — imported support evidence quality gate", () => {
  it("does not materialize imported technical/code/source-text support entries as receipts", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "repetitive_loop" as const,
      summary: 'Repetitive loop pattern across sessions: "I keep repeating this pattern."',
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s1",
          messageId: "import-m1",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content: "Again.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s2",
          messageId: "import-m2",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content: "user@host % npx prisma migrate reset --force",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s3",
          messageId: "import-m3",
          journalEntryId: null,
          timestamp: new Date("2026-01-03T00:00:00.000Z"),
          content: "```ts\nconst handler = async () => {\n  return null;\n};\n```",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s4",
          messageId: "import-m4",
          journalEntryId: null,
          timestamp: new Date("2026-01-04T00:00:00.000Z"),
          content:
            "I need to coordinate Codex tasks and wire the Pinecone index setup before the next pass.",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    expect(db._evidence.filter((row) => row.claimId === claimId)).toHaveLength(0);
  });

  it("still materializes clean imported behavioral support entries", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "trigger_condition" as const,
      summary: 'Trigger-response pattern: "When pressure rises, I default to appeasing."',
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s1",
          messageId: "import-clean-1",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content:
            "When pressure rises, I default to appeasing people instead of staying direct.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s2",
          messageId: "import-clean-2",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content:
            "Whenever I feel uncertain, I tend to overthink and avoid committing.",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    const claimEvidence = db._evidence.filter((row) => row.claimId === claimId);
    expect(claimEvidence).toHaveLength(2);
    expect(claimEvidence.map((row) => row.messageId)).toEqual([
      "import-clean-1",
      "import-clean-2",
    ]);
  });

  it("does not apply the quality gate to native APP support entries", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "repetitive_loop" as const,
      summary: 'Repetitive loop pattern across sessions: "I keep doing this."',
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "APP",
          sessionId: "app-s1",
          messageId: "app-m1",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content: "Again.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "APP",
          sessionId: "app-s2",
          messageId: "app-m2",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content: "user@host % npx prisma migrate reset --force",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    const claimEvidence = db._evidence.filter((row) => row.claimId === claimId);
    expect(claimEvidence).toHaveLength(2);
    expect(claimEvidence.map((row) => row.messageId)).toEqual(["app-m1", "app-m2"]);
  });

  it("repetitive_loop: rejects weak imported loop support markers while keeping clean loop evidence", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "repetitive_loop" as const,
      summary: 'Repetitive loop pattern across sessions: "I keep falling back into the same pattern."',
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s1",
          messageId: "import-valid-loop",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content: "I keep falling back into the same pattern when stress spikes.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s2",
          messageId: "import-weak-again",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content: "Again.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          sessionId: "import-s3",
          messageId: "import-weak-code",
          journalEntryId: null,
          timestamp: new Date("2026-01-03T00:00:00.000Z"),
          content: "```bash\nnpm run build\n```",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    const claimEvidence = db._evidence.filter((row) => row.claimId === claimId);
    expect(claimEvidence).toHaveLength(1);
    expect(claimEvidence[0]?.messageId).toBe("import-valid-loop");
  });

  it("gates imported support entries with missing direct origin metadata via history lookup", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "trigger_condition" as const,
      summary: 'Trigger-response pattern: "When pressure rises, I default to appeasing."',
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionId: "import-s1",
          messageId: "import-lookup-clean",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content:
            "When pressure rises, I default to appeasing people instead of staying direct.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionId: "import-s2",
          messageId: "import-lookup-noise",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content: "user@host % npx prisma migrate reset --force",
        },
      ],
    };

    const lookup = buildSupportEntryHistoryLookup([
      {
        sourceKind: "chat_message",
        messageId: "import-lookup-clean",
        sessionId: "import-s1",
        journalEntryId: null,
        sessionOrigin: "IMPORTED_ARCHIVE",
        sessionStartedAt: new Date("2026-01-01T00:00:00.000Z"),
        role: "user",
        content: "When pressure rises, I default to appeasing people instead of staying direct.",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        sourceKind: "chat_message",
        messageId: "import-lookup-noise",
        sessionId: "import-s2",
        journalEntryId: null,
        sessionOrigin: "IMPORTED_ARCHIVE",
        sessionStartedAt: new Date("2026-01-02T00:00:00.000Z"),
        role: "user",
        content: "user@host % npx prisma migrate reset --force",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({
      claimId,
      clue,
      db,
      supportEntryHistoryLookup: lookup,
    });

    const claimEvidence = db._evidence.filter((row) => row.claimId === claimId);
    expect(claimEvidence).toHaveLength(1);
    expect(claimEvidence[0]?.messageId).toBe("import-lookup-clean");
  });

  it("does not apply the import-only gate to journal support entries", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "repetitive_loop" as const,
      summary: 'Repetitive loop pattern across sessions: "I keep looping."',
      supportEntries: [
        {
          sourceKind: "journal_entry" as const,
          sessionId: null,
          messageId: null,
          journalEntryId: "journal-entry-1",
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content: "Again.",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    const claimEvidence = db._evidence.filter((row) => row.claimId === claimId);
    expect(claimEvidence).toHaveLength(1);
    expect(claimEvidence[0]?.journalEntryId).toBe("journal-entry-1");
  });

  it("accounts every support entry as evaluated or skipped on the runtime materialization path", async () => {
    const db = makePipelineMockDb();
    const debugCollector = createPatternRerunDebugCollector();
    const clue = {
      userId: "u1",
      patternType: "trigger_condition" as const,
      summary: 'Trigger-response pattern: "When pressure rises, I default to appeasing."',
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          role: "user",
          sessionId: "import-s1",
          messageId: "import-ok",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content:
            "When pressure rises, I default to appeasing people instead of staying direct.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "IMPORTED_ARCHIVE",
          role: "user",
          sessionId: "import-s2",
          messageId: "import-reject",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content: "user@host % npx prisma migrate reset --force",
        },
        {
          sourceKind: "chat_message" as const,
          sessionOrigin: "APP",
          role: "user",
          sessionId: "app-s1",
          messageId: "app-skip",
          journalEntryId: null,
          timestamp: new Date("2026-01-03T00:00:00.000Z"),
          content: "Again.",
        },
        {
          sourceKind: "journal_entry" as const,
          role: "user",
          sessionId: null,
          messageId: null,
          journalEntryId: "journal-skip",
          timestamp: new Date("2026-01-04T00:00:00.000Z"),
          content: "Again.",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db, debugCollector });

    const diagnostics = debugCollector.buildDiagnostics();
    expect(diagnostics.supportEntriesTotal).toBe(4);
    expect(diagnostics.importedSupportEntriesEvaluatedForEvidenceQuality).toBe(2);
    expect(diagnostics.supportEntriesSkippedEvidenceQualityGateCount).toBe(2);
    expect(
      diagnostics.importedSupportEntriesEvaluatedForEvidenceQuality +
        diagnostics.supportEntriesSkippedEvidenceQualityGateCount
    ).toBe(diagnostics.supportEntriesTotal);

    const claimEvidence = db._evidence.filter((row) => row.claimId === claimId);
    expect(claimEvidence).toHaveLength(3);
    expect(claimEvidence.some((row) => row.messageId === "import-reject")).toBe(false);
  });
});

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe("Packet 3 smoke — trigger_condition full pipeline", () => {
  it("creates a PatternClaim and evidence when threshold met", async () => {
    const db = makePipelineMockDb({
      messages: [
        makeMessage("whenever I'm stressed, I tend to procrastinate"),
        makeMessage("every time work gets hard, I end up avoiding it", {
          sessionId: "sess2",
        }),
        makeMessage("this kind of pressure triggers me to shut down", {
          sessionId: "sess3",
          id: "msg_rep",
        }),
      ],
    });

    const claimsCreated = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    expect(claimsCreated).toBeGreaterThanOrEqual(1);
    const tc = db._claims.find((c) => c.patternType === "trigger_condition");
    expect(tc).toBeDefined();
    expect(tc!.status).toBe("active"); // 1 evidence → candidate → active
    expect(db._evidence.some((e) => e.claimId === tc!.id)).toBe(true);
  });

  it("persists enough support to replay a non-null canonical summary", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "trigger_condition" as const,
      summary: 'Trigger-response pattern: "Whenever someone seems upset with me, I default to people-pleasing"',
      sourceKind: "chat_message" as const,
      sessionId: "s1",
      messageId: "m1",
      journalEntryId: null,
      quote: "Whenever someone seems upset with me, I default to people-pleasing",
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionId: "s1",
          messageId: "m1",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content: "Whenever someone seems upset with me, I default to people-pleasing",
        },
        {
          sourceKind: "chat_message" as const,
          sessionId: "s2",
          messageId: "m2",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content: "When pressure rises, I start appeasing people instead of staying honest",
        },
        {
          sourceKind: "chat_message" as const,
          sessionId: "s3",
          messageId: "m3",
          journalEntryId: null,
          timestamp: new Date("2026-01-03T00:00:00.000Z"),
          content: "Every time a boundary might disappoint someone, I walk it back quickly",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    const replayableClaim = buildReplayableClaimFromDb(db, claimId);
    const replay = replayPersistedPatternClaim({
      claim: replayableClaim,
      evidence: replayableClaim.evidence,
      abstentionThreshold: 0.55,
    });

    expect(
      db._evidence.filter((e) => e.claimId === claimId && typeof e.quote === "string" && e.quote)
        .length
    ).toBe(3);
    expect(replay.replayed.summaryText).toBe(
      "When pressure rises, you default to pleasing or appeasing."
    );
    expect(replay.completeness.supportBundleComplete).toBe(true);
  });

  it("preserves the representative support sentence even when clue.quote differs", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "trigger_condition" as const,
      summary: 'Trigger-response pattern: "I notice I am definitely a people pleaser"',
      sourceKind: "chat_message" as const,
      sessionId: "s1",
      messageId: "m1",
      journalEntryId: null,
      quote: "When pressure rises, I start appeasing people instead of staying honest",
      supportEntries: [
        {
          sourceKind: "chat_message" as const,
          sessionId: "s1",
          messageId: "m1",
          journalEntryId: null,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          content: "I notice I am definitely a people pleaser. I apologize immediately.",
        },
        {
          sourceKind: "chat_message" as const,
          sessionId: "s2",
          messageId: "m2",
          journalEntryId: null,
          timestamp: new Date("2026-01-02T00:00:00.000Z"),
          content: "When pressure rises, I start appeasing people instead of staying honest",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    const claimEvidence = db._evidence.filter((e) => e.claimId === claimId);
    expect(claimEvidence).toHaveLength(3);
    expect(
      claimEvidence.some((e) => e.messageId === "m1" && e.quote === "I notice I am definitely a people pleaser.")
    ).toBe(true);
    expect(
      claimEvidence.some(
        (e) =>
          e.messageId === "m1" &&
          e.quote === "When pressure rises, I start appeasing people instead of staying honest"
      )
    ).toBe(true);
  });
});

describe("Packet 3 smoke — inner_critic full pipeline", () => {
  it("creates a PatternClaim when IC threshold met", async () => {
    const db = makePipelineMockDb({
      messages: [
        makeMessage("I'm terrible at staying on track"),
        makeMessage("I can't do anything right", { sessionId: "sess2" }),
        makeMessage("why do I always mess this up", { sessionId: "sess3" }),
      ],
    });

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });

    const ic = db._claims.find((c) => c.patternType === "inner_critic");
    expect(ic).toBeDefined();
    expect(ic!.status).toBe("active");
  });
});

describe("Packet 3 smoke — repetitive_loop full pipeline", () => {
  it("creates a PatternClaim when RL threshold met", async () => {
    const db = makePipelineMockDb({
      messages: [
        makeMessage("I keep falling back into the same pattern"),
        makeMessage("here I am again doing the same thing", { sessionId: "sess2" }),
        makeMessage("I'm back to square one as usual", { sessionId: "sess3" }),
      ],
    });

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });

    const rl = db._claims.find((c) => c.patternType === "repetitive_loop");
    expect(rl).toBeDefined();
  });

  it("persists enough support to replay a non-null canonical summary", async () => {
    const db = makePipelineMockDb({
      messages: [
        makeMessage("I keep circling back to the same regret about wasting my potential", {
          id: "m1",
          sessionId: "s1",
        }),
        makeMessage(
          "The same confidence regret comes back whenever I think about what I could have done",
          { id: "m2", sessionId: "s2" }
        ),
        makeMessage("I revisit that wasted-potential feeling over and over", {
          id: "m3",
          sessionId: "s3",
        }),
      ],
    });

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });

    const rl = db._claims.find((c) => c.patternType === "repetitive_loop");
    expect(rl).toBeDefined();
    const replayableClaim = buildReplayableClaimFromDb(db, rl!.id);
    const replay = replayPersistedPatternClaim({
      claim: replayableClaim,
      evidence: replayableClaim.evidence,
      abstentionThreshold: 0.55,
    });

    expect(
      db._evidence.filter((e) => e.claimId === rl!.id && typeof e.quote === "string" && e.quote)
        .length
    ).toBeGreaterThanOrEqual(2);
    expect(replay.replayed.summaryText).toBe(
      "The same confidence-related regret keeps resurfacing."
    );
    expect(replay.completeness.supportBundleComplete).toBe(true);
  });
});

describe("Packet 3 smoke — single receipt claims remain incomplete when support is real", () => {
  it("does not fake replay completeness for a one-quote claim", async () => {
    const db = makePipelineMockDb();
    const { claimId } = await upsertPatternClaimFromClue({
      clue: {
        userId: "u1",
        patternType: "trigger_condition",
        summary: 'Trigger-response pattern: "I notice I am definitely a people pleaser"',
      },
      db,
    });

    await materializeReceipt({
      claimId,
      sessionId: "s1",
      messageId: "m1",
      quote: "I notice I am definitely a people pleaser",
      db,
    });

    const replayableClaim = buildReplayableClaimFromDb(db, claimId);
    const replay = replayPersistedPatternClaim({
      claim: replayableClaim,
      evidence: replayableClaim.evidence,
      abstentionThreshold: 0.55,
    });

    expect(replay.replayed.summaryText).toBeNull();
    expect(replay.completeness.supportBundleComplete).toBe(false);
    expect(replay.completeness.missingFields).toContain("summaryText");
  });
});

describe("Packet 3 smoke — recovery_stabilizer full pipeline", () => {
  it("creates a PatternClaim when RS threshold met", async () => {
    const db = makePipelineMockDb({
      messages: [
        makeMessage("I've been doing better with my routines lately"),
        makeMessage("finally managed to stick with my plan this week", {
          sessionId: "sess2",
        }),
      ],
    });

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });

    const rs = db._claims.find((c) => c.patternType === "recovery_stabilizer");
    expect(rs).toBeDefined();
  });
});

describe("Packet 3 smoke — re-run deduplication", () => {
  it("second run does not create duplicate claims", async () => {
    const db = makePipelineMockDb({
      messages: [
        makeMessage("whenever I'm stressed, I tend to procrastinate"),
        makeMessage("every time work gets hard, I end up avoiding it", {
          sessionId: "sess2",
        }),
        makeMessage("this kind of pressure triggers me to shut down", {
          sessionId: "sess3",
        }),
      ],
    });

    const first = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    const second = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run2",
      db,
    });

    const tcClaims = db._claims.filter((c) => c.patternType === "trigger_condition");
    expect(tcClaims).toHaveLength(1); // exactly one claim, not two
    expect(first).toBeGreaterThan(0); // first run created it
    expect(second).toBe(0); // second run found existing, created=false
  });
});

describe("Packet 3 smoke — evidence deduplication on re-run", () => {
  it("re-run does not add duplicate evidence receipts", async () => {
    const db = makePipelineMockDb({
      messages: [
        makeMessage("whenever stressed I tend to procrastinate", {
          id: "m1",
          sessionId: "s1",
        }),
        makeMessage("every time work piles up I end up avoiding", {
          id: "m2",
          sessionId: "s2",
        }),
        makeMessage("this triggers me to shut down", { id: "m3", sessionId: "s3" }),
      ],
    });

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });
    const evidenceAfterFirst = db._evidence.length;

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run2", db });
    const evidenceAfterSecond = db._evidence.length;

    expect(evidenceAfterSecond).toBe(evidenceAfterFirst);
  });
});

describe("Packet 3 smoke — hooks fire on candidate creation", () => {
  it("emits candidate_available event when new claim is created", async () => {
    patternClaimHooks._reset();
    const events: PatternClaimEvent[] = [];
    patternClaimHooks.on((e) => { events.push(e); });

    const db = makePipelineMockDb({
      messages: [
        makeMessage("whenever I'm stressed, I tend to procrastinate"),
        makeMessage("every time work gets hard, I end up avoiding it", {
          sessionId: "sess2",
        }),
        makeMessage("this kind of pressure triggers me to shut down", {
          sessionId: "sess3",
        }),
      ],
    });

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });
    await Promise.resolve(); // flush microtasks for hook listeners

    const candidateEvents = events.filter(
      (e) => e.type === "candidate_available" && e.patternType === "trigger_condition"
    );
    expect(candidateEvents).toHaveLength(1);
    expect(candidateEvents[0]!.userId).toBe("u1");

    patternClaimHooks._reset();
  });

  it("emits claim_active event when claim transitions to active", async () => {
    patternClaimHooks._reset();
    const events: PatternClaimEvent[] = [];
    patternClaimHooks.on((e) => { events.push(e); });

    const db = makePipelineMockDb({
      messages: [
        makeMessage("whenever I'm stressed, I tend to procrastinate"),
        makeMessage("every time work gets hard, I end up avoiding it", {
          sessionId: "sess2",
        }),
        makeMessage("this kind of pressure triggers me to shut down", {
          sessionId: "sess3",
        }),
      ],
    });

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });
    await Promise.resolve();

    const activeEvents = events.filter((e) => e.type === "claim_active");
    expect(activeEvents.length).toBeGreaterThanOrEqual(1);

    patternClaimHooks._reset();
  });
});

describe("Packet 3 smoke — empty history returns 0 claims", () => {
  it("returns 0 when user has no messages", async () => {
    const db = makePipelineMockDb({ messages: [] });
    const count = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });
    expect(count).toBe(0);
    expect(db._claims).toHaveLength(0);
  });
});

describe("Packet 3 smoke — journal entries feed detector input", () => {
  it("creates claims from journal-only history and stores journalEntryId provenance", async () => {
    const db = makePipelineMockDb({
      messages: [],
      journalEntries: [
        makeJournalEntry("I'm terrible at staying on track lately.", {
          id: "journal-1",
          authoredAt: new Date("2026-01-01T10:00:00.000Z"),
        }),
        makeJournalEntry("I can't keep commitments when pressure builds.", {
          id: "journal-2",
          authoredAt: new Date("2026-01-02T10:00:00.000Z"),
        }),
        makeJournalEntry("why do I always mess this up", {
          id: "journal-3",
          authoredAt: new Date("2026-01-03T10:00:00.000Z"),
        }),
      ],
    });

    const claimsCreated = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run-journal-1",
      db,
    });

    expect(claimsCreated).toBeGreaterThanOrEqual(1);
    const innerCritic = db._claims.find((claim) => claim.patternType === "inner_critic");
    expect(innerCritic).toBeDefined();

    const journalReceipts = db._evidence.filter(
      (evidence) => evidence.claimId === innerCritic!.id && evidence.journalEntryId !== null
    );
    expect(journalReceipts.length).toBeGreaterThan(0);
    expect(
      journalReceipts.every(
        (evidence) => evidence.sessionId === null && evidence.messageId === null
      )
    ).toBe(true);
  });
});

describe("Packet 3 smoke — multiple families in one run", () => {
  it("creates separate claims for different pattern families", async () => {
    const db = makePipelineMockDb({
      messages: [
        // trigger_condition markers (3)
        makeMessage("whenever I'm stressed, I tend to avoid tasks"),
        makeMessage("every time pressure builds, I end up procrastinating", {
          sessionId: "s2",
        }),
        makeMessage("this triggers me to shut down", { sessionId: "s3" }),
        // inner_critic markers (3)
        makeMessage("I'm terrible at staying consistent", { sessionId: "s4" }),
        makeMessage("I can't do anything right", { sessionId: "s5" }),
        makeMessage("why do I always mess this up", { sessionId: "s6" }),
        // recovery_stabilizer markers (2)
        makeMessage("I've been doing better this week", { sessionId: "s7" }),
        makeMessage("finally managed to keep my routine", { sessionId: "s8" }),
      ],
    });

    const claimsCreated = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    expect(claimsCreated).toBeGreaterThanOrEqual(3);
    const types = db._claims.map((c) => c.patternType);
    expect(types).toContain("trigger_condition");
    expect(types).toContain("inner_critic");
    expect(types).toContain("recovery_stabilizer");
  });
});
