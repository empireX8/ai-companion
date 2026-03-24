/**
 * Pattern Claim Evidence — V1 Receipt Materialization Pipeline (P3-05)
 *
 * Materializes V1 quote-based receipts using the canonical shared evidence
 * substrate. PatternClaimEvidence mirrors ContradictionEvidence (Slice 1
 * governance decision) — this is NOT a third receipt model.
 *
 * The pipeline:
 *  1. extractQuote      — pull a representative quote from message content
 *  2. materializeReceipt — create one idempotent PatternClaimEvidence record
 *  3. materializeReceiptsFromEntries — bulk pipeline from NormalizedHistoryEntry[]
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";

export type PersistedPatternClaimEvidenceRecord = {
  id: string;
  source: string;
  sessionId: string | null;
  messageId: string | null;
  quote: string | null;
  createdAt: Date;
};

export type PersistedPatternClaimEvidenceBundle = {
  evidenceCount: number;
  replayableEvidenceCount: number;
  replayableQuotes: string[];
};

// ── Quote extraction ──────────────────────────────────────────────────────────

/**
 * Extract a representative quote from message content.
 * Takes the first sentence (ends at ., !, or ?) up to 200 chars.
 * Falls back to the raw content truncated to 200 chars.
 */
export function extractQuote(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^.{3,}?[.!?]/);
  if (match) {
    return match[0].slice(0, 200);
  }
  return trimmed.slice(0, 200);
}

// ── Single receipt ────────────────────────────────────────────────────────────

export type ReceiptInput = {
  claimId: string;
  source?: string; // "derivation" | "user_input" — defaults to "derivation"
  sessionId?: string;
  messageId?: string;
  quote?: string;
  db?: PrismaClient;
};

export type ReceiptResult = {
  evidenceId: string;
  created: boolean;
};

/**
 * Materialize one V1 receipt for a PatternClaim.
 *
 * Idempotent: if a receipt with the same (claimId, messageId, quote) already
 * exists it is returned without creating a duplicate.
 *
 * When neither messageId nor quote is supplied, no dedup check is performed
 * and a new record is always created (bare provenance receipt).
 */
export async function materializeReceipt({
  claimId,
  source = "derivation",
  sessionId,
  messageId,
  quote,
  db = prismadb,
}: ReceiptInput): Promise<ReceiptResult> {
  if (messageId !== undefined || quote !== undefined) {
    const existing = await db.patternClaimEvidence.findFirst({
      where: {
        claimId,
        ...(messageId !== undefined ? { messageId } : {}),
        ...(quote !== undefined ? { quote } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      return { evidenceId: existing.id, created: false };
    }
  }

  const record = await db.patternClaimEvidence.create({
    data: {
      claimId,
      source,
      sessionId: sessionId ?? null,
      messageId: messageId ?? null,
      quote: quote ?? null,
    },
    select: { id: true },
  });

  return { evidenceId: record.id, created: true };
}

// ── Bulk pipeline ─────────────────────────────────────────────────────────────

export type BulkReceiptEntry = {
  messageId: string;
  sessionId: string;
  content: string;
};

/**
 * Bulk materialize receipts from a slice of normalized history.
 * Extracts one quote per entry and calls materializeReceipt for each.
 * Returns the count of new receipts created (deduped entries don't count).
 */
export async function materializeReceiptsFromEntries({
  claimId,
  entries,
  db = prismadb,
}: {
  claimId: string;
  entries: BulkReceiptEntry[];
  db?: PrismaClient;
}): Promise<number> {
  let created = 0;

  for (const entry of entries) {
    const quote = extractQuote(entry.content);
    const result = await materializeReceipt({
      claimId,
      sessionId: entry.sessionId,
      messageId: entry.messageId,
      quote,
      db,
    });
    if (result.created) created++;
  }

  return created;
}

export function extractReplayablePatternClaimEvidenceQuotes(
  evidence: PersistedPatternClaimEvidenceRecord[]
): string[] {
  return evidence
    .slice()
    .sort((a, b) => {
      const createdAtCompare = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtCompare !== 0) return createdAtCompare;
      return a.id.localeCompare(b.id);
    })
    .map((row) => row.quote)
    .filter((quote): quote is string => typeof quote === "string" && quote.trim().length > 0);
}

export function countReplayablePatternClaimEvidence(
  evidence: PersistedPatternClaimEvidenceRecord[]
): number {
  return extractReplayablePatternClaimEvidenceQuotes(evidence).length;
}

export function buildPersistedClaimEvidenceBundle(
  evidence: PersistedPatternClaimEvidenceRecord[]
): PersistedPatternClaimEvidenceBundle {
  return {
    evidenceCount: evidence.length,
    replayableEvidenceCount: countReplayablePatternClaimEvidence(evidence),
    replayableQuotes: extractReplayablePatternClaimEvidenceQuotes(evidence),
  };
}
