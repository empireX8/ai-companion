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
import { materializeClueSupport, patternDetectorV1 } from "../pattern-detector-v1";
import { replayPersistedPatternClaim } from "../pattern-claim-replay";
import { materializeReceipt } from "../pattern-claim-evidence";
import { upsertPatternClaimFromClue } from "../pattern-claim-lifecycle";
import type { NormalizedHistoryEntry } from "../history-synthesis";
import type { PatternClaimEvent } from "../pattern-claim-hooks";

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

let rowSeq = 0;
const nextId = () => `row_${++rowSeq}`;

function makePipelineMockDb(opts: {
  messages?: MessageRow[];
  existingClaims?: ClaimRow[];
  existingEvidence?: EvidenceRow[];
} = {}) {
  const messages: MessageRow[] = opts.messages ?? [];
  const claims: ClaimRow[] = opts.existingClaims ?? [];
  const evidence: EvidenceRow[] = opts.existingEvidence ?? [];

  const db = {
    // history-synthesis
    message: {
      findMany: async () => messages,
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
        quote: row.quote,
        createdAt: row.createdAt,
      })),
    actions: [],
  };
}

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
      sessionId: "s1",
      messageId: "m1",
      quote: "Whenever someone seems upset with me, I default to people-pleasing",
      supportEntries: [
        {
          sessionId: "s1",
          messageId: "m1",
          content: "Whenever someone seems upset with me, I default to people-pleasing",
        },
        {
          sessionId: "s2",
          messageId: "m2",
          content: "When pressure rises, I start appeasing people instead of staying honest",
        },
        {
          sessionId: "s3",
          messageId: "m3",
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

  it("does not double-persist the representative message when support entries include it", async () => {
    const db = makePipelineMockDb();
    const clue = {
      userId: "u1",
      patternType: "trigger_condition" as const,
      summary: 'Trigger-response pattern: "Whenever someone seems upset with me, I default to people-pleasing"',
      sessionId: "s1",
      messageId: "m1",
      quote: "Whenever someone seems upset with me, I default to people-pleasing",
      supportEntries: [
        {
          sessionId: "s1",
          messageId: "m1",
          content: "Whenever someone seems upset with me, I default to people-pleasing. I apologize immediately.",
        },
        {
          sessionId: "s2",
          messageId: "m2",
          content: "When pressure rises, I start appeasing people instead of staying honest",
        },
      ],
    };

    const { claimId } = await upsertPatternClaimFromClue({ clue, db });
    await materializeClueSupport({ claimId, clue, db });

    const claimEvidence = db._evidence.filter((e) => e.claimId === claimId);
    expect(claimEvidence).toHaveLength(2);
    expect(claimEvidence.filter((e) => e.messageId === "m1")).toHaveLength(1);
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
