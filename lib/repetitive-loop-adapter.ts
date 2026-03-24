/**
 * Repetitive Loop Adapter (P3-08)
 *
 * Two-stage detector for the repetitive_loop pattern type.
 *
 * Stage 1 — message-level cue detection:
 *   Scans entries for loop-language markers ("I keep…", "same pattern", etc.).
 *   Matching messages are candidate evidence only.
 *
 * Stage 2 — session-level aggregation (lib/repetitive-loop-aggregation):
 *   Emits a PatternClue only when loop cues appear across at least
 *   RL_MIN_SESSIONS distinct sessions.
 *   A single session, no matter how many loop-like messages it contains,
 *   never triggers a claim.
 *
 * Rule-based heuristics only — no LLM call.
 * Summary is content-stable across re-runs for reliable summaryNorm dedup.
 */

import type { NormalizedHistoryEntry } from "./history-synthesis";
import type { PatternClue } from "./pattern-claim-lifecycle";
import {
  detectRepetitiveLoopCueMessages,
  groupLoopCuesBySession,
  buildRepetitiveLoopClueFromSessions,
} from "./repetitive-loop-aggregation";

export { RL_MIN_SESSIONS } from "./repetitive-loop-aggregation";

// ── Markers ───────────────────────────────────────────────────────────────────

export const REPETITIVE_LOOP_MARKERS: RegExp[] = [
  /\bi\s+keep\s+(?:\w+ing|doing|going\s+back)\b/i,
  /\bhere\s+(?:i\s+am|we\s+are)\s+again\b/i,
  /\b(?:again|once\s+again|yet\s+again).{0,20}\b(?:i|the\s+same|back)\b/i,
  /\b(?:fall|falling|fell)\s+(?:back|into\s+the\s+same)\b/i,
  /\bsame\s+(?:pattern|cycle|thing|mistake|loop)\b/i,
  /\b(?:i\s+)?(?:always|keep)\s+(?:coming\s+back|returning|reverting)\b/i,
  /\b(?:cycle|loop|pattern)\s+(?:repeats?|again|continues?)\b/i,
  /\bback\s+to\s+(?:square\s+one|the\s+same|where\s+i\s+started)\b/i,
  // Broader loop and recurrence markers
  /\bi\s+(?:find|found|keep\s+finding)\s+myself\b/i,
  /\bover\s+and\s+over\b/i,
  /\b(?:same\s+old|same\s+as\s+(?:before|usual|always))\b/i,
  /\bi\s+(?:always\s+)?do\s+this\b/i,
  /\bi'?m\s+(?:still\s+)?stuck\s+(?:on|in|with)\b/i,
  /\bi\s+know\s+this\s+(?:pattern|cycle|feeling)\b/i,
  /\bkeep\s+(?:ending\s+up|running\s+into|hitting)\s+the\s+same\b/i,
  /\bi\s+(?:went\s+back\s+to|defaulted\s+back\s+to|slipped\s+back\s+into)\b/i,
];

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Detect repetitive_loop patterns from a user's normalized history.
 *
 * Wraps the two-stage pipeline: cue detection → session aggregation.
 * Returns one PatternClue when loop cues appear across ≥ RL_MIN_SESSIONS
 * distinct sessions; empty otherwise.
 */
export function detectRepetitiveLoopClues({
  userId,
  entries,
}: {
  userId: string;
  entries: NormalizedHistoryEntry[];
}): PatternClue[] {
  const cues = detectRepetitiveLoopCueMessages(entries, REPETITIVE_LOOP_MARKERS);
  const sessionGroups = groupLoopCuesBySession(cues);
  const clue = buildRepetitiveLoopClueFromSessions(userId, sessionGroups);
  return clue ? [clue] : [];
}
