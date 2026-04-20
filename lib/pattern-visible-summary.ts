import type { PatternTypeValue } from "./pattern-claim-boundary";

type SummaryReceipt = {
  quote: string | null;
};

export type VisibleSummaryInput = {
  patternType: PatternTypeValue;
  persistedSummary: string;
  receipts: SummaryReceipt[];
};

const GENERIC_SHELL_PATTERNS = [
  /recurring trigger-response pattern/i,
  /recurring trigger response pattern/i,
  /recurring self-critical pattern/i,
  /recurring self critical pattern/i,
  /recurring repetitive loop/i,
  /recurring recovery pattern/i,
  /conversation history/i,
  /^pattern around\b/i,
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "get",
  "go",
  "goes",
  "going",
  "i",
  "im",
  "ive",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "up",
  "when",
  "you",
  "your",
  "pattern",
  "patterns",
  "recurring",
  "conversation",
  "history",
  "loop",
  "loops",
  "trigger",
  "response",
  "responses",
  "recovery",
  "stabilizer",
  "self",
  "critical",
  "language",
  "sessions",
  "things",
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeToken(token: string): string {
  if (/^pleas(?:e|er|ers|ing|ed)?$/.test(token)) return "please";
  if (/^appeas(?:e|es|ed|ing)?$/.test(token)) return "appease";
  return token;
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .map(canonicalizeToken)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function getQuotes(receipts: SummaryReceipt[]): string[] {
  return receipts
    .map((receipt) => receipt.quote?.trim() ?? "")
    .filter((quote) => quote.length > 0);
}

function countMatchingQuotes(quotes: string[], pattern: RegExp): number {
  return quotes.filter((quote) => pattern.test(quote)).length;
}

function hasRecurringSignal(quotes: string[], pattern: RegExp): boolean {
  return countMatchingQuotes(quotes, pattern) >= 2;
}

function isGenericShellSummary(summary: string): boolean {
  return GENERIC_SHELL_PATTERNS.some((pattern) => pattern.test(summary.trim()));
}

function isDistinctFromQuotes(summary: string, quotes: string[]): boolean {
  const normalizedSummary = normalizeText(summary);
  return quotes.every((quote) => normalizeText(quote) !== normalizedSummary);
}

function hasLexicalEvidenceOverlap(summary: string, quotes: string[]): boolean {
  const evidenceTokens = new Set(quotes.flatMap(tokenize));
  const summaryTokens = tokenize(summary);
  return summaryTokens.some((token) => evidenceTokens.has(token));
}

function buildTriggerSummary(quotes: string[]): string | null {
  if (
    hasRecurringSignal(
      quotes,
      /\b(people[-\s]?pleas(?:e|ing|er)|appeas(?:e|ing)?|apologiz\w*|go along|walk it back|settl(?:e|ing) for less|submissiv\w*)\b/i
    )
  ) {
    return "When pressure rises, you default to pleasing or appeasing.";
  }

  if (
    hasRecurringSignal(
      quotes,
      /\b(shut down|go quiet|freeze|withdraw|retreat|stay quiet)\b/i
    )
  ) {
    return "When pressure rises, you shut down or go quiet.";
  }

  if (hasRecurringSignal(quotes, /\b(procrastinat|avoid|put off|delay)\w*\b/i)) {
    return "Pressure often pushes you toward avoidance.";
  }

  return null;
}

function buildInnerCriticSummary(quotes: string[]): string | null {
  if (
    hasRecurringSignal(
      quotes,
      /\b(doubt myself|not sure i can|capable|incapable|second-guess|trust my own judgment|probably can t|probably cant)\b/i
    )
  ) {
    return "Self-doubt shows up when you assess your own ability.";
  }

  if (
    hasRecurringSignal(
      quotes,
      /\b(terrible at|mess things up|ruin things|failure|can(?:'|’|\s)?t do|can(?:'|’|\s)?t get anything right)\b/i
    )
  ) {
    return "You often tell yourself you can't do it or get it right.";
  }

  if (
    hasRecurringSignal(
      quotes,
      /\b(have\s+a\s+hard\s+time|have\s+trouble|have\s+difficulty|probably\s+can't|probably\s+cant|probably\s+cannot|worried\s+(?:that\s+)?i|afraid\s+(?:that\s+)?i)\b/i
    )
  ) {
    return "You often find certain areas hard and doubt your own ability to handle them.";
  }

  return null;
}

function buildRepetitiveLoopSummary(quotes: string[]): string | null {
  if (
    hasRecurringSignal(
      quotes,
      /\b(regret|wasted potential|potential|confidence|could have|should have)\b/i
    )
  ) {
    return "The same confidence-related regret keeps resurfacing.";
  }

  if (
    hasRecurringSignal(
      quotes,
      /\b(same pattern|same loop|back here|square one|again|same place|over and over)\b/i
    )
  ) {
    return "You describe returning to the same loop even when you see it happening.";
  }

  return null;
}

function buildRecoverySummary(quotes: string[]): string | null {
  if (
    hasRecurringSignal(
      quotes,
      /\b(follow through|stuck with|stick with|keeping up|routine|routines|consistent|consistently|momentum)\b/i
    )
  ) {
    return "Progress appears when you follow through consistently.";
  }

  if (
    hasRecurringSignal(
      quotes,
      /\b(stay calm|stepped away|step away|walk away|boundary|set a limit|speak up|speaking up)\b/i
    )
  ) {
    return "You describe improvement when you stay steady under pressure.";
  }

  if (
    hasRecurringSignal(
      quotes,
      /\b(doing better|get(?:ting)? better|making progress|improvement|progress)\b/i
    )
  ) {
    return "You describe improvement when momentum becomes visible.";
  }

  return null;
}

function buildCandidateSummary(patternType: PatternTypeValue, quotes: string[]): string | null {
  switch (patternType) {
    case "trigger_condition":
      return buildTriggerSummary(quotes);
    case "inner_critic":
      return buildInnerCriticSummary(quotes);
    case "repetitive_loop":
      return buildRepetitiveLoopSummary(quotes);
    case "recovery_stabilizer":
      return buildRecoverySummary(quotes);
    case "contradiction_drift":
      return null;
  }
}

function isAcceptedVisibleSummary(
  summary: string,
  quotes: string[],
  patternType: PatternTypeValue
): boolean {
  if (patternType === "contradiction_drift") return summary.trim().length > 0;
  if (isGenericShellSummary(summary)) return false;
  if (summary.trim().length < 24 || summary.trim().length > 120) return false;
  if (!isDistinctFromQuotes(summary, quotes)) return false;
  if (!hasLexicalEvidenceOverlap(summary, quotes)) return false;
  return true;
}

export function generateVisiblePatternSummary({
  patternType,
  persistedSummary,
  receipts,
}: VisibleSummaryInput): string | null {
  if (patternType === "contradiction_drift") {
    return persistedSummary;
  }

  const quotes = getQuotes(receipts);
  if (quotes.length < 2) return null;

  const candidate = buildCandidateSummary(patternType, quotes);
  if (!candidate) return null;

  return isAcceptedVisibleSummary(candidate, quotes, patternType)
    ? candidate
    : null;
}

export function shouldSurfacePatternClaim(input: VisibleSummaryInput): boolean {
  return generateVisiblePatternSummary(input) !== null;
}
