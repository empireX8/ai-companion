import { describe, expect, it } from "vitest";

import { computeGroupMetrics, computeMetrics, runRegressionGates } from "../eval/pattern-evaluator";
import {
  RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR,
  computeComprehensivenessEffect,
  computeLeaveOneOutChecks,
  computeRationaleMinimalityClaim,
  computeRationaleMinimalityReport,
  computeRationaleMinimalityScores,
  findBestPreservingSubset,
  RATIONALE_SUBSET_SEARCH_COVERAGE_FLOOR,
  RATIONALE_SUBSET_SEARCH_MAX_QUOTES,
  RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING,
  RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING,
} from "../eval/pattern-rationale-minimality";
import type { RationaleSufficiencyClaimScore } from "../eval/eval-types";

function makeSufficiencyClaim(
  overrides: Partial<RationaleSufficiencyClaimScore> = {}
): RationaleSufficiencyClaimScore {
  return {
    groupId: "group-1",
    family: "trigger_condition",
    visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
    fullEvidenceQuotes: [
      "I default to people-pleasing when someone seems upset with me",
      "When pressure rises, I start appeasing people instead of staying honest",
      "I apologize fast when tension shows up",
      "I avoid hard conversations when pressure builds",
    ],
    rationaleReceiptQuotes: [
      "I default to people-pleasing when someone seems upset with me",
      "When pressure rises, I start appeasing people instead of staying honest",
    ],
    originalReceiptCount: 2,
    rationaleReceiptCount: 2,
    originalFaithful: true,
    originalParseStatus: "parsed",
    summaryStableFromRationale: true,
    rationaleFaithful: true,
    rationaleFaithfulnessParseStatus: "parsed",
    rationaleFaithfulnessScore: 0.9,
    faithfulnessStableFromRationale: true,
    rationaleSufficient: true,
    rationaleBundleSource: "preferred_receipts",
    sufficiencyReasons: [],
    shadowMode: true,
    usedForProductDecision: false,
    ...overrides,
  };
}

describe("pattern rationale minimality", () => {
  it("leave-one-out-critical does not imply global minimality when a different smaller subset works", () => {
    const quotes = ["a", "b", "c", "d"];
    const leaveOneOut = quotes.map((_, index) => {
      const subset = quotes.filter((_, current) => current !== index);
      return subset.length === 2 && subset.join(",") === "a,d";
    });

    expect(leaveOneOut.every((result) => result === false)).toBe(true);

    const search = findBestPreservingSubset(quotes, (subset) => subset.join(",") === "a,d");

    expect(search.searchPerformed).toBe(true);
    expect(search.supportingSubsetExists).toBe(true);
    expect(search.bestSubsetQuotes).toEqual(["a", "d"]);
    expect(search.bestSubsetSize).toBe(2);
  });

  it("whole complement can fail while a smaller complement subset succeeds", () => {
    const complement = ["x", "y", "z"];
    const search = findBestPreservingSubset(
      complement,
      (subset) => subset.join(",") === "x,z"
    );

    expect(search.supportingSubsetExists).toBe(true);
    expect(search.bestSubsetQuotes).toEqual(["x", "z"]);
    expect(search.bestSubsetSize).toBe(2);
  });

  it("leave-one-out identifies critical quotes correctly under the real Phase 17 path", () => {
    const claim = makeSufficiencyClaim();
    const checks = computeLeaveOneOutChecks(claim);

    expect(checks).toHaveLength(2);
    expect(checks.every((check) => check.critical === true)).toBe(true);
  });

  it("marks genuine global minimality and no-alternative-support cases", () => {
    const claim = computeRationaleMinimalityClaim(makeSufficiencyClaim());

    expect(claim).not.toBeNull();
    expect(claim?.rationaleGloballyMinimal).toBe(true);
    expect(claim?.smallerSupportingSubsetExists).toBe(false);
    expect(claim?.chosenVsMinimalSubsetDelta).toBe(0);
    expect(claim?.alternativeSupportStrength).toBe("none");
    expect(claim?.complementSupportingSubsetExists).toBe(false);
    expect(claim?.competitiveAlternativeSupport).toBeNull();
    expect(claim?.complementVsMinimalSubsetDelta).toBeNull();
  });

  it("computes report metrics and visibility consistently", () => {
    const claims = computeRationaleMinimalityScores([
      makeSufficiencyClaim(),
      makeSufficiencyClaim({
        groupId: "group-2",
        rationaleReceiptQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          "I apologize fast when tension shows up",
        ],
      }),
    ]);
    const report = computeRationaleMinimalityReport(claims);

    expect(report.totalEligibleClaims).toBe(2);
    expect(report.globallyMinimalClaims).toBeGreaterThanOrEqual(1);
    expect(report.nonMinimalClaims).toBeGreaterThanOrEqual(0);
    expect(report.alternativeSupportClaims).toBeGreaterThanOrEqual(0);
    expect(report.noAlternativeSupportClaims).toBeGreaterThanOrEqual(0);
    expect(report.bloatedByDeltaClaims).toBeGreaterThanOrEqual(0);
    expect(report.competitiveAlternativeSupportClaims).toBeGreaterThanOrEqual(0);
    expect(report.nonCompetitiveAlternativeSupportClaims).toBeGreaterThanOrEqual(0);
    expect(report.totalRationaleSubsetChecks).toBeGreaterThanOrEqual(0);
    expect(report.totalComplementSubsetChecks).toBeGreaterThanOrEqual(0);
    expect(report.inspectableClaims.length).toBeGreaterThanOrEqual(0);
  });

  it("marks over-cap rationale bundles as skipped and unknown, and surfaces them", () => {
    const rationaleReceiptQuotes = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES + 1 },
      (_, index) => `When pressure rises, I appease people pattern quote ${index + 1}`
    );
    const claim = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-overcap-rationale",
        fullEvidenceQuotes: [
          ...rationaleReceiptQuotes,
          "I avoid hard conversations when pressure builds",
        ],
        rationaleReceiptQuotes,
      })
    );

    expect(claim).not.toBeNull();
    expect(claim?.rationaleSubsetSearchPerformed).toBe(false);
    expect(claim?.rationaleSubsetSearchOverCap).toBe(true);
    expect(claim?.rationaleSearchCapUsed).toBe(RATIONALE_SUBSET_SEARCH_MAX_QUOTES);
    expect(claim?.rationaleGloballyMinimal).toBeNull();
    expect(claim?.smallerSupportingSubsetExists).toBeNull();
    expect(claim?.unknownMinimalityReason).toBe("subset_search_skipped");

    const report = computeRationaleMinimalityReport([claim!]);
    expect(report.rationaleSubsetSearchSkippedClaims).toBe(1);
    expect(report.rationaleSubsetSearchOverCapClaims).toBe(1);
    expect(report.unknownMinimalityClaims).toBe(1);
    expect(report.searchedRationaleSubsetRate).toBe(0);
    expect(report.unknownMinimalityRate).toBe(1);
    expect(report.inspectableClaims.map((item) => item.groupId)).toContain(
      "group-overcap-rationale"
    );
  });

  it("marks over-cap complement bundles as skipped and unknown, and surfaces them", () => {
    const complementQuotes = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES + 1 },
      (_, index) => `Alternative non-rationale support quote ${index + 1}`
    );
    const claim = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-overcap-complement",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          ...complementQuotes,
        ],
      })
    );

    expect(claim).not.toBeNull();
    expect(claim?.complementSubsetSearchPerformed).toBe(false);
    expect(claim?.complementSubsetSearchOverCap).toBe(true);
    expect(claim?.complementSearchCapUsed).toBe(RATIONALE_SUBSET_SEARCH_MAX_QUOTES);
    expect(claim?.complementSupportingSubsetExists).toBeNull();
    expect(claim?.alternativeSupportStrength).toBeNull();
    expect(claim?.unknownAlternativeSupportReason).toBe("subset_search_skipped");

    const report = computeRationaleMinimalityReport([claim!]);
    expect(report.complementSubsetSearchSkippedClaims).toBe(1);
    expect(report.complementSubsetSearchOverCapClaims).toBe(1);
    expect(report.unknownAlternativeSupportClaims).toBe(1);
    expect(report.searchedComplementSubsetRate).toBe(0);
    expect(report.unknownAlternativeSupportRate).toBe(1);
    expect(report.inspectableClaims.map((item) => item.groupId)).toContain(
      "group-overcap-complement"
    );
  });

  it("computes delta metrics and competitive alternative support exactly", () => {
    const bloatedClaim = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-deltas",
        rationaleReceiptQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          "I apologize fast when tension shows up",
        ],
      })
    );
    const equalSizedSupport = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-equal-support",
        family: "repetitive_loop",
        visibleSummary: "You describe returning to the same loop even when you see it happening.",
        fullEvidenceQuotes: [
          "I keep falling back into the same pattern with this every single time I think I have broken it",
          "No matter how aware I am, I still end up back in the same cycle again",
          "Here I am again dealing with this exact cycle I thought I had finally left behind for good",
          "This same loop keeps reappearing even when I recognize it early",
        ],
        rationaleReceiptQuotes: [
          "I keep falling back into the same pattern with this every single time I think I have broken it",
          "No matter how aware I am, I still end up back in the same cycle again",
        ],
      })
    );
    const noSupportClaim = computeRationaleMinimalityClaim(makeSufficiencyClaim());
    const unknownSupportClaim = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-unknown-support",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          ...Array.from(
            { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES + 1 },
            (_, index) => `Unknown alternative support quote ${index + 1}`
          ),
        ],
      })
    );

    expect(bloatedClaim?.chosenVsMinimalSubsetDelta).toBe(1);
    expect(equalSizedSupport?.competitiveAlternativeSupport).toBe(true);
    expect(equalSizedSupport?.complementVsMinimalSubsetDelta).toBe(0);
    expect(noSupportClaim?.competitiveAlternativeSupport).toBeNull();
    expect(noSupportClaim?.complementVsMinimalSubsetDelta).toBeNull();
    expect(unknownSupportClaim?.competitiveAlternativeSupport).toBeNull();
    expect(unknownSupportClaim?.complementVsMinimalSubsetDelta).toBeNull();
  });

  it("runs search exactly at the cap and skips only above the cap", () => {
    const atCap = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES },
      (_, index) => `At-cap quote ${index + 1}`
    );
    const overCap = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES + 1 },
      (_, index) => `Over-cap quote ${index + 1}`
    );

    const atCapSearch = findBestPreservingSubset(atCap, () => false);
    const overCapSearch = findBestPreservingSubset(overCap, () => false);

    expect(atCapSearch.searchPerformed).toBe(true);
    expect(atCapSearch.overCap).toBe(false);
    expect(atCapSearch.subsetCountChecked).toBeGreaterThan(0);
    expect(overCapSearch.searchPerformed).toBe(false);
    expect(overCapSearch.overCap).toBe(true);
    expect(overCapSearch.subsetCountChecked).toBe(0);
  });

  it("runs complement search exactly at the cap and skips only above the cap", () => {
    const atCapComplement = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES },
      (_, index) => `At-cap complement quote ${index + 1}`
    );
    const overCapComplement = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES + 1 },
      (_, index) => `Over-cap complement quote ${index + 1}`
    );

    const atCapClaim = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-at-cap-complement",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          ...atCapComplement,
        ],
      })
    );
    const overCapClaim = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-over-cap-complement-boundary",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          ...overCapComplement,
        ],
      })
    );

    expect(atCapClaim?.complementSubsetSearchPerformed).toBe(true);
    expect(atCapClaim?.complementSubsetSearchOverCap).toBe(false);
    expect(atCapClaim?.complementSubsetCountChecked).toBeGreaterThan(0);
    expect(overCapClaim?.complementSubsetSearchPerformed).toBe(false);
    expect(overCapClaim?.complementSubsetSearchOverCap).toBe(true);
    expect(overCapClaim?.complementSubsetCountChecked).toBe(0);
  });

  it("comprehensiveness classification helper remains deterministic", () => {
    expect(
      computeComprehensivenessEffect({
        complementSummaryStable: false,
        complementFaithfulnessStable: false,
      })
    ).toBe("strong");
    expect(
      computeComprehensivenessEffect({
        complementSummaryStable: false,
        complementFaithfulnessStable: true,
      })
    ).toBe("partial");
    expect(
      computeComprehensivenessEffect({
        complementSummaryStable: true,
        complementFaithfulnessStable: true,
      })
    ).toBe("none");
  });

  it("outputs remain shadow-only and deterministic", () => {
    const claim = computeRationaleMinimalityClaim(makeSufficiencyClaim());
    const report = computeRationaleMinimalityReport(
      computeRationaleMinimalityScores([makeSufficiencyClaim()])
    );

    expect(claim?.usedForProductDecision).toBe(false);
    expect(report.authoritativeViolations).toBe(0);
    expect(report).toEqual(
      computeRationaleMinimalityReport(
        computeRationaleMinimalityScores([makeSufficiencyClaim()])
      )
    );
  });

  it("repeated runs over skipped-search claims remain deterministic", () => {
    const overCapQuotes = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES + 1 },
      (_, index) => `Over-cap rationale quote ${index + 1}`
    );
    const input = makeSufficiencyClaim({
      groupId: "group-overcap-deterministic",
      fullEvidenceQuotes: [...overCapQuotes, "I avoid hard conversations when pressure builds"],
      rationaleReceiptQuotes: overCapQuotes,
    });

    const reportA = computeRationaleMinimalityReport(
      computeRationaleMinimalityScores([input])
    );
    const reportB = computeRationaleMinimalityReport(
      computeRationaleMinimalityScores([input])
    );

    expect(reportA).toEqual(reportB);
  });

  it("keeps deterministic tie-breaks when size and aggregate quality tie", () => {
    const quotes = [
      "I repeat this pattern alpha",
      "I repeat this pattern bravo",
      "I repeat this pattern charly",
    ];
    const predicate = (subset: string[]) =>
      subset.length === 2 &&
      (subset.join("|") ===
        "I repeat this pattern alpha|I repeat this pattern bravo" ||
        subset.join("|") ===
          "I repeat this pattern alpha|I repeat this pattern charly");

    const searchA = findBestPreservingSubset(quotes, predicate);
    const searchB = findBestPreservingSubset(quotes, predicate);

    expect(searchA.bestSubsetQuotes).toEqual(searchB.bestSubsetQuotes);
    expect(searchA.bestSubsetQuotes).toEqual([
      "I repeat this pattern alpha",
      "I repeat this pattern bravo",
    ]);
  });

  it("marks searched-but-indeterminate paths as unknown without treating them as skipped", () => {
    const search = findBestPreservingSubset(
      ["alpha", "bravo", "charly"],
      () => null
    );

    expect(search.searchPerformed).toBe(true);
    expect(search.overCap).toBe(false);
    expect(search.indeterminate).toBe(true);
    expect(search.supportingSubsetExists).toBeNull();
  });

  it("surfaces path-indeterminate unknowns and distinguishes them from skipped search", () => {
    const unknownClaim = {
      ...computeRationaleMinimalityClaim(makeSufficiencyClaim())!,
      groupId: "aaa-indeterminate",
      rationaleSubsetSearchPerformed: true,
      rationaleSubsetSearchOverCap: false,
      complementSubsetSearchPerformed: true,
      complementSubsetSearchOverCap: false,
      rationaleGloballyMinimal: null,
      smallerSupportingSubsetExists: null,
      unknownMinimalityReason: "path_indeterminate" as const,
      complementSupportingSubsetExists: null,
      alternativeSupportStrength: null,
      unknownAlternativeSupportReason: "path_indeterminate" as const,
    };
    const skippedClaim = {
      ...computeRationaleMinimalityClaim(makeSufficiencyClaim())!,
      groupId: "zzz-skipped",
      rationaleSubsetSearchPerformed: false,
      rationaleSubsetSearchOverCap: true,
      complementSubsetSearchPerformed: false,
      complementSubsetSearchOverCap: true,
      rationaleGloballyMinimal: null,
      smallerSupportingSubsetExists: null,
      unknownMinimalityReason: "subset_search_skipped" as const,
      complementSupportingSubsetExists: null,
      alternativeSupportStrength: null,
      unknownAlternativeSupportReason: "subset_search_skipped" as const,
    };
    const report = computeRationaleMinimalityReport([unknownClaim, skippedClaim]);
    const baseMsgReport = computeMetrics([]);
    const baseGroupMetrics = computeGroupMetrics([]);
    const gates = runRegressionGates(
      baseMsgReport,
      baseGroupMetrics,
      null,
      null,
      null,
      null,
      null,
      report
    ).gates;

    expect(report.unknownMinimalityReasonCounts.path_indeterminate).toBe(1);
    expect(report.unknownMinimalityReasonCounts.subset_search_skipped).toBe(1);
    expect(report.inspectableClaims[0]?.groupId).toBe("zzz-skipped");
    expect(report.inspectableClaims[1]?.groupId).toBe("aaa-indeterminate");
    expect(
      gates.find((gate) => gate.name === "rationale_subset_search_coverage_floor")?.passed
    ).toBe(false);
    expect(
      gates.find((gate) => gate.name === "rationale_unknown_minimality_ceiling")?.passed
    ).toBe(false);
  });

  it("locks exact inspectable ordering for a mixed synthetic set", () => {
    const base = computeRationaleMinimalityClaim(makeSufficiencyClaim())!;
    const claims = [
      {
        ...base,
        groupId: "e-bloated",
        rationaleGloballyMinimal: true,
        competitiveAlternativeSupport: null,
        redundantQuoteCount: 1,
        chosenVsMinimalSubsetDelta: 1,
      },
      {
        ...base,
        groupId: "d-competitive",
        rationaleGloballyMinimal: true,
        competitiveAlternativeSupport: true,
        complementSupportingSubsetExists: true,
        alternativeSupportStrength: "strong" as const,
        redundantQuoteCount: 0,
        chosenVsMinimalSubsetDelta: 0,
      },
      {
        ...base,
        groupId: "c-nonminimal",
        rationaleGloballyMinimal: false,
        smallerSupportingSubsetExists: true,
        competitiveAlternativeSupport: null,
        redundantQuoteCount: 0,
        chosenVsMinimalSubsetDelta: 1,
      },
      {
        ...base,
        groupId: "b-indeterminate",
        rationaleSubsetSearchPerformed: true,
        complementSubsetSearchPerformed: true,
        unknownMinimalityReason: "path_indeterminate" as const,
        rationaleGloballyMinimal: null,
        smallerSupportingSubsetExists: null,
      },
      {
        ...base,
        groupId: "a-skipped",
        rationaleSubsetSearchPerformed: false,
        rationaleSubsetSearchOverCap: true,
        complementSubsetSearchPerformed: false,
        complementSubsetSearchOverCap: true,
        unknownMinimalityReason: "subset_search_skipped" as const,
        unknownAlternativeSupportReason: "subset_search_skipped" as const,
        rationaleGloballyMinimal: null,
        smallerSupportingSubsetExists: null,
        complementSupportingSubsetExists: null,
        alternativeSupportStrength: null,
      },
    ];

    const report = computeRationaleMinimalityReport(claims);

    expect(report.inspectableClaims.map((claim) => claim.groupId)).toEqual([
      "a-skipped",
      "b-indeterminate",
      "c-nonminimal",
      "d-competitive",
      "e-bloated",
    ]);
  });

  it("keeps deterministic tie-breaks with multiple equal winning subsets in a larger set", () => {
    const quotes = [
      "I repeat this pattern alpha",
      "I repeat this pattern bravo",
      "I repeat this pattern charly",
      "I repeat this pattern delta",
      "I repeat this pattern echoo",
    ];
    const predicate = (subset: string[]) =>
      subset.length === 2 &&
      [
        "I repeat this pattern alpha|I repeat this pattern bravo",
        "I repeat this pattern alpha|I repeat this pattern charly",
        "I repeat this pattern alpha|I repeat this pattern delta",
      ].includes(subset.join("|"));

    const searchA = findBestPreservingSubset(quotes, predicate);
    const searchB = findBestPreservingSubset(quotes, predicate);

    expect(searchA.bestSubsetQuotes).toEqual(searchB.bestSubsetQuotes);
    expect(searchA.bestSubsetQuotes).toEqual([
      "I repeat this pattern alpha",
      "I repeat this pattern bravo",
    ]);
  });

  it("visibility gates pass when skipped or unknown claims are inspectable, and trivially pass at zero", () => {
    const overCapQuotes = Array.from(
      { length: RATIONALE_SUBSET_SEARCH_MAX_QUOTES + 1 },
      (_, index) => `Over-cap rationale quote ${index + 1}`
    );
    const skippedClaim = computeRationaleMinimalityClaim(
      makeSufficiencyClaim({
        groupId: "group-overcap-gates",
        fullEvidenceQuotes: [...overCapQuotes, "I avoid hard conversations when pressure builds"],
        rationaleReceiptQuotes: overCapQuotes,
      })
    );
    const skippedReport = computeRationaleMinimalityReport([skippedClaim!]);
    const baseMsgReport = computeMetrics([]);
    const baseGroupMetrics = computeGroupMetrics([]);

    const skippedGates = runRegressionGates(
      baseMsgReport,
      baseGroupMetrics,
      null,
      null,
      null,
      null,
      null,
      skippedReport
    ).gates;

    expect(
      skippedGates.find((gate) => gate.name === "rationale_subset_search_skip_visible")?.passed
    ).toBe(true);
    expect(
      skippedGates.find((gate) => gate.name === "rationale_unknown_minimality_visible")?.passed
    ).toBe(true);
    expect(
      skippedGates.find((gate) => gate.name === "rationale_subset_search_coverage_floor")?.passed
    ).toBe(false);
    expect(
      skippedGates.find((gate) => gate.name === "rationale_complement_search_coverage_floor")?.passed
    ).toBe(
      (skippedReport.searchedComplementSubsetRate ?? 0) >=
        RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR
    );
    expect(
      skippedGates.find((gate) => gate.name === "rationale_unknown_minimality_ceiling")?.passed
    ).toBe(
      (skippedReport.unknownMinimalityRate ?? 0) <=
        RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING
    );
    expect(
      skippedGates.find((gate) => gate.name === "rationale_unknown_alternative_support_ceiling")?.passed
    ).toBe(
      (skippedReport.unknownAlternativeSupportRate ?? 0) <=
        RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING
    );

    const cleanReport = computeRationaleMinimalityReport([
      computeRationaleMinimalityClaim(makeSufficiencyClaim())!,
    ]);
    const cleanGates = runRegressionGates(
      baseMsgReport,
      baseGroupMetrics,
      null,
      null,
      null,
      null,
      null,
      cleanReport
    ).gates;

    expect(
      cleanGates.find((gate) => gate.name === "rationale_subset_search_skip_visible")?.passed
    ).toBe(true);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_unknown_minimality_visible")?.passed
    ).toBe(true);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_subset_search_coverage_floor")?.threshold
    ).toBe(RATIONALE_SUBSET_SEARCH_COVERAGE_FLOOR);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_complement_search_coverage_floor")?.threshold
    ).toBe(RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_unknown_minimality_ceiling")?.threshold
    ).toBe(RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_unknown_alternative_support_ceiling")?.threshold
    ).toBe(RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_subset_search_coverage_floor")?.passed
    ).toBe(true);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_complement_search_coverage_floor")?.passed
    ).toBe(true);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_unknown_minimality_ceiling")?.passed
    ).toBe(true);
    expect(
      cleanGates.find((gate) => gate.name === "rationale_unknown_alternative_support_ceiling")?.passed
    ).toBe(true);
  });
});
