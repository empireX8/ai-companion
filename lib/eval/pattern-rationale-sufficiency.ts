import { generateVisiblePatternSummary } from "../pattern-visible-summary";
import { isDisplaySafePatternQuote, scorePatternQuoteCandidate } from "../pattern-quote-selection";
import type {
  ActiveFamily,
  FaithfulnessClaimScore,
  GroupResult,
  RationaleSufficiencyClaimScore,
  RationaleSufficiencyReport,
} from "./eval-types";

type SummaryRubric = {
  family: ActiveFamily;
  summary: string;
  supportPattern: RegExp;
};

export type ResolvedRationaleReceiptBundle = {
  quotes: string[];
  source: "preferred_receipts" | "matching_pair" | "ranked_fallback";
};

export const RATIONALE_SUFFICIENCY_FLOOR = 0.50;
export const RATIONALE_PARSE_FAILURE_CEILING = 0.60;
export const RATIONALE_FAITHFULNESS_STABILITY_FLOOR = 0.50;

const SUMMARY_RUBRICS: SummaryRubric[] = [
  {
    family: "trigger_condition",
    summary: "When pressure rises, you default to pleasing or appeasing.",
    supportPattern:
      /\b(people[-\s]?pleas(?:e|ing)?|appeas(?:e|ing)?|apologiz\w*|back down|go along|walk it back|settl(?:e|ing) for less|upset|tension)\b/i,
  },
  {
    family: "trigger_condition",
    summary: "When pressure rises, you shut down or go quiet.",
    supportPattern: /\b(shut down|go quiet|freeze|withdraw|retreat|stay quiet|silent)\b/i,
  },
  {
    family: "trigger_condition",
    summary: "Pressure often pushes you toward avoidance.",
    supportPattern: /\b(procrastinat|avoid|put off|delay)\w*\b/i,
  },
  {
    family: "inner_critic",
    summary: "Self-doubt shows up when you assess your own ability.",
    supportPattern:
      /\b(doubt myself|doubt my ability|not sure i can|capable|incapable|second-guess|question myself|trust my own judgment|probably can t|probably cant)\b/i,
  },
  {
    family: "inner_critic",
    summary: "You often frame yourself as incapable before acting.",
    supportPattern:
      /\b(terrible at|mess things up|ruin things|failure|failing|give up|can t do|cant do|can t get anything right|cant get anything right)\b/i,
  },
  {
    family: "repetitive_loop",
    summary: "The same confidence-related regret keeps resurfacing.",
    supportPattern: /\b(regret|wasted potential|potential|confidence|could have|should have)\b/i,
  },
  {
    family: "repetitive_loop",
    summary: "You describe returning to the same loop even when you see it happening.",
    supportPattern: /\b(same pattern|same loop|back here|square one|again|same place|over and over)\b/i,
  },
  {
    family: "recovery_stabilizer",
    summary: "Progress appears when you follow through consistently.",
    supportPattern:
      /\b(follow through|followed through|stuck with|stick with|keeping up|routine|routines|consistent|consistently|momentum)\b/i,
  },
  {
    family: "recovery_stabilizer",
    summary: "You describe improvement when you stay steady under pressure.",
    supportPattern:
      /\b(stay calm|stepped away|step away|walk away|boundary|set a limit|speak up|speaking up)\b/i,
  },
  {
    family: "recovery_stabilizer",
    summary: "You describe improvement when momentum becomes visible.",
    supportPattern:
      /\b(doing better|get(?:ting)? better|making progress|improvement|progress|difference)\b/i,
  },
];

function uniqueQuotes(quotes: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const quote of quotes) {
    const trimmed = quote.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeQuoteBundle(quotes: string[], maxReceipts?: number): string[] {
  const normalized = uniqueQuotes(quotes);
  return maxReceipts === undefined ? normalized : normalized.slice(0, maxReceipts);
}

function rankQuotes(quotes: string[]) {
  return uniqueQuotes(quotes)
    .map((quote, index) => ({
      quote,
      index,
      displaySafe: isDisplaySafePatternQuote(quote),
      quoteScore: scorePatternQuoteCandidate(quote),
    }))
    .sort((a, b) => {
      const aViable = a.quoteScore.score > 0;
      const bViable = b.quoteScore.score > 0;
      if (aViable !== bViable) return aViable ? -1 : 1;
      if (a.displaySafe !== b.displaySafe) return a.displaySafe ? -1 : 1;
      if (a.quoteScore.score !== b.quoteScore.score) return b.quoteScore.score - a.quoteScore.score;
      if (a.quoteScore.isQuestion !== b.quoteScore.isQuestion) return a.quoteScore.isQuestion ? 1 : -1;
      if (a.quoteScore.isAssistantDirected !== b.quoteScore.isAssistantDirected) {
        return a.quoteScore.isAssistantDirected ? 1 : -1;
      }
      if (a.quoteScore.isQuotedOrPasted !== b.quoteScore.isQuotedOrPasted) {
        return a.quoteScore.isQuotedOrPasted ? 1 : -1;
      }
      return a.index - b.index;
    });
}

function findSummaryRubric(
  family: ActiveFamily,
  visibleSummary: string
): SummaryRubric | null {
  return (
    SUMMARY_RUBRICS.find(
      (rubric) => rubric.family === family && rubric.summary === visibleSummary
    ) ?? null
  );
}

function countMatchingQuotes(quotes: string[], pattern: RegExp): number {
  return quotes.filter((quote) => pattern.test(quote)).length;
}

function buildReceipts(quotes: string[]) {
  return quotes.map((quote) => ({ quote }));
}

function scoreMatchingPair(args: {
  family: ActiveFamily;
  visibleSummary: string;
  quotes: string[];
}): string[] | null {
  const ranked = rankQuotes(args.quotes);
  const matchingPairs: Array<{
    quotes: string[];
    displaySafeCount: number;
    totalScore: number;
    indexes: [number, number];
  }> = [];

  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const first = ranked[i]!;
      const second = ranked[j]!;
      const quotes = [first.quote, second.quote];
      const regenerated = generateVisiblePatternSummary({
        patternType: args.family,
        persistedSummary: "",
        receipts: buildReceipts(quotes),
      });
      if (regenerated !== args.visibleSummary) continue;
      matchingPairs.push({
        quotes,
        displaySafeCount: Number(first.displaySafe) + Number(second.displaySafe),
        totalScore: first.quoteScore.score + second.quoteScore.score,
        indexes: [Math.min(first.index, second.index), Math.max(first.index, second.index)],
      });
    }
  }

  matchingPairs.sort((a, b) => {
    if (a.quotes.length !== b.quotes.length) return a.quotes.length - b.quotes.length;
    if (a.displaySafeCount !== b.displaySafeCount) return b.displaySafeCount - a.displaySafeCount;
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    if (a.indexes[0] !== b.indexes[0]) return a.indexes[0] - b.indexes[0];
    return a.indexes[1] - b.indexes[1];
  });

  return matchingPairs[0]?.quotes ?? null;
}

export function selectRationaleReceiptBundle(
  argsOrQuotes:
    | string[]
    | {
        family: ActiveFamily;
        visibleSummary: string;
        fullEvidenceQuotes: string[];
        preferredReceiptQuotes?: string[];
        maxReceipts?: number;
      },
  maxReceipts = 2
): string[] {
  if (Array.isArray(argsOrQuotes)) {
    return rankQuotes(argsOrQuotes)
      .slice(0, maxReceipts)
      .map((entry) => entry.quote);
  }

  const preferredBundle = normalizeQuoteBundle(argsOrQuotes.preferredReceiptQuotes ?? []);
  if (preferredBundle.length >= 2) {
    return preferredBundle;
  }

  const matchingPair = scoreMatchingPair({
    family: argsOrQuotes.family,
    visibleSummary: argsOrQuotes.visibleSummary,
    quotes: argsOrQuotes.fullEvidenceQuotes,
  });
  if (matchingPair) return matchingPair;

  return rankQuotes(argsOrQuotes.fullEvidenceQuotes)
    .slice(0, argsOrQuotes.maxReceipts ?? maxReceipts)
    .map((entry) => entry.quote);
}

export function resolveRationaleReceiptBundle(args: {
  family: ActiveFamily;
  visibleSummary: string;
  fullEvidenceQuotes: string[];
  preferredReceiptQuotes?: string[];
  maxReceipts?: number;
}): ResolvedRationaleReceiptBundle {
  const preferredBundle = normalizeQuoteBundle(args.preferredReceiptQuotes ?? []);
  if (preferredBundle.length >= 2) {
    return { quotes: preferredBundle, source: "preferred_receipts" };
  }

  const matchingPair = scoreMatchingPair({
    family: args.family,
    visibleSummary: args.visibleSummary,
    quotes: args.fullEvidenceQuotes,
  });
  if (matchingPair) {
    return { quotes: matchingPair, source: "matching_pair" };
  }

  return {
    quotes: selectRationaleReceiptBundle({
      family: args.family,
      visibleSummary: args.visibleSummary,
      fullEvidenceQuotes: args.fullEvidenceQuotes,
      preferredReceiptQuotes: [],
      maxReceipts: args.maxReceipts,
    }),
    source: "ranked_fallback",
  };
}

export function computeSummaryStableFromRationale(args: {
  family: ActiveFamily;
  visibleSummary: string;
  rationaleReceiptQuotes: string[];
}): boolean | null {
  const rationaleSummary = generateVisiblePatternSummary({
    patternType: args.family,
    persistedSummary: "",
    receipts: buildReceipts(args.rationaleReceiptQuotes),
  });

  if (!rationaleSummary) return false;
  return rationaleSummary === args.visibleSummary;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

function buildSufficiencyReasons(args: {
  originalParseStatus: FaithfulnessClaimScore["parseStatus"];
  rationaleParseStatus: FaithfulnessClaimScore["parseStatus"];
  summaryStableFromRationale: boolean | null;
  faithfulnessStableFromRationale: boolean | null;
  rationaleReceiptQuotes: string[];
  bundleSource: ResolvedRationaleReceiptBundle["source"];
}): RationaleSufficiencyClaimScore["sufficiencyReasons"] {
  return [
    args.originalParseStatus !== "parsed" ? "original_parse_failure" : null,
    args.rationaleParseStatus !== "parsed" ? "rationale_parse_failure" : null,
    args.summaryStableFromRationale === false ? "summary_drift" : null,
    args.faithfulnessStableFromRationale === false ? "faithfulness_drift" : null,
    args.rationaleReceiptQuotes.length === 0 ? "no_rationale_receipts" : null,
    args.bundleSource !== "preferred_receipts" ? "fallback_bundle_used" : null,
  ].filter(
    (
      reason
    ): reason is RationaleSufficiencyClaimScore["sufficiencyReasons"][number] => reason !== null
  );
}

function sufficiencyInspectableRank(score: RationaleSufficiencyClaimScore): number {
  const reasons = new Set(score.sufficiencyReasons);
  if (reasons.has("original_parse_failure")) return 0;
  if (reasons.has("rationale_parse_failure")) return 1;
  if (reasons.has("summary_drift") && reasons.has("faithfulness_drift")) return 2;
  if (reasons.has("faithfulness_drift")) return 3;
  if (reasons.has("summary_drift")) return 4;
  return 5;
}

export function computeFaithfulnessFromReceiptBundle(args: {
  groupId: string;
  family: ActiveFamily;
  visibleSummary: string;
  receiptQuotes: string[];
}): FaithfulnessClaimScore {
  const receiptQuotes = uniqueQuotes(args.receiptQuotes);
  const rubric = findSummaryRubric(args.family, args.visibleSummary);

  if (!rubric) {
    return {
      groupId: args.groupId,
      family: args.family,
      visibleSummary: args.visibleSummary,
      receiptQuotes,
      faithful: false,
      score: 0,
      rationale: "Summary branch is not recognized by deterministic rationale faithfulness scoring.",
      parseStatus: "parsed",
      shadowMode: true,
      usedForProductDecision: false,
    };
  }

  const supportCount = countMatchingQuotes(receiptQuotes, rubric.supportPattern);
  const competingSupport = SUMMARY_RUBRICS
    .filter((candidate) => candidate.family === args.family && candidate.summary !== args.visibleSummary)
    .map((candidate) => countMatchingQuotes(receiptQuotes, candidate.supportPattern));
  const competingMax = competingSupport.length > 0 ? Math.max(...competingSupport) : 0;
  const faithful = supportCount >= 2 && supportCount > competingMax;
  const score = faithful
    ? clampScore(0.55 + supportCount * 0.15 - competingMax * 0.05)
    : clampScore(0.35 + supportCount * 0.05 - competingMax * 0.10);
  const rationale = faithful
    ? `Rationale receipts preserve the ${args.family} summary branch with support=${supportCount} and competing=${competingMax}.`
    : `Rationale receipts do not preserve the ${args.family} summary branch with support=${supportCount} and competing=${competingMax}.`;

  return {
    groupId: args.groupId,
    family: args.family,
    visibleSummary: args.visibleSummary,
    receiptQuotes,
    faithful,
    score,
    rationale,
    parseStatus: "parsed",
    shadowMode: true,
    usedForProductDecision: false,
  };
}

export function computeRationaleSufficiencyClaim(args: {
  groupId: string;
  family: ActiveFamily;
  visibleSummary: string;
  fullEvidenceQuotes: string[];
  rationaleReceiptQuotes?: string[];
  faithfulnessScore: FaithfulnessClaimScore;
}): RationaleSufficiencyClaimScore {
  const resolvedBundle = resolveRationaleReceiptBundle({
    family: args.family,
    visibleSummary: args.visibleSummary,
    fullEvidenceQuotes: args.fullEvidenceQuotes,
    preferredReceiptQuotes: args.rationaleReceiptQuotes,
  });

  if (args.faithfulnessScore.parseStatus !== "parsed") {
    return {
      groupId: args.groupId,
      family: args.family,
      visibleSummary: args.visibleSummary,
      fullEvidenceQuotes: [...args.fullEvidenceQuotes],
      rationaleReceiptQuotes: resolvedBundle.quotes,
      originalReceiptCount: args.faithfulnessScore.receiptQuotes.length,
      rationaleReceiptCount: resolvedBundle.quotes.length,
      originalFaithful: args.faithfulnessScore.faithful,
      originalParseStatus: args.faithfulnessScore.parseStatus,
      summaryStableFromRationale: null,
      rationaleFaithful: null,
      rationaleFaithfulnessParseStatus: args.faithfulnessScore.parseStatus,
      rationaleFaithfulnessScore: null,
      faithfulnessStableFromRationale: null,
      rationaleSufficient: null,
      rationaleBundleSource: resolvedBundle.source,
      sufficiencyReasons: buildSufficiencyReasons({
        originalParseStatus: args.faithfulnessScore.parseStatus,
        rationaleParseStatus: args.faithfulnessScore.parseStatus,
        summaryStableFromRationale: null,
        faithfulnessStableFromRationale: null,
        rationaleReceiptQuotes: resolvedBundle.quotes,
        bundleSource: resolvedBundle.source,
      }),
      shadowMode: true,
      usedForProductDecision: false,
      notes: `original_parse_failure:${args.faithfulnessScore.parseStatus};bundle_source=${resolvedBundle.source}`,
    };
  }

  const summaryStableFromRationale = computeSummaryStableFromRationale({
    family: args.family,
    visibleSummary: args.visibleSummary,
    rationaleReceiptQuotes: resolvedBundle.quotes,
  });
  const rationaleFaithfulness = computeFaithfulnessFromReceiptBundle({
    groupId: args.groupId,
    family: args.family,
    visibleSummary: args.visibleSummary,
    receiptQuotes: resolvedBundle.quotes,
  });
  const faithfulnessStableFromRationale =
    rationaleFaithfulness.parseStatus !== "parsed" || args.faithfulnessScore.parseStatus !== "parsed"
      ? null
      : rationaleFaithfulness.faithful === args.faithfulnessScore.faithful;
  const rationaleSufficient =
    rationaleFaithfulness.parseStatus !== "parsed"
      ? null
      : summaryStableFromRationale === true && faithfulnessStableFromRationale === true;

  const noteParts = [`bundle_source=${resolvedBundle.source}`];
  if (summaryStableFromRationale === false) noteParts.push("summary_drift");
  if (faithfulnessStableFromRationale === false) noteParts.push("faithfulness_drift");

  return {
    groupId: args.groupId,
    family: args.family,
    visibleSummary: args.visibleSummary,
    fullEvidenceQuotes: [...args.fullEvidenceQuotes],
    rationaleReceiptQuotes: resolvedBundle.quotes,
    originalReceiptCount: args.faithfulnessScore.receiptQuotes.length,
    rationaleReceiptCount: resolvedBundle.quotes.length,
    originalFaithful: args.faithfulnessScore.faithful,
    originalParseStatus: args.faithfulnessScore.parseStatus,
    summaryStableFromRationale,
    rationaleFaithful: rationaleFaithfulness.faithful,
    rationaleFaithfulnessParseStatus: rationaleFaithfulness.parseStatus,
    rationaleFaithfulnessScore: rationaleFaithfulness.score,
    faithfulnessStableFromRationale,
    rationaleSufficient,
    rationaleBundleSource: resolvedBundle.source,
    sufficiencyReasons: buildSufficiencyReasons({
      originalParseStatus: args.faithfulnessScore.parseStatus,
      rationaleParseStatus: rationaleFaithfulness.parseStatus,
      summaryStableFromRationale,
      faithfulnessStableFromRationale,
      rationaleReceiptQuotes: resolvedBundle.quotes,
      bundleSource: resolvedBundle.source,
    }),
    shadowMode: true,
    usedForProductDecision: false,
    notes: noteParts.join(";"),
  };
}

export function computeRationaleSufficiencyScores(
  groupResults: GroupResult[],
  faithfulnessScores: FaithfulnessClaimScore[]
): RationaleSufficiencyClaimScore[] {
  const groupById = new Map(groupResults.map((result) => [result.group.id, result]));
  const scores: RationaleSufficiencyClaimScore[] = [];

  for (const faithfulnessScore of faithfulnessScores) {
    const groupResult = groupById.get(faithfulnessScore.groupId);
    const fullEvidenceQuotes = uniqueQuotes(
      groupResult
        ? groupResult.group.entries
            .filter((entry) => entry.role === "user")
            .map((entry) => entry.text)
        : faithfulnessScore.receiptQuotes
    );

    scores.push(
      computeRationaleSufficiencyClaim({
        groupId: faithfulnessScore.groupId,
        family: faithfulnessScore.family,
        visibleSummary: faithfulnessScore.visibleSummary,
        fullEvidenceQuotes,
        rationaleReceiptQuotes: faithfulnessScore.receiptQuotes,
        faithfulnessScore,
      })
    );
  }

  return scores.sort((a, b) =>
    `${a.groupId}:${a.family}`.localeCompare(`${b.groupId}:${b.family}`)
  );
}

export function computeRationaleSufficiencyReport(
  scores: RationaleSufficiencyClaimScore[],
  floor = RATIONALE_SUFFICIENCY_FLOOR
): RationaleSufficiencyReport {
  const eligibleScores = scores.filter(
    (score) =>
      score.originalParseStatus === "parsed" &&
      score.originalFaithful === true &&
      score.rationaleFaithfulnessParseStatus === "parsed"
  );
  const scoredClaims = eligibleScores.length;
  const sufficientCount = eligibleScores.filter((score) => score.rationaleSufficient === true).length;
  const insufficientCount = eligibleScores.filter((score) => score.rationaleSufficient === false).length;
  const parseFailureCount = scores.filter(
    (score) =>
      score.originalParseStatus !== "parsed" ||
      score.rationaleFaithfulnessParseStatus !== "parsed"
  ).length;
  const summaryStableCount = eligibleScores.filter(
    (score) => score.summaryStableFromRationale === true
  ).length;
  const summaryDriftCount = eligibleScores.filter(
    (score) => score.summaryStableFromRationale === false
  ).length;
  const faithfulnessStableCount = eligibleScores.filter(
    (score) => score.faithfulnessStableFromRationale === true
  ).length;
  const faithfulnessDriftCount = eligibleScores.filter(
    (score) => score.faithfulnessStableFromRationale === false
  ).length;
  const sufficiencyRate = scoredClaims === 0 ? null : sufficientCount / scoredClaims;
  const summaryStabilityRate = scoredClaims === 0 ? null : summaryStableCount / scoredClaims;
  const faithfulnessStabilityRate =
    scoredClaims === 0 ? null : faithfulnessStableCount / scoredClaims;
  const authoritativeViolations = scores.filter((score) => Boolean(score.usedForProductDecision)).length;
  const originalParseFailureClaims = scores.filter((score) =>
    score.sufficiencyReasons.includes("original_parse_failure")
  ).length;
  const rationaleParseFailureClaims = scores.filter((score) =>
    score.sufficiencyReasons.includes("rationale_parse_failure")
  ).length;
  const preferredReceiptBundleClaims = scores.filter(
    (score) => score.rationaleBundleSource === "preferred_receipts"
  ).length;
  const fallbackReceiptBundleClaims = scores.length - preferredReceiptBundleClaims;
  const inspectableClaims = scores
    .filter(
      (score) =>
        score.rationaleSufficient !== true ||
        score.originalParseStatus !== "parsed" ||
        score.rationaleFaithfulnessParseStatus !== "parsed" ||
        score.summaryStableFromRationale !== true ||
        score.faithfulnessStableFromRationale !== true
    )
    .sort((a, b) => {
      const rank = sufficiencyInspectableRank(a) - sufficiencyInspectableRank(b);
      if (rank !== 0) return rank;
      return `${a.groupId}:${a.family}`.localeCompare(`${b.groupId}:${b.family}`);
    });

  return {
    allClaims: scores,
    totalClaimsConsidered: scores.length,
    scoredClaims,
    sufficientCount,
    insufficientCount,
    parseFailureCount,
    originalParseFailureClaims,
    rationaleParseFailureClaims,
    summaryStableCount,
    summaryDriftCount,
    faithfulnessStableCount,
    faithfulnessDriftCount,
    preferredReceiptBundleClaims,
    fallbackReceiptBundleClaims,
    sufficiencyRate,
    summaryStabilityRate,
    faithfulnessStabilityRate,
    inspectableClaims,
    authoritativeViolations,
    regressionGate: {
      name: "rationale_sufficiency_floor",
      threshold: floor,
      actual: sufficiencyRate,
      passed: (sufficiencyRate ?? 0) >= floor,
    },
  };
}
