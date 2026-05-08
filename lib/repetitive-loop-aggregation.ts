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
import { selectBestDisplayQuoteWithSource } from "./pattern-quote-selection";

/** Minimum distinct sessions with loop cues required before a clue is emitted. */
export const RL_MIN_SESSIONS = 2;
/** Pilot cap for multi-clue emission within repetitive_loop. */
export const RL_MAX_CLUES = 3;
/** Minimum localized support score used for repetitive_loop support-entry narrowing. */
const RL_SUPPORT_LOCALIZATION_MIN_SCORE = 4;

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
 * Theme-aware localization markers (Step 5E):
 * tighten representative/quote selection within already-selected subgroup cues.
 */
const REPETITIVE_LOOP_RECURRENCE_LOCALIZATION_MARKERS: RegExp[] = [
  /\bover\s+and\s+over\b/i,
  /\bagain\s+and\s+again\b/i,
  /\bhere\s+i\s+am\s+again\b/i,
  /\b(?:same\s+(?:pattern|cycle|thing|mistake|loop))\b/i,
  /\b(?:always\s+end\s+up|every\s+time)\b/i,
  /\bkeep\s+(?:doing\s+this|ending\s+up|going\s+back|running\s+into|hitting\s+the\s+same)\b/i,
  /\bback\s+to\s+square\s+one\b/i,
  /\bkeeps?\s+happening\b/i,
  /\b(?:again|once\s+again|yet\s+again).{0,20}\b(?:i|the\s+same|back)\b/i,
  /\bi\s+keep\s+(?:\w+ing|doing|going\s+back)\b/i,
];

const GENERAL_STRONG_RECURRENCE_MARKERS: RegExp[] = [
  /\bover\s+and\s+over\b/i,
  /\bagain\s+and\s+again\b/i,
  /\bsame\s+thing\s+again\b/i,
  /\bkeep\s+doing\s+this\b/i,
  /\balways\s+end\s+up\b/i,
  /\bevery\s+time\b/i,
  /\b(?:same\s+(?:pattern|cycle|loop|thing|mistake))\b/i,
  /\bhere\s+i\s+am\s+again\b/i,
  /\bback\s+to\s+square\s+one\b/i,
];

const COGNITIVE_OVERLOAD_LOCALIZATION_STRONG_MARKERS: RegExp[] = [
  /\boverwhelm\w*\b/i,
  /\boverstim\w*\b/i,
  /\boverload\w*\b/i,
  /\bmental\s+load\b/i,
  /\btoo\s+much\s+to\s+(?:process|handle)\b/i,
  /\bpace\s+i\s+could\s+think\b/i,
  /\bthought\s+speed\b/i,
  /\borganis(?:e|ing|ation|ational)\b/i,
];

const COGNITIVE_OVERLOAD_LOCALIZATION_WEAK_MARKERS: RegExp[] = [
  /\bbrain\b/i,
  /\bmind\b/i,
  /\bmental(?:ly)?\b/i,
  /\blearn(?:ing)?\b/i,
  /\bpace\b/i,
];

const ASSISTANT_PROCESS_CONTEXT_MARKERS: RegExp[] = [
  /\b(?:assistant|codex|chatgpt|project|prompt|email|pc|watch(?:ing)?|course|video|task|instruction|process|build(?:ing)?|codebase|tooling)\b/i,
];

const ASSISTANT_PROCESS_FRICTION_MARKERS: RegExp[] = [
  /\b(?:check(?:ing)?|confirm|follow[-\s]?up|repeat(?:ing|ed)?|frustrat\w*|confus\w*|skip(?:ping|ped)?|later)\b/i,
  /\bkeep\s+(?:asking|watching)\b/i,
];

const ASSISTANT_PROCESS_REASSURANCE_MARKERS: RegExp[] = [
  /\breassur\w*\b/i,
  /\bseek(?:ing)?\s+reassurance\b/i,
];

function countPatternMatches(content: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(content) ? 1 : 0), 0);
}

function computeRecurrenceLocalizationScore(content: string): number {
  const recurrence = countPatternMatches(content, REPETITIVE_LOOP_RECURRENCE_LOCALIZATION_MARKERS);
  if (recurrence === 0) return 0;
  const strongRecurrence = countPatternMatches(content, GENERAL_STRONG_RECURRENCE_MARKERS);
  return recurrence + strongRecurrence * 2;
}

function computeThemeSemanticLocalizationScore(theme: RepetitiveLoopTheme, content: string): number {
  if (theme === "general") {
    return countPatternMatches(content, GENERAL_STRONG_RECURRENCE_MARKERS);
  }
  if (theme === "substance_relapse") {
    return countPatternMatches(content, SUBSTANCE_RELAPSE_THEME_MARKERS);
  }
  if (theme === "cognitive_overload") {
    const strong = countPatternMatches(content, COGNITIVE_OVERLOAD_LOCALIZATION_STRONG_MARKERS);
    const weak = countPatternMatches(content, COGNITIVE_OVERLOAD_LOCALIZATION_WEAK_MARKERS);
    return strong * 2 + weak;
  }
  if (theme === "assistant_process") {
    const reassurance = countPatternMatches(content, ASSISTANT_PROCESS_REASSURANCE_MARKERS);
    if (reassurance > 0) {
      return reassurance * 3;
    }
    const context = countPatternMatches(content, ASSISTANT_PROCESS_CONTEXT_MARKERS);
    const friction = countPatternMatches(content, ASSISTANT_PROCESS_FRICTION_MARKERS);
    if (context === 0 || friction === 0) return 0;
    return context + friction * 2;
  }
  return countPatternMatches(content, EMOTIONAL_RESET_THEME_MARKERS);
}

function computeThemeLocalizedCueScore({
  theme,
  content,
}: {
  theme: RepetitiveLoopTheme;
  content: string;
}): number {
  const recurrenceScore = computeRecurrenceLocalizationScore(content);
  if (recurrenceScore === 0) return 0;

  const semanticScore = computeThemeSemanticLocalizationScore(theme, content);
  if (semanticScore === 0) return 0;

  return recurrenceScore + semanticScore;
}

function selectThemeLocalizedCuePool({
  cues,
  theme,
}: {
  cues: NormalizedHistoryEntry[];
  theme: RepetitiveLoopTheme;
}): NormalizedHistoryEntry[] {
  const scored = cues.map((cue) => ({
    cue,
    score: computeThemeLocalizedCueScore({ theme, content: cue.content }),
  }));
  const maxScore = scored.reduce((max, item) => Math.max(max, item.score), 0);
  if (maxScore <= 0) return [];
  return scored
    .filter((item) => item.score === maxScore)
    .map((item) => item.cue);
}

function selectThemeLocalizedSupportCuePool({
  cues,
  theme,
}: {
  cues: NormalizedHistoryEntry[];
  theme: RepetitiveLoopTheme;
}): NormalizedHistoryEntry[] {
  return cues
    .map((cue) => ({
      cue,
      score: computeThemeLocalizedCueScore({ theme, content: cue.content }),
    }))
    .filter((item) => item.score >= RL_SUPPORT_LOCALIZATION_MIN_SCORE)
    .map((item) => item.cue);
}

function selectSupportCuePoolForTheme({
  cues,
  theme,
}: {
  cues: NormalizedHistoryEntry[];
  theme: RepetitiveLoopTheme;
}): NormalizedHistoryEntry[] {
  if (cues.length === 0) return cues;

  const localizedSupport = selectThemeLocalizedSupportCuePool({ cues, theme });
  const localizedSessionCount = groupLoopCuesBySession(localizedSupport).size;
  if (localizedSessionCount >= RL_MIN_SESSIONS) {
    return localizedSupport;
  }

  return cues;
}

function cueMatchesRepresentative({
  cue,
  clue,
}: {
  cue: NormalizedHistoryEntry;
  clue: PatternClue;
}): boolean {
  if (clue.messageId != null && cue.messageId != null) {
    return cue.messageId === clue.messageId;
  }
  if (clue.journalEntryId != null && cue.journalEntryId != null) {
    return cue.journalEntryId === clue.journalEntryId;
  }
  return false;
}

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

  const supportPool = selectSupportCuePoolForTheme({ cues, theme });
  let supportCues = supportPool;

  // Keep representative provenance in support for replay consistency.
  const representativeCue = cues.find((cue) => cueMatchesRepresentative({ cue, clue }));
  if (representativeCue && !supportCues.some((cue) => cueMatchesRepresentative({ cue, clue }))) {
    supportCues = [...supportCues, representativeCue];
  }
  clue.supportEntries = supportCues.map(toSupportEntry);

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
  const theme = options?.theme ?? "general";
  const localizedCuePool = selectThemeLocalizedCuePool({
    cues: allCues,
    theme,
  });
  const representativePool = localizedCuePool.length > 0 ? localizedCuePool : allCues;

  // Classification: representative drives sessionId/messageId and summary dedup key.
  const representative = selectEvidenceRepresentative(representativePool)!;
  const summaryQuote = representative.content.slice(0, 100).trim();
  const summaryPrefix =
    theme === "general"
      ? "Repetitive loop pattern across sessions"
      : `Repetitive loop (${REPETITIVE_LOOP_THEME_SUMMARY_LABEL[theme]}) across sessions`;
  const summary = `${summaryPrefix}: "${summaryQuote}"`;

  // Display: stricter quote-ranking path — null when no candidate is display-safe.
  const displayQuoteSelection =
    selectBestDisplayQuoteWithSource(
      localizedCuePool.length > 0 ? localizedCuePool : allCues
    ) ?? selectBestDisplayQuoteWithSource(allCues);
  const quote = displayQuoteSelection?.quote ?? undefined;
  const quoteSource = displayQuoteSelection?.candidate;

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
    quoteSourceKind: quoteSource
      ? quoteSource.sourceKind ?? (quoteSource.journalEntryId ? "journal_entry" : "chat_message")
      : undefined,
    quoteSessionId: quoteSource?.sessionId,
    quoteMessageId: quoteSource?.messageId,
    quoteJournalEntryId: quoteSource?.journalEntryId ?? null,
    supportEntries: allCues.map((cue) => toSupportEntry(cue)),
  };
}
