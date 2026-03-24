/**
 * Pattern Claim Action service (P2.5-01, P2.5-04, P2.5-07)
 *
 * Claim-attached action lifecycle. Injectable db for testability.
 * No due dates, no reminders, no streaks anywhere in this file.
 */

import type { PatternClaimView, PatternClaimActionView } from "./patterns-api";
import {
  GATE_CANDIDATE,
  GATE_PAUSED,
  GATE_NOT_ENOUGH_OBSERVATIONS,
} from "./trust-copy";

// ── Maturity gate (P2.5-04) ───────────────────────────────────────────────────

/**
 * Returns true when a claim is mature enough to support an action.
 * Gate: active status + at least 2 evidence observations.
 */
export function isActionReady(claim: PatternClaimView): boolean {
  return claim.status === "active" && claim.evidenceCount >= 2;
}

/**
 * Returns a human-readable explanation of why an action is not available.
 * Returns null when the action is ready (use isActionReady first).
 */
export function getActionGateReason(claim: PatternClaimView): string | null {
  if (claim.status === "candidate") return GATE_CANDIDATE;
  if (claim.status === "paused")    return GATE_PAUSED;
  if (claim.status === "dismissed") return null; // No message shown for dismissed
  if (claim.evidenceCount < 2)      return GATE_NOT_ENOUGH_OBSERVATIONS;
  return null;
}

// ── Terminal status check ────────────────────────────────────────────────────

export function isTerminalActionStatus(
  status: PatternClaimActionView["status"]
): boolean {
  return status === "completed" || status === "skipped" || status === "abandoned";
}

// ── Outcome → reevaluation signal (P2.5-07) ───────────────────────────────────

/**
 * Returns whether a completed action's outcome should flag the claim
 * for reevaluation on the next refresh pass.
 *
 * "not_helpful" outcomes signal that the claim may need downgrading.
 * "helpful" outcomes reinforce the claim — no special flag needed.
 */
export function shouldFlagForReevaluation(
  outcomeSignal: string | null | undefined
): boolean {
  return outcomeSignal === "not_helpful";
}

// ── DB service (injectable) ───────────────────────────────────────────────────

type MinimalDb = {
  patternClaimAction: {
    create: (args: {
      data: {
        claimId: string;
        userId: string;
        prompt: string;
        status: string;
      };
    }) => Promise<DbActionRow>;
    update: (args: {
      where: { id: string };
      data: {
        status?: string;
        outcomeSignal?: string | null;
        reflectionNote?: string | null;
        completedAt?: Date | null;
        updatedAt?: Date;
      };
    }) => Promise<DbActionRow>;
    findFirst: (args: {
      where: { id: string; userId: string };
    }) => Promise<DbActionRow | null>;
  };
  patternClaim: {
    update: (args: {
      where: { id: string };
      data: { needsReevaluation: boolean; updatedAt: Date };
    }) => Promise<unknown>;
    findMany: (args: {
      where: { userId: string; needsReevaluation: boolean };
      select: { id: true; patternType: true; strengthLevel: true; status: true };
    }) => Promise<ReevaluationCandidate[]>;
  };
};

export type ReevaluationCandidate = {
  id: string;
  patternType: string;
  strengthLevel: string;
  status: string;
};

type DbActionRow = {
  id: string;
  claimId: string;
  userId: string;
  prompt: string;
  status: string;
  outcomeSignal: string | null;
  reflectionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export function toActionView(row: DbActionRow): PatternClaimActionView {
  return {
    id: row.id,
    claimId: row.claimId,
    prompt: row.prompt,
    status: row.status as PatternClaimActionView["status"],
    outcomeSignal: row.outcomeSignal as PatternClaimActionView["outcomeSignal"],
    reflectionNote: row.reflectionNote,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function createClaimAction(
  {
    claimId,
    userId,
    prompt,
  }: { claimId: string; userId: string; prompt: string },
  db: MinimalDb
): Promise<PatternClaimActionView> {
  const row = await db.patternClaimAction.create({
    data: { claimId, userId, prompt, status: "pending" },
  });
  return toActionView(row);
}

export async function updateClaimActionStatus(
  {
    actionId,
    userId,
    status,
    outcomeSignal,
    reflectionNote,
    now = new Date(),
  }: {
    actionId: string;
    userId: string;
    status: PatternClaimActionView["status"];
    outcomeSignal?: "helpful" | "not_helpful" | "unclear";
    reflectionNote?: string;
    now?: Date;
  },
  db: MinimalDb
): Promise<PatternClaimActionView | null> {
  const existing = await db.patternClaimAction.findFirst({
    where: { id: actionId, userId },
  });
  if (!existing) return null;

  const terminal = isTerminalActionStatus(status);
  const updated = await db.patternClaimAction.update({
    where: { id: actionId },
    data: {
      status,
      outcomeSignal: outcomeSignal ?? null,
      reflectionNote: reflectionNote ?? null,
      completedAt: terminal ? now : null,
    },
  });

  // P2.5-07 — set needsReevaluation=true on the claim when outcome is negative.
  // batchRefreshClaimsForUser reads this flag via getReevaluationCandidates()
  // and clears it after the reevaluation pass.
  if (terminal && shouldFlagForReevaluation(outcomeSignal ?? null)) {
    await db.patternClaim.update({
      where: { id: existing.claimId },
      data: { needsReevaluation: true, updatedAt: now },
    });
  }

  return toActionView(updated);
}

// ── Reevaluation query (P2.5-07) ─────────────────────────────────────────────

/**
 * Returns all claims for the user that have been flagged for reevaluation
 * by a not_helpful action outcome. Called by batchRefreshClaimsForUser before
 * its normal lifecycle pass so it can treat these claims with lower advancement
 * thresholds. Consumers must clear needsReevaluation after processing.
 */
export async function getReevaluationCandidates(
  userId: string,
  db: MinimalDb
): Promise<ReevaluationCandidate[]> {
  return db.patternClaim.findMany({
    where: { userId, needsReevaluation: true },
    select: { id: true, patternType: true, strengthLevel: true, status: true },
  });
}
