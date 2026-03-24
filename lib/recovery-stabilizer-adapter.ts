/**
 * Recovery Stabilizer Adapter (P3-08)
 *
 * Baseline detector for the recovery_stabilizer pattern type.
 *
 * Identifies messages where the user describes positive change, progress,
 * or stabilization: "I've been doing better", "finally making progress",
 * "things are getting easier".
 *
 * Rule-based heuristics only — no LLM call.
 * Lower threshold (RS_MIN_MATCHES=2) than other families — positive change
 * signals are less frequent but carry a strong stabilization indicator.
 * Summary is content-stable across re-runs for reliable summaryNorm dedup.
 */

import type { NormalizedHistoryEntry } from "./history-synthesis";
import type { PatternClue } from "./pattern-claim-lifecycle";
import { selectEvidenceRepresentative } from "./behavioral-filter";
import { selectBestDisplayQuote } from "./pattern-quote-selection";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum user messages with recovery markers before a clue is emitted. */
export const RS_MIN_MATCHES = 2;

// ── Markers ───────────────────────────────────────────────────────────────────

export const RECOVERY_STABILIZER_MARKERS: RegExp[] = [
  /\bi'?ve\s+been\s+(?:doing|getting|feeling)\s+(?:better|well|good|great)\b/i,
  /\b(?:finally|at\s+last)\s+(?:able\s+to|managed|starting\s+to|making)\b/i,
  /\bi'?m\s+(?:getting|making|seeing)\s+(?:better|progress|improvement)\b/i,
  /\b(?:making|seeing|noticing)\s+(?:real\s+)?progress\b/i,
  /\bi\s+(?:actually|finally|really)\s+(?:did\s+it|managed|succeeded|stuck\s+with)\b/i,
  /\bthings?\s+(?:are\s+)?(?:getting|feeling|looking)\s+(?:better|easier|clearer)\b/i,
  /\b(?:recovering|rebuilding|bouncing\s+back|stabiliz\w+)\b/i,
  /\bi\s+(?:broke|broke\s+out\s+of|overcame)\s+the\s+(?:cycle|pattern|loop)\b/i,
  // Broader recovery and progress markers
  /\bi\s+(?:managed|was\s+able)\s+to\b/i,
  /\bworking\s+(?:on|through|towards?)\s+(?:it|that|this|my)\b/i,
  /\bi\s+(?:actually\s+)?(?:completed|finished|followed\s+through|followed\s+up)\b/i,
  /\bi'?ve\s+been\s+keeping\s+(?:up|at\s+it|going)\b/i,
  /\bproud\s+of\s+(?:myself|how)\b/i,
  /\bi\s+(?:got\s+better|improved|leveled\s+up)\s+at\b/i,
  /\b(?:things?\s+(?:went|worked\s+out)|it\s+(?:went|worked)\s+(?:well|out))\b/i,
];

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Detect recovery_stabilizer patterns from a user's normalized history.
 *
 * Returns one PatternClue when RS_MIN_MATCHES recovery-language messages are found.
 */
export function detectRecoveryStabilizerClues({
  userId,
  entries,
}: {
  userId: string;
  entries: NormalizedHistoryEntry[];
}): PatternClue[] {
  const userMessages = entries.filter((e) => e.role === "user");

  const matches = userMessages.filter((e) =>
    RECOVERY_STABILIZER_MARKERS.some((p) => p.test(e.content))
  );

  if (matches.length < RS_MIN_MATCHES) return [];

  // Classification: representative drives sessionId/messageId and summary dedup key.
  const representative = selectEvidenceRepresentative(matches);
  if (!representative) return [];

  const summaryQuote = representative.content.slice(0, 100).trim();
  const summary = `Recovery pattern: "${summaryQuote}"`;

  // Display: stricter quote-ranking path — null when no candidate is display-safe.
  const quote = selectBestDisplayQuote(matches) ?? undefined;

  return [
    {
      userId,
      patternType: "recovery_stabilizer",
      summary,
      sessionId: representative.sessionId,
      messageId: representative.messageId,
      quote,
      supportEntries: matches.map((match) => ({
        sessionId: match.sessionId,
        messageId: match.messageId,
        content: match.content,
      })),
    },
  ];
}
