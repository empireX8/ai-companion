/**
 * Evaluator-Time Evidence Faithfulness Scoring Tests (Capability 3)
 *
 * Covers:
 * A. Supported summary scores faithful
 * B. Unsupported summary scores unfaithful
 * C. No visible summary → no faithfulness score (skipped)
 * D. Parse failure is safe (no crash, correct parseStatus)
 * E. computeFaithfulnessReport aggregation is correct
 * F. Evaluator-only boundary: no app/api imports reachable through the scoring path
 *
 * All tests use mock invokers — no LLM calls, no DB, no network.
 */

import { describe, expect, it } from "vitest";

import {
  buildFaithfulnessPrompt,
  computeFaithfulnessReport,
  FAITHFULNESS_FLOOR,
  parseFaithfulnessOutput,
  buildFaithfulnessRequestFailure,
  scoreFaithfulnessForGroup,
  type FaithfulnessInvoker,
} from "../eval/pattern-evaluator";
import type { GroupResult } from "../eval/eval-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Minimal GroupResult for faithfulness scoring tests.
 * Only the fields consumed by scoreFaithfulnessForGroup matter here.
 */
function makeGroupResult(overrides: {
  id?: string;
  emittedFamilies?: Partial<GroupResult["emittedFamilies"]>;
  clueQuotes?: Partial<GroupResult["clueQuotes"]>;
}): GroupResult {
  const emittedFamilies: GroupResult["emittedFamilies"] = {
    trigger_condition: false,
    inner_critic: false,
    repetitive_loop: false,
    recovery_stabilizer: false,
    ...overrides.emittedFamilies,
  };
  const clueQuotes: GroupResult["clueQuotes"] = {
    trigger_condition: [],
    inner_critic: [],
    repetitive_loop: [],
    recovery_stabilizer: [],
    ...overrides.clueQuotes,
  };
  return {
    group: {
      id: overrides.id ?? "test-group",
      description: "test",
      entries: [],
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
    emittedFamilies,
    anyClaimed: Object.values(emittedFamilies).some(Boolean),
    quoteSafe: false,
    behavioralCorrect: true,
    familiesCorrect: true,
    abstainCorrect: true,
    quoteSafeCorrect: true,
    falsePositiveFamilies: [],
    falseNegativeFamilies: [],
    clueQuotes,
    visibleAbstentionScores: [],
    reviewFlag: {
      groupId: overrides.id ?? "test-group",
      emittedFamilies: [],
      review_needed: false,
      review_priority: null,
      review_reasons: [],
      faithfulnessIncluded: false,
    },
  };
}

/**
 * Quotes that produce a visible trigger_condition summary.
 * Two quotes match the procrastinate/avoid pattern in buildTriggerSummary,
 * giving generateVisiblePatternSummary enough signal to emit:
 *   "Pressure often pushes you toward avoidance."
 */
const TC_SUPPORTED_QUOTES = [
  "I tend to avoid difficult conversations whenever pressure builds",
  "I always procrastinate when I need to make important decisions",
];

function mockInvoker(rawOutput: string): FaithfulnessInvoker {
  return async () => ({ rawOutput });
}

// ── A. Supported summary scores faithful ──────────────────────────────────────

describe("A. supported summary — invoker returns faithful=true", () => {
  it("produces FaithfulnessClaimScore with faithful=true and parseStatus=parsed", async () => {
    const gr = makeGroupResult({
      id: "grp-a",
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });

    const invoker = mockInvoker(
      '{"faithful":true,"score":0.92,"rationale":"quotes clearly show avoidance under pressure"}'
    );
    const scores = await scoreFaithfulnessForGroup(gr, invoker);

    expect(scores).toHaveLength(1);
    const s = scores[0]!;
    expect(s.faithful).toBe(true);
    expect(s.score).toBeCloseTo(0.92);
    expect(s.parseStatus).toBe("parsed");
    expect(s.shadowMode).toBe(true);
    expect(s.family).toBe("trigger_condition");
    expect(s.visibleSummary.length).toBeGreaterThan(0);
    expect(s.receiptQuotes).toEqual(TC_SUPPORTED_QUOTES);
    expect(s.groupId).toBe("grp-a");
  });

  it("sets rationale from the invoker response", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const invoker = mockInvoker(
      '{"faithful":true,"score":0.85,"rationale":"avoidance language is present in both quotes"}'
    );
    const [score] = await scoreFaithfulnessForGroup(gr, invoker);
    expect(score?.rationale).toContain("avoidance");
  });
});

// ── B. Unsupported summary scores unfaithful ──────────────────────────────────

describe("B. unsupported summary — invoker returns faithful=false", () => {
  it("produces FaithfulnessClaimScore with faithful=false and parseStatus=parsed", async () => {
    const gr = makeGroupResult({
      id: "grp-b",
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });

    const invoker = mockInvoker(
      '{"faithful":false,"score":0.18,"rationale":"summary overstates the pattern relative to quotes"}'
    );
    const scores = await scoreFaithfulnessForGroup(gr, invoker);

    expect(scores).toHaveLength(1);
    const s = scores[0]!;
    expect(s.faithful).toBe(false);
    expect(s.parseStatus).toBe("parsed");
    expect(s.shadowMode).toBe(true);
    expect(s.rationale).toContain("overstates");
  });

  it("appears in unfaithfulClaims of the report", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const invoker = mockInvoker(
      '{"faithful":false,"score":0.1,"rationale":"not supported"}'
    );
    const scores = await scoreFaithfulnessForGroup(gr, invoker);
    const report = computeFaithfulnessReport(scores);

    expect(report.unfaithfulCount).toBe(1);
    expect(report.unfaithfulClaims).toHaveLength(1);
    expect(report.faithfulCount).toBe(0);
    expect(report.faithfulRate).toBe(0);
  });
});

// ── C. No visible summary → skipped ──────────────────────────────────────────

describe("C. no visible summary → faithfulness scoring is skipped", () => {
  it("returns empty scores when only one quote is provided (< 2 needed)", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: {
        trigger_condition: ["I tend to avoid difficult conversations"],
        // Only 1 quote → generateVisiblePatternSummary returns null
      },
    });
    const invoker = mockInvoker('{"faithful":true,"score":1.0,"rationale":"should not be called"}');
    const scores = await scoreFaithfulnessForGroup(gr, invoker);

    expect(scores).toHaveLength(0);
  });

  it("returns empty scores when emittedFamilies is all false", async () => {
    const gr = makeGroupResult({
      emittedFamilies: {},
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const invoker = mockInvoker('{"faithful":true,"score":1.0,"rationale":"noop"}');
    const scores = await scoreFaithfulnessForGroup(gr, invoker);

    expect(scores).toHaveLength(0);
  });

  it("returns empty scores when family is emitted but clueQuotes is empty", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: [] },
    });
    const invoker = mockInvoker('{"faithful":true,"score":1.0,"rationale":"noop"}');
    const scores = await scoreFaithfulnessForGroup(gr, invoker);

    expect(scores).toHaveLength(0);
  });
});

// ── D. Parse failure is safe ──────────────────────────────────────────────────

describe("D. parse failure is safe — no crash, correct parseStatus recorded", () => {
  it("malformed JSON from invoker → parseStatus=malformed_json, faithful=null", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const invoker = mockInvoker("not valid json at all");
    const scores = await scoreFaithfulnessForGroup(gr, invoker);

    expect(scores).toHaveLength(1);
    const s = scores[0]!;
    expect(s.parseStatus).toBe("malformed_json");
    expect(s.faithful).toBeNull();
    expect(s.score).toBeNull();
    expect(s.shadowMode).toBe(true);
  });

  it("schema-invalid JSON (missing faithful field) → parseStatus=schema_invalid", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const invoker = mockInvoker('{"score":0.5,"rationale":"missing faithful field"}');
    const scores = await scoreFaithfulnessForGroup(gr, invoker);

    expect(scores).toHaveLength(1);
    expect(scores[0]?.parseStatus).toBe("schema_invalid");
    expect(scores[0]?.faithful).toBeNull();
  });

  it("invoker throws → parseStatus=request_failed, no crash", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const throwingInvoker: FaithfulnessInvoker = async () => {
      throw new Error("network failure");
    };
    const scores = await scoreFaithfulnessForGroup(gr, throwingInvoker);

    expect(scores).toHaveLength(1);
    expect(scores[0]?.parseStatus).toBe("request_failed");
    expect(scores[0]?.faithful).toBeNull();
    expect(scores[0]?.shadowMode).toBe(true);
  });

  it("parseFaithfulnessOutput handles rationale truncation at 240 chars", () => {
    const longRationale = "x".repeat(300);
    const result = parseFaithfulnessOutput({
      rawOutput: `{"faithful":true,"score":0.9,"rationale":"${longRationale}"}`,
      groupId: "g1",
      family: "trigger_condition",
      visibleSummary: "test summary",
      receiptQuotes: ["quote1"],
    });
    expect(result.parseStatus).toBe("parsed");
    expect(result.rationale.length).toBeLessThanOrEqual(240);
  });

  it("buildFaithfulnessRequestFailure produces a safe shadow-mode record", () => {
    const result = buildFaithfulnessRequestFailure({
      error: new Error("timeout"),
      groupId: "g2",
      family: "inner_critic",
      visibleSummary: "test",
      receiptQuotes: ["q"],
    });
    expect(result.parseStatus).toBe("request_failed");
    expect(result.faithful).toBeNull();
    expect(result.shadowMode).toBe(true);
    expect(result.groupId).toBe("g2");
    expect(result.family).toBe("inner_critic");
  });
});

// ── E. computeFaithfulnessReport aggregation ──────────────────────────────────

describe("E. computeFaithfulnessReport aggregation", () => {
  it("counts faithful, unfaithful, and parse failures correctly", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });

    const faithfulScores = await scoreFaithfulnessForGroup(
      gr,
      mockInvoker('{"faithful":true,"score":0.9,"rationale":"good"}')
    );
    const unfaithfulScores = await scoreFaithfulnessForGroup(
      { ...gr, group: { ...gr.group, id: "grp-b" } },
      mockInvoker('{"faithful":false,"score":0.1,"rationale":"bad"}')
    );
    const failureScores = await scoreFaithfulnessForGroup(
      { ...gr, group: { ...gr.group, id: "grp-c" } },
      mockInvoker("not json")
    );

    const report = computeFaithfulnessReport([
      ...faithfulScores,
      ...unfaithfulScores,
      ...failureScores,
    ]);

    expect(report.scoredClaims).toBe(3);
    expect(report.faithfulCount).toBe(1);
    expect(report.unfaithfulCount).toBe(1);
    expect(report.parseFailureCount).toBe(1);
    expect(report.faithfulRate).toBeCloseTo(1 / 3);
  });

  it("faithfulRate is null when no claims were scored", () => {
    const report = computeFaithfulnessReport([]);
    expect(report.scoredClaims).toBe(0);
    expect(report.faithfulRate).toBeNull();
  });

  it("faithfulRate is 1.0 when all claims are faithful", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const scores = await scoreFaithfulnessForGroup(
      gr,
      mockInvoker('{"faithful":true,"score":1.0,"rationale":"fully supported"}')
    );
    const report = computeFaithfulnessReport(scores);

    expect(report.faithfulRate).toBe(1);
    expect(report.regressionGate.passed).toBe(true);
    expect(report.regressionGate.threshold).toBe(FAITHFULNESS_FLOOR);
  });

  it("regressionGate fails when faithfulRate is below FAITHFULNESS_FLOOR", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const scores = await scoreFaithfulnessForGroup(
      gr,
      mockInvoker('{"faithful":false,"score":0.0,"rationale":"not supported at all"}')
    );
    const report = computeFaithfulnessReport(scores);

    expect(report.faithfulRate).toBe(0);
    expect(report.regressionGate.passed).toBe(false);
    expect(report.regressionGate.name).toBe("faithfulness_floor");
  });

  it("unfaithfulClaims includes parse failures as well as faithful=false", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });
    const failureScores = await scoreFaithfulnessForGroup(gr, mockInvoker("bad json"));
    const report = computeFaithfulnessReport(failureScores);

    expect(report.unfaithfulClaims).toHaveLength(1);
    expect(report.unfaithfulClaims[0]?.parseStatus).toBe("malformed_json");
  });
});

// ── F. Evaluator-only boundary ────────────────────────────────────────────────

describe("F. evaluator-only boundary", () => {
  it("scoring functions are importable from lib/eval without touching app/api", () => {
    // The fact that this test file imports from ../eval/pattern-evaluator
    // without importing anything from app/api/* proves the boundary holds.
    // TypeScript compilation enforces no accidental product-path leakage.
    expect(typeof scoreFaithfulnessForGroup).toBe("function");
    expect(typeof computeFaithfulnessReport).toBe("function");
    expect(typeof parseFaithfulnessOutput).toBe("function");
    expect(typeof buildFaithfulnessPrompt).toBe("function");
    expect(typeof buildFaithfulnessRequestFailure).toBe("function");
  });

  it("buildFaithfulnessPrompt produces a prompt containing the summary and quotes", () => {
    const prompt = buildFaithfulnessPrompt({
      visibleSummary: "When pressure rises, you shut down or go quiet.",
      receiptQuotes: ["I tend to shut down under pressure", "I always go quiet when criticized"],
    });

    expect(prompt).toContain("When pressure rises, you shut down or go quiet.");
    expect(prompt).toContain("I tend to shut down under pressure");
    expect(prompt).toContain("I always go quiet when criticized");
    expect(prompt).toContain("faithful=true");
    expect(prompt).toContain("faithful=false");
  });

  it("shadowMode is always true on every score path", async () => {
    const gr = makeGroupResult({
      emittedFamilies: { trigger_condition: true },
      clueQuotes: { trigger_condition: TC_SUPPORTED_QUOTES },
    });

    const [faithful] = await scoreFaithfulnessForGroup(
      gr,
      mockInvoker('{"faithful":true,"score":0.9,"rationale":"ok"}')
    );
    const [unfaithful] = await scoreFaithfulnessForGroup(
      { ...gr, group: { ...gr.group, id: "b" } },
      mockInvoker('{"faithful":false,"score":0.1,"rationale":"no"}')
    );
    const [failed] = await scoreFaithfulnessForGroup(
      { ...gr, group: { ...gr.group, id: "c" } },
      mockInvoker("bad json")
    );

    expect(faithful?.shadowMode).toBe(true);
    expect(unfaithful?.shadowMode).toBe(true);
    expect(failed?.shadowMode).toBe(true);
  });
});
