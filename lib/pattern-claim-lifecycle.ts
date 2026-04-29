/**
 * Pattern Claim Lifecycle Engine (P3-06)
 *
 * Implements the claim lifecycle:
 *   clue (transient signal) → candidate (PatternClaim) → active
 *
 * And deterministic strength advancement:
 *   tentative → developing → established
 *
 * Uses locked thresholds and enums from pattern-claim-boundary.ts.
 * A single advanceClaimLifecycle call cascades through all eligible levels.
 */

import fs from "node:fs";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";
import {
  STRENGTH_ADVANCEMENT_THRESHOLDS,
  nextStrengthLevel,
  type PatternTypeValue,
  type PatternClaimStatusValue,
  type StrengthLevelValue,
} from "./pattern-claim-boundary";
import {
  computeEffectiveSpread,
  computeJournalDaySpread,
  computeJournalEvidenceCount,
  computeSessionCount,
} from "./pattern-spread";
import {
  replayPersistedPatternClaimsBatch,
  writePersistedClaimReplayArtifact,
  DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH,
  type PersistedPatternClaimReplayInput,
  type PersistedClaimReplayResult,
  type PersistedClaimReplaySummary,
} from "./pattern-claim-replay";
export {
  replayPersistedPatternClaim,
  assessPersistedClaimSupportBundleCompleteness,
  comparePersistedClaimToReplay,
  computePersistedClaimReplaySummary,
  areNormalizedRationaleBundlesEqual,
  replayPersistedPatternClaimsBatch,
  writePersistedClaimReplayArtifact,
  DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH,
  type PersistedClaimReplayResult,
  type PersistedPatternClaimReplayInput,
  type PersistedClaimReplaySummary,
  type PersistedClaimReplayDivergenceReason,
} from "./pattern-claim-replay";
import type { VisiblePatternClaimRecord } from "./pattern-visible-claim";
import type { PersistedPatternClaimEvidenceRecord } from "./pattern-claim-evidence";

// ── PatternClue — transient pre-persistence signal ────────────────────────────

/**
 * A clue is a pattern signal that has been observed but not yet materialized
 * as a PatternClaim in the database. The lifecycle engine turns clues into
 * candidate PatternClaims.
 */
export type PatternClue = {
  userId: string;
  patternType: PatternTypeValue;
  summary: string;
  sourceRunId?: string;
  // Optional evidence context for the initial receipt
  sourceKind?: "chat_message" | "journal_entry";
  sessionId?: string | null;
  messageId?: string | null;
  journalEntryId?: string | null;
  quote?: string;
  // Optional deterministic replay-support entries. These preserve additional
  // source quotes already available at detection time so persisted replay can
  // reconstruct the same canonical visible-summary path later.
  supportEntries?: Array<{
    sourceKind: "chat_message" | "journal_entry";
    sessionId: string | null;
    messageId: string | null;
    journalEntryId: string | null;
    timestamp: Date;
    content: string;
  }>;
};

// ── Summary normalization (dedup key) ─────────────────────────────────────────

/**
 * Normalize a PatternClaim summary for deduplication.
 * Mirrors the pattern used by ProfileArtifact.claimNorm.
 */
export function normalizeSummary(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

// ── Upsert from clue ──────────────────────────────────────────────────────────

export type UpsertClueResult = {
  claimId: string;
  created: boolean;
  status: PatternClaimStatusValue;
};

/**
 * Find or create a PatternClaim from a transient clue signal.
 *
 * Dedup key: (userId, patternType, summaryNorm) — unique index on PatternClaim.
 * New claims are created with status="candidate", strengthLevel="tentative".
 * Existing claims are returned as-is without mutation.
 */
export async function upsertPatternClaimFromClue({
  clue,
  db = prismadb,
}: {
  clue: PatternClue;
  db?: PrismaClient;
}): Promise<UpsertClueResult> {
  const summaryNorm = normalizeSummary(clue.summary);

  const existing = await db.patternClaim.findUnique({
    where: {
      userId_patternType_summaryNorm: {
        userId: clue.userId,
        patternType: clue.patternType,
        summaryNorm,
      },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    return {
      claimId: existing.id,
      created: false,
      status: existing.status as PatternClaimStatusValue,
    };
  }

  const created = await db.patternClaim.create({
    data: {
      userId: clue.userId,
      patternType: clue.patternType,
      summary: clue.summary,
      summaryNorm,
      status: "candidate",
      strengthLevel: "tentative",
      sourceRunId: clue.sourceRunId ?? null,
    },
    select: { id: true, status: true },
  });

  return {
    claimId: created.id,
    created: true,
    status: created.status as PatternClaimStatusValue,
  };
}

// ── Lifecycle advancement ─────────────────────────────────────────────────────

export type LifecycleAdvancementResult = {
  claimId: string;
  previousStatus: PatternClaimStatusValue;
  newStatus: PatternClaimStatusValue;
  previousStrengthLevel: StrengthLevelValue;
  newStrengthLevel: StrengthLevelValue;
  evidenceCount: number;
  sessionCount: number;
  journalEvidenceCount: number;
  journalDaySpread: number;
  advanced: boolean;
};

export type PersistedPatternClaimWithEvidence = VisiblePatternClaimRecord & {
  evidence: PersistedPatternClaimEvidenceRecord[];
};

export type PersistedClaimReplayAuditRun = {
  results: PersistedClaimReplayResult[];
  inspectableResults: PersistedClaimReplayResult[];
  summary: PersistedClaimReplaySummary;
  outputPath: string;
  artifactSha256: string;
};

export async function loadPersistedPatternClaimsForReplay({
  claimIds,
  limit,
  db = prismadb,
}: {
  claimIds?: string[];
  limit?: number;
  db?: PrismaClient;
} = {}): Promise<PersistedPatternClaimWithEvidence[]> {
  const rows = await db.patternClaim.findMany({
    where: claimIds && claimIds.length > 0 ? { id: { in: claimIds } } : undefined,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      patternType: true,
      summary: true,
      status: true,
      strengthLevel: true,
      journalEvidenceCount: true,
      journalDaySpread: true,
      createdAt: true,
      updatedAt: true,
      evidence: {
        select: {
          id: true,
          source: true,
          sessionId: true,
          messageId: true,
          journalEntryId: true,
          quote: true,
          createdAt: true,
        },
      },
    },
  });

  return rows
    .map((row) => ({
      id: row.id,
      patternType: row.patternType as VisiblePatternClaimRecord["patternType"],
      summary: row.summary,
      status: row.status as VisiblePatternClaimRecord["status"],
      strengthLevel: row.strengthLevel as VisiblePatternClaimRecord["strengthLevel"],
      journalEvidenceCount: row.journalEvidenceCount,
      journalDaySpread: row.journalDaySpread,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      evidence: row.evidence
        .slice()
        .sort((a, b) => {
          const createdAtCompare = a.createdAt.getTime() - b.createdAt.getTime();
          if (createdAtCompare !== 0) return createdAtCompare;
          return a.id.localeCompare(b.id);
        })
        .map((evidence) => ({
          id: evidence.id,
          source: evidence.source,
          sessionId: evidence.sessionId,
          messageId: evidence.messageId,
          journalEntryId: evidence.journalEntryId,
          quote: evidence.quote,
          createdAt: evidence.createdAt,
        })),
    }))
    .sort((a, b) => {
      const createdAtCompare = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtCompare !== 0) return createdAtCompare;
      return a.id.localeCompare(b.id);
    });
}

export function runPersistedClaimReplayAudit({
  claims,
  outputPath = DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH,
}: {
  claims: PersistedPatternClaimWithEvidence[];
  outputPath?: string;
}): PersistedClaimReplayAuditRun {
  const batchInputs: PersistedPatternClaimReplayInput[] = claims.map((claim) => ({
    claim: {
      id: claim.id,
      patternType: claim.patternType,
      summary: claim.summary,
      status: claim.status,
      strengthLevel: claim.strengthLevel,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      evidence: claim.evidence,
    },
    evidence: claim.evidence,
  }));
  const batch = replayPersistedPatternClaimsBatch(batchInputs);
  writePersistedClaimReplayArtifact(batch, outputPath);
  const writtenArtifact = fs.readFileSync(outputPath, "utf8");

  return {
    ...batch,
    outputPath,
    artifactSha256: createHash("sha256").update(writtenArtifact).digest("hex"),
  };
}

/**
 * Evaluate a claim's current evidence and advance its lifecycle state
 * deterministically using the locked threshold configuration.
 *
 * Lifecycle transitions:
 *  candidate → active      : evidenceCount >= 1, sessionCount >= 1 (tentative threshold)
 *  active + tentative  → developing  : evidenceCount >= 3, effectiveSpread >= 2
 *  active + developing → established : evidenceCount >= 7, effectiveSpread >= 3
 *
 * Cascades in a single call — if evidence supports multiple advances,
 * all eligible transitions are applied.
 *
 * Paused and dismissed claims are never advanced.
 */
export async function advanceClaimLifecycle({
  claimId,
  db = prismadb,
}: {
  claimId: string;
  db?: PrismaClient;
}): Promise<LifecycleAdvancementResult> {
  const claim = await db.patternClaim.findFirst({
    where: { id: claimId },
    select: { id: true, status: true, strengthLevel: true },
  });

  if (!claim) {
    throw new Error(`PatternClaim not found: ${claimId}`);
  }

  const previousStatus = claim.status as PatternClaimStatusValue;
  const previousStrength = claim.strengthLevel as StrengthLevelValue;

  // Frozen states — no advancement
  if (previousStatus === "paused" || previousStatus === "dismissed") {
    return {
      claimId,
      previousStatus,
      newStatus: previousStatus,
      previousStrengthLevel: previousStrength,
      newStrengthLevel: previousStrength,
      evidenceCount: 0,
      sessionCount: 0,
      journalEvidenceCount: 0,
      journalDaySpread: 0,
      advanced: false,
    };
  }

  // Count evidence and distinct sessions
  const evidence = await db.patternClaimEvidence.findMany({
    where: { claimId },
    select: {
      sessionId: true,
      journalEntryId: true,
      createdAt: true,
      journalEntry: {
        select: {
          authoredAt: true,
          createdAt: true,
        },
      },
    },
  });

  const evidenceCount = evidence.length;
  const sessionCount = computeSessionCount(evidence);
  const journalEvidenceCount = computeJournalEvidenceCount(evidence);
  const journalDaySpread = computeJournalDaySpread(evidence);
  const effectiveSpread = computeEffectiveSpread(sessionCount, journalDaySpread);

  let newStatus = previousStatus;
  let newStrength = previousStrength;

  // candidate → active: meets tentative activation threshold (1 evidence, 1 session)
  if (newStatus === "candidate") {
    const activationThresh = STRENGTH_ADVANCEMENT_THRESHOLDS.tentative;
    if (
      evidenceCount >= activationThresh.evidenceRequired &&
      sessionCount >= activationThresh.minSessionSpread
    ) {
      newStatus = "active";
    }
  }

  // active: cascade strength advancement as far as evidence allows
  if (newStatus === "active") {
    while (true) {
      const next = nextStrengthLevel(newStrength);
      if (next === null) break; // already at ceiling
      const thresh = STRENGTH_ADVANCEMENT_THRESHOLDS[next];
      if (
        evidenceCount >= thresh.evidenceRequired &&
        effectiveSpread >= thresh.minSessionSpread
      ) {
        newStrength = next;
      } else {
        break;
      }
    }
  }

  const advanced = newStatus !== previousStatus || newStrength !== previousStrength;

  await db.patternClaim.update({
    where: { id: claimId },
    data: {
      journalEvidenceCount,
      journalDaySpread,
      ...(advanced ? { status: newStatus, strengthLevel: newStrength } : {}),
    },
  });

  return {
    claimId,
    previousStatus,
    newStatus,
    previousStrengthLevel: previousStrength,
    newStrengthLevel: newStrength,
    evidenceCount,
    sessionCount,
    journalEvidenceCount,
    journalDaySpread,
    advanced,
  };
}
