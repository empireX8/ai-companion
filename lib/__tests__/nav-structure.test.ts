/**
 * V1 Navigation Structure regression tests (P1-12)
 *
 * Guards the V1 IA constants against accidental drift.
 * Source of truth: lib/v1-nav.ts
 */

import { describe, expect, it } from "vitest";
import {
  V1_CORE_ROUTES,
  V1_SECONDARY_ROUTES,
  V1_HIDDEN_INTERNAL_ROUTES,
  V1_VISIBLE_HREFS,
  V1_HIDDEN_HREFS,
} from "../v1-nav";

// Typed as string[] to avoid TS literal-overlap errors on `as const` arrays.
const coreHrefs: string[] = V1_CORE_ROUTES.map((r) => r.href);
const secondaryHrefs: string[] = V1_SECONDARY_ROUTES.map((r) => r.href);
const hiddenHrefs: string[] = V1_HIDDEN_INTERNAL_ROUTES.map((r) => r.href);

// ── Core routes ───────────────────────────────────────────────────────────────

describe("V1_CORE_ROUTES", () => {
  it("contains exactly five routes", () => {
    expect(V1_CORE_ROUTES).toHaveLength(5);
  });

  it("contains /chat as the first core route", () => {
    expect(V1_CORE_ROUTES[0]).toMatchObject({ href: "/chat", label: "Chat" });
  });

  it("contains /check-ins as a core route", () => {
    expect(coreHrefs).toContain("/check-ins");
  });

  it("contains /timeline as a core route", () => {
    expect(coreHrefs).toContain("/timeline");
  });

  it("contains /patterns as a core route", () => {
    expect(coreHrefs).toContain("/patterns");
  });

  it("contains /history as a core route", () => {
    expect(coreHrefs).toContain("/history");
  });

  it("does not include any hidden internal routes", () => {
    for (const href of coreHrefs) {
      expect(V1_HIDDEN_HREFS.has(href)).toBe(false);
    }
  });

  it("does not include /contradictions", () => {
    expect(coreHrefs).not.toContain("/contradictions");
  });

  it("does not include /projections", () => {
    expect(coreHrefs).not.toContain("/projections");
  });

  it("does not include /references", () => {
    expect(coreHrefs).not.toContain("/references");
  });

  it("does not include /audit", () => {
    expect(coreHrefs).not.toContain("/audit");
  });
});

// ── Secondary routes ──────────────────────────────────────────────────────────

describe("V1_SECONDARY_ROUTES", () => {
  it("contains exactly five routes", () => {
    expect(V1_SECONDARY_ROUTES).toHaveLength(5);
  });

  it("contains /actions as a secondary route", () => {
    expect(secondaryHrefs).toContain("/actions");
  });

  it("contains /context as a secondary route", () => {
    expect(secondaryHrefs).toContain("/context");
  });

  it("contains /memories as a secondary route", () => {
    expect(secondaryHrefs).toContain("/memories");
  });

  it("contains /import as a secondary route", () => {
    expect(secondaryHrefs).toContain("/import");
  });

  it("contains /settings as a secondary route", () => {
    expect(secondaryHrefs).toContain("/settings");
  });

  it("does not include any hidden internal routes", () => {
    for (const href of secondaryHrefs) {
      expect(V1_HIDDEN_HREFS.has(href)).toBe(false);
    }
  });

  it("does not include /contradictions", () => {
    expect(secondaryHrefs).not.toContain("/contradictions");
  });

  it("does not include /projections", () => {
    expect(secondaryHrefs).not.toContain("/projections");
  });
});

// ── Hidden internal routes ────────────────────────────────────────────────────

describe("V1_HIDDEN_INTERNAL_ROUTES", () => {
  it("contains exactly five routes", () => {
    expect(V1_HIDDEN_INTERNAL_ROUTES).toHaveLength(5);
  });

  it("includes /contradictions as hidden", () => {
    expect(hiddenHrefs).toContain("/contradictions");
  });

  it("includes /references as hidden", () => {
    expect(hiddenHrefs).toContain("/references");
  });

  it("includes /audit as hidden", () => {
    expect(hiddenHrefs).toContain("/audit");
  });

  it("includes /evidence as hidden", () => {
    expect(hiddenHrefs).toContain("/evidence");
  });

  it("includes /metrics as hidden", () => {
    expect(hiddenHrefs).toContain("/metrics");
  });

  it("does not include /projections (not in locked hidden list)", () => {
    expect(hiddenHrefs).not.toContain("/projections");
  });

  it("does not include /help (not in locked hidden list)", () => {
    expect(hiddenHrefs).not.toContain("/help");
  });

  it("every hidden route has a reason string", () => {
    for (const route of V1_HIDDEN_INTERNAL_ROUTES) {
      expect(typeof route.reason).toBe("string");
      expect(route.reason.length).toBeGreaterThan(0);
    }
  });
});

// ── Derived sets ──────────────────────────────────────────────────────────────

describe("V1_VISIBLE_HREFS", () => {
  it("contains all core hrefs", () => {
    for (const route of V1_CORE_ROUTES) {
      expect(V1_VISIBLE_HREFS.has(route.href)).toBe(true);
    }
  });

  it("contains all secondary hrefs", () => {
    for (const route of V1_SECONDARY_ROUTES) {
      expect(V1_VISIBLE_HREFS.has(route.href)).toBe(true);
    }
  });

  it("does not contain any hidden hrefs", () => {
    for (const href of V1_HIDDEN_HREFS) {
      expect(V1_VISIBLE_HREFS.has(href)).toBe(false);
    }
  });

  it("has size equal to core + secondary count", () => {
    // Core (5) + Secondary (5) = 10
    expect(V1_VISIBLE_HREFS.size).toBe(
      V1_CORE_ROUTES.length + V1_SECONDARY_ROUTES.length
    );
  });
});

describe("V1_HIDDEN_HREFS", () => {
  it("contains all hidden internal hrefs", () => {
    for (const route of V1_HIDDEN_INTERNAL_ROUTES) {
      expect(V1_HIDDEN_HREFS.has(route.href)).toBe(true);
    }
  });

  it("has size equal to hidden internal routes count", () => {
    expect(V1_HIDDEN_HREFS.size).toBe(V1_HIDDEN_INTERNAL_ROUTES.length);
  });

  it("does not contain any visible hrefs", () => {
    for (const href of V1_VISIBLE_HREFS) {
      expect(V1_HIDDEN_HREFS.has(href)).toBe(false);
    }
  });
});

// ── Disjoint sets invariant ───────────────────────────────────────────────────

describe("visible + hidden sets are disjoint", () => {
  it("no href appears in both visible and hidden sets", () => {
    const intersection = [...V1_VISIBLE_HREFS].filter((h) => V1_HIDDEN_HREFS.has(h));
    expect(intersection).toHaveLength(0);
  });

  it("core and secondary route sets do not overlap", () => {
    const overlap = secondaryHrefs.filter((h) => coreHrefs.includes(h));
    expect(overlap).toHaveLength(0);
  });
});
