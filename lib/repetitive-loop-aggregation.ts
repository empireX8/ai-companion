/**
 * Repetitive Loop Aggregation (Phase 2)
 *
 * Second stage of the two-stage repetitive_loop detection pipeline.
 *
 * Stage 1 (message-level): `detectRepetitiveLoopCueMessages`
 *   — identifies user messages containing loop-language markers.
 *   These are candidate evidence only; a single session is never sufficient.
 *
 * Stage 2 (session-level): `groupLoopCuesBySession` + subgroup clue builders
 *   — emits subgroup clues only when loop cues in that subgroup appear across
 *     at least RL_MIN_SESSIONS distinct sessions. A single session, regardless
 *     of how many loop-like messages it contains, never triggers a claim.
 *
 * Rule-based, no LLM call.
 */

import type { NormalizedHistoryEntry } from "./history-synthesis";
import type { PatternClue } from "./pattern-claim-lifecycle";
import { selectEvidenceRepresentative } from "./behavioral-filter";
import { selectBestDisplayQuote } from "./pattern-quote-selection";

/** Minimum distinct sessions with loop cues required before a clue is emitted. */
export const RL_MIN_SESSIONS = 2;
/** Pilot cap for multi-clue emission within repetitive_loop. */
export const RL_MAX_CLUES = 3;

type RepetitiveLoopTheme =
  | "substance_relapse"
  | "cognitive_overload"
  | "assistant_process"
  | "emotional_reset"
  | "general";

const REPETITIVE_LOOP_THEME_PRIORITY: RepetitiveLoopTheme[] = [
  "substance_relapse",
  "cognitive_overload",
  "assistant_process",
  "emotional_reset",
  "general",
];

const REPETITIVE_LOOP_THEME_SUMMARY_LABEL: Record<RepetitiveLoopTheme, string> = {
  substance_relapse: "substance/relapse loop",
  cognitive_overload: "cognitive overload loop",
  assistant_process: "assistant/process loop",
  emotional_reset: "emotional reset loop",
  general: "general loop",
};

const SUBSTANCE_RELAPSE_THEME_MARKERS: RegExp[] = [
  /\b(?:weed|smok\w*|tobacco|nicotine|alcohol|drin\w*|relaps\w*|sober|quit(?:ting)?)\b/i,
];

const COGNITIVE_OVERLOAD_THEME_MARKERS: RegExp[] = [
  /\b(?:overwhelm\w*|overstim\w*|overthink\w*|brain|mind|mental(?:ly)?|learn(?:ing)?|pace)\b/i,
];

const ASSISTANT_PROCESS_THEME_MARKERS: RegExp[] = [
  /\b(?:codex|assistant|project|prompt|email|pc|watch(?:ing)?|updat\w*|aesthetic|build(?:ing)?|codebase|tooling)\b/i,
];

const EMOTIONAL_RESET_THEME_MARKERS: RegExp[] = [
  /\b(?:crash\s+out|calm|gratitude|accept(?:ing|ance)?\s+reality|moving\s+forward|over\s+it)\b/i,
];

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
 * Journal-backed cues (no sessionId) are intentionally excluded from the
 * cross-session gate to avoid inflating session spread.
 */
export function groupLoopCuesBySession(
  cues: NormalizedHistoryEntry[]
): Map<string, NormalizedHistoryEntry[]> {
  const map = new Map<string, NormalizedHistoryEntry[]>();
  for (const cue of cues) {
    if (!cue.sessionId) continue;
    const group = map.get(cue.sessionId);
    if (group) {
      group.push(cue);
    } else {
      map.set(cue.sessionId, [cue]);
    }
  }
  return map;
}

function classifyRepetitiveLoopTheme(content: string): RepetitiveLoopTheme {
  if (SUBSTANCE_RELAPSE_THEME_MARKERS.some((pattern) => pattern.test(content))) {
    return "substance_relapse";
  }
  if (COGNITIVE_OVERLOAD_THEME_MARKERS.some((pattern) => pattern.test(content))) {
    return "cognitive_overload";
  }
  if (ASSISTANT_PROCESS_THEME_MARKERS.some((pattern) => pattern.test(content))) {
    return "assistant_process";
  }
  if (EMOTIONAL_RESET_THEME_MARKERS.some((pattern) => pattern.test(content))) {
    return "emotional_reset";
  }
  return "general";
}

export function groupLoopCuesByTheme(
  cues: NormalizedHistoryEntry[]
): Map<RepetitiveLoopTheme, NormalizedHistoryEntry[]> {
  const grouped = new Map<RepetitiveLoopTheme, NormalizedHistoryEntry[]>();
  for (const cue of cues) {
    const theme = classifyRepetitiveLoopTheme(cue.content);
    const existing = grouped.get(theme);
    if (existing) existing.push(cue);
    else grouped.set(theme, [cue]);
  }
  return grouped;
}

function toSupportEntry(cue: NormalizedHistoryEntry): NonNullable<PatternClue["supportEntries"]>[number] {
  return {
    sourceKind:
      cue.sourceKind ?? (cue.journalEntryId ? "journal_entry" : "chat_message"),
    sessionId: cue.sessionId,
    messageId: cue.messageId,
    journalEntryId: cue.journalEntryId ?? null,
    sessionOrigin: cue.sessionOrigin,
    role: cue.role,
    timestamp: cue.createdAt,
    content: cue.content,
  };
}

function buildRepetitiveLoopClueFromCues({
  userId,
  cues,
  theme,
}: {
  userId: string;
  cues: NormalizedHistoryEntry[];
  theme: RepetitiveLoopTheme;
}): PatternClue | null {
  const sessionGroups = groupLoopCuesBySession(cues);
  const clue = buildRepetitiveLoopClueFromSessions(userId, sessionGroups, { theme });
  if (!clue) return null;

  // Session-less cues (journal/no-session imports) never influence session spread.
  // Once the subgroup passes via message sessions, keep these cues as support.
  const sessionlessCues = cues.filter((cue) => !cue.sessionId);
  if (sessionlessCues.length > 0) {
    clue.supportEntries = [...clue.supportEntries!, ...sessionlessCues.map(toSupportEntry)];
  }

  return clue;
}

export function buildRepetitiveLoopCluesFromCues({
  userId,
  cues,
  maxClues = RL_MAX_CLUES,
}: {
  userId: string;
  cues: NormalizedHistoryEntry[];
  maxClues?: number;
}): PatternClue[] {
  if (cues.length === 0) return [];

  const groupedByTheme = groupLoopCuesByTheme(cues);
  const subgroupCandidates: Array<{
    theme: RepetitiveLoopTheme;
    clue: PatternClue;
    sessionCount: number;
    cueCount: number;
  }> = [];

  for (const theme of REPETITIVE_LOOP_THEME_PRIORITY) {
    const themedCues = groupedByTheme.get(theme);
    if (!themedCues || themedCues.length === 0) continue;
    const clue = buildRepetitiveLoopClueFromCues({
      userId,
      cues: themedCues,
      theme,
    });
    if (!clue) continue;
    subgroupCandidates.push({
      theme,
      clue,
      sessionCount: groupLoopCuesBySession(themedCues).size,
      cueCount: themedCues.length,
    });
  }

  if (subgroupCandidates.length > 0) {
    const capped = subgroupCandidates
      .sort((a, b) => {
        if (a.sessionCount !== b.sessionCount) return b.sessionCount - a.sessionCount;
        if (a.cueCount !== b.cueCount) return b.cueCount - a.cueCount;
        return (
          REPETITIVE_LOOP_THEME_PRIORITY.indexOf(a.theme) -
          REPETITIVE_LOOP_THEME_PRIORITY.indexOf(b.theme)
        );
      })
      .slice(0, Math.max(1, maxClues))
      .map((candidate) => candidate.clue);
    return capped;
  }

  // Preserve legacy behavior: when no subgroup independently meets the gate,
  // fall back to one broad clue across all cues.
  const fallback = buildRepetitiveLoopClueFromCues({
    userId,
    cues,
    theme: "general",
  });
  return fallback ? [fallback] : [];
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
  sessionGroups: Map<string, NormalizedHistoryEntry[]>,
  options?: {
    theme?: RepetitiveLoopTheme;
  }
): PatternClue | null {
  if (sessionGroups.size < RL_MIN_SESSIONS) return null;

  const allCues = [...sessionGroups.values()].flat();

  // Classification: representative drives sessionId/messageId and summary dedup key.
  const representative = selectEvidenceRepresentative(allCues)!;
  const summaryQuote = representative.content.slice(0, 100).trim();
  const theme = options?.theme ?? "general";
  const summaryPrefix =
    theme === "general"
      ? "Repetitive loop pattern across sessions"
      : `Repetitive loop (${REPETITIVE_LOOP_THEME_SUMMARY_LABEL[theme]}) across sessions`;
  const summary = `${summaryPrefix}: "${summaryQuote}"`;

  // Display: stricter quote-ranking path — null when no candidate is display-safe.
  const quote = selectBestDisplayQuote(allCues) ?? undefined;

  return {
    userId,
    patternType: "repetitive_loop",
    summary,
    sourceKind:
      representative.sourceKind ??
      (representative.journalEntryId ? "journal_entry" : "chat_message"),
    sessionId: representative.sessionId,
    messageId: representative.messageId,
    journalEntryId: representative.journalEntryId ?? null,
    quote,
    supportEntries: allCues.map((cue) => toSupportEntry(cue)),
  };
}
