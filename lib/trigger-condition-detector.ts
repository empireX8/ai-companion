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
const TRIGGER_MARKER_DEFINITIONS: Array<{ label: string; pattern: RegExp }> = [
  { label: "whenever", pattern: /\bwhenever\b/i },
  { label: "every_time", pattern: /\bevery\s+time\b/i },
  {
    label: "when_i_tend_to",
    pattern:
      /\bwhen\s+(?:i|i'm|i\s+am|\w+).{0,40}\b(?:always|tend\s+to|usually|often|end\s+up|start\s+to)\b/i,
  },
  { label: "default_to", pattern: /\b(?:when|whenever|if)\b.{0,80}\b(?:i\s+)?default\s+to\b/i },
  { label: "walk_back", pattern: /\b(?:when|whenever|if)\b.{0,80}\bwalk\s+back\b/i },
  {
    label: "start_appeasing",
    pattern: /\b(?:when|whenever|if)\b.{0,80}\b(?:start|starting)\s+appeas\w+\b/i,
  },
  { label: "triggers_me", pattern: /\btriggers?\s+(?:me|my)\b/i },
  { label: "makes_me", pattern: /\bmakes?\s+me\s+(?:want|feel|start|tend)\b/i },
  { label: "if_then_i", pattern: /\bif\s+.{0,40}\bthen\s+i\b/i },
  { label: "always_when", pattern: /\b(?:always|tend\s+to|end\s+up)\s+.{0,20}when\b/i },
  // Broader natural-language trigger markers
  { label: "i_tend_to", pattern: /\bi\s+tend\s+to\b/i },
  {
    label: "automatic_when_if",
    pattern:
      /\bi\s+(?:always|automatically|instinctively|usually|typically)\s+(?:\w+\s+){0,3}(?:when|if|after|before)\b/i,
  },
  {
    label: "my_default_or_reaction",
    pattern: /\bmy\s+(?:default|instinct|reaction|pattern|first\s+instinct|go-?to)\s+is\b/i,
  },
  { label: "i_notice_i", pattern: /\bi\s+notice\s+(?:that\s+)?i\b/i },
  { label: "by_default_i", pattern: /\bby\s+default\s+i\b/i },
  {
    label: "automatically_when_if_once",
    pattern: /\bautomatically\s+(?:\w+\s+){0,3}(?:when|if|once)\b/i,
  },
  { label: "always_end_up_default", pattern: /\bi\s+always\s+(?:end\s+up|find\s+myself|default\s+to|gravitate)\b/i },
];

export const TRIGGER_MARKERS: RegExp[] = TRIGGER_MARKER_DEFINITIONS.map(
  (definition) => definition.pattern
);

export type TriggerConditionSubgroup =
  | "social_appeasement"
  | "overwhelm_state_shift"
  | "coping_reactivity"
  | "general";

export type TriggerConditionSubgroupBucketDiagnostics = {
  candidateCount: number;
  sessionCount: number;
  samples: string[];
  topMatchedMarkers: string[];
};

export type TriggerConditionSubgroupDiagnostics = Record<
  TriggerConditionSubgroup,
  TriggerConditionSubgroupBucketDiagnostics
>;

const TRIGGER_SUBGROUP_ORDER: TriggerConditionSubgroup[] = [
  "social_appeasement",
  "overwhelm_state_shift",
  "coping_reactivity",
  "general",
];

const SOCIAL_APPEASEMENT_MARKERS: RegExp[] = [
  /\bpeople[-\s]?pleas\w*\b/i,
  /\bappeas\w*\b/i,
  /\bboundar(?:y|ies)\b/i,
  /\bwalk\s+back\b/i,
  /\bdisappoint\w*\b/i,
  /\bupset\b/i,
  /\bsocial(?:ly)?\b/i,
  /\bfamily\b/i,
  /\bchristen\w*\b/i,
];

const OVERWHELM_STATE_SHIFT_MARKERS: RegExp[] = [
  /\boverwhelm\w*\b/i,
  /\boverstim\w*\b/i,
  /\bmode\b/i,
  /\bstate\b/i,
  /\bemotional\b/i,
  /\bidentity\b/i,
  /\bpanic\w*\b/i,
  /\bpressure\b/i,
  /\banxious\b/i,
];

const COPING_REACTIVITY_MARKERS: RegExp[] = [
  /\bweed\b/i,
  /\bsmok\w*\b/i,
  /\btobacco\b/i,
  /\balcohol\b/i,
  /\brelaps\w*\b/i,
  /\bquit(?:ting)?\b/i,
  /\btea\b/i,
  /\bkettle\b/i,
  /\beat(?:ing)?\b/i,
  /\bdinner\b/i,
  /\bfood\b/i,
  /\bsnack\w*\b/i,
  /\bfeel\s+weird\b/i,
  /\bbody\b/i,
  /\bsomatic\b/i,
];

function matchesAnyPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

function truncateDiagnosticSample(content: string, maxLength = 140): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function countDistinctSessions(entries: NormalizedHistoryEntry[]): number {
  return new Set(entries.map((entry) => entry.sessionId).filter((sessionId): sessionId is string => Boolean(sessionId)))
    .size;
}

function getMatchedTriggerMarkerLabels(content: string): string[] {
  return TRIGGER_MARKER_DEFINITIONS
    .filter((definition) => definition.pattern.test(content))
    .map((definition) => definition.label);
}

function sortDiagnosticEntries(entries: NormalizedHistoryEntry[]): NormalizedHistoryEntry[] {
  return entries
    .slice()
    .sort((left, right) => {
      const byTimestamp = right.createdAt.getTime() - left.createdAt.getTime();
      if (byTimestamp !== 0) return byTimestamp;

      const leftSessionId = left.sessionId ?? "";
      const rightSessionId = right.sessionId ?? "";
      if (leftSessionId !== rightSessionId) return leftSessionId.localeCompare(rightSessionId);

      const leftMessageId = left.messageId ?? "";
      const rightMessageId = right.messageId ?? "";
      if (leftMessageId !== rightMessageId) return leftMessageId.localeCompare(rightMessageId);

      return left.content.localeCompare(right.content);
    });
}

function getTopMatchedMarkers(markerCounts: Map<string, number>, limit = 3): string[] {
  return [...markerCounts.entries()]
    .sort((left, right) => {
      if (left[1] !== right[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([label]) => label);
}

export function classifyTriggerConditionSubgroup(content: string): TriggerConditionSubgroup {
  if (matchesAnyPattern(content, SOCIAL_APPEASEMENT_MARKERS)) {
    return "social_appeasement";
  }
  if (matchesAnyPattern(content, OVERWHELM_STATE_SHIFT_MARKERS)) {
    return "overwhelm_state_shift";
  }
  if (matchesAnyPattern(content, COPING_REACTIVITY_MARKERS)) {
    return "coping_reactivity";
  }
  return "general";
}

export function getTriggerConditionMatches(
  entries: NormalizedHistoryEntry[]
): NormalizedHistoryEntry[] {
  const userMessages = entries.filter((entry) => entry.role === "user");
  return userMessages.filter((entry) =>
    TRIGGER_MARKERS.some((pattern) => pattern.test(entry.content))
  );
}

export function buildTriggerConditionSubgroupDiagnostics(
  entries: NormalizedHistoryEntry[]
): TriggerConditionSubgroupDiagnostics {
  const matches = getTriggerConditionMatches(entries);
  const groupedBySubgroup = new Map<TriggerConditionSubgroup, NormalizedHistoryEntry[]>();
  const markerCountsBySubgroup = new Map<TriggerConditionSubgroup, Map<string, number>>();

  for (const entry of matches) {
    const subgroup = classifyTriggerConditionSubgroup(entry.content);
    const existingEntries = groupedBySubgroup.get(subgroup);
    if (existingEntries) existingEntries.push(entry);
    else groupedBySubgroup.set(subgroup, [entry]);

    const subgroupMarkerCounts =
      markerCountsBySubgroup.get(subgroup) ?? new Map<string, number>();
    for (const markerLabel of getMatchedTriggerMarkerLabels(entry.content)) {
      subgroupMarkerCounts.set(
        markerLabel,
        (subgroupMarkerCounts.get(markerLabel) ?? 0) + 1
      );
    }
    markerCountsBySubgroup.set(subgroup, subgroupMarkerCounts);
  }

  const diagnostics = {} as TriggerConditionSubgroupDiagnostics;
  for (const subgroup of TRIGGER_SUBGROUP_ORDER) {
    const subgroupEntries = groupedBySubgroup.get(subgroup) ?? [];
    const markerCounts = markerCountsBySubgroup.get(subgroup) ?? new Map<string, number>();
    const sortedEntries = sortDiagnosticEntries(subgroupEntries);
    diagnostics[subgroup] = {
      candidateCount: subgroupEntries.length,
      sessionCount: countDistinctSessions(subgroupEntries),
      samples: sortedEntries
        .slice(0, 3)
        .map((entry) => truncateDiagnosticSample(entry.content)),
      topMatchedMarkers: getTopMatchedMarkers(markerCounts, 3),
    };
  }

  return diagnostics;
}

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
  const matches = getTriggerConditionMatches(entries);

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
    sourceKind:
      representative.sourceKind ??
      (representative.journalEntryId ? "journal_entry" : "chat_message"),
    sessionId: representative.sessionId,
    messageId: representative.messageId,
    journalEntryId: representative.journalEntryId ?? null,
    quote,
    supportEntries: matches.map((match) => ({
      sourceKind:
        match.sourceKind ?? (match.journalEntryId ? "journal_entry" : "chat_message"),
      sessionId: match.sessionId,
      messageId: match.messageId,
      journalEntryId: match.journalEntryId ?? null,
      sessionOrigin: match.sessionOrigin,
      role: match.role,
      timestamp: match.createdAt,
      content: match.content,
    })),
  }];
}
