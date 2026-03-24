/**
 * Trigger-Condition Detector (P3-07)
 *
 * First reliable family detector for the trigger_condition pattern type.
 *
 * Reads the user's normalized history and identifies recurring trigger-response
 * patterns: messages where the user describes a consistent if/when/trigger
 * stimulus-response relationship ("whenever X happens, I tend to Y").
 *
 * Rule-based, no LLM call. Uses heuristic marker patterns on user messages.
 * Returns a single PatternClue when the minimum match threshold is met.
 *
 * Summary is content-stable across re-runs so dedup via summaryNorm works.
 */

import type { NormalizedHistoryEntry } from "./history-synthesis";
import type { PatternClue } from "./pattern-claim-lifecycle";
import { selectEvidenceRepresentative } from "./behavioral-filter";
import { selectBestDisplayQuote } from "./pattern-quote-selection";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum user messages with trigger markers before a clue is emitted. */
export const TC_MIN_MATCHES = 3;

// ── Trigger-response markers ──────────────────────────────────────────────────

/**
 * Regex patterns that identify trigger-response language in user messages.
 * Each pattern captures one form of "when X, I do Y" stimulus-response structure.
 */
export const TRIGGER_MARKERS: RegExp[] = [
  /\bwhenever\b/i,
  /\bevery\s+time\b/i,
  /\bwhen\s+(?:i|i'm|i\s+am|\w+).{0,40}\b(?:always|tend\s+to|usually|often|end\s+up|start\s+to)\b/i,
  /\btriggers?\s+(?:me|my)\b/i,
  /\bmakes?\s+me\s+(?:want|feel|start|tend)\b/i,
  /\bif\s+.{0,40}\bthen\s+i\b/i,
  /\b(?:always|tend\s+to|end\s+up)\s+.{0,20}when\b/i,
  // Broader natural-language trigger markers
  /\bi\s+tend\s+to\b/i,
  /\bi\s+(?:always|automatically|instinctively|usually|typically)\s+(?:\w+\s+){0,3}(?:when|if|after|before)\b/i,
  /\bmy\s+(?:default|instinct|reaction|pattern|first\s+instinct|go-?to)\s+is\b/i,
  /\bi\s+notice\s+(?:that\s+)?i\b/i,
  /\bby\s+default\s+i\b/i,
  /\bautomatically\s+(?:\w+\s+){0,3}(?:when|if|once)\b/i,
  /\bi\s+always\s+(?:end\s+up|find\s+myself|default\s+to|gravitate)\b/i,
];

// ── Detector ──────────────────────────────────────────────────────────────────

export type TriggerConditionInput = {
  userId: string;
  entries: NormalizedHistoryEntry[];
};

/**
 * Detect trigger_condition patterns from a user's normalized history.
 *
 * Scans user-role messages for trigger-response language markers.
 * Returns one PatternClue when TC_MIN_MATCHES is met, empty otherwise.
 *
 * Evidence context is taken from the most recent matching message.
 */
export function detectTriggerConditionClues({
  userId,
  entries,
}: TriggerConditionInput): PatternClue[] {
  const userMessages = entries.filter((e) => e.role === "user");

  const matches = userMessages.filter((e) =>
    TRIGGER_MARKERS.some((pattern) => pattern.test(e.content))
  );

  if (matches.length < TC_MIN_MATCHES) {
    return [];
  }

  // Classification: representative drives sessionId/messageId and summary dedup key.
  const representative = selectEvidenceRepresentative(matches);
  if (!representative) return [];

  const summaryQuote = representative.content.slice(0, 100).trim();
  const summary = `Trigger-response pattern: "${summaryQuote}"`;

  // Display: stricter quote-ranking path — null when no candidate is display-safe.
  const quote = selectBestDisplayQuote(matches) ?? undefined;

  return [{
    userId,
    patternType: "trigger_condition",
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
