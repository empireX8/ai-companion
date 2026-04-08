import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { VisibleAbstentionPolicyArtifact } from "../eval/eval-types";
import {
  areNormalizedRationaleBundlesEqual,
  assessPersistedClaimSupportBundleCompleteness,
  computePersistedClaimReplaySummary,
  writePersistedClaimReplayArtifact,
  replayPersistedPatternClaimsBatch,
  replayPersistedPatternClaim,
} from "../pattern-claim-replay";

function makeEvidence(quotes: Array<string | null>) {
  return quotes.map((quote, index) => ({
    id: `ev-${index + 1}`,
    source: "derivation",
    sessionId: `sess-${index + 1}`,
    messageId: `msg-${index + 1}`,
    quote,
    createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
  }));
}

function makeClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: "claim-1",
    patternType: "trigger_condition" as const,
    summary: "When pressure rises, you default to pleasing or appeasing.",
    status: "active" as const,
    strengthLevel: "developing" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    evidence: makeEvidence([
      "I default to people-pleasing when someone seems upset with me",
      "When pressure rises, I start appeasing people instead of staying honest",
      "I walk it back quickly if a boundary might disappoint someone",
    ]),
    actions: [],
    ...overrides,
  };
}

function makePolicyArtifact(): VisibleAbstentionPolicyArtifact {
  return {
    version: 1,
    generatedAt: "2026-03-18T00:00:00.000Z",
    sourceReportPath: "/tmp/latest.json",
    selectedThreshold: 0.75,
    targetFailureRate: 0.25,
    coverageFloor: 0.4,
    eligibleClaims: 9,
    fallbackUsed: false,
    selectionReason: "selected",
    calibrationGateStatus: {
      thresholdSelected: true,
      coverageFloorPassed: true,
      failureTargetRespected: true,
      dataSufficient: true,
    },
  };
}

describe("pattern claim replay", () => {
  it("is deterministic across repeated runs", () => {
    const claim = makeClaim();
    const resultA = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });
    const resultB = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });

    expect(resultA).toEqual(resultB);
  });

  it("matching persisted claim replays cleanly", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: {
        surfaced: true,
        evidenceCount: 3,
        thresholdUsed: 0.55,
        displaySafeQuoteStatus: true,
        rationaleBundleQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          "I walk it back quickly if a boundary might disappoint someone",
        ],
      },
      abstentionThreshold: 0.55,
    });

    expect(result.completeness.supportBundleComplete).toBe(true);
    expect(result.divergence.divergenceReasons).toEqual([]);
    expect(result.replayOutcome).toBe("clean_match");
    expect(result.divergence.any).toBe(false);
  });

  it("surfaces summary drift explicitly", () => {
    const claim = makeClaim({ summary: "Stored summary shell" });
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });

    expect(result.divergence.summaryMismatch).toBe(true);
    expect(result.divergence.divergenceReasons).toEqual(["summary_mismatch"]);
    expect(result.divergence.any).toBe(true);
  });

  it("surfaces surfaced-state drift explicitly", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: { surfaced: false },
    });

    expect(result.divergence.surfacedMismatch).toBe(true);
    expect(result.divergence.any).toBe(true);
  });

  it("surfaces evidence-count drift explicitly", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: { evidenceCount: 99 },
    });

    expect(result.divergence.evidenceCountMismatch).toBe(true);
  });

  it("marks incomplete support bundles explicitly", () => {
    const claim = makeClaim({
      summary: "Stored shell summary",
      evidence: makeEvidence([null, null]),
    });
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });

    expect(result.completeness.supportBundleComplete).toBe(false);
    expect(result.completeness.missingFields).toEqual([
      "summaryText",
      "replayableQuotes",
      "rationaleBundleQuotes",
    ]);
    expect(result.divergence.divergenceReasons).toEqual([
      "summary_mismatch",
      "support_bundle_incomplete",
    ]);
    expect(result.divergence.incompleteSupportBundle).toBe(true);
    expect(result.divergence.any).toBe(true);
  });

  it("records threshold from the same resolution path and annotates policy source", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      policyArtifact: makePolicyArtifact(),
    });

    expect(result.replayed.thresholdUsed).toBe(0.75);
    expect(result.canonicalSupportBundle.thresholdUsed).toBe(0.75);
    expect(result.replayed.thresholdSource).toBe("policy_artifact");
    expect(result.canonicalSupportBundle.thresholdSource).toBe("policy_artifact");
    expect(result.replayed.rationaleBundleSource).toBe("persisted_evidence_quotes");
    expect(result.replayed.supportBundleSource).toBe("replay_derived");
  });

  it("annotates constant fallback threshold source for explicit override", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      abstentionThreshold: 0.55,
    });

    expect(result.replayed.thresholdSource).toBe("constant_fallback");
  });

  it("annotates constant fallback threshold source when no policy is present", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });

    expect(result.replayed.thresholdSource).toBe("constant_fallback");
  });

  it("annotates policy-artifact threshold source when loading from path", () => {
    const claim = makeClaim();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pattern-policy-"));
    const policyPath = path.join(tempDir, "visible-abstention-policy.json");
    fs.writeFileSync(policyPath, JSON.stringify(makePolicyArtifact()), "utf8");

    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      policyArtifactPath: policyPath,
    });

    expect(result.replayed.thresholdSource).toBe("policy_artifact");
  });

  it("computes display-safe status through the same quote-safe logic", () => {
    const claim = makeClaim({
      evidence: makeEvidence([
        "Can you help me understand this?",
        "What does this mean for me?",
      ]),
    });
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });

    expect(result.replayed.displaySafeQuoteStatus).toBe(false);
  });

  it("surfaces rationale bundle mismatch explicitly", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: {
        rationaleBundleQuotes: ["wrong quote"],
      },
    });

    expect(result.divergence.rationaleBundleMismatch).toBe(true);
  });

  it("keeps rationale bundle comparison exact but normalized", () => {
    expect(
      areNormalizedRationaleBundlesEqual([" First quote ", "Second quote"], [
        "First quote",
        "Second quote",
      ])
    ).toBe(true);
    expect(
      areNormalizedRationaleBundlesEqual(["First quote", "Second quote"], [
        "Second quote",
        "First quote",
      ])
    ).toBe(false);
  });

  it("preserves contradiction_drift special behavior", () => {
    const claim = makeClaim({
      patternType: "contradiction_drift",
      summary: "Recurring goal behavior gap across 3 contradictions",
      evidence: [],
    });
    const result = replayPersistedPatternClaim({
      claim,
      evidence: [],
    });

    expect(result.replayed.summaryText).toBe("Recurring goal behavior gap across 3 contradictions");
    expect(result.replayed.surfaced).toBe(true);
  });

  it("keeps rationale bundle and missing-field ordering deterministic", () => {
    const claim = makeClaim({
      summary: "Stored shell summary",
      evidence: makeEvidence([null, "Second quote", "First quote"]),
    });
    const resultA = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });
    const resultB = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
    });

    expect(resultA.replayed.rationaleBundleQuotes).toEqual([ "Second quote", "First quote" ]);
    expect(resultA.completeness.missingFields).toEqual(resultB.completeness.missingFields);
  });

  it("assesses completeness deterministically for partial persisted states", () => {
    const completeness = assessPersistedClaimSupportBundleCompleteness({
      summaryText: null,
      evidenceCount: 0,
      replayableQuotes: [],
      thresholdUsed: 0.55,
      displaySafeQuoteStatus: false,
    });

    expect(completeness).toEqual({
      supportBundleComplete: false,
      missingFields: ["summaryText", "evidence", "replayableQuotes", "rationaleBundleQuotes"],
      hasSummaryText: false,
      hasEvidence: false,
      hasReplayableQuotes: false,
      hasThreshold: true,
      hasRationaleBundle: false,
    });
  });

  it("does not create false mismatches when comparable persisted fields are absent", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: {},
      abstentionThreshold: 0.55,
    });

    expect(result.divergence.surfacedMismatch).toBe(false);
    expect(result.divergence.thresholdMismatch).toBe(false);
    expect(result.divergence.displaySafeMismatch).toBe(false);
    expect(result.divergence.rationaleBundleMismatch).toBe(false);
  });

  it("supports partial historical persisted state without false mismatches", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: {
        surfaced: true,
      },
      abstentionThreshold: 0.55,
    });

    expect(result.completeness.supportBundleComplete).toBe(true);
    expect(result.divergence.surfacedMismatch).toBe(false);
    expect(result.divergence.thresholdMismatch).toBe(false);
    expect(result.divergence.displaySafeMismatch).toBe(false);
    expect(result.divergence.rationaleBundleMismatch).toBe(false);
  });

  it("treats absent persisted threshold as non-comparable historical state", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: {
        surfaced: true,
        evidenceCount: 3,
      },
      abstentionThreshold: 0.55,
    });

    expect(result.divergence.thresholdMismatch).toBe(false);
  });

  it("treats absent persisted rationale bundle as non-comparable historical state", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: {
        surfaced: true,
        evidenceCount: 3,
        thresholdUsed: 0.55,
        displaySafeQuoteStatus: false,
      },
      abstentionThreshold: 0.55,
    });

    expect(result.divergence.rationaleBundleMismatch).toBe(false);
  });

  it("treats absent persisted display-safe status as non-comparable historical state", () => {
    const claim = makeClaim();
    const result = replayPersistedPatternClaim({
      claim,
      evidence: claim.evidence,
      persistedSurfaceState: {
        surfaced: true,
        evidenceCount: 3,
        thresholdUsed: 0.55,
      },
      abstentionThreshold: 0.55,
    });

    expect(result.divergence.displaySafeMismatch).toBe(false);
  });

  it("computes deterministic batch replay summaries", () => {
    const clean = replayPersistedPatternClaim({
      claim: makeClaim(),
      evidence: makeClaim().evidence,
      persistedSurfaceState: {
        surfaced: true,
        evidenceCount: 3,
        thresholdUsed: 0.55,
        displaySafeQuoteStatus: true,
        rationaleBundleQuotes: [
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          "I walk it back quickly if a boundary might disappoint someone",
        ],
      },
      abstentionThreshold: 0.55,
    });
    const summaryDrift = replayPersistedPatternClaim({
      claim: makeClaim({ id: "claim-2", summary: "Stored shell summary" }),
      evidence: makeClaim().evidence,
      abstentionThreshold: 0.55,
    });
    const incomplete = replayPersistedPatternClaim({
      claim: makeClaim({
        id: "claim-3",
        summary: "Stored shell summary",
        evidence: makeEvidence([null, null]),
      }),
      evidence: makeEvidence([null, null]),
      abstentionThreshold: 0.55,
    });

    const results = [clean, summaryDrift, incomplete];
    const summaryA = computePersistedClaimReplaySummary(results);
    const summaryB = computePersistedClaimReplaySummary(results);
    const batchA = replayPersistedPatternClaimsBatch([
      {
        claim: makeClaim(),
        evidence: makeClaim().evidence,
        persistedSurfaceState: {
          surfaced: true,
          evidenceCount: 3,
          thresholdUsed: 0.55,
          displaySafeQuoteStatus: true,
          rationaleBundleQuotes: [
            "I default to people-pleasing when someone seems upset with me",
            "When pressure rises, I start appeasing people instead of staying honest",
            "I walk it back quickly if a boundary might disappoint someone",
          ],
        },
        abstentionThreshold: 0.55,
      },
      {
        claim: makeClaim({ id: "claim-2", summary: "Stored shell summary" }),
        evidence: makeClaim().evidence,
        abstentionThreshold: 0.55,
      },
      {
        claim: makeClaim({
          id: "claim-3",
          summary: "Stored shell summary",
          evidence: makeEvidence([null, null]),
        }),
        evidence: makeEvidence([null, null]),
        abstentionThreshold: 0.55,
      },
    ]);

    expect(summaryA).toEqual(summaryB);
    expect(summaryA).toMatchObject({
      replayedClaims: 3,
      completeSupportBundles: 2,
      incompleteSupportBundles: 1,
      divergentClaims: 2,
      cleanMatchClaims: 1,
      incompleteSupportBundleClaims: 1,
      summaryMismatchClaims: 2,
      surfacedMismatchClaims: 0,
      evidenceCountMismatchClaims: 0,
      thresholdMismatchClaims: 0,
      displaySafeMismatchClaims: 0,
      rationaleBundleMismatchClaims: 0,
    });
    expect(batchA.summary).toEqual(summaryA);
    expect(batchA.inspectableResults.map((result) => result.claimId)).toEqual(["claim-3", "claim-2"]);
  });

  it("writes deterministic persisted replay artifacts", () => {
    const batch = replayPersistedPatternClaimsBatch([
      {
        claim: makeClaim(),
        evidence: makeClaim().evidence,
        abstentionThreshold: 0.55,
      },
      {
        claim: makeClaim({ id: "claim-2", summary: "Stored shell summary" }),
        evidence: makeClaim().evidence,
        abstentionThreshold: 0.55,
      },
    ]);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-replay-artifact-"));
    const pathA = path.join(tempDir, "replay-a.json");
    const pathB = path.join(tempDir, "replay-b.json");

    writePersistedClaimReplayArtifact(batch, pathA);
    writePersistedClaimReplayArtifact(batch, pathB);

    expect(fs.readFileSync(pathA, "utf8")).toBe(fs.readFileSync(pathB, "utf8"));
  });
});
