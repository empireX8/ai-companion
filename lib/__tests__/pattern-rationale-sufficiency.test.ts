import { describe, expect, it } from "vitest";

import {
  computeFaithfulnessFromReceiptBundle,
  computeRationaleSufficiencyClaim,
  computeRationaleSufficiencyReport,
  computeSummaryStableFromRationale,
  resolveRationaleReceiptBundle,
  selectRationaleReceiptBundle,
} from "../eval/pattern-rationale-sufficiency";
import { computeMetrics, computeGroupMetrics, runRegressionGates } from "../eval/pattern-evaluator";
import type { FaithfulnessClaimScore, RationaleSufficiencyClaimScore } from "../eval/eval-types";

function makeFaithfulnessScore(
  overrides: Partial<FaithfulnessClaimScore> = {}
): FaithfulnessClaimScore {
  return {
    groupId: "group-1",
    family: "trigger_condition",
    visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
    receiptQuotes: [
      "I default to people-pleasing when someone seems upset with me",
      "When pressure rises, I start appeasing people instead of staying honest",
    ],
    faithful: true,
    score: 0.9,
    rationale: "supported",
    parseStatus: "parsed",
    shadowMode: true,
    usedForProductDecision: false,
    ...overrides,
  };
}

describe("pattern rationale sufficiency", () => {
  it("marks a rationale bundle sufficient only when summary and faithfulness are both preserved", () => {
    const claim = computeRationaleSufficiencyClaim({
      groupId: "group-1",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
        "I apologize fast when tension shows up",
      ],
      faithfulnessScore: makeFaithfulnessScore(),
    });

    expect(claim.summaryStableFromRationale).toBe(true);
    expect(claim.rationaleFaithful).toBe(true);
    expect(claim.faithfulnessStableFromRationale).toBe(true);
    expect(claim.rationaleSufficient).toBe(true);
    expect(claim.rationaleBundleSource).toBe("matching_pair");
    expect(claim.sufficiencyReasons).toEqual(["fallback_bundle_used"]);
  });

  it("marks summary-stable but faithfulness-drift cases as insufficient", () => {
    const claim = computeRationaleSufficiencyClaim({
      groupId: "group-2",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
      faithfulnessScore: makeFaithfulnessScore({
        groupId: "group-2",
        faithful: false,
        score: 0.12,
        rationale: "full bundle marked unfaithful",
      }),
    });

    expect(claim.summaryStableFromRationale).toBe(true);
    expect(claim.rationaleFaithful).toBe(true);
    expect(claim.faithfulnessStableFromRationale).toBe(false);
    expect(claim.rationaleSufficient).toBe(false);
    expect(claim.sufficiencyReasons).toEqual(["faithfulness_drift", "fallback_bundle_used"]);
  });

  it("marks faithfulness-stable but summary-drift cases as insufficient", () => {
    const claim = computeRationaleSufficiencyClaim({
      groupId: "group-3",
      family: "recovery_stabilizer",
      visibleSummary: "Progress appears when you follow through consistently.",
      fullEvidenceQuotes: [
        "I actually managed to stay calm during a difficult conversation I had been dreading all week",
        "I was able to step away from the situation before I said something I would have deeply regretted",
      ],
      faithfulnessScore: makeFaithfulnessScore({
        groupId: "group-3",
        family: "recovery_stabilizer",
        visibleSummary: "Progress appears when you follow through consistently.",
        receiptQuotes: [
          "I actually managed to stay calm during a difficult conversation I had been dreading all week",
          "I was able to step away from the situation before I said something I would have deeply regretted",
        ],
        faithful: false,
        score: 0.15,
      }),
    });

    expect(claim.summaryStableFromRationale).toBe(false);
    expect(claim.rationaleFaithful).toBe(false);
    expect(claim.faithfulnessStableFromRationale).toBe(true);
    expect(claim.rationaleSufficient).toBe(false);
    expect(claim.sufficiencyReasons).toEqual(["summary_drift", "fallback_bundle_used"]);
  });

  it("propagates parse failures as non-authoritative null outputs", () => {
    const claim = computeRationaleSufficiencyClaim({
      groupId: "group-4",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
      faithfulnessScore: makeFaithfulnessScore({
        groupId: "group-4",
        faithful: null,
        score: null,
        parseStatus: "schema_invalid",
      }),
    });

    expect(claim.summaryStableFromRationale).toBeNull();
    expect(claim.rationaleFaithful).toBeNull();
    expect(claim.faithfulnessStableFromRationale).toBeNull();
    expect(claim.rationaleSufficient).toBeNull();
    expect(claim.originalParseStatus).toBe("schema_invalid");
    expect(claim.rationaleFaithfulnessParseStatus).toBe("schema_invalid");
    expect(claim.sufficiencyReasons).toContain("original_parse_failure");
    expect(claim.usedForProductDecision).toBe(false);
  });

  it("aggregates inspectable output and rates consistently", () => {
    const scores: RationaleSufficiencyClaimScore[] = [
      computeRationaleSufficiencyClaim({
        groupId: "group-1",
        family: "trigger_condition",
        visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
        ],
        faithfulnessScore: makeFaithfulnessScore(),
      }),
      computeRationaleSufficiencyClaim({
        groupId: "group-2",
        family: "trigger_condition",
        visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
        ],
        faithfulnessScore: makeFaithfulnessScore({
          groupId: "group-2",
          faithful: false,
          score: 0.12,
        }),
      }),
      computeRationaleSufficiencyClaim({
        groupId: "group-3",
        family: "trigger_condition",
        visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
        ],
        faithfulnessScore: makeFaithfulnessScore({
          groupId: "group-3",
          faithful: null,
          score: null,
          parseStatus: "malformed_json",
        }),
      }),
    ];

    const report = computeRationaleSufficiencyReport(scores);
    expect(report.totalClaimsConsidered).toBe(3);
    expect(report.scoredClaims).toBe(1);
    expect(report.sufficientCount).toBe(1);
    expect(report.insufficientCount).toBe(0);
    expect(report.parseFailureCount).toBe(1);
    expect(report.originalParseFailureClaims).toBe(1);
    expect(report.rationaleParseFailureClaims).toBe(1);
    expect(report.summaryStableCount).toBe(1);
    expect(report.summaryDriftCount).toBe(0);
    expect(report.faithfulnessStableCount).toBe(1);
    expect(report.faithfulnessDriftCount).toBe(0);
    expect(report.preferredReceiptBundleClaims).toBeGreaterThanOrEqual(0);
    expect(report.fallbackReceiptBundleClaims).toBeGreaterThanOrEqual(0);
    expect(report.sufficiencyRate).toBe(1);
    expect(report.summaryStabilityRate).toBe(1);
    expect(report.faithfulnessStabilityRate).toBe(1);
    expect(report.inspectableClaims.map((claim) => claim.groupId)).toEqual(["group-3", "group-2"]);
  });

  it("orders inspectable claims by diagnostic severity rather than lexical id", () => {
    const originalParseFailure = computeRationaleSufficiencyClaim({
      groupId: "group-z",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
      faithfulnessScore: makeFaithfulnessScore({
        groupId: "group-z",
        faithful: null,
        score: null,
        parseStatus: "malformed_json",
      }),
    });
    const faithfulnessDrift = computeRationaleSufficiencyClaim({
      groupId: "group-a",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
      faithfulnessScore: makeFaithfulnessScore({
        groupId: "group-a",
        faithful: false,
        score: 0.12,
      }),
    });
    const summaryDrift = computeRationaleSufficiencyClaim({
      groupId: "group-b",
      family: "recovery_stabilizer",
      visibleSummary: "Progress appears when you follow through consistently.",
      fullEvidenceQuotes: [
        "I actually managed to stay calm during a difficult conversation I had been dreading all week",
        "I was able to step away from the situation before I said something I would have deeply regretted",
      ],
      faithfulnessScore: makeFaithfulnessScore({
        groupId: "group-b",
        family: "recovery_stabilizer",
        visibleSummary: "Progress appears when you follow through consistently.",
        receiptQuotes: [
          "I actually managed to stay calm during a difficult conversation I had been dreading all week",
          "I was able to step away from the situation before I said something I would have deeply regretted",
        ],
        faithful: false,
        score: 0.15,
      }),
    });

    const report = computeRationaleSufficiencyReport([
      summaryDrift,
      faithfulnessDrift,
      originalParseFailure,
    ]);

    expect(report.inspectableClaims.map((claim) => claim.groupId)).toEqual([
      "group-z",
      "group-a",
      "group-b",
    ]);
  });

  it("keeps pair selection deterministic across repeated runs", () => {
    const args = {
      family: "trigger_condition" as const,
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "Can you help me understand this pattern?",
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
    };

    expect(selectRationaleReceiptBundle(args)).toEqual(selectRationaleReceiptBundle(args));
    expect(resolveRationaleReceiptBundle(args)).toEqual(resolveRationaleReceiptBundle(args));
  });

  it("uses FaithfulnessClaimScore.receiptQuotes first when a usable bundle already exists", () => {
    const bundle = resolveRationaleReceiptBundle({
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
        "I apologize fast when tension shows up",
      ],
      preferredReceiptQuotes: [
        "I apologize fast when tension shows up",
        "I default to people-pleasing when someone seems upset with me",
      ],
    });

    expect(bundle.source).toBe("preferred_receipts");
    expect(bundle.quotes).toEqual([
      "I apologize fast when tension shows up",
      "I default to people-pleasing when someone seems upset with me",
    ]);
  });

  it("falls back to deterministic selection only when the original bundle is absent or unusable", () => {
    const bundle = resolveRationaleReceiptBundle({
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
        "Can you help me understand this pattern?",
      ],
      preferredReceiptQuotes: ["I default to people-pleasing when someone seems upset with me"],
    });

    expect(bundle.source).toBe("matching_pair");
    expect(bundle.quotes).toEqual([
      "I default to people-pleasing when someone seems upset with me",
      "When pressure rises, I start appeasing people instead of staying honest",
    ]);
  });

  it("adds rationale regression gates only when a rationale report is present", () => {
    const rationaleReport = computeRationaleSufficiencyReport([
      computeRationaleSufficiencyClaim({
        groupId: "group-1",
        family: "trigger_condition",
        visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
        fullEvidenceQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
        ],
        faithfulnessScore: makeFaithfulnessScore(),
      }),
    ]);

    const withReport = runRegressionGates(
      computeMetrics([]),
      computeGroupMetrics([]),
      null,
      null,
      null,
      null,
      rationaleReport
    );
    const withoutReport = runRegressionGates(
      computeMetrics([]),
      computeGroupMetrics([]),
      null,
      null,
      null,
      null,
      null
    );

    expect(withReport.gates.some((gate) => gate.name === "rationale_sufficiency_floor")).toBe(true);
    expect(withReport.gates.some((gate) => gate.name === "rationale_parse_failure_ceiling")).toBe(true);
    expect(withReport.gates.some((gate) => gate.name === "rationale_faithfulness_stability_floor")).toBe(true);
    expect(withReport.gates.some((gate) => gate.name === "rationale_summary_stability_visible")).toBe(true);
    expect(withReport.gates.some((gate) => gate.name === "rationale_shadow_only")).toBe(true);
    expect(withReport.gates.some((gate) => gate.name === "rationale_insufficiency_visible")).toBe(true);
    expect(withoutReport.gates.some((gate) => gate.name.startsWith("rationale_"))).toBe(false);
  });

  it("keeps usedForProductDecision false on rationale and rationale-only faithfulness outputs", () => {
    const rationaleFaithfulness = computeFaithfulnessFromReceiptBundle({
      groupId: "group-1",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      receiptQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
    });
    const claim = computeRationaleSufficiencyClaim({
      groupId: "group-1",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
      faithfulnessScore: makeFaithfulnessScore(),
    });

    expect(rationaleFaithfulness.usedForProductDecision).toBe(false);
    expect(claim.usedForProductDecision).toBe(false);
  });

  it("remains deterministic across repeated summary and claim computations", () => {
    const inputs = {
      groupId: "group-1",
      family: "trigger_condition" as const,
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      fullEvidenceQuotes: [
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
      ],
      faithfulnessScore: makeFaithfulnessScore(),
    };

    expect(
      computeSummaryStableFromRationale({
        family: inputs.family,
        visibleSummary: inputs.visibleSummary,
        rationaleReceiptQuotes: selectRationaleReceiptBundle({
          family: inputs.family,
          visibleSummary: inputs.visibleSummary,
          fullEvidenceQuotes: inputs.fullEvidenceQuotes,
        }),
      })
    ).toBe(
      computeSummaryStableFromRationale({
        family: inputs.family,
        visibleSummary: inputs.visibleSummary,
        rationaleReceiptQuotes: selectRationaleReceiptBundle({
          family: inputs.family,
          visibleSummary: inputs.visibleSummary,
          fullEvidenceQuotes: inputs.fullEvidenceQuotes,
        }),
      })
    );
    expect(computeRationaleSufficiencyClaim(inputs)).toEqual(computeRationaleSufficiencyClaim(inputs));
  });
});
