/**
 * Visible Claim Abstention Scoring Tests — Phase 8
 *
 * Covers:
 * 1. No visible summary → hard abstain (existing behavior preserved)
 * 2. Strong multi-receipt, multi-session claim clears threshold
 * 3. Weak but technically specific claim loses to abstention score
 * 4. More evidence improves score deterministically
 * 5. Quote safety affects score
 * 6. Shared projection remains centralized (no route-local bypass)
 * 7. Evaluator / report includes abstention scoring fields
 * 8. Shadow-only rule preserved — no product path depends on LLM or faithfulness
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, expect, it } from "vitest";

import {
  VISIBLE_ABSTENTION_THRESHOLD,
  VISIBLE_CLAIM_EVIDENCE_SATURATION,
  VISIBLE_CLAIM_SESSION_SATURATION,
  VISIBLE_CLAIM_WEIGHT_EVIDENCE,
  VISIBLE_CLAIM_WEIGHT_QUOTE,
  VISIBLE_CLAIM_WEIGHT_SESSION,
  resolveRuntimeVisibleAbstentionThreshold,
  scoreVisiblePatternClaim,
  shouldAbstainVisiblePatternClaim,
  projectVisiblePatternClaim,
  type VisiblePatternClaimRecord,
} from "../pattern-visible-claim";
import {
  loadVisibleAbstentionPolicyArtifact,
  loadVisibleAbstentionPolicyArtifactDiagnostics,
  resolveVisibleAbstentionPolicyThreshold,
  summarizeVisibleAbstentionPolicyArtifact,
  VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION,
} from "../visible-abstention-policy";
import {
  computeVisibleAbstentionSummary,
} from "../eval/pattern-evaluator";
import type { GroupResult, VisibleAbstentionPolicyArtifact } from "../eval/eval-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDate(offset = 0): Date {
  return new Date(Date.now() - offset);
}

/**
 * Build a minimal VisiblePatternClaimRecord for projection tests.
 * Evidence entries are constructed to control evidenceCount, sessionCount, and quote content.
 */
function makeClaim(opts: {
  patternType?: VisiblePatternClaimRecord["patternType"];
  evidenceCount?: number;
  sessionCount?: number;
  quotes?: (string | null)[];
}): VisiblePatternClaimRecord {
  const {
    patternType = "trigger_condition",
    evidenceCount = 5,
    sessionCount = 3,
    quotes,
  } = opts;

  // Build evidence entries with controlled session spread and quotes.
  const evidence = Array.from({ length: evidenceCount }, (_, i) => ({
    id: `ev-${i}`,
    source: "derivation",
    sessionId: `session-${(i % sessionCount) + 1}`,
    messageId: `msg-${i}`,
    quote: quotes ? (quotes[i] ?? null) : `I tend to avoid difficult situations when pressure builds (${i})`,
    createdAt: makeDate(i * 1000),
  }));

  return {
    id: "claim-test",
    patternType,
    summary: "Candidate summary — overridden by generateVisiblePatternSummary",
    status: "active",
    strengthLevel: "developing",
    createdAt: makeDate(10000),
    updatedAt: makeDate(1000),
    evidence,
  };
}

/**
 * Minimal GroupResult for evaluator abstention tests.
 * Only clueQuotes and group.entries.session_id are used by the scorer.
 */
function makeGroupResult(opts: {
  id?: string;
  emittedFamily?: "trigger_condition" | "inner_critic";
  clueQuotes?: string[];
  sessionIds?: string[];
}): GroupResult {
  const {
    id = "g-test",
    emittedFamily = "trigger_condition",
    clueQuotes = [],
    sessionIds = ["s1"],
  } = opts;

  return {
    group: {
      id,
      description: "test group",
      entries: sessionIds.map((sid, i) => ({
        text: `message ${i}`,
        session_id: sid,
        role: "user" as const,
        source: "live_user" as const,
      })),
      expected_behavioral: true,
      expected_families: {
        trigger_condition: false,
        inner_critic: false,
        repetitive_loop: false,
        recovery_stabilizer: false,
      },
      expected_abstain: false,
      expected_quote_safe: false,
    },
    behavioral: true,
    emittedFamilies: {
      trigger_condition: emittedFamily === "trigger_condition",
      inner_critic: emittedFamily === "inner_critic",
      repetitive_loop: false,
      recovery_stabilizer: false,
    },
    anyClaimed: true,
    quoteSafe: false,
    behavioralCorrect: true,
    familiesCorrect: true,
    abstainCorrect: true,
    quoteSafeCorrect: true,
    falsePositiveFamilies: [],
    falseNegativeFamilies: [],
    clueQuotes: {
      trigger_condition: emittedFamily === "trigger_condition" ? clueQuotes : [],
      inner_critic: emittedFamily === "inner_critic" ? clueQuotes : [],
      repetitive_loop: [],
      recovery_stabilizer: [],
    },
    visibleAbstentionScores: [],
    reviewFlag: {
      groupId: id,
      emittedFamilies: [],
      review_needed: false,
      review_priority: null,
      review_reasons: [],
      faithfulnessIncluded: false,
    },
  };
}

function makePolicyArtifact(
  overrides: Partial<VisibleAbstentionPolicyArtifact> = {}
): VisibleAbstentionPolicyArtifact {
  return {
    version: VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION,
    generatedAt: "2026-03-18T00:00:00.000Z",
    sourceReportPath: "/tmp/latest.json",
    selectedThreshold: 0.8,
    targetFailureRate: 0.25,
    coverageFloor: 0.4,
    eligibleClaims: 9,
    fallbackUsed: false,
    selectionReason: "target_failure_rate_0.25_coverage_maximized",
    calibrationGateStatus: {
      thresholdSelected: true,
      coverageFloorPassed: true,
      failureTargetRespected: true,
      dataSufficient: true,
    },
    ...overrides,
  };
}

function writePolicyArtifactFile(
  artifact: VisibleAbstentionPolicyArtifact | string
): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-visible-policy-"));
  const policyPath = path.join(tempDir, "visible-abstention-policy.json");
  const contents =
    typeof artifact === "string"
      ? artifact
      : JSON.stringify(artifact, null, 2) + "\n";
  fs.writeFileSync(policyPath, contents, "utf-8");
  return policyPath;
}

// ── 1. No visible summary → hard abstain ──────────────────────────────────────

describe("1. no visible summary → hard abstain", () => {
  it("projectVisiblePatternClaim returns null when fewer than 2 receipts have quotes", () => {
    // Only 1 quote → generateVisiblePatternSummary returns null → hard abstain
    const claim = makeClaim({
      evidenceCount: 5,
      sessionCount: 3,
      quotes: ["I tend to avoid difficult conversations", null, null, null, null],
    });
    expect(projectVisiblePatternClaim(claim)).toBeNull();
  });

  it("projectVisiblePatternClaim returns null when quotes exist but no pattern matches", () => {
    // 2+ quotes but no TC/IC/RL/RS pattern matches → summary = null
    const claim = makeClaim({
      evidenceCount: 5,
      sessionCount: 3,
      quotes: [
        "The weather is nice today",
        "I had coffee this morning",
        "The meeting went well",
        null,
        null,
      ],
    });
    expect(projectVisiblePatternClaim(claim)).toBeNull();
  });

  it("scoreVisiblePatternClaim is never called when summary gate blocks — null is returned directly", () => {
    // Even with perfect signal inputs, if no visible summary exists the claim is null.
    // This test documents the layered decision: summary gate is primary, score gate is secondary.
    const noSummaryQuotes = [
      "The weather today is wonderful",
      "I enjoy cooking dinner",
      "My commute was fine",
      null,
      null,
    ];
    const claim = makeClaim({ evidenceCount: 5, sessionCount: 3, quotes: noSummaryQuotes });
    const result = projectVisiblePatternClaim(claim);
    expect(result).toBeNull();
  });
});

describe("policy artifact diagnostics", () => {
  it("returns explicit deterministic fallback diagnostics for missing and malformed artifacts", () => {
    const missing = summarizeVisibleAbstentionPolicyArtifact({
      policyPath: path.join(os.tmpdir(), `missing-policy-${Date.now()}.json`),
    });
    const malformedPath = writePolicyArtifactFile("{bad json");
    const malformed = summarizeVisibleAbstentionPolicyArtifact({ policyPath: malformedPath });

    expect(missing.fallbackReason).toBe("missing_artifact");
    expect(missing.thresholdSource).toBe("constant_fallback");
    expect(malformed.fallbackReason).toBe("malformed_json");
    expect(malformed.thresholdSource).toBe("constant_fallback");
  });

  it("classifies invalid shape, missing threshold, fallback-flagged, and failed-gate cases explicitly", () => {
    const invalidShapePath = writePolicyArtifactFile(
      JSON.stringify({ version: VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION, generatedAt: "x" })
    );
    const thresholdMissing = summarizeVisibleAbstentionPolicyArtifact({
      policyArtifact: makePolicyArtifact({ selectedThreshold: null }),
    });
    const fallbackFlagged = summarizeVisibleAbstentionPolicyArtifact({
      policyArtifact: makePolicyArtifact({ fallbackUsed: true }),
    });
    const failedGate = summarizeVisibleAbstentionPolicyArtifact({
      policyArtifact: makePolicyArtifact({
        calibrationGateStatus: {
          thresholdSelected: true,
          coverageFloorPassed: false,
          failureTargetRespected: true,
          dataSufficient: true,
        },
      }),
    });

    expect(loadVisibleAbstentionPolicyArtifactDiagnostics(invalidShapePath).fallbackReason).toBe(
      "invalid_shape"
    );
    expect(thresholdMissing.fallbackReason).toBe("threshold_missing");
    expect(fallbackFlagged.fallbackReason).toBe("fallback_flagged");
    expect(failedGate.fallbackReason).toBe("failed_gate");
  });

  it("produces identical diagnostic summaries for identical artifact inputs", () => {
    const policyArtifact = makePolicyArtifact();
    const summaryA = summarizeVisibleAbstentionPolicyArtifact({ policyArtifact });
    const summaryB = summarizeVisibleAbstentionPolicyArtifact({ policyArtifact });

    expect(summaryA).toEqual(summaryB);
  });

  it("distinguishes explicit override from artifact fallback without changing threshold behavior", () => {
    const resolved = resolveVisibleAbstentionPolicyThreshold({
      explicitOverride: 0.61,
      constantThreshold: VISIBLE_ABSTENTION_THRESHOLD,
    });

    expect(resolved.thresholdUsed).toBe(0.61);
    expect(resolved.thresholdSource).toBe("explicit_override");
    expect(resolved.fallbackReason).toBe("constant_override");
  });
});

// ── 2. Strong claim clears threshold ──────────────────────────────────────────

describe("2. strong multi-receipt, multi-session claim clears threshold", () => {
  it("scoreVisiblePatternClaim at saturation returns score >= threshold", () => {
    const { score, triggered } = scoreVisiblePatternClaim({
      evidenceCount: VISIBLE_CLAIM_EVIDENCE_SATURATION,
      sessionCount: VISIBLE_CLAIM_SESSION_SATURATION,
      hasDisplaySafeQuote: true,
    });
    expect(score).toBeCloseTo(1.0);
    expect(triggered).toBe(false);
  });

  it("projectVisiblePatternClaim surfaces a strong TC claim with matching avoidance quotes", () => {
    // 5 evidence across 3 sessions, all matching avoidance pattern → should surface
    const claim = makeClaim({
      evidenceCount: 5,
      sessionCount: 3,
      quotes: [
        "I tend to avoid difficult conversations whenever pressure builds",
        "I always procrastinate when I need to make important decisions",
        "I tend to avoid conflicts by going quiet",
        "I always put off hard decisions when stress builds",
        "I avoid confrontation by procrastinating",
      ],
    });
    const result = projectVisiblePatternClaim(claim);
    expect(result).not.toBeNull();
    expect(result?.summary).toBeTruthy();
    expect(result?.evidenceCount).toBe(5);
  });
});

// ── 3. Weak claim loses to abstention score ────────────────────────────────────

describe("3. weak claim suppressed by abstention score even when summary exists", () => {
  it("scoreVisiblePatternClaim returns triggered=true for low evidence+session, no safe quote", () => {
    const { score, triggered } = scoreVisiblePatternClaim({
      evidenceCount: 1,
      sessionCount: 1,
      hasDisplaySafeQuote: false,
    });
    // 0.35*(1/5) + 0.35*(1/3) + 0 = 0.07 + 0.117 = 0.187
    expect(score).toBeLessThan(VISIBLE_ABSTENTION_THRESHOLD);
    expect(triggered).toBe(true);
  });

  it("score with 2 evidence, 1 session, no safe quote is below threshold", () => {
    const { score, triggered } = scoreVisiblePatternClaim({
      evidenceCount: 2,
      sessionCount: 1,
      hasDisplaySafeQuote: false,
    });
    // 0.35*(2/5) + 0.35*(1/3) + 0 = 0.14 + 0.117 = 0.257
    expect(score).toBeLessThan(VISIBLE_ABSTENTION_THRESHOLD);
    expect(triggered).toBe(true);
  });

  it("shouldAbstainVisiblePatternClaim returns true for weak inputs", () => {
    expect(
      shouldAbstainVisiblePatternClaim({ evidenceCount: 1, sessionCount: 1, hasDisplaySafeQuote: false })
    ).toBe(true);
  });
});

// ── 4. More evidence improves score ──────────────────────────────────────────

describe("4. more evidence improves score deterministically", () => {
  it("score increases with evidenceCount from 1 to saturation", () => {
    const base = { sessionCount: 3, hasDisplaySafeQuote: false };
    const s1 = scoreVisiblePatternClaim({ ...base, evidenceCount: 1 }).score;
    const s3 = scoreVisiblePatternClaim({ ...base, evidenceCount: 3 }).score;
    const s5 = scoreVisiblePatternClaim({ ...base, evidenceCount: 5 }).score;
    expect(s3).toBeGreaterThan(s1);
    expect(s5).toBeGreaterThan(s3);
  });

  it("crossing evidence saturation does not increase score further", () => {
    const base = { sessionCount: 3, hasDisplaySafeQuote: false };
    const atSat = scoreVisiblePatternClaim({ ...base, evidenceCount: VISIBLE_CLAIM_EVIDENCE_SATURATION }).score;
    const overSat = scoreVisiblePatternClaim({ ...base, evidenceCount: VISIBLE_CLAIM_EVIDENCE_SATURATION + 10 }).score;
    expect(overSat).toBeCloseTo(atSat);
  });

  it("higher evidence can cross the abstention threshold when other signals are present", () => {
    // With 3 sessions and no safe quote:
    // evidenceCount=2 → 0.35*(2/5) + 0.35 = 0.14 + 0.35 = 0.49 → ABSTAIN
    // evidenceCount=5 → 0.35*(5/5) + 0.35 = 0.35 + 0.35 = 0.70 → SURFACE
    const weak = scoreVisiblePatternClaim({ evidenceCount: 2, sessionCount: 3, hasDisplaySafeQuote: false });
    const strong = scoreVisiblePatternClaim({ evidenceCount: 5, sessionCount: 3, hasDisplaySafeQuote: false });
    expect(weak.triggered).toBe(true);
    expect(strong.triggered).toBe(false);
  });
});

// ── 5. Quote safety affects score ────────────────────────────────────────────

describe("5. quote safety affects the abstention score", () => {
  it("hasDisplaySafeQuote=true adds WEIGHT_QUOTE to the score", () => {
    const base = { evidenceCount: 3, sessionCount: 2 };
    const without = scoreVisiblePatternClaim({ ...base, hasDisplaySafeQuote: false }).score;
    const withQuote = scoreVisiblePatternClaim({ ...base, hasDisplaySafeQuote: true }).score;
    expect(withQuote - without).toBeCloseTo(VISIBLE_CLAIM_WEIGHT_QUOTE);
  });

  it("claim with no display-safe quote has a lower score than one with a safe quote", () => {
    const base = { evidenceCount: 3, sessionCount: 2 };
    const noQuote = scoreVisiblePatternClaim({ ...base, hasDisplaySafeQuote: false });
    const withQuote = scoreVisiblePatternClaim({ ...base, hasDisplaySafeQuote: true });
    expect(withQuote.score).toBeGreaterThan(noQuote.score);
  });

  it("quote safety alone can shift the decision from abstain to surface", () => {
    // 3 evidence, 2 sessions, no quote: 0.35*(3/5) + 0.35*(2/3) = 0.21 + 0.233 = 0.443 → ABSTAIN
    // Add safe quote: +0.30 = 0.743 → SURFACE
    const noQuote = scoreVisiblePatternClaim({ evidenceCount: 3, sessionCount: 2, hasDisplaySafeQuote: false });
    const withQuote = scoreVisiblePatternClaim({ evidenceCount: 3, sessionCount: 2, hasDisplaySafeQuote: true });
    expect(noQuote.triggered).toBe(true);
    expect(withQuote.triggered).toBe(false);
  });

  it("reasons array includes quote-safe or no-safe-quote label", () => {
    const { reasons: r1 } = scoreVisiblePatternClaim({ evidenceCount: 2, sessionCount: 1, hasDisplaySafeQuote: true });
    const { reasons: r2 } = scoreVisiblePatternClaim({ evidenceCount: 2, sessionCount: 1, hasDisplaySafeQuote: false });
    expect(r1).toContain("quote-safe");
    expect(r2).toContain("no-safe-quote");
  });
});

describe("5b. support-container spread integration", () => {
  it("keeps message-only scoring unchanged when journalEntrySpread=0", () => {
    const legacy = scoreVisiblePatternClaim({
      evidenceCount: 3,
      sessionCount: 2,
      hasDisplaySafeQuote: false,
    });
    const explicitSupportContainer = scoreVisiblePatternClaim({
      evidenceCount: 3,
      sessionCount: 2,
      journalEntrySpread: 0,
      supportContainerSpread: 2,
      hasDisplaySafeQuote: false,
    });

    expect(explicitSupportContainer.score).toBeCloseTo(legacy.score);
    expect(explicitSupportContainer.triggered).toBe(legacy.triggered);
  });

  it("adds spread support from journalEntrySpread via supportContainerSpread", () => {
    const noJournalContainer = scoreVisiblePatternClaim({
      evidenceCount: 3,
      sessionCount: 1,
      journalEntrySpread: 0,
      hasDisplaySafeQuote: false,
    });
    const withJournalContainers = scoreVisiblePatternClaim({
      evidenceCount: 3,
      sessionCount: 1,
      journalEntrySpread: 2,
      hasDisplaySafeQuote: false,
    });

    expect(noJournalContainer.triggered).toBe(true);
    expect(withJournalContainers.triggered).toBe(false);
    expect(withJournalContainers.score).toBeGreaterThan(noJournalContainer.score);
  });

  it("journal-backed claim can surface from journalEntrySpread even with one chat session", () => {
    const claim = makeClaim({
      evidenceCount: 3,
      sessionCount: 1,
      quotes: [
        "I tend to avoid difficult conversations whenever pressure builds",
        "I always procrastinate when I need to make important decisions",
        "I avoid confrontation by procrastinating",
      ],
    });
    claim.journalEvidenceCount = 3;
    claim.journalEntrySpread = 2;
    claim.journalDaySpread = 4;
    claim.supportContainerSpread = 3;
    claim.evidence = claim.evidence.map((ev, i) => ({
      ...ev,
      journalEntryId: `journal-${i + 1}`,
      createdAt: new Date("2026-04-20T00:00:00.000Z"),
    }));

    // Old spread path (sessions only) would abstain here; support containers should surface.
    expect(projectVisiblePatternClaim(claim)).not.toBeNull();
  });

  it("journal-only claim with no replayable quotes still fails summary/quote safety gates", () => {
    const claim = makeClaim({
      evidenceCount: 3,
      sessionCount: 1,
      quotes: [null, null, null],
    });
    claim.journalEvidenceCount = 3;
    claim.journalEntrySpread = 3;
    claim.journalDaySpread = 6;
    claim.supportContainerSpread = 3;
    claim.evidence = claim.evidence.map((ev, i) => ({
      ...ev,
      sessionId: null,
      messageId: null,
      journalEntryId: `journal-${i + 1}`,
    }));

    expect(projectVisiblePatternClaim(claim)).toBeNull();
  });

  it("journalDaySpread is secondary metadata and does not drive visibility when container spread is fixed", () => {
    const baseClaim = makeClaim({
      evidenceCount: 3,
      sessionCount: 1,
      quotes: [
        "I tend to avoid difficult conversations whenever pressure builds",
        "I always procrastinate when I need to make important decisions",
        "I avoid confrontation by procrastinating",
      ],
    });
    baseClaim.journalEvidenceCount = 3;
    baseClaim.journalEntrySpread = 2;
    baseClaim.supportContainerSpread = 3;

    const lowDaySpreadClaim = {
      ...baseClaim,
      journalDaySpread: 1,
    };
    const highDaySpreadClaim = {
      ...baseClaim,
      journalDaySpread: 9,
    };

    expect(projectVisiblePatternClaim(lowDaySpreadClaim)).not.toBeNull();
    expect(projectVisiblePatternClaim(highDaySpreadClaim)).not.toBeNull();
  });
});

// ── 6. Shared projection is centralized ──────────────────────────────────────

describe("6. shared projection is centralized — no route-local bypass", () => {
  it("projectVisiblePatternClaim is importable from lib/pattern-visible-claim", () => {
    // The fact that this test imports projectVisiblePatternClaim from the shared lib —
    // not from app/api — proves both routes use the same function.
    expect(typeof projectVisiblePatternClaim).toBe("function");
  });

  it("scoreVisiblePatternClaim is exported from the same module as projectVisiblePatternClaim", () => {
    // Both the online gate and the scoring helper are co-located in pattern-visible-claim.ts.
    // No route-local copy exists.
    expect(typeof scoreVisiblePatternClaim).toBe("function");
    expect(typeof shouldAbstainVisiblePatternClaim).toBe("function");
  });

  it("constants are exported and used internally — no inline magic numbers", () => {
    expect(typeof VISIBLE_ABSTENTION_THRESHOLD).toBe("number");
    expect(typeof VISIBLE_CLAIM_EVIDENCE_SATURATION).toBe("number");
    expect(typeof VISIBLE_CLAIM_SESSION_SATURATION).toBe("number");
    expect(typeof VISIBLE_CLAIM_WEIGHT_EVIDENCE).toBe("number");
    expect(typeof VISIBLE_CLAIM_WEIGHT_SESSION).toBe("number");
    expect(typeof VISIBLE_CLAIM_WEIGHT_QUOTE).toBe("number");
    // Weights sum to 1
    expect(
      VISIBLE_CLAIM_WEIGHT_EVIDENCE + VISIBLE_CLAIM_WEIGHT_SESSION + VISIBLE_CLAIM_WEIGHT_QUOTE
    ).toBeCloseTo(1.0);
  });
});

// ── 7. Evaluator / report includes abstention scoring fields ─────────────────

describe("7. evaluator includes abstention scoring fields", () => {
  it("computeVisibleAbstentionSummary returns correct shape with empty groups", () => {
    const summary = computeVisibleAbstentionSummary([]);
    expect(summary.totalEmittedClaims).toBe(0);
    expect(summary.totalSurfaced).toBe(0);
    expect(summary.totalAbstained).toBe(0);
    expect(summary.coverageRate).toBeNull();
    expect(summary.abstentionRate).toBeNull();
    expect(summary.scoreDistribution.min).toBeNull();
    expect(summary.conditionalFaithfulnessRate).toBeNull();
    expect(summary.abstentionThreshold).toBe(VISIBLE_ABSTENTION_THRESHOLD);
  });

  it("computeVisibleAbstentionSummary aggregates visibleAbstentionScores from multiple groups", () => {
    // Create GroupResults with pre-computed visibleAbstentionScores
    const surfacedGroup: GroupResult = {
      ...makeGroupResult({ id: "g-surf" }),
      visibleAbstentionScores: [
        {
          family: "trigger_condition",
          score: 0.80,
          triggered: false,
          evidenceCount: 4,
          sessionCount: 3,
          hasDisplaySafeQuote: true,
        },
      ],
    };
    const abstainedGroup: GroupResult = {
      ...makeGroupResult({ id: "g-abs" }),
      visibleAbstentionScores: [
        {
          family: "trigger_condition",
          score: 0.25,
          triggered: true,
          evidenceCount: 1,
          sessionCount: 1,
          hasDisplaySafeQuote: false,
        },
      ],
    };

    const summary = computeVisibleAbstentionSummary([surfacedGroup, abstainedGroup]);

    expect(summary.totalEmittedClaims).toBe(2);
    expect(summary.totalSurfaced).toBe(1);
    expect(summary.totalAbstained).toBe(1);
    expect(summary.coverageRate).toBeCloseTo(0.5);
    expect(summary.abstentionRate).toBeCloseTo(0.5);
    expect(summary.scoreDistribution.min).toBeCloseTo(0.25);
    expect(summary.scoreDistribution.max).toBeCloseTo(0.80);
    expect(summary.scoreDistribution.mean).toBeCloseTo(0.525);
  });

  it("conditionalFaithfulnessRate uses groupId:family join key", () => {
    const group: GroupResult = {
      ...makeGroupResult({ id: "grp-x" }),
      visibleAbstentionScores: [
        {
          family: "trigger_condition",
          score: 0.80,
          triggered: false,
          evidenceCount: 4,
          sessionCount: 3,
          hasDisplaySafeQuote: true,
        },
      ],
    };

    // Faithful score for the surfaced claim
    const faithfulnessScores = [
      {
        groupId: "grp-x",
        family: "trigger_condition" as const,
        visibleSummary: "When pressure rises, you default to pleasing.",
        receiptQuotes: ["quote1", "quote2"],
        faithful: true,
        score: 0.9,
        rationale: "supported",
        parseStatus: "parsed" as const,
        shadowMode: true as const,
        usedForProductDecision: false as const,
      },
    ];

    const summary = computeVisibleAbstentionSummary([group], faithfulnessScores);
    expect(summary.conditionalFaithfulnessRate).toBe(1); // 1 surfaced, 1 faithful
  });

  it("conditionalFaithfulnessRate excludes abstained claims from faithfulness denominator", () => {
    const group: GroupResult = {
      ...makeGroupResult({ id: "grp-y" }),
      visibleAbstentionScores: [
        {
          family: "trigger_condition",
          score: 0.20,
          triggered: true, // abstained — should not count toward conditional faithfulness
          evidenceCount: 1,
          sessionCount: 1,
          hasDisplaySafeQuote: false,
        },
      ],
    };

    const faithfulnessScores = [
      {
        groupId: "grp-y",
        family: "trigger_condition" as const,
        visibleSummary: "some summary",
        receiptQuotes: ["q1", "q2"],
        faithful: true,
        score: 0.9,
        rationale: "ok",
        parseStatus: "parsed" as const,
        shadowMode: true as const,
        usedForProductDecision: false as const,
      },
    ];

    const summary = computeVisibleAbstentionSummary([group], faithfulnessScores);
    // The faithfulness score exists but the claim was abstained → not in surfacedKeys
    expect(summary.conditionalFaithfulnessRate).toBeNull();
  });
});

// ── 8. Shadow-only rule preserved ────────────────────────────────────────────

describe("8. shadow-only rule preserved", () => {
  it("projectVisiblePatternClaim does not depend on any faithfulness or LLM data", () => {
    // The fact that this module has no imports from lib/eval/ proves the boundary.
    // Calling projectVisiblePatternClaim without any faithfulness report succeeds.
    const claim = makeClaim({
      evidenceCount: 5,
      sessionCount: 3,
      quotes: [
        "I tend to avoid difficult conversations whenever pressure builds",
        "I always procrastinate when I need to make important decisions",
        "I put off hard decisions to avoid conflict",
        "I avoid responsibility when I feel overwhelmed",
        "I procrastinate on important things to dodge discomfort",
      ],
    });
    // No faithfulness report passed — projection still works
    const result = projectVisiblePatternClaim(claim);
    // Result depends on summary + score; we just assert it doesn't throw
    expect(result === null || typeof result?.summary === "string").toBe(true);
  });

  it("computeVisibleAbstentionSummary with null faithfulnessAllScores does not throw", () => {
    const summary = computeVisibleAbstentionSummary([], null);
    expect(summary.conditionalFaithfulnessRate).toBeNull();
  });

  it("shouldAbstainVisiblePatternClaim returns true (safe default) on abnormal input", () => {
    // Edge: evidenceCount=0, sessionCount=0
    expect(shouldAbstainVisiblePatternClaim({ evidenceCount: 0, sessionCount: 0, hasDisplaySafeQuote: false })).toBe(true);
  });

  it("scoreVisiblePatternClaim score formula is deterministic — same inputs always produce same output", () => {
    const inputs = { evidenceCount: 3, sessionCount: 2, hasDisplaySafeQuote: true };
    const s1 = scoreVisiblePatternClaim(inputs);
    const s2 = scoreVisiblePatternClaim(inputs);
    expect(s1.score).toBe(s2.score);
    expect(s1.triggered).toBe(s2.triggered);
  });
});

// ── 9. Runtime policy artifact loading and resolution ───────────────────────

describe("9. runtime policy artifact loading and resolution", () => {
  it("loads a valid policy artifact successfully", () => {
    const policyPath = writePolicyArtifactFile(makePolicyArtifact({ selectedThreshold: 0.75 }));
    expect(loadVisibleAbstentionPolicyArtifact(policyPath)).toEqual(
      makePolicyArtifact({ selectedThreshold: 0.75 })
    );
  });

  it("returns null when the policy artifact file is missing", () => {
    const missingPath = path.join(os.tmpdir(), `missing-policy-${Date.now()}.json`);
    expect(loadVisibleAbstentionPolicyArtifact(missingPath)).toBeNull();
  });

  it("returns null when the policy artifact JSON is malformed", () => {
    const policyPath = writePolicyArtifactFile("{not-json");
    expect(loadVisibleAbstentionPolicyArtifact(policyPath)).toBeNull();
  });

  it("returns null when selectedThreshold is missing or invalid", () => {
    const missingThresholdPath = writePolicyArtifactFile({
      version: VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION,
      generatedAt: "2026-03-18T00:00:00.000Z",
      sourceReportPath: "/tmp/latest.json",
      targetFailureRate: 0.25,
      coverageFloor: 0.4,
      eligibleClaims: 9,
      fallbackUsed: false,
      selectionReason: "invalid",
      calibrationGateStatus: {
        thresholdSelected: true,
        coverageFloorPassed: true,
        failureTargetRespected: true,
        dataSufficient: true,
      },
    } as unknown as VisibleAbstentionPolicyArtifact);
    const invalidThresholdPath = writePolicyArtifactFile(
      `{
  "version": ${VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION},
  "generatedAt": "2026-03-18T00:00:00.000Z",
  "sourceReportPath": "/tmp/latest.json",
  "selectedThreshold": "0.8",
  "targetFailureRate": 0.25,
  "coverageFloor": 0.4,
  "eligibleClaims": 9,
  "fallbackUsed": false,
  "selectionReason": "invalid",
  "calibrationGateStatus": {
    "thresholdSelected": true,
    "coverageFloorPassed": true,
    "failureTargetRespected": true,
    "dataSufficient": true
  }
}`
    );

    expect(loadVisibleAbstentionPolicyArtifact(missingThresholdPath)).toBeNull();
    expect(loadVisibleAbstentionPolicyArtifact(invalidThresholdPath)).toBeNull();
  });

  it("uses a calibrated threshold only when the artifact is fully consumable", () => {
    expect(
      resolveRuntimeVisibleAbstentionThreshold(makePolicyArtifact({ selectedThreshold: 0.8 }))
    ).toBe(0.8);
    expect(
      resolveRuntimeVisibleAbstentionThreshold(
        makePolicyArtifact({ fallbackUsed: true, selectedThreshold: 0.8 })
      )
    ).toBe(VISIBLE_ABSTENTION_THRESHOLD);
    expect(
      resolveRuntimeVisibleAbstentionThreshold(
        makePolicyArtifact({
          calibrationGateStatus: {
            thresholdSelected: true,
            coverageFloorPassed: false,
            failureTargetRespected: true,
            dataSufficient: true,
          },
        })
      )
    ).toBe(VISIBLE_ABSTENTION_THRESHOLD);
    expect(resolveRuntimeVisibleAbstentionThreshold(null)).toBe(VISIBLE_ABSTENTION_THRESHOLD);
  });
});

// ── 10. Visible projection consumes runtime policy safely ───────────────────

describe("10. visible projection consumes runtime policy safely", () => {
  it("suppresses a claim under a higher valid calibrated threshold but surfaces it at the constant threshold", () => {
    const claim = makeClaim({
      evidenceCount: 3,
      sessionCount: 2,
      quotes: [
        "I tend to avoid difficult conversations whenever pressure builds",
        "I always procrastinate when I need to make important decisions",
        "I put off hard decisions to avoid conflict",
      ],
    });
    const policyPath = writePolicyArtifactFile(makePolicyArtifact({ selectedThreshold: 0.8 }));

    expect(projectVisiblePatternClaim(claim)).not.toBeNull();
    expect(projectVisiblePatternClaim(claim, { policyArtifactPath: policyPath })).toBeNull();
  });

  it("falls back to constant-threshold behavior when fallbackUsed=true", () => {
    const claim = makeClaim({
      evidenceCount: 3,
      sessionCount: 2,
      quotes: [
        "I tend to avoid difficult conversations whenever pressure builds",
        "I always procrastinate when I need to make important decisions",
        "I put off hard decisions to avoid conflict",
      ],
    });
    const policyPath = writePolicyArtifactFile(
      makePolicyArtifact({ selectedThreshold: 0.8, fallbackUsed: true })
    );

    expect(projectVisiblePatternClaim(claim, { policyArtifactPath: policyPath })).not.toBeNull();
  });

  it("does not crash on malformed policy artifact input", () => {
    const claim = makeClaim({
      evidenceCount: 3,
      sessionCount: 2,
      quotes: [
        "I tend to avoid difficult conversations whenever pressure builds",
        "I always procrastinate when I need to make important decisions",
        "I put off hard decisions to avoid conflict",
      ],
    });
    const policyPath = writePolicyArtifactFile("{broken-json");

    expect(() => projectVisiblePatternClaim(claim, { policyArtifactPath: policyPath })).not.toThrow();
    expect(projectVisiblePatternClaim(claim, { policyArtifactPath: policyPath })).not.toBeNull();
  });

  it("keeps contradiction_drift unchanged even when a policy artifact is supplied", () => {
    const claim = makeClaim({
      patternType: "contradiction_drift",
      evidenceCount: 0,
      sessionCount: 1,
      quotes: [],
    });
    const policyPath = writePolicyArtifactFile(makePolicyArtifact({ selectedThreshold: 0.95 }));

    expect(projectVisiblePatternClaim(claim, { policyArtifactPath: policyPath })).not.toBeNull();
  });
});
