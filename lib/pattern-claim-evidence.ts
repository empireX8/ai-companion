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

import { analyzeBehavioralEligibility } from "./behavioral-filter";
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

const MAX_EXTRACTED_QUOTE_LENGTH = 200;

type QuoteCandidate = {
  raw: string;
  normalizedForScoring: string;
};

function truncateExtractedQuote(text: string): string {
  return text.trim().slice(0, MAX_EXTRACTED_QUOTE_LENGTH);
}

function extractFallbackQuote(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^.{3,}?[.!?]/);
  if (match) {
    return truncateExtractedQuote(match[0]);
  }
  return truncateExtractedQuote(trimmed);
}

function splitIntoQuoteCandidates(content: string): QuoteCandidate[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const blocks = trimmed
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const candidates: QuoteCandidate[] = [];

  for (const block of blocks) {
    const sentences =
      block.match(/[^.!?;\n]+(?:[.!?;]+|$)/g)?.map((sentence) => sentence.trim()) ??
      [block];

    for (const sentence of sentences) {
      if (!sentence) continue;

      const normalizedForScoring = sentence
        .replace(/^(?:user|human|me)\s*:\s*/i, "")
        .replace(/^(?:[-*•]\s+)/, "")
        .trim();

      candidates.push({
        raw: sentence,
        normalizedForScoring: normalizedForScoring || sentence,
      });
    }
  }

  return candidates;
}

function hasBehavioralSignal(features: ReturnType<typeof analyzeBehavioralEligibility>["features"]): boolean {
  return (
    features.containsHabitLanguage ||
    features.containsSelfJudgmentLanguage ||
    features.containsProgressLanguage
  );
}

function containsBehavioralSignal(candidate: QuoteCandidate): boolean {
  const analysis = analyzeBehavioralEligibility(candidate.normalizedForScoring);
  if (analysis.eligible) {
    return true;
  }

  return (
    hasBehavioralSignal(analysis.features) &&
    !analysis.features.questionLike &&
    !analysis.features.assistantDirected &&
    !analysis.features.imperativeLike &&
    !analysis.features.likelyTopicQuery &&
    !analysis.features.tooShort
  );
}

/**
 * Extract a representative quote from message content.
 * Prefers the first sentence/chunk that carries behavioral signal, so replayable
 * receipts keep the same supporting language that triggered the family detector.
 * Falls back to the previous first-sentence behavior when no better chunk exists.
 */
export function extractQuote(content: string): string {
  const candidates = splitIntoQuoteCandidates(content);
  const behavioralCandidate = candidates.find(containsBehavioralSignal);

  if (behavioralCandidate) {
    return truncateExtractedQuote(behavioralCandidate.raw);
  }

  return extractFallbackQuote(content);
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
