/**
 * Pattern Build Gates (P5-05)
 *
 * These tests act as compile-time guardrails. They fail fast if:
 *  - Locked enum values are added, removed, or renamed without updating
 *    the schema migration + governance docs.
 *  - PatternClaim and ProfileArtifact type sets overlap.
 *  - V1 receipt field contract is broken.
 *  - Bootstrap order changes.
 */

import { describe, expect, it } from "vitest";

import {
  BOOTSTRAP_ORDER,
  PATTERN_CLAIM_OWNS,
  PATTERN_CLAIM_STATUS_VALUES,
  PATTERN_TYPE_VALUES,
  PROFILE_ARTIFACT_OWNS,
  STRENGTH_ADVANCEMENT_THRESHOLDS,
  STRENGTH_LEVEL_VALUES,
  assertBootstrapOrder,
  nextStrengthLevel,
} from "../pattern-claim-boundary";

import {
  ALLOWED_EVIDENCE_MODELS,
  V1_RECEIPT_MIRRORS,
  V1_RECEIPT_MODEL,
  V1_RECEIPT_REQUIRED_FIELDS,
  assertSingleDomain,
} from "../pattern-governance";

// ── PatternType enum lock ─────────────────────────────────────────────────────

describe("PATTERN_TYPE_VALUES (locked enum)", () => {
  it("contains exactly 5 values", () => {
    expect(PATTERN_TYPE_VALUES).toHaveLength(5);
  });

  it("contains all required V1 pattern types", () => {
    const required = [
      "trigger_condition",
      "inner_critic",
      "repetitive_loop",
      "contradiction_drift",
      "recovery_stabilizer",
    ];
    for (const v of required) {
      expect(PATTERN_TYPE_VALUES).toContain(v);
    }
  });

  it("exact value set has not drifted", () => {
    // This test pins the exact set. Any addition/removal fails here.
    expect([...PATTERN_TYPE_VALUES].sort()).toEqual([
      "contradiction_drift",
      "inner_critic",
      "recovery_stabilizer",
      "repetitive_loop",
      "trigger_condition",
    ]);
  });
});

// ── PatternClaimStatus enum lock ──────────────────────────────────────────────

describe("PATTERN_CLAIM_STATUS_VALUES (locked enum)", () => {
  it("contains exactly 4 values", () => {
    expect(PATTERN_CLAIM_STATUS_VALUES).toHaveLength(4);
  });

  it("exact value set has not drifted", () => {
    expect([...PATTERN_CLAIM_STATUS_VALUES].sort()).toEqual([
      "active",
      "candidate",
      "dismissed",
      "paused",
    ]);
  });
});

// ── StrengthLevel enum lock ───────────────────────────────────────────────────

describe("STRENGTH_LEVEL_VALUES (locked enum)", () => {
  it("contains exactly 3 values in ascending order", () => {
    expect(STRENGTH_LEVEL_VALUES).toHaveLength(3);
    expect(STRENGTH_LEVEL_VALUES[0]).toBe("tentative");
    expect(STRENGTH_LEVEL_VALUES[1]).toBe("developing");
    expect(STRENGTH_LEVEL_VALUES[2]).toBe("established");
  });

  it("exact value set has not drifted", () => {
    expect([...STRENGTH_LEVEL_VALUES].sort()).toEqual([
      "developing",
      "established",
      "tentative",
    ]);
  });
});

// ── PatternClaim / ProfileArtifact boundary ───────────────────────────────────

describe("PatternClaim / ProfileArtifact ownership boundary", () => {
  it("PatternClaim owns all PATTERN_TYPE_VALUES", () => {
    for (const v of PATTERN_TYPE_VALUES) {
      expect(PATTERN_CLAIM_OWNS.has(v)).toBe(true);
    }
  });

  it("ProfileArtifact types and PatternClaim types are disjoint", () => {
    for (const v of PATTERN_TYPE_VALUES) {
      expect(PROFILE_ARTIFACT_OWNS.has(v as never)).toBe(false);
    }
  });

  it("ProfileArtifact types are not in PATTERN_TYPE_VALUES", () => {
    for (const v of PROFILE_ARTIFACT_OWNS) {
      expect(PATTERN_TYPE_VALUES).not.toContain(v);
    }
  });
});

// ── Bootstrap order ───────────────────────────────────────────────────────────

describe("BOOTSTRAP_ORDER", () => {
  it("profile_artifact comes before pattern_claim", () => {
    expect(BOOTSTRAP_ORDER[0]).toBe("profile_artifact");
    expect(BOOTSTRAP_ORDER[1]).toBe("pattern_claim");
  });

  it("assertBootstrapOrder passes for correct order", () => {
    expect(() =>
      assertBootstrapOrder("profile_artifact", "pattern_claim")
    ).not.toThrow();
  });

  it("assertBootstrapOrder throws for reversed order", () => {
    expect(() =>
      assertBootstrapOrder("pattern_claim", "profile_artifact")
    ).toThrow();
  });

  it("assertBootstrapOrder throws for same phase", () => {
    expect(() =>
      assertBootstrapOrder("pattern_claim", "pattern_claim")
    ).toThrow();
  });
});

// ── Strength advancement thresholds ──────────────────────────────────────────

describe("STRENGTH_ADVANCEMENT_THRESHOLDS", () => {
  it("has an entry for each strength level", () => {
    for (const level of STRENGTH_LEVEL_VALUES) {
      expect(STRENGTH_ADVANCEMENT_THRESHOLDS[level]).toBeDefined();
    }
  });

  it("evidence required increases from tentative to established", () => {
    const t = STRENGTH_ADVANCEMENT_THRESHOLDS.tentative.evidenceRequired;
    const d = STRENGTH_ADVANCEMENT_THRESHOLDS.developing.evidenceRequired;
    const e = STRENGTH_ADVANCEMENT_THRESHOLDS.established.evidenceRequired;
    expect(t).toBeLessThan(d);
    expect(d).toBeLessThan(e);
  });

  it("minSessionSpread increases from tentative to established", () => {
    const t = STRENGTH_ADVANCEMENT_THRESHOLDS.tentative.minSessionSpread;
    const e = STRENGTH_ADVANCEMENT_THRESHOLDS.established.minSessionSpread;
    expect(t).toBeLessThan(e);
  });

  // ── Exact value pinning (Phase 11) ────────────────────────────────────────
  // Any change to these values requires a deliberate decision + this test update.

  it("tentative thresholds are exactly evidenceRequired=1, minSessionSpread=1", () => {
    expect(STRENGTH_ADVANCEMENT_THRESHOLDS.tentative.evidenceRequired).toBe(1);
    expect(STRENGTH_ADVANCEMENT_THRESHOLDS.tentative.minSessionSpread).toBe(1);
  });

  it("developing thresholds are exactly evidenceRequired=3, minSessionSpread=2", () => {
    expect(STRENGTH_ADVANCEMENT_THRESHOLDS.developing.evidenceRequired).toBe(3);
    expect(STRENGTH_ADVANCEMENT_THRESHOLDS.developing.minSessionSpread).toBe(2);
  });

  it("established thresholds are exactly evidenceRequired=7, minSessionSpread=3", () => {
    expect(STRENGTH_ADVANCEMENT_THRESHOLDS.established.evidenceRequired).toBe(7);
    expect(STRENGTH_ADVANCEMENT_THRESHOLDS.established.minSessionSpread).toBe(3);
  });
});

describe("nextStrengthLevel", () => {
  it("tentative → developing", () => {
    expect(nextStrengthLevel("tentative")).toBe("developing");
  });

  it("developing → established", () => {
    expect(nextStrengthLevel("developing")).toBe("established");
  });

  it("established → null (ceiling)", () => {
    expect(nextStrengthLevel("established")).toBeNull();
  });
});

// ── V1 Receipt model shape ────────────────────────────────────────────────────

describe("V1 receipt model governance", () => {
  it("receipt model is PatternClaimEvidence", () => {
    expect(V1_RECEIPT_MODEL).toBe("PatternClaimEvidence");
  });

  it("receipt mirrors ContradictionEvidence (not a new concept)", () => {
    expect(V1_RECEIPT_MIRRORS).toBe("ContradictionEvidence");
  });

  it("required fields include claimId, source, sessionId, messageId, quote", () => {
    const required = ["claimId", "source", "sessionId", "messageId", "quote"];
    for (const f of required) {
      expect(V1_RECEIPT_REQUIRED_FIELDS).toContain(f);
    }
  });

  it("allowed evidence models are exactly 3", () => {
    expect(ALLOWED_EVIDENCE_MODELS).toHaveLength(3);
  });

  it("allowed evidence model list has not proliferated beyond ContradictionEvidence + PatternClaimEvidence + EvidenceSpan", () => {
    expect([...ALLOWED_EVIDENCE_MODELS].sort()).toEqual([
      "ContradictionEvidence",
      "EvidenceSpan",
      "PatternClaimEvidence",
    ]);
  });
});

// ── UI Domain Guard ───────────────────────────────────────────────────────────

describe("assertSingleDomain", () => {
  it("passes for valid pattern_claim domain guard", () => {
    expect(() =>
      assertSingleDomain({ domain: "pattern_claim", includesProfileArtifacts: false })
    ).not.toThrow();
  });

  it("passes for valid profile_artifact domain guard", () => {
    expect(() =>
      assertSingleDomain({ domain: "profile_artifact", includesPatternClaims: false })
    ).not.toThrow();
  });
});
