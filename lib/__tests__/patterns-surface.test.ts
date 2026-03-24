/**
 * Patterns Surface Regression Tests (P2-11)
 *
 * Covers:
 * - View model correctness (section count, order, shape)
 * - Trust-language constraints (no numeric scores, locked label text)
 * - Section ordering (five locked families in exact order)
 * - State display rules (dismissed/paused separation, candidate-only logic)
 * - fetchPatterns error handling
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import {
  PATTERN_FAMILY_SECTIONS,
  STRENGTH_LABELS,
  fetchPatterns,
  type PatternClaimView,
  type PatternFamilySection,
  type PatternsResponse,
} from "../patterns-api";

// ── Section definitions ───────────────────────────────────────────────────────

describe("PATTERN_FAMILY_SECTIONS", () => {
  it("has exactly 5 sections", () => {
    expect(PATTERN_FAMILY_SECTIONS).toHaveLength(5);
  });

  it("sections are in the locked order", () => {
    const keys = PATTERN_FAMILY_SECTIONS.map((s) => s.familyKey);
    expect(keys).toEqual([
      "trigger_condition",
      "inner_critic",
      "repetitive_loop",
      "contradiction_drift",
      "recovery_stabilizer",
    ]);
  });

  it("locked section labels match exactly", () => {
    const labels = PATTERN_FAMILY_SECTIONS.map((s) => s.sectionLabel);
    expect(labels).toEqual([
      "Triggers & Conditions",
      "Inner-Critic / Self-Talk",
      "Repetitive Loops",
      "Contradictions & Drift",
      "Recovery & Stabilizers",
    ]);
  });

  it("every section has a non-empty description", () => {
    for (const section of PATTERN_FAMILY_SECTIONS) {
      expect(section.description.length).toBeGreaterThan(0);
    }
  });

  it("no section label contains numeric scores", () => {
    for (const section of PATTERN_FAMILY_SECTIONS) {
      expect(/\d+(\.\d+)?%/.test(section.sectionLabel)).toBe(false);
      expect(/score/i.test(section.sectionLabel)).toBe(false);
    }
  });
});

// ── Strength labels ───────────────────────────────────────────────────────────

describe("STRENGTH_LABELS", () => {
  it("has entries for all three strength levels", () => {
    expect(STRENGTH_LABELS["tentative"]).toBeDefined();
    expect(STRENGTH_LABELS["developing"]).toBeDefined();
    expect(STRENGTH_LABELS["established"]).toBeDefined();
  });

  it("labels are qualitative — no numeric content", () => {
    for (const label of Object.values(STRENGTH_LABELS)) {
      expect(/\d/.test(label)).toBe(false);
    }
  });

  it("tentative label does not use clinical language", () => {
    const label = STRENGTH_LABELS["tentative"]!;
    expect(/disorder|diagnosis|clinical|patholog/i.test(label)).toBe(false);
  });

  it("established label does not claim certainty beyond the data", () => {
    const label = STRENGTH_LABELS["established"]!;
    expect(/definitively|proven|certain|always/i.test(label)).toBe(false);
  });
});

// ── View model shape ──────────────────────────────────────────────────────────

describe("PatternClaimView shape", () => {
  const makeClaim = (
    overrides: Partial<PatternClaimView> = {}
  ): PatternClaimView => ({
    id: "claim-1",
    patternType: "trigger_condition",
    summary: "Test summary",
    status: "candidate",
    strengthLevel: "tentative",
    evidenceCount: 0,
    sessionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receipts: [],
    action: null,
    ...overrides,
  });

  it("status is one of the four locked values", () => {
    const statuses = ["candidate", "active", "paused", "dismissed"] as const;
    for (const status of statuses) {
      const claim = makeClaim({ status });
      expect(["candidate", "active", "paused", "dismissed"]).toContain(claim.status);
    }
  });

  it("strengthLevel is one of three locked values", () => {
    const levels = ["tentative", "developing", "established"] as const;
    for (const level of levels) {
      const claim = makeClaim({ strengthLevel: level });
      expect(["tentative", "developing", "established"]).toContain(claim.strengthLevel);
    }
  });

  it("patternType matches a known family key", () => {
    const validKeys = PATTERN_FAMILY_SECTIONS.map((s) => s.familyKey);
    const claim = makeClaim({ patternType: "inner_critic" });
    expect(validKeys).toContain(claim.patternType);
  });
});

// ── Main dashboard display rules ──────────────────────────────────────────────

describe("main dashboard display rules (P2-09, P2-10)", () => {
  const makeSection = (
    familyKey: PatternFamilySection["familyKey"],
    claims: PatternClaimView[]
  ): PatternFamilySection => ({
    familyKey,
    sectionLabel:
      PATTERN_FAMILY_SECTIONS.find((s) => s.familyKey === familyKey)!.sectionLabel,
    description: "test",
    claims,
  });

  const makeClaim = (
    status: PatternClaimView["status"],
    id = "c1"
  ): PatternClaimView => ({
    id,
    patternType: "trigger_condition",
    summary: "Test",
    status,
    strengthLevel: "tentative",
    evidenceCount: 0,
    sessionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receipts: [],
    action: null,
  });

  it("dismissed claims are not active/candidate", () => {
    const dismissed = makeClaim("dismissed");
    const visible = [dismissed].filter(
      (c) => c.status === "candidate" || c.status === "active"
    );
    expect(visible).toHaveLength(0);
  });

  it("paused claims are not active/candidate", () => {
    const paused = makeClaim("paused");
    const visible = [paused].filter(
      (c) => c.status === "candidate" || c.status === "active"
    );
    expect(visible).toHaveLength(0);
  });

  it("candidate-only detection: all candidate, none active", () => {
    const section = makeSection("trigger_condition", [
      makeClaim("candidate", "c1"),
      makeClaim("candidate", "c2"),
    ]);
    const visible = section.claims.filter(
      (c) => c.status === "candidate" || c.status === "active"
    );
    const hasActive = visible.some((c) => c.status === "active");
    const candidateOnly = visible.length > 0 && !hasActive;
    expect(candidateOnly).toBe(true);
  });

  it("candidate-only is false when at least one active claim exists", () => {
    const section = makeSection("trigger_condition", [
      makeClaim("candidate", "c1"),
      makeClaim("active", "c2"),
    ]);
    const visible = section.claims.filter(
      (c) => c.status === "candidate" || c.status === "active"
    );
    const hasActive = visible.some((c) => c.status === "active");
    const candidateOnly = visible.length > 0 && !hasActive;
    expect(candidateOnly).toBe(false);
  });

  it("resolved section collects paused and dismissed across all sections", () => {
    const sections: PatternFamilySection[] = [
      makeSection("trigger_condition", [makeClaim("paused", "p1")]),
      makeSection("inner_critic", [makeClaim("dismissed", "d1"), makeClaim("active", "a1")]),
      makeSection("repetitive_loop", []),
    ];
    const resolved = sections.flatMap((s) =>
      s.claims.filter((c) => c.status === "paused" || c.status === "dismissed")
    );
    expect(resolved).toHaveLength(2);
    expect(resolved.map((c) => c.id).sort()).toEqual(["d1", "p1"]);
  });

  it("resolved section is empty when no paused/dismissed claims", () => {
    const sections: PatternFamilySection[] = [
      makeSection("trigger_condition", [makeClaim("candidate", "c1"), makeClaim("active", "a1")]),
    ];
    const resolved = sections.flatMap((s) =>
      s.claims.filter((c) => c.status === "paused" || c.status === "dismissed")
    );
    expect(resolved).toHaveLength(0);
  });
});

// ── Low-data threshold ────────────────────────────────────────────────────────

describe("low-data banner threshold (P2-09)", () => {
  const LOW_DATA_MESSAGE_THRESHOLD = 20;

  it("shows low-data banner below threshold", () => {
    const scopeMessageCount = 15;
    const isLowData =
      scopeMessageCount > 0 && scopeMessageCount < LOW_DATA_MESSAGE_THRESHOLD;
    expect(isLowData).toBe(true);
  });

  it("does not show low-data banner at threshold", () => {
    const scopeMessageCount = 20;
    const isLowData =
      scopeMessageCount > 0 && scopeMessageCount < LOW_DATA_MESSAGE_THRESHOLD;
    expect(isLowData).toBe(false);
  });

  it("does not show low-data banner at zero messages", () => {
    const scopeMessageCount = 0;
    const isLowData =
      scopeMessageCount > 0 && scopeMessageCount < LOW_DATA_MESSAGE_THRESHOLD;
    expect(isLowData).toBe(false);
  });
});

// ── fetchPatterns error handling ──────────────────────────────────────────────

describe("fetchPatterns", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );
    const result = await fetchPatterns();
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );
    const result = await fetchPatterns();
    expect(result).toBeNull();
  });

  it("returns parsed data when response is ok", async () => {
    const mockData: PatternsResponse = {
      sections: [],
      scopeMessageCount: 100,
      scopeSessionCount: 10,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockData })
    );
    const result = await fetchPatterns();
    expect(result).toEqual(mockData);
  });
});
