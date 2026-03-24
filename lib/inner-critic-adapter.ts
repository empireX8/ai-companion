/**
 * Inner Critic Adapter (P3-08)
 *
 * Baseline detector for the inner_critic pattern type.
 *
 * Identifies recurring self-critical language in user messages:
 * harsh self-judgment, negative self-labeling, self-blame loops.
 *
 * Rule-based heuristics only — no LLM call.
 * Summary is content-stable across re-runs for reliable summaryNorm dedup.
 */

import type { NormalizedHistoryEntry } from "./history-synthesis";
import type { PatternClue } from "./pattern-claim-lifecycle";
import { selectEvidenceRepresentative } from "./behavioral-filter";
import { selectBestDisplayQuote } from "./pattern-quote-selection";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum user messages with self-critical markers before a clue is emitted. */
export const IC_MIN_MATCHES = 3;

// ── Markers ───────────────────────────────────────────────────────────────────

export const INNER_CRITIC_MARKERS: RegExp[] = [
  /\bi\s+(?:always|keep|never\s+stop)\s+(?:mess|screw|ruin|fail|disappoint)\w*/i,
  /\bi'?m\s+(?:so\s+)?(?:terrible|awful|bad|horrible|pathetic|useless)\s+at\b/i,
  /\bi\s+(?:can't|cannot|could\s+never)\s+(?:do|get|make|keep|stop|finish)\b/i,
  /\bwhy\s+(?:do|can't|can|am)\s+i\s+(?:always|never|keep)\b/i,
  /\bi\s+(?:always|keep)\s+(?:doing|making)\s+the\s+same\b/i,
  /\bi\s+(?:hate|despise)\s+(?:myself|that\s+i)\b/i,
  /\bi'?m\s+such\s+a\s+(?:failure|mess|disappointment|loser|idiot|burden)\b/i,
  /\bi\s+(?:ruin|destroy|sabotage)\s+everything\b/i,
  // Broader self-doubt and self-critical markers
  /\bi\s+(?:really\s+)?struggle\s+(?:with|to)\b/i,
  /\bi\s+have\s+(?:a\s+hard\s+time|trouble|difficulty)\s+(?:with\b|\w+ing)/i,
  /\bi'?m\s+not\s+(?:sure\s+i\s+can|good\s+enough|smart\s+enough|capable\s+of)\b/i,
  /\bi\s+(?:honestly\s+)?(?:doubt|question)\s+(?:myself|whether\s+i|my\s+ability)\b/i,
  /\bi\s+(?:probably|honestly)\s+(?:can't|shouldn't|won't\s+be\s+able)\b/i,
  /\bi'?m\s+(?:worried|afraid|scared)\s+(?:that\s+)?i'?(?:ll|m\s+going\s+to)\b/i,
  /\b(?:not\s+my\s+(?:strong|best)\s+suit|my\s+weakness)\b/i,
  /\bi\s+(?:always\s+)?(?:overthink|second.?guess)\b/i,
];

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Detect inner_critic patterns from a user's normalized history.
 *
 * Returns one PatternClue when IC_MIN_MATCHES self-critical messages are found.
 */
export function detectInnerCriticClues({
  userId,
  entries,
}: {
  userId: string;
  entries: NormalizedHistoryEntry[];
}): PatternClue[] {
  const userMessages = entries.filter((e) => e.role === "user");

  const matches = userMessages.filter((e) =>
    INNER_CRITIC_MARKERS.some((p) => p.test(e.content))
  );

  if (matches.length < IC_MIN_MATCHES) return [];

  // Classification: representative drives sessionId/messageId and summary dedup key.
  const representative = selectEvidenceRepresentative(matches);
  if (!representative) return [];

  const summaryQuote = representative.content.slice(0, 100).trim();
  const summary = `Self-critical pattern: "${summaryQuote}"`;

  // Display: stricter quote-ranking path — null when no candidate is display-safe.
  const quote = selectBestDisplayQuote(matches) ?? undefined;

  return [{
    userId,
    patternType: "inner_critic",
    summary,
    sessionId: representative.sessionId,
    messageId: representative.messageId,
    quote,
    supportEntries: matches.map((match) => ({
      sessionId: match.sessionId,
      messageId: match.messageId,
      content: match.content,
    })),
  }];
}
