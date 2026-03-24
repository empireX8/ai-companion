/**
 * Repetitive Loop Aggregation (Phase 2)
 *
 * Second stage of the two-stage repetitive_loop detection pipeline.
 *
 * Stage 1 (message-level): `detectRepetitiveLoopCueMessages`
 *   — identifies user messages containing loop-language markers.
 *   These are candidate evidence only; a single session is never sufficient.
 *
 * Stage 2 (session-level): `groupLoopCuesBySession` + `buildRepetitiveLoopClueFromSessions`
 *   — emits a clue only when loop cues appear across at least RL_MIN_SESSIONS
 *     distinct sessions. A single session, regardless of how many loop-like
 *     messages it contains, never triggers a claim.
 *
 * Rule-based, no LLM call.
 */

import type { NormalizedHistoryEntry } from "./history-synthesis";
import type { PatternClue } from "./pattern-claim-lifecycle";
import { selectEvidenceRepresentative } from "./behavioral-filter";
import { selectBestDisplayQuote } from "./pattern-quote-selection";

/** Minimum distinct sessions with loop cues required before a clue is emitted. */
export const RL_MIN_SESSIONS = 2;

/**
 * Stage 1: Return user messages that contain at least one loop-language marker.
 * The caller supplies the marker list so marker definitions stay in one place.
 */
export function detectRepetitiveLoopCueMessages(
  entries: NormalizedHistoryEntry[],
  markers: RegExp[]
): NormalizedHistoryEntry[] {
  return entries.filter(
    (e) => e.role === "user" && markers.some((p) => p.test(e.content))
  );
}

/**
 * Stage 2a: Group cue messages by sessionId (insertion-order preserved).
 */
export function groupLoopCuesBySession(
  cues: NormalizedHistoryEntry[]
): Map<string, NormalizedHistoryEntry[]> {
  const map = new Map<string, NormalizedHistoryEntry[]>();
  for (const cue of cues) {
    const group = map.get(cue.sessionId);
    if (group) {
      group.push(cue);
    } else {
      map.set(cue.sessionId, [cue]);
    }
  }
  return map;
}

/**
 * Stage 2b: Build a PatternClue from session groups, or return null if the
 * cross-session threshold is not met.
 *
 * Representative selection: delegates to selectEvidenceRepresentative —
 * prefers last I-starting, ≤300-char, non-colon-prefixed cue; falls back
 * to last cue if none qualify.
 *
 * Summary omits session count to remain content-stable across re-runs —
 * summaryNorm dedup in pattern-claim-lifecycle relies on this stability.
 */
export function buildRepetitiveLoopClueFromSessions(
  userId: string,
  sessionGroups: Map<string, NormalizedHistoryEntry[]>
): PatternClue | null {
  if (sessionGroups.size < RL_MIN_SESSIONS) return null;

  const allCues = [...sessionGroups.values()].flat();

  // Classification: representative drives sessionId/messageId and summary dedup key.
  const representative = selectEvidenceRepresentative(allCues)!;
  const summaryQuote = representative.content.slice(0, 100).trim();
  const summary = `Repetitive loop pattern across sessions: "${summaryQuote}"`;

  // Display: stricter quote-ranking path — null when no candidate is display-safe.
  const quote = selectBestDisplayQuote(allCues) ?? undefined;

  return {
    userId,
    patternType: "repetitive_loop",
    summary,
    sessionId: representative.sessionId,
    messageId: representative.messageId,
    quote,
    supportEntries: allCues.map((cue) => ({
      sessionId: cue.sessionId,
      messageId: cue.messageId,
      content: cue.content,
    })),
  };
}
