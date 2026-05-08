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
import { extractQuote } from "./pattern-claim-evidence";
import { selectBestDisplayQuote } from "./pattern-quote-selection";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum user messages with recovery markers before a clue is emitted. */
export const RS_MIN_MATCHES = 2;

// ── Markers ───────────────────────────────────────────────────────────────────

export const RECOVERY_STABILIZER_MARKERS: RegExp[] = [
  /\bi'?ve\s+been\s+(?:doing|getting|feeling)\s+(?:better|well|good|great)\b/i,
  /\bi'?ve\s+been\s+doing\s+a\s+better\s+job\b/i,
  /\blately\s+i'?ve\s+been\s+doing\s+a\s+better\s+job\b/i,
  /\b(?:finally|at\s+last)\s+(?:able\s+to|managed|starting\s+to|making)\b/i,
  /\bi'?m\s+(?:getting|making|seeing)\s+(?:better|progress|improvement)\b/i,
  /\b(?:making|seeing|noticing)\s+(?:real\s+)?progress\b/i,
  /\bi\s+(?:actually|finally|really)\s+(?:did\s+it|managed|succeeded|stuck\s+with)\b/i,
  /\bthings?\s+(?:are\s+)?(?:getting|feeling|looking)\s+(?:better|easier|clearer)\b/i,
  /\b(?:recovering|rebuilding|bouncing\s+back|stabiliz\w+)\b/i,
  /\bstabiliz\w+\s+faster\b/i,
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

const RECOVERY_SUMMARY_STABILIZATION_MARKERS: RegExp[] = [
  /\b(?:making|made|seeing|noticing)\s+(?:real\s+)?progress\b/i,
  /\bprogress\s+though\b/i,
  /\bgot\s+through\s+it\b/i,
  /\bcalm(?:ed)?\s+down\b/i,
  /\bground(?:ed|ing)\b/i,
  /\breset\b/i,
  /\brecover(?:ed|ing)?\b/i,
  /\b(?:feel|felt)\s+better\b/i,
  /\bgot\s+rid\s+of\s+it\b/i,
  /\bhelp(?:ed|s)?\s+me\s+stabiliz\w*\b/i,
  /\bstabiliz\w+\b/i,
  /\b(?:prayed?|meditat\w+)\b.{0,40}\b(?:stabiliz\w+|calm(?:ed)?\s+down|better|got\s+rid\s+of\s+it|recover\w*)\b/i,
  /\b(?:stabiliz\w+|calm(?:ed)?\s+down|better|recover\w*|got\s+rid\s+of\s+it)\b.{0,40}\b(?:prayed?|meditat\w+)\b/i,
];

const RECOVERY_SUMMARY_BIOGRAPHY_MARKERS: RegExp[] = [
  /\bshy(?:ness)?\b/i,
  /\blife\s+story\b/i,
  /\bexacerbat\w*\b/i,
  /\bsince\s+a\s+child\b/i,
  /\bas\s+a\s+child\b/i,
  /\bgrowing\s+up\b/i,
  /\bconsidered\s+shy\b/i,
];

type RecoveryQuoteCandidate = {
  entry: NormalizedHistoryEntry;
  quote: string;
};

function matchesAnyRecoveryPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

function filterRecoverySummaryMatches(
  matches: NormalizedHistoryEntry[]
): NormalizedHistoryEntry[] {
  const themed = matches.filter((entry) =>
    matchesAnyRecoveryPattern(entry.content, RECOVERY_SUMMARY_STABILIZATION_MARKERS)
  );
  return themed.length > 0 ? themed : matches;
}

function buildRecoveryQuoteCandidates(
  matches: NormalizedHistoryEntry[]
): RecoveryQuoteCandidate[] {
  const candidates: RecoveryQuoteCandidate[] = [];
  for (const entry of matches) {
    const quote = extractQuote(entry.content).trim();
    if (quote.length === 0) continue;
    candidates.push({ entry, quote });
  }
  return candidates;
}

function selectRecoveryQuoteFromCandidates(
  candidates: RecoveryQuoteCandidate[]
): string | null {
  return selectBestDisplayQuote(
    candidates.map((candidate) => ({ content: candidate.quote }))
  );
}

function findLastEntryForQuote(
  candidates: RecoveryQuoteCandidate[],
  quote: string
): NormalizedHistoryEntry | null {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (candidates[index]?.quote === quote) {
      return candidates[index]!.entry;
    }
  }
  return null;
}

type RecoverySummarySelection = {
  representative: NormalizedHistoryEntry;
  summaryQuote: string;
  displayQuote?: string;
};

function selectRecoverySummaryCandidate(
  localizedMatches: NormalizedHistoryEntry[],
  fallbackMatches: NormalizedHistoryEntry[]
): RecoverySummarySelection | null {
  const quoteCandidates = buildRecoveryQuoteCandidates(localizedMatches);
  const explicitRecoveryCandidates = quoteCandidates.filter((candidate) =>
    matchesAnyRecoveryPattern(candidate.quote, RECOVERY_SUMMARY_STABILIZATION_MARKERS)
  );
  const explicitRecoveryNonBiographyCandidates = explicitRecoveryCandidates.filter(
    (candidate) =>
      !matchesAnyRecoveryPattern(candidate.quote, RECOVERY_SUMMARY_BIOGRAPHY_MARKERS)
  );
  const prioritizedCandidates =
    explicitRecoveryNonBiographyCandidates.length > 0
      ? explicitRecoveryNonBiographyCandidates
      : explicitRecoveryCandidates;

  if (prioritizedCandidates.length > 0) {
    const selectedQuote = selectRecoveryQuoteFromCandidates(prioritizedCandidates);
    if (selectedQuote) {
      const representative =
        findLastEntryForQuote(prioritizedCandidates, selectedQuote) ??
        selectEvidenceRepresentative(prioritizedCandidates.map((candidate) => candidate.entry));
      if (!representative) return null;
      return {
        representative,
        summaryQuote: selectedQuote,
        displayQuote: selectedQuote,
      };
    }

    const representative = selectEvidenceRepresentative(
      prioritizedCandidates.map((candidate) => candidate.entry)
    );
    if (!representative) return null;
    const extracted = extractQuote(representative.content).trim();
    return {
      representative,
      summaryQuote: extracted.length > 0 ? extracted : representative.content.slice(0, 100).trim(),
    };
  }

  const representative = selectEvidenceRepresentative(localizedMatches);
  if (!representative) return null;

  const legacyDisplayQuote =
    selectBestDisplayQuote(localizedMatches) ??
    selectBestDisplayQuote(fallbackMatches) ??
    undefined;
  return {
    representative,
    summaryQuote: representative.content.slice(0, 100).trim(),
    displayQuote: legacyDisplayQuote,
  };
}

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

  const localizedMatches = filterRecoverySummaryMatches(matches);

  const selected = selectRecoverySummaryCandidate(localizedMatches, matches);
  if (!selected) return [];
  const representative = selected.representative;
  const summaryQuote = selected.summaryQuote.slice(0, 100).trim();
  const summary = `Recovery pattern: "${summaryQuote}"`;

  const quote = selected.displayQuote;

  return [
    {
      userId,
      patternType: "recovery_stabilizer",
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
    },
  ];
}
