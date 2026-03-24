import { scorePatternQuoteCandidate } from "../pattern-quote-selection";
import type {
  RationaleMinimalityClaimScore,
  RationaleMinimalityLeaveOneOutCheck,
  RationaleMinimalityReport,
  RationaleSufficiencyClaimScore,
} from "./eval-types";
import {
  computeFaithfulnessFromReceiptBundle,
  computeSummaryStableFromRationale,
} from "./pattern-rationale-sufficiency";

type SearchResult = {
  searchPerformed: boolean;
  overCap: boolean;
  capUsed: number;
  subsetCountChecked: number;
  bestSubsetQuotes: string[];
  bestSubsetSize: number | null;
  supportingSubsetExists: boolean | null;
  indeterminate: boolean;
};

type RankedSubset = {
  quotes: string[];
  indices: number[];
  aggregateQuality: number;
};

export const RATIONALE_MINIMALITY_FLOOR = 0.50;
export const RATIONALE_SUBSET_SEARCH_MAX_QUOTES = 8;
export const RATIONALE_SUBSET_SEARCH_COVERAGE_FLOOR = 1.0;
export const RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR = 1.0;
export const RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING = 0.0;
export const RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING = 0.0;

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

function isEligibleClaim(claim: RationaleSufficiencyClaimScore): boolean {
  return (
    claim.originalParseStatus === "parsed" &&
    claim.rationaleFaithfulnessParseStatus === "parsed" &&
    claim.rationaleSufficient === true &&
    claim.rationaleReceiptQuotes.length >= 1
  );
}

function computeFaithfulnessStable(args: {
  groupId: string;
  family: RationaleSufficiencyClaimScore["family"];
  visibleSummary: string;
  receiptQuotes: string[];
  originalFaithful: boolean | null;
}): boolean | null {
  const rationaleFaithfulness = computeFaithfulnessFromReceiptBundle({
    groupId: args.groupId,
    family: args.family,
    visibleSummary: args.visibleSummary,
    receiptQuotes: args.receiptQuotes,
  });
  if (rationaleFaithfulness.parseStatus !== "parsed" || args.originalFaithful === null) {
    return null;
  }
  return rationaleFaithfulness.faithful === args.originalFaithful;
}

function quoteAggregateQuality(quotes: string[]): number {
  return quotes.reduce((sum, quote) => sum + scorePatternQuoteCandidate(quote).score, 0);
}

function compareRankedSubsets(a: RankedSubset, b: RankedSubset): number {
  if (a.quotes.length !== b.quotes.length) return a.quotes.length - b.quotes.length;
  if (a.aggregateQuality !== b.aggregateQuality) return b.aggregateQuality - a.aggregateQuality;
  for (let index = 0; index < Math.min(a.indices.length, b.indices.length); index += 1) {
    if (a.indices[index] !== b.indices[index]) return a.indices[index]! - b.indices[index]!;
  }
  return a.quotes.join("\u0000").localeCompare(b.quotes.join("\u0000"));
}

function enumerateNonEmptySubsets(quotes: string[]): RankedSubset[] {
  const normalized = uniqueQuotes(quotes);
  const subsets: RankedSubset[] = [];
  const totalMasks = 1 << normalized.length;

  for (let mask = 1; mask < totalMasks; mask += 1) {
    const subsetQuotes: string[] = [];
    const indices: number[] = [];
    for (let index = 0; index < normalized.length; index += 1) {
      if ((mask & (1 << index)) === 0) continue;
      subsetQuotes.push(normalized[index]!);
      indices.push(index);
    }
    subsets.push({
      quotes: subsetQuotes,
      indices,
      aggregateQuality: quoteAggregateQuality(subsetQuotes),
    });
  }

  subsets.sort(compareRankedSubsets);
  return subsets;
}

function evaluateSubsetPreservesPath(args: {
  claim: RationaleSufficiencyClaimScore;
  subsetQuotes: string[];
}): boolean | null {
  const summaryStable = computeSummaryStableFromRationale({
    family: args.claim.family,
    visibleSummary: args.claim.visibleSummary,
    rationaleReceiptQuotes: args.subsetQuotes,
  });
  const faithfulnessStable = computeFaithfulnessStable({
    groupId: args.claim.groupId,
    family: args.claim.family,
    visibleSummary: args.claim.visibleSummary,
    receiptQuotes: args.subsetQuotes,
    originalFaithful: args.claim.originalFaithful,
  });

  if (summaryStable === null || faithfulnessStable === null) return null;
  return summaryStable === true && faithfulnessStable === true;
}

export function findBestPreservingSubset(
  quotes: string[],
  preserves: (subsetQuotes: string[]) => boolean | null,
  maxQuotes = RATIONALE_SUBSET_SEARCH_MAX_QUOTES
): SearchResult {
  const normalized = uniqueQuotes(quotes);
  if (normalized.length === 0) {
    return {
      searchPerformed: true,
      overCap: false,
      capUsed: maxQuotes,
      subsetCountChecked: 0,
      bestSubsetQuotes: [],
      bestSubsetSize: null,
      supportingSubsetExists: false,
      indeterminate: false,
    };
  }
  if (normalized.length > maxQuotes) {
    return {
      searchPerformed: false,
      overCap: true,
      capUsed: maxQuotes,
      subsetCountChecked: 0,
      bestSubsetQuotes: [],
      bestSubsetSize: null,
      supportingSubsetExists: null,
      indeterminate: false,
    };
  }

  const subsets = enumerateNonEmptySubsets(normalized);
  let sawIndeterminate = false;
  for (const subset of subsets) {
    const result = preserves(subset.quotes);
    if (result === null) {
      sawIndeterminate = true;
      continue;
    }
    if (result !== true) continue;
    return {
      searchPerformed: true,
      overCap: false,
      capUsed: maxQuotes,
      subsetCountChecked: subsets.length,
      bestSubsetQuotes: subset.quotes,
      bestSubsetSize: subset.quotes.length,
      supportingSubsetExists: true,
      indeterminate: false,
    };
  }

  return {
    searchPerformed: true,
    overCap: false,
    capUsed: maxQuotes,
    subsetCountChecked: subsets.length,
    bestSubsetQuotes: [],
    bestSubsetSize: null,
    supportingSubsetExists: sawIndeterminate ? null : false,
    indeterminate: sawIndeterminate,
  };
}

function computeUnknownReason(args: {
  searchPerformed: boolean;
  overCap: boolean;
  indeterminate: boolean;
  unknown: boolean;
}): "subset_search_skipped" | "path_indeterminate" | null {
  if (!args.unknown) return null;
  if (!args.searchPerformed || args.overCap) return "subset_search_skipped";
  if (args.indeterminate) return "path_indeterminate";
  return null;
}

function compareInspectableClaims(
  a: RationaleMinimalityClaimScore,
  b: RationaleMinimalityClaimScore
): number {
  const aPriority = [
    !a.rationaleSubsetSearchPerformed || !a.complementSubsetSearchPerformed ? 0 : 1,
    a.unknownMinimalityReason !== null || a.unknownAlternativeSupportReason !== null ? 0 : 1,
    a.rationaleGloballyMinimal === false ? 0 : 1,
    a.competitiveAlternativeSupport === true ? 0 : 1,
    a.redundantQuoteCount > 0 || (a.chosenVsMinimalSubsetDelta ?? 0) > 0 ? 0 : 1,
  ];
  const bPriority = [
    !b.rationaleSubsetSearchPerformed || !b.complementSubsetSearchPerformed ? 0 : 1,
    b.unknownMinimalityReason !== null || b.unknownAlternativeSupportReason !== null ? 0 : 1,
    b.rationaleGloballyMinimal === false ? 0 : 1,
    b.competitiveAlternativeSupport === true ? 0 : 1,
    b.redundantQuoteCount > 0 || (b.chosenVsMinimalSubsetDelta ?? 0) > 0 ? 0 : 1,
  ];
  for (let index = 0; index < aPriority.length; index += 1) {
    if (aPriority[index] !== bPriority[index]) {
      return aPriority[index]! - bPriority[index]!;
    }
  }
  return `${a.groupId}:${a.family}`.localeCompare(`${b.groupId}:${b.family}`);
}

export function computeLeaveOneOutChecks(
  claim: RationaleSufficiencyClaimScore
): RationaleMinimalityLeaveOneOutCheck[] {
  const checks: RationaleMinimalityLeaveOneOutCheck[] = [];

  for (let index = 0; index < claim.rationaleReceiptQuotes.length; index += 1) {
    const removedQuote = claim.rationaleReceiptQuotes[index]!;
    const reducedQuotes = claim.rationaleReceiptQuotes.filter((_, current) => current !== index);
    const summaryStableFromRationale = computeSummaryStableFromRationale({
      family: claim.family,
      visibleSummary: claim.visibleSummary,
      rationaleReceiptQuotes: reducedQuotes,
    });
    const faithfulnessStableFromRationale = computeFaithfulnessStable({
      groupId: claim.groupId,
      family: claim.family,
      visibleSummary: claim.visibleSummary,
      receiptQuotes: reducedQuotes,
      originalFaithful: claim.originalFaithful,
    });
    const critical =
      summaryStableFromRationale === null || faithfulnessStableFromRationale === null
        ? null
        : summaryStableFromRationale !== true || faithfulnessStableFromRationale !== true;

    checks.push({
      removedQuote,
      summaryStableFromRationale,
      faithfulnessStableFromRationale,
      critical,
    });
  }

  return checks;
}

export function computeComprehensivenessEffect(args: {
  complementSummaryStable: boolean | null;
  complementFaithfulnessStable: boolean | null;
}): "strong" | "partial" | "none" | null {
  if (
    args.complementSummaryStable === null ||
    args.complementFaithfulnessStable === null
  ) {
    return null;
  }
  if (args.complementSummaryStable === false && args.complementFaithfulnessStable === false) {
    return "strong";
  }
  if (args.complementSummaryStable === true && args.complementFaithfulnessStable === true) {
    return "none";
  }
  return "partial";
}

function computeAlternativeSupportStrength(args: {
  complementSupportingSubsetExists: boolean | null;
  minimalComplementSupportingSubsetSize: number | null;
  minimalPreservingSubsetSize: number | null;
}): "none" | "weak" | "strong" | null {
  if (args.complementSupportingSubsetExists === null) return null;
  if (args.complementSupportingSubsetExists === false) return "none";
  if (
    args.minimalComplementSupportingSubsetSize !== null &&
    args.minimalPreservingSubsetSize !== null &&
    args.minimalComplementSupportingSubsetSize <= args.minimalPreservingSubsetSize
  ) {
    return "strong";
  }
  return "weak";
}

function computeChosenVsMinimalSubsetDelta(args: {
  rationaleQuoteCount: number;
  minimalPreservingSubsetSize: number | null;
}): number | null {
  if (args.minimalPreservingSubsetSize === null) return null;
  return args.rationaleQuoteCount - args.minimalPreservingSubsetSize;
}

function computeComplementVsMinimalSubsetDelta(args: {
  complementSupportingSubsetExists: boolean | null;
  minimalComplementSupportingSubsetSize: number | null;
  minimalPreservingSubsetSize: number | null;
}): number | null {
  if (
    args.complementSupportingSubsetExists !== true ||
    args.minimalComplementSupportingSubsetSize === null ||
    args.minimalPreservingSubsetSize === null
  ) {
    return null;
  }
  return args.minimalComplementSupportingSubsetSize - args.minimalPreservingSubsetSize;
}

function computeCompetitiveAlternativeSupport(args: {
  complementSupportingSubsetExists: boolean | null;
  minimalComplementSupportingSubsetSize: number | null;
  minimalPreservingSubsetSize: number | null;
}): boolean | null {
  if (
    args.complementSupportingSubsetExists !== true ||
    args.minimalComplementSupportingSubsetSize === null ||
    args.minimalPreservingSubsetSize === null
  ) {
    return null;
  }
  return args.minimalComplementSupportingSubsetSize <= args.minimalPreservingSubsetSize;
}

export function computeRationaleMinimalityClaim(
  claim: RationaleSufficiencyClaimScore
): RationaleMinimalityClaimScore | null {
  if (!isEligibleClaim(claim)) {
    return null;
  }

  const leaveOneOutChecks = computeLeaveOneOutChecks(claim);
  const criticalQuoteCount = leaveOneOutChecks.filter((check) => check.critical === true).length;
  const redundantQuoteCount = leaveOneOutChecks.filter((check) => check.critical === false).length;
  const minimalityRate =
    claim.rationaleReceiptQuotes.length === 0
      ? null
      : criticalQuoteCount / claim.rationaleReceiptQuotes.length;

  const rationaleSubsetSearch = findBestPreservingSubset(
    claim.rationaleReceiptQuotes,
    (subsetQuotes) => evaluateSubsetPreservesPath({ claim, subsetQuotes })
  );

  const rationaleSet = new Set(claim.rationaleReceiptQuotes);
  const complementReceiptQuotes = uniqueQuotes(
    claim.fullEvidenceQuotes.filter((quote) => !rationaleSet.has(quote))
  );
  const complementSummaryStable = computeSummaryStableFromRationale({
    family: claim.family,
    visibleSummary: claim.visibleSummary,
    rationaleReceiptQuotes: complementReceiptQuotes,
  });
  const complementFaithfulnessStable = computeFaithfulnessStable({
    groupId: claim.groupId,
    family: claim.family,
    visibleSummary: claim.visibleSummary,
    receiptQuotes: complementReceiptQuotes,
    originalFaithful: claim.originalFaithful,
  });
  const comprehensivenessEffect = computeComprehensivenessEffect({
    complementSummaryStable,
    complementFaithfulnessStable,
  });
  const complementSubsetSearch = findBestPreservingSubset(
    complementReceiptQuotes,
    (subsetQuotes) => evaluateSubsetPreservesPath({ claim, subsetQuotes })
  );

  const rationaleGloballyMinimal =
    rationaleSubsetSearch.supportingSubsetExists === null
      ? null
      : rationaleSubsetSearch.bestSubsetSize === claim.rationaleReceiptQuotes.length;
  const smallerSupportingSubsetExists =
    rationaleSubsetSearch.supportingSubsetExists === null
      ? null
      : (rationaleSubsetSearch.bestSubsetSize ?? Infinity) < claim.rationaleReceiptQuotes.length;
  const alternativeSupportStrength = computeAlternativeSupportStrength({
    complementSupportingSubsetExists: complementSubsetSearch.supportingSubsetExists,
    minimalComplementSupportingSubsetSize: complementSubsetSearch.bestSubsetSize,
    minimalPreservingSubsetSize: rationaleSubsetSearch.bestSubsetSize,
  });
  const rationaleQuoteCount = claim.rationaleReceiptQuotes.length;
  const chosenVsMinimalSubsetDelta = computeChosenVsMinimalSubsetDelta({
    rationaleQuoteCount,
    minimalPreservingSubsetSize: rationaleSubsetSearch.bestSubsetSize,
  });
  const complementVsMinimalSubsetDelta = computeComplementVsMinimalSubsetDelta({
    complementSupportingSubsetExists: complementSubsetSearch.supportingSubsetExists,
    minimalComplementSupportingSubsetSize: complementSubsetSearch.bestSubsetSize,
    minimalPreservingSubsetSize: rationaleSubsetSearch.bestSubsetSize,
  });
  const competitiveAlternativeSupport = computeCompetitiveAlternativeSupport({
    complementSupportingSubsetExists: complementSubsetSearch.supportingSubsetExists,
    minimalComplementSupportingSubsetSize: complementSubsetSearch.bestSubsetSize,
    minimalPreservingSubsetSize: rationaleSubsetSearch.bestSubsetSize,
  });
  const unknownMinimalityReason = computeUnknownReason({
    searchPerformed: rationaleSubsetSearch.searchPerformed,
    overCap: rationaleSubsetSearch.overCap,
    indeterminate: rationaleSubsetSearch.indeterminate,
    unknown:
      rationaleGloballyMinimal === null || smallerSupportingSubsetExists === null,
  });
  const unknownAlternativeSupportReason = computeUnknownReason({
    searchPerformed: complementSubsetSearch.searchPerformed,
    overCap: complementSubsetSearch.overCap,
    indeterminate: complementSubsetSearch.indeterminate,
    unknown:
      complementSubsetSearch.supportingSubsetExists === null ||
      alternativeSupportStrength === null,
  });

  return {
    ...claim,
    rationaleQuoteCount,
    complementReceiptQuotes,
    leaveOneOutChecks,
    criticalQuoteCount,
    redundantQuoteCount,
    minimalityRate,
    complementSummaryStable,
    complementFaithfulnessStable,
    comprehensivenessEffect,
    rationaleSubsetSearchPerformed: rationaleSubsetSearch.searchPerformed,
    rationaleSubsetSearchOverCap: rationaleSubsetSearch.overCap,
    rationaleSearchCapUsed: rationaleSubsetSearch.capUsed,
    rationaleSubsetCountChecked: rationaleSubsetSearch.subsetCountChecked,
    minimalPreservingSubsetQuotes: rationaleSubsetSearch.bestSubsetQuotes,
    minimalPreservingSubsetSize: rationaleSubsetSearch.bestSubsetSize,
    rationaleGloballyMinimal,
    smallerSupportingSubsetExists,
    unknownMinimalityReason,
    complementSubsetSearchPerformed: complementSubsetSearch.searchPerformed,
    complementSubsetSearchOverCap: complementSubsetSearch.overCap,
    complementSearchCapUsed: complementSubsetSearch.capUsed,
    complementSubsetCountChecked: complementSubsetSearch.subsetCountChecked,
    complementSupportingSubsetExists: complementSubsetSearch.supportingSubsetExists,
    minimalComplementSupportingSubsetQuotes: complementSubsetSearch.bestSubsetQuotes,
    minimalComplementSupportingSubsetSize: complementSubsetSearch.bestSubsetSize,
    unknownAlternativeSupportReason,
    chosenVsMinimalSubsetDelta,
    complementVsMinimalSubsetDelta,
    competitiveAlternativeSupport,
    alternativeSupportStrength,
    notes: [
      claim.notes,
      rationaleGloballyMinimal === true ? "globally_minimal" : "non_minimal_or_unknown",
      `comprehensiveness=${comprehensivenessEffect ?? "null"}`,
      `alternative_support=${alternativeSupportStrength ?? "null"}`,
    ]
      .filter(Boolean)
      .join(";"),
  };
}

export function computeRationaleMinimalityScores(
  claims: RationaleSufficiencyClaimScore[]
): RationaleMinimalityClaimScore[] {
  return claims
    .map((claim) => computeRationaleMinimalityClaim(claim))
    .filter((claim): claim is RationaleMinimalityClaimScore => claim !== null)
    .sort((a, b) => `${a.groupId}:${a.family}`.localeCompare(`${b.groupId}:${b.family}`));
}

export function computeRationaleMinimalityReport(
  claims: RationaleMinimalityClaimScore[],
  floor = RATIONALE_MINIMALITY_FLOOR
): RationaleMinimalityReport {
  const totalEligibleClaims = claims.length;
  const minimalClaims = claims.filter((claim) => claim.redundantQuoteCount === 0).length;
  const bloatedClaims = claims.filter((claim) => claim.redundantQuoteCount > 0).length;
  const meanMinimalityRate =
    totalEligibleClaims === 0
      ? null
      : claims.reduce((sum, claim) => sum + (claim.minimalityRate ?? 0), 0) / totalEligibleClaims;
  const totalRationaleSubsetChecks = claims.reduce(
    (sum, claim) => sum + claim.rationaleSubsetCountChecked,
    0
  );
  const totalComplementSubsetChecks = claims.reduce(
    (sum, claim) => sum + claim.complementSubsetCountChecked,
    0
  );
  const meanRationaleSubsetChecksPerClaim =
    totalEligibleClaims === 0 ? null : totalRationaleSubsetChecks / totalEligibleClaims;
  const meanComplementSubsetChecksPerClaim =
    totalEligibleClaims === 0 ? null : totalComplementSubsetChecks / totalEligibleClaims;
  const maxRationaleSubsetChecksPerClaim = claims.reduce(
    (max, claim) => Math.max(max, claim.rationaleSubsetCountChecked),
    0
  );
  const maxComplementSubsetChecksPerClaim = claims.reduce(
    (max, claim) => Math.max(max, claim.complementSubsetCountChecked),
    0
  );
  const rationaleSubsetSearchSkippedClaims = claims.filter(
    (claim) => !claim.rationaleSubsetSearchPerformed
  ).length;
  const complementSubsetSearchSkippedClaims = claims.filter(
    (claim) => !claim.complementSubsetSearchPerformed
  ).length;
  const rationaleSubsetSearchOverCapClaims = claims.filter(
    (claim) => claim.rationaleSubsetSearchOverCap
  ).length;
  const complementSubsetSearchOverCapClaims = claims.filter(
    (claim) => claim.complementSubsetSearchOverCap
  ).length;
  const unknownMinimalityClaims = claims.filter(
    (claim) =>
      claim.rationaleGloballyMinimal === null || claim.smallerSupportingSubsetExists === null
  ).length;
  const unknownAlternativeSupportClaims = claims.filter(
    (claim) =>
      claim.complementSupportingSubsetExists === null ||
      claim.alternativeSupportStrength === null
  ).length;
  const unknownMinimalityReasonCounts = {
    subset_search_skipped: claims.filter(
      (claim) => claim.unknownMinimalityReason === "subset_search_skipped"
    ).length,
    path_indeterminate: claims.filter(
      (claim) => claim.unknownMinimalityReason === "path_indeterminate"
    ).length,
  };
  const unknownAlternativeSupportReasonCounts = {
    subset_search_skipped: claims.filter(
      (claim) => claim.unknownAlternativeSupportReason === "subset_search_skipped"
    ).length,
    path_indeterminate: claims.filter(
      (claim) => claim.unknownAlternativeSupportReason === "path_indeterminate"
    ).length,
  };
  const searchedRationaleSubsetRate =
    totalEligibleClaims === 0
      ? null
      : (totalEligibleClaims - rationaleSubsetSearchSkippedClaims) / totalEligibleClaims;
  const searchedComplementSubsetRate =
    totalEligibleClaims === 0
      ? null
      : (totalEligibleClaims - complementSubsetSearchSkippedClaims) / totalEligibleClaims;
  const unknownMinimalityRate =
    totalEligibleClaims === 0 ? null : unknownMinimalityClaims / totalEligibleClaims;
  const unknownAlternativeSupportRate =
    totalEligibleClaims === 0 ? null : unknownAlternativeSupportClaims / totalEligibleClaims;
  const globallyMinimalClaims = claims.filter(
    (claim) => claim.rationaleGloballyMinimal === true
  ).length;
  const nonMinimalClaims = claims.filter(
    (claim) => claim.smallerSupportingSubsetExists === true
  ).length;
  const globallyMinimalRate =
    totalEligibleClaims === 0 ? null : globallyMinimalClaims / totalEligibleClaims;
  const alternativeSupportClaims = claims.filter(
    (claim) => claim.complementSupportingSubsetExists === true
  ).length;
  const noAlternativeSupportClaims = claims.filter(
    (claim) => claim.alternativeSupportStrength === "none"
  ).length;
  const alternativeSupportRate =
    totalEligibleClaims === 0 ? null : alternativeSupportClaims / totalEligibleClaims;
  const bloatedByDeltaClaims = claims.filter(
    (claim) => (claim.chosenVsMinimalSubsetDelta ?? 0) > 0
  ).length;
  const meanChosenVsMinimalSubsetDelta = (() => {
    const deltas = claims
      .map((claim) => claim.chosenVsMinimalSubsetDelta)
      .filter((delta): delta is number => delta !== null);
    if (deltas.length === 0) return null;
    return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  })();
  const competitiveAlternativeSupportClaims = claims.filter(
    (claim) => claim.competitiveAlternativeSupport === true
  ).length;
  const nonCompetitiveAlternativeSupportClaims = claims.filter(
    (claim) => claim.competitiveAlternativeSupport === false
  ).length;
  const competitiveAlternativeSupportRate =
    totalEligibleClaims === 0 ? null : competitiveAlternativeSupportClaims / totalEligibleClaims;
  const strongComprehensivenessCount = claims.filter(
    (claim) => claim.comprehensivenessEffect === "strong"
  ).length;
  const partialComprehensivenessCount = claims.filter(
    (claim) => claim.comprehensivenessEffect === "partial"
  ).length;
  const noComprehensivenessCount = claims.filter(
    (claim) => claim.comprehensivenessEffect === "none"
  ).length;
  const inspectableClaims = claims.filter(
    (claim) =>
      !claim.rationaleSubsetSearchPerformed ||
      !claim.complementSubsetSearchPerformed ||
      claim.redundantQuoteCount > 0 ||
      claim.comprehensivenessEffect !== "strong" ||
      claim.leaveOneOutChecks.some((check) => check.critical === false) ||
      claim.minimalityRate === null ||
      claim.complementSummaryStable === null ||
      claim.complementFaithfulnessStable === null ||
      claim.rationaleGloballyMinimal !== true ||
      claim.smallerSupportingSubsetExists === null ||
      claim.complementSupportingSubsetExists === true ||
      claim.complementSupportingSubsetExists === null ||
      claim.alternativeSupportStrength === null
  ).sort(compareInspectableClaims);
  const skippedSearchInspectableCount = inspectableClaims.filter(
    (claim) => !claim.rationaleSubsetSearchPerformed || !claim.complementSubsetSearchPerformed
  ).length;
  const indeterminateInspectableCount = inspectableClaims.filter(
    (claim) =>
      claim.unknownMinimalityReason === "path_indeterminate" ||
      claim.unknownAlternativeSupportReason === "path_indeterminate"
  ).length;
  const nonMinimalInspectableCount = inspectableClaims.filter(
    (claim) => claim.rationaleGloballyMinimal === false
  ).length;
  const competitiveAlternativeSupportInspectableCount = inspectableClaims.filter(
    (claim) => claim.competitiveAlternativeSupport === true
  ).length;
  const bloatedInspectableCount = inspectableClaims.filter(
    (claim) => claim.redundantQuoteCount > 0 || (claim.chosenVsMinimalSubsetDelta ?? 0) > 0
  ).length;
  const authoritativeViolations = claims.filter((claim) => claim.usedForProductDecision).length;

  return {
    totalEligibleClaims,
    minimalClaims,
    bloatedClaims,
    meanMinimalityRate,
    totalRationaleSubsetChecks,
    totalComplementSubsetChecks,
    meanRationaleSubsetChecksPerClaim,
    meanComplementSubsetChecksPerClaim,
    maxRationaleSubsetChecksPerClaim,
    maxComplementSubsetChecksPerClaim,
    rationaleSubsetSearchSkippedClaims,
    complementSubsetSearchSkippedClaims,
    rationaleSubsetSearchOverCapClaims,
    complementSubsetSearchOverCapClaims,
    unknownMinimalityClaims,
    unknownAlternativeSupportClaims,
    unknownMinimalityReasonCounts,
    unknownAlternativeSupportReasonCounts,
    searchedRationaleSubsetRate,
    searchedComplementSubsetRate,
    unknownMinimalityRate,
    unknownAlternativeSupportRate,
    globallyMinimalClaims,
    nonMinimalClaims,
    globallyMinimalRate,
    bloatedByDeltaClaims,
    meanChosenVsMinimalSubsetDelta,
    alternativeSupportClaims,
    noAlternativeSupportClaims,
    alternativeSupportRate,
    competitiveAlternativeSupportClaims,
    nonCompetitiveAlternativeSupportClaims,
    competitiveAlternativeSupportRate,
    strongComprehensivenessCount,
    partialComprehensivenessCount,
    noComprehensivenessCount,
    skippedSearchInspectableCount,
    indeterminateInspectableCount,
    nonMinimalInspectableCount,
    competitiveAlternativeSupportInspectableCount,
    bloatedInspectableCount,
    inspectableClaims,
    authoritativeViolations,
    regressionGate: {
      name: "rationale_minimality_floor",
      threshold: floor,
      actual: meanMinimalityRate,
      passed: (meanMinimalityRate ?? 0) >= floor,
    },
  };
}
