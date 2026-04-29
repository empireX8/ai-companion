/**
 * Pattern Claim Lifecycle Engine tests (P3-06)
 *
 * Covers: normalizeSummary, upsertPatternClaimFromClue,
 * advanceClaimLifecycle (all lifecycle transitions + cascade).
 */

import type { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  advanceClaimLifecycle,
  loadPersistedPatternClaimsForReplay,
  normalizeSummary,
  runPersistedClaimReplayAudit,
  upsertPatternClaimFromClue,
  type PatternClue,
} from "../pattern-claim-lifecycle";

// ── normalizeSummary ──────────────────────────────────────────────────────────

describe("normalizeSummary", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeSummary("Recurring Goal! Behavior Gap")).toBe(
      "recurring goal behavior gap"
    );
  });

  it("collapses extra whitespace", () => {
    expect(normalizeSummary("hello   world")).toBe("hello world");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeSummary("  hello  ")).toBe("hello");
  });

  it("caps at 300 chars", () => {
    expect(normalizeSummary("a".repeat(400))).toHaveLength(300);
  });

  it("returns empty string for empty input", () => {
    expect(normalizeSummary("")).toBe("");
  });
});

// ── Mock DB factory ───────────────────────────────────────────────────────────

type ClaimRow = {
  id: string;
  userId: string;
  patternType: string;
  summaryNorm: string;
  summary: string;
  status: string;
  strengthLevel: string;
  sourceRunId: string | null;
  journalEvidenceCount?: number;
  journalDaySpread?: number;
};

type EvidenceRow = {
  sessionId: string | null;
  journalEntryId?: string | null;
  createdAt?: Date;
  journalEntry?: {
    authoredAt?: Date | null;
    createdAt: Date;
  } | null;
};

let idSeq = 0;
const nextId = () => `claim_${++idSeq}`;

function makeMockDb(opts: {
  existingClaim?: ClaimRow | null;
  evidence?: EvidenceRow[];
} = {}) {
  const claims: ClaimRow[] = opts.existingClaim ? [opts.existingClaim] : [];
  const evidence: EvidenceRow[] = opts.evidence ?? [];

  const db = {
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
        if (idx === -1) throw new Error("claim not found");
        claims[idx] = { ...claims[idx]!, ...data } as ClaimRow;
        return claims[idx]!;
      },
    },
    patternClaimEvidence: {
      findMany: async () =>
        evidence.map((row) => ({
          sessionId: row.sessionId,
          journalEntryId: row.journalEntryId ?? null,
          createdAt: row.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
          journalEntry: row.journalEntry ?? null,
        })),
    },
    _claims: claims,
  };

  return db as unknown as PrismaClient & { _claims: ClaimRow[] };
}

const BASE_CLUE: PatternClue = {
  userId: "u1",
  patternType: "contradiction_drift",
  summary: "Recurring goal behavior gap across 3 contradictions",
};

function makeReplayDb() {
  let findManyCalls = 0;
  const rows = [
    {
      id: "claim-b",
      patternType: "trigger_condition",
      summary: "Second stored summary",
      status: "active",
      strengthLevel: "developing",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      evidence: [
        {
          id: "ev-b2",
          source: "derivation",
          sessionId: "sess-2",
          messageId: "msg-2",
          quote: "Later quote",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "ev-b1",
          source: "derivation",
          sessionId: "sess-1",
          messageId: "msg-1",
          quote: "Earlier quote",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    },
    {
      id: "claim-a",
      patternType: "contradiction_drift",
      summary: "Recurring goal behavior gap across 3 contradictions",
      status: "active",
      strengthLevel: "tentative",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      evidence: [
        {
          id: "ev-a2",
          source: "derivation",
          sessionId: "sess-2",
          messageId: "msg-2",
          quote: "Second contradiction quote",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "ev-a1",
          source: "derivation",
          sessionId: "sess-1",
          messageId: "msg-1",
          quote: "First contradiction quote",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    },
  ];

  const db = {
    patternClaim: {
      findMany: async () => {
        findManyCalls += 1;
        return rows;
      },
      create: async () => {
        throw new Error("unexpected patternClaim.create");
      },
      update: async () => {
        throw new Error("unexpected patternClaim.update");
      },
    },
    patternClaimEvidence: {
      create: async () => {
        throw new Error("unexpected patternClaimEvidence.create");
      },
      update: async () => {
        throw new Error("unexpected patternClaimEvidence.update");
      },
    },
    _findManyCalls: () => findManyCalls,
  };

  return db as unknown as PrismaClient & { _findManyCalls: () => number };
}

// ── upsertPatternClaimFromClue ────────────────────────────────────────────────

describe("upsertPatternClaimFromClue", () => {
  it("creates a new claim with status=candidate and strengthLevel=tentative", async () => {
    const db = makeMockDb();
    const result = await upsertPatternClaimFromClue({ clue: BASE_CLUE, db });

    expect(result.created).toBe(true);
    expect(result.status).toBe("candidate");
    expect(db._claims[0]!.strengthLevel).toBe("tentative");
  });

  it("is idempotent — returns existing claim with created=false", async () => {
    const db = makeMockDb();
    const first = await upsertPatternClaimFromClue({ clue: BASE_CLUE, db });
    const second = await upsertPatternClaimFromClue({ clue: BASE_CLUE, db });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.claimId).toBe(first.claimId);
    expect(db._claims).toHaveLength(1);
  });

  it("dedup is case-insensitive via normalizeSummary", async () => {
    const db = makeMockDb();
    const clue1 = { ...BASE_CLUE, summary: "Recurring goal behavior gap across 3 contradictions" };
    const clue2 = { ...BASE_CLUE, summary: "RECURRING GOAL BEHAVIOR GAP ACROSS 3 CONTRADICTIONS" };

    const first = await upsertPatternClaimFromClue({ clue: clue1, db });
    const second = await upsertPatternClaimFromClue({ clue: clue2, db });

    expect(second.created).toBe(false);
    expect(second.claimId).toBe(first.claimId);
  });

  it("different patternType creates a separate claim", async () => {
    const db = makeMockDb();
    await upsertPatternClaimFromClue({ clue: { ...BASE_CLUE, patternType: "contradiction_drift" }, db });
    const result = await upsertPatternClaimFromClue({
      clue: { ...BASE_CLUE, patternType: "inner_critic" },
      db,
    });

    expect(result.created).toBe(true);
    expect(db._claims).toHaveLength(2);
  });

  it("forwards sourceRunId to the claim", async () => {
    const db = makeMockDb();
    await upsertPatternClaimFromClue({
      clue: { ...BASE_CLUE, sourceRunId: "run_xyz" },
      db,
    });
    expect(db._claims[0]!.sourceRunId).toBe("run_xyz");
  });
});

describe("persisted claim replay loader", () => {
  it("loads claims and evidence in deterministic storage-boundary order", async () => {
    const db = makeReplayDb();

    const claims = await loadPersistedPatternClaimsForReplay({ db });

    expect(db._findManyCalls()).toBe(1);
    expect(claims.map((claim) => claim.id)).toEqual(["claim-a", "claim-b"]);
    expect(claims[0]?.evidence.map((evidence) => evidence.id)).toEqual(["ev-a1", "ev-a2"]);
    expect(claims[1]?.evidence.map((evidence) => evidence.id)).toEqual(["ev-b1", "ev-b2"]);
  });

  it("is read-only against the persistence boundary", async () => {
    const db = makeReplayDb();

    await expect(loadPersistedPatternClaimsForReplay({ db })).resolves.toHaveLength(2);
    expect(db._findManyCalls()).toBe(1);
  });
});

describe("persisted claim replay runner", () => {
  it("writes deterministic artifacts and hashes for the same loaded fixture", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-replay-runner-"));
    const outputPathA = path.join(tempDir, "replay-a.json");
    const outputPathB = path.join(tempDir, "replay-b.json");
    const claims = [
      {
        id: "claim-a",
        patternType: "trigger_condition" as const,
        summary: "Stored shell summary",
        status: "active" as const,
        strengthLevel: "developing" as const,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        evidence: [
          {
            id: "ev-1",
            source: "derivation",
            sessionId: "sess-1",
            messageId: "msg-1",
            quote: "I default to people-pleasing when someone seems upset with me",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            id: "ev-2",
            source: "derivation",
            sessionId: "sess-2",
            messageId: "msg-2",
            quote: "When pressure rises, I start appeasing people instead of staying honest",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      },
    ];

    const runA = runPersistedClaimReplayAudit({ claims, outputPath: outputPathA });
    const runB = runPersistedClaimReplayAudit({ claims, outputPath: outputPathB });
    const bytesA = fs.readFileSync(outputPathA, "utf8");
    const bytesB = fs.readFileSync(outputPathB, "utf8");

    expect(bytesA).toBe(bytesB);
    expect(runA.artifactSha256).toBe(runB.artifactSha256);
    expect(runA.artifactSha256).toBe(
      createHash("sha256").update(bytesA).digest("hex")
    );
  });

  it("preserves partial historical state as non-comparable through the runner", () => {
    const run = runPersistedClaimReplayAudit({
      claims: [
        {
          id: "claim-partial",
          patternType: "trigger_condition",
          summary: "When pressure rises, you default to pleasing or appeasing.",
          status: "active",
          strengthLevel: "developing",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          evidence: [
            {
              id: "ev-1",
              source: "derivation",
              sessionId: "sess-1",
              messageId: "msg-1",
              quote: "I default to people-pleasing when someone seems upset with me",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
            {
              id: "ev-2",
              source: "derivation",
              sessionId: "sess-2",
              messageId: "msg-2",
              quote: "When pressure rises, I start appeasing people instead of staying honest",
              createdAt: new Date("2026-01-02T00:00:00.000Z"),
            },
          ],
        },
      ],
      outputPath: path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-replay-partial-")),
        "replay.json"
      ),
    });

    expect(run.summary.cleanMatchPartialHistoricalStateClaims).toBe(1);
    expect(run.results[0]?.divergence.surfacedMismatch).toBe(false);
    expect(run.results[0]?.divergence.thresholdMismatch).toBe(false);
    expect(run.results[0]?.divergence.displaySafeMismatch).toBe(false);
    expect(run.results[0]?.divergence.rationaleBundleMismatch).toBe(false);
  });
});

// ── advanceClaimLifecycle ─────────────────────────────────────────────────────

describe("advanceClaimLifecycle — frozen states", () => {
  it("throws when claim does not exist", async () => {
    const db = makeMockDb();
    await expect(advanceClaimLifecycle({ claimId: "nonexistent", db })).rejects.toThrow();
  });

  it("does nothing for paused claim", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "paused",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(false);
    expect(result.newStatus).toBe("paused");
  });

  it("does nothing for dismissed claim", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "dismissed",
        strengthLevel: "developing",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(false);
    expect(result.newStatus).toBe("dismissed");
  });
});

describe("advanceClaimLifecycle — candidate → active", () => {
  it("candidate with no evidence stays candidate", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "candidate",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(false);
    expect(result.newStatus).toBe("candidate");
  });

  it("candidate with 1 evidence from 1 session → active (tentative threshold met)", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "candidate",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(true);
    expect(result.previousStatus).toBe("candidate");
    expect(result.newStatus).toBe("active");
    expect(result.newStrengthLevel).toBe("tentative");
  });
});

describe("advanceClaimLifecycle — strength advancement", () => {
  it("active+tentative with 3 evidence from 2 sessions → developing", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }, { sessionId: "s1" }, { sessionId: "s2" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(true);
    expect(result.newStrengthLevel).toBe("developing");
  });

  it("active+developing with 7 evidence from 3 sessions → established", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "developing",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: "s1" },
        { sessionId: "s1" },
        { sessionId: "s2" },
        { sessionId: "s2" },
        { sessionId: "s3" },
        { sessionId: "s3" },
        { sessionId: "s3" },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(true);
    expect(result.newStrengthLevel).toBe("established");
  });

  it("active+established stays established (ceiling)", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "established",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: "s1" },
        { sessionId: "s2" },
        { sessionId: "s3" },
        { sessionId: "s1" },
        { sessionId: "s2" },
        { sessionId: "s3" },
        { sessionId: "s1" },
        { sessionId: "s2" },
        { sessionId: "s3" },
        { sessionId: "s1" },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(false);
    expect(result.newStrengthLevel).toBe("established");
  });

  it("active+tentative does NOT advance to developing with only 2 evidence (below threshold)", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }, { sessionId: "s2" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(false);
    expect(result.newStrengthLevel).toBe("tentative");
  });

  it("message-only threshold behavior is unchanged (3 evidence in 1 session stays tentative)", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }, { sessionId: "s1" }, { sessionId: "s1" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.sessionCount).toBe(1);
    expect(result.journalDaySpread).toBe(0);
    expect(result.newStrengthLevel).toBe("tentative");
  });

  it("active claim with sessionCount=1 can advance via journal day spread without inflating sessionCount", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: "s1", journalEntryId: null, createdAt: new Date("2026-02-01T00:00:00.000Z") },
        {
          sessionId: null,
          journalEntryId: "j1",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          journalEntry: {
            authoredAt: new Date("2026-01-10T08:00:00.000Z"),
            createdAt: new Date("2026-01-10T08:00:00.000Z"),
          },
        },
        {
          sessionId: null,
          journalEntryId: "j2",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          journalEntry: {
            authoredAt: new Date("2026-01-11T08:00:00.000Z"),
            createdAt: new Date("2026-01-11T08:00:00.000Z"),
          },
        },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.evidenceCount).toBe(3);
    expect(result.sessionCount).toBe(1);
    expect(result.journalEvidenceCount).toBe(2);
    expect(result.journalDaySpread).toBe(2);
    expect(result.newStrengthLevel).toBe("developing");
  });

  it("applies Math.floor(journalDaySpread / 2) at boundaries for strength spread checks", async () => {
    const withThreeJournalDays = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "developing",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: "s1", journalEntryId: null },
        { sessionId: "s1", journalEntryId: null },
        { sessionId: "s1", journalEntryId: null },
        { sessionId: "s1", journalEntryId: null },
        {
          sessionId: null,
          journalEntryId: "j1",
          journalEntry: { authoredAt: new Date("2026-01-01T00:00:00.000Z"), createdAt: new Date("2026-01-01T00:00:00.000Z") },
        },
        {
          sessionId: null,
          journalEntryId: "j2",
          journalEntry: { authoredAt: new Date("2026-01-02T00:00:00.000Z"), createdAt: new Date("2026-01-02T00:00:00.000Z") },
        },
        {
          sessionId: null,
          journalEntryId: "j3",
          journalEntry: { authoredAt: new Date("2026-01-03T00:00:00.000Z"), createdAt: new Date("2026-01-03T00:00:00.000Z") },
        },
      ],
    });

    const threeDayResult = await advanceClaimLifecycle({
      claimId: "c1",
      db: withThreeJournalDays,
    });
    expect(threeDayResult.evidenceCount).toBe(7);
    expect(threeDayResult.sessionCount).toBe(1);
    expect(threeDayResult.journalDaySpread).toBe(3);
    expect(threeDayResult.newStrengthLevel).toBe("developing");

    const withFourJournalDays = makeMockDb({
      existingClaim: {
        id: "c2",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test-2",
        summary: "test-2",
        status: "active",
        strengthLevel: "developing",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: "s1", journalEntryId: null },
        { sessionId: "s1", journalEntryId: null },
        { sessionId: "s1", journalEntryId: null },
        {
          sessionId: null,
          journalEntryId: "j1",
          journalEntry: { authoredAt: new Date("2026-01-01T00:00:00.000Z"), createdAt: new Date("2026-01-01T00:00:00.000Z") },
        },
        {
          sessionId: null,
          journalEntryId: "j2",
          journalEntry: { authoredAt: new Date("2026-01-02T00:00:00.000Z"), createdAt: new Date("2026-01-02T00:00:00.000Z") },
        },
        {
          sessionId: null,
          journalEntryId: "j3",
          journalEntry: { authoredAt: new Date("2026-01-03T00:00:00.000Z"), createdAt: new Date("2026-01-03T00:00:00.000Z") },
        },
        {
          sessionId: null,
          journalEntryId: "j4",
          journalEntry: { authoredAt: new Date("2026-01-04T00:00:00.000Z"), createdAt: new Date("2026-01-04T00:00:00.000Z") },
        },
      ],
    });

    const fourDayResult = await advanceClaimLifecycle({
      claimId: "c2",
      db: withFourJournalDays,
    });
    expect(fourDayResult.evidenceCount).toBe(7);
    expect(fourDayResult.sessionCount).toBe(1);
    expect(fourDayResult.journalDaySpread).toBe(4);
    expect(fourDayResult.newStrengthLevel).toBe("established");
  });
});

describe("advanceClaimLifecycle — cascade (single call, multiple advances)", () => {
  it("candidate with 7 evidence from 3 sessions → active+established in one call", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "candidate",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: "s1" },
        { sessionId: "s1" },
        { sessionId: "s2" },
        { sessionId: "s2" },
        { sessionId: "s3" },
        { sessionId: "s3" },
        { sessionId: "s3" },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(true);
    expect(result.newStatus).toBe("active");
    expect(result.newStrengthLevel).toBe("established");
  });

  it("reports correct evidenceCount and sessionCount", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "candidate",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }, { sessionId: "s2" }, { sessionId: "s2" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.evidenceCount).toBe(3);
    expect(result.sessionCount).toBe(2);
  });

  it("null sessionIds are not counted as sessions", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "candidate",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: null }, { sessionId: null }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    // evidenceCount = 2 but sessionCount = 0 (no non-null sessions)
    // tentative threshold requires minSessionSpread = 1, so candidate stays
    expect(result.newStatus).toBe("candidate");
    expect(result.sessionCount).toBe(0);
  });

  it("journal-backed evidence increases evidenceCount but not session spread", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "candidate",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: null, journalEntryId: "journal-1" },
        { sessionId: null, journalEntryId: "journal-2" },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.evidenceCount).toBe(2);
    expect(result.sessionCount).toBe(0);
    expect(result.newStatus).toBe("candidate");
  });
});

// ── journal accounting fields ─────────────────────────────────────────────────

describe("advanceClaimLifecycle — journal accounting fields", () => {
  it("persists message-only accounting as journalEvidenceCount=0 and journalDaySpread=0", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }, { sessionId: "s2" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.sessionCount).toBe(2);
    expect(result.journalEvidenceCount).toBe(0);
    expect(result.journalDaySpread).toBe(0);
    expect(db._claims[0]?.journalEvidenceCount).toBe(0);
    expect(db._claims[0]?.journalDaySpread).toBe(0);
  });

  it("returns journalEvidenceCount=0 and journalDaySpread=0 when no journal evidence", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [{ sessionId: "s1" }, { sessionId: "s2" }],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.journalEvidenceCount).toBe(0);
    expect(result.journalDaySpread).toBe(0);
  });

  it("counts journal receipts and distinct authored calendar days", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [
        {
          sessionId: null,
          journalEntryId: "j1",
          createdAt: new Date("2026-02-20T08:00:00.000Z"),
          journalEntry: {
            authoredAt: new Date("2026-01-10T08:00:00.000Z"),
            createdAt: new Date("2026-01-10T08:00:00.000Z"),
          },
        },
        {
          sessionId: null,
          journalEntryId: "j2",
          createdAt: new Date("2026-02-20T12:00:00.000Z"),
          journalEntry: {
            authoredAt: new Date("2026-01-10T20:00:00.000Z"),
            createdAt: new Date("2026-01-10T20:00:00.000Z"),
          },
        },
        {
          sessionId: null,
          journalEntryId: "j3",
          createdAt: new Date("2026-02-20T16:00:00.000Z"),
          journalEntry: {
            authoredAt: new Date("2026-01-11T12:00:00.000Z"),
            createdAt: new Date("2026-01-11T12:00:00.000Z"),
          },
        },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.journalEvidenceCount).toBe(3);
    // journal evidence materialized on one day still spreads across source authored days.
    expect(result.journalDaySpread).toBe(2);
  });

  it("falls back to JournalEntry.createdAt when authoredAt is missing", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [
        {
          sessionId: null,
          journalEntryId: "j1",
          createdAt: new Date("2026-03-10T08:00:00.000Z"),
          journalEntry: {
            authoredAt: null,
            createdAt: new Date("2026-01-20T08:00:00.000Z"),
          },
        },
        {
          sessionId: null,
          journalEntryId: "j2",
          createdAt: new Date("2026-03-10T10:00:00.000Z"),
          journalEntry: {
            authoredAt: null,
            createdAt: new Date("2026-01-21T08:00:00.000Z"),
          },
        },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.journalEvidenceCount).toBe(2);
    expect(result.journalDaySpread).toBe(2);
  });

  it("falls back to evidence.createdAt when linked JournalEntry is unavailable", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [
        {
          sessionId: null,
          journalEntryId: "j1",
          createdAt: new Date("2026-04-01T08:00:00.000Z"),
          journalEntry: null,
        },
        {
          sessionId: null,
          journalEntryId: "j2",
          createdAt: new Date("2026-04-02T08:00:00.000Z"),
          journalEntry: null,
        },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.journalEvidenceCount).toBe(2);
    expect(result.journalDaySpread).toBe(2);
  });

  it("mixed chat+journal evidence splits counts correctly", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
      evidence: [
        { sessionId: "s1", journalEntryId: null },
        { sessionId: "s2", journalEntryId: null },
        {
          sessionId: null,
          journalEntryId: "j1",
          createdAt: new Date("2026-01-15T00:00:00.000Z"),
        },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.evidenceCount).toBe(3);
    expect(result.sessionCount).toBe(2);
    expect(result.journalEvidenceCount).toBe(1);
    expect(result.journalDaySpread).toBe(1);
  });

  it("always writes accounting fields even when lifecycle does not advance", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "active",
        strengthLevel: "established",
        sourceRunId: null,
      },
      evidence: [
        {
          sessionId: null,
          journalEntryId: "j1",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(false);
    expect(result.journalEvidenceCount).toBe(1);
    expect(result.journalDaySpread).toBe(1);
  });

  it("frozen states return journalDaySpread=0 without querying evidence", async () => {
    const db = makeMockDb({
      existingClaim: {
        id: "c1",
        userId: "u1",
        patternType: "contradiction_drift",
        summaryNorm: "test",
        summary: "test",
        status: "paused",
        strengthLevel: "tentative",
        sourceRunId: null,
      },
    });

    const result = await advanceClaimLifecycle({ claimId: "c1", db });

    expect(result.advanced).toBe(false);
    expect(result.journalEvidenceCount).toBe(0);
    expect(result.journalDaySpread).toBe(0);
  });
});
