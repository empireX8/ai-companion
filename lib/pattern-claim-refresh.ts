/**
 * Pattern Claim Refresh + Longitudinal Merge Rules (P3-09)
 *
 * Governs how the detection engine handles re-runs against the same user's
 * history. Rules:
 *
 *  1. Dedup    — upsertPatternClaimFromClue uses the (userId, patternType,
 *                summaryNorm) unique index. Re-runs that produce the same clue
 *                return the existing claim and never create a duplicate.
 *
 *  2. Reinforce — materializeReceipt is idempotent by (claimId, messageId, quote).
 *                 New messages in a re-run add new evidence records. Lifecycle
 *                 advancement re-evaluates based on total accumulated evidence.
 *
 *  3. Refresh  — batchRefreshClaimsForUser re-runs advanceClaimLifecycle for all
 *                non-frozen claims so evidence accumulated outside the current
 *                detector run is also counted.
 *
 *  4. Weaken   — Evidence is append-only (receipts are permanent). Strength
 *                advancement is therefore monotonically non-decreasing within
 *                a claim. Decay/weakening is intentionally deferred to a
 *                future packet.
 *
 *  5. Merge    — mergeStaleDuplicateClaims handles the edge case where the same
 *                underlying pattern produced two separate PatternClaims (e.g. due
 *                to a summary change between runs). It transfers evidence from the
 *                newer claim to the canonical (older) claim and marks the newer
 *                one dismissed.
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";
import { advanceClaimLifecycle } from "./pattern-claim-lifecycle";
import { getReevaluationCandidates } from "./pattern-claim-action";

// ── Refresh ───────────────────────────────────────────────────────────────────

export type RefreshResult = {
  userId: string;
  claimsEvaluated: number;
  claimsAdvanced: number;
  /** IDs of claims that had needsReevaluation=true and were cleared this pass */
  reevaluatedIds: string[];
};

/**
 * Re-evaluate lifecycle advancement for all non-frozen PatternClaims owned
 * by the given user.
 *
 * P2.5-07 integration: before the normal advancement pass, this function
 * reads claims flagged with needsReevaluation=true (set by not_helpful action
 * outcomes). These claims are included in the evaluation pass and their flag
 * is cleared afterward. Future passes can apply downgrade logic here by
 * reading the reevaluatedIds list and comparing against advancement results.
 *
 * Call this after a detection run completes to ensure claims that received
 * additional evidence during the run are advanced if thresholds are now met.
 */
export async function batchRefreshClaimsForUser({
  userId,
  db = prismadb,
}: {
  userId: string;
  db?: PrismaClient;
}): Promise<RefreshResult> {
  // P2.5-07 — collect claims flagged for reevaluation by not_helpful outcomes
  const reevaluationCandidates = await getReevaluationCandidates(
    userId,
    db as unknown as Parameters<typeof getReevaluationCandidates>[1]
  );
  const reevaluationIds = new Set(reevaluationCandidates.map((c) => c.id));

  const activeClaims = (await db.patternClaim.findMany({
    where: {
      userId,
      status: { in: ["candidate", "active"] },
    },
    select: { id: true },
  })) as Array<{ id: string }>;

  let claimsAdvanced = 0;

  for (const claim of activeClaims) {
    const result = await advanceClaimLifecycle({ claimId: claim.id, db });
    if (result.advanced) claimsAdvanced++;
  }

  // Clear needsReevaluation flag for all processed candidates
  if (reevaluationIds.size > 0) {
    await (db.patternClaim as unknown as {
      updateMany: (args: {
        where: { id: { in: string[] } };
        data: { needsReevaluation: false };
      }) => Promise<unknown>;
    }).updateMany({
      where: { id: { in: Array.from(reevaluationIds) } },
      data: { needsReevaluation: false },
    });
  }

  return {
    userId,
    claimsEvaluated: activeClaims.length,
    claimsAdvanced,
    reevaluatedIds: Array.from(reevaluationIds),
  };
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export type MergeResult = {
  mergedCount: number;
  /** IDs of claims that were dismissed as duplicates */
  dismissedIds: string[];
};

/**
 * Detect and merge stale duplicate PatternClaims for a user.
 *
 * Two claims are considered duplicates if they have the same (userId,
 * patternType, summaryNorm). Under normal operation the unique index prevents
 * this, but this function serves as a safety valve for edge cases (e.g. data
 * imported outside the normal path).
 *
 * The older claim (lower createdAt) is canonical. Evidence from the newer
 * claim is re-attributed to the canonical claim, and the newer claim is
 * dismissed with summaryNorm prefixed to mark it as merged.
 */
export async function mergeStaleDuplicateClaims({
  userId,
  db = prismadb,
}: {
  userId: string;
  db?: PrismaClient;
}): Promise<MergeResult> {
  const claims = (await db.patternClaim.findMany({
    where: { userId, status: { not: "dismissed" } },
    select: {
      id: true,
      patternType: true,
      summaryNorm: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })) as Array<{
    id: string;
    patternType: string;
    summaryNorm: string;
    createdAt: Date;
  }>;

  // Group by (patternType, summaryNorm)
  const byKey = new Map<string, typeof claims>();
  for (const claim of claims) {
    const key = `${claim.patternType}:${claim.summaryNorm}`;
    const group = byKey.get(key) ?? [];
    group.push(claim);
    byKey.set(key, group);
  }

  const dismissedIds: string[] = [];

  for (const group of byKey.values()) {
    if (group.length < 2) continue;

    // First claim is canonical (oldest due to orderBy asc)
    const canonical = group[0]!;
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      // Re-attribute evidence from duplicate to canonical
      await (
        db.patternClaimEvidence as unknown as {
          updateMany: (args: {
            where: { claimId: string };
            data: { claimId: string };
          }) => Promise<unknown>;
        }
      ).updateMany({
        where: { claimId: dup.id },
        data: { claimId: canonical.id },
      });

      // Dismiss the duplicate
      await db.patternClaim.update({
        where: { id: dup.id },
        data: {
          status: "dismissed",
          summaryNorm: `merged:${dup.summaryNorm}`.slice(0, 300),
        },
      });

      dismissedIds.push(dup.id);
    }
  }

  return { mergedCount: dismissedIds.length, dismissedIds };
}
