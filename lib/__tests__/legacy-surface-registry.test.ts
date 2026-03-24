/**
 * legacy-surface-registry.test.ts — regression protection for legacy surface inventory
 *
 * Guards:
 *   - Registry shape and completeness
 *   - Redirected routes have no rendered copy (verified via file content checks)
 *   - Active legacy routes pass the same trust-safe check
 *   - Old product naming absent from active surfaces
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  REDIRECTED_LEGACY_ROUTES,
  ACTIVE_LEGACY_ROUTES,
  HIDDEN_INTERNAL_ROUTES,
} from "../legacy-surface-registry";
import { isTrustSafe } from "../trust-language";

// ── Registry shape ─────────────────────────────────────────────────────────────

describe("REDIRECTED_LEGACY_ROUTES — registry shape", () => {
  it("has exactly 2 entries (projections list + projections detail)", () => {
    expect(REDIRECTED_LEGACY_ROUTES.length).toBe(2);
  });

  it("all entries have redirectTo set to /patterns", () => {
    for (const route of REDIRECTED_LEGACY_ROUTES) {
      expect(route.redirectTo).toBe("/patterns");
      expect(route.status).toBe("redirected");
    }
  });

  it("covers /projections and /projections/:id", () => {
    const paths = REDIRECTED_LEGACY_ROUTES.map((r) => r.path) as string[];
    expect(paths).toContain("/projections");
    expect(paths).toContain("/projections/:id");
  });
});

describe("ACTIVE_LEGACY_ROUTES — registry shape", () => {
  it("has at least 1 entry", () => {
    expect(ACTIVE_LEGACY_ROUTES.length).toBeGreaterThanOrEqual(1);
  });

  it("all entries have status 'active' and no redirectTo", () => {
    for (const route of ACTIVE_LEGACY_ROUTES) {
      expect(route.status).toBe("active");
      expect(route.redirectTo).toBeNull();
    }
  });

  it("covers /help", () => {
    const paths = ACTIVE_LEGACY_ROUTES.map((r) => r.path) as string[];
    expect(paths).toContain("/help");
  });
});

describe("HIDDEN_INTERNAL_ROUTES — registry shape", () => {
  it("has exactly 5 entries", () => {
    expect(HIDDEN_INTERNAL_ROUTES.length).toBe(5);
  });

  it("covers the locked V1 hidden list", () => {
    const paths = HIDDEN_INTERNAL_ROUTES.map((r) => r.path) as string[];
    expect(paths).toContain("/contradictions");
    expect(paths).toContain("/references");
    expect(paths).toContain("/audit");
    expect(paths).toContain("/evidence");
    expect(paths).toContain("/metrics");
  });
});

// ── Projections redirect — no rendered copy ────────────────────────────────────

const ROOT = resolve(process.cwd());

function readPage(routeRelPath: string): string {
  return readFileSync(
    resolve(ROOT, `app/(root)/(routes)${routeRelPath}/page.tsx`),
    "utf8"
  );
}

/** Strip JS/TS/JSX comments so we test rendered copy only. */
function stripComments(src: string): string {
  return src
    // Block comments (including JSDoc)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Single-line comments
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("projections/page.tsx — is a pure redirect", () => {
  const content = readPage("/projections");
  const stripped = stripComments(content);

  it("contains redirect('/patterns')", () => {
    expect(content).toContain('redirect("/patterns")');
  });

  it("has no rendered JSX elements (no className, no return with JSX)", () => {
    // A pure redirect page calls redirect() and has no className attributes
    expect(content).not.toMatch(/className=/);
  });

  it("has no forecast language in rendered code (comments excluded)", () => {
    expect(stripped.toLowerCase()).not.toMatch(/forecast/);
  });

  it("has no numeric confidence badge", () => {
    expect(content).not.toMatch(/Math\.round/);
  });
});

describe("projections/[id]/page.tsx — is a pure redirect", () => {
  const content = readPage("/projections/[id]");

  it("contains redirect('/patterns')", () => {
    expect(content).toContain('redirect("/patterns")');
  });

  it("has no rendered JSX elements", () => {
    expect(content).not.toMatch(/className=/);
  });
});

// ── Help page — active legacy surface trust checks ─────────────────────────────

describe("help/page.tsx — product naming", () => {
  const content = readPage("/help");
  const stripped = stripComments(content);

  it("uses 'MindLab' (no space)", () => {
    // Must not contain "Mind Lab" (with space) anywhere outside comments
    expect(stripped).not.toMatch(/Mind Lab[^s]/);
  });

  it("does not mention forecast features in rendered copy (comments excluded)", () => {
    expect(stripped.toLowerCase()).not.toMatch(/forecast/);
  });

  it("does not link to /projections", () => {
    expect(content).not.toContain('href="/projections');
  });

  it("does not link to /contradictions (hidden internal route)", () => {
    expect(content).not.toContain('href="/contradictions');
  });
});

// ── Evidence page — no numeric confidence badge ────────────────────────────────

describe("evidence/[id]/page.tsx — no numeric confidence badge", () => {
  const content = readPage("/evidence/[id]");

  it("does not contain Math.round confidence %", () => {
    expect(content).not.toMatch(/Math\.round[^)]*confidence/i);
    expect(content).not.toMatch(/confidence.*Math\.round/i);
  });

  it("does not contain a bare confidence % pattern", () => {
    // Pattern: any % sign immediately after Math.round(...)
    expect(content).not.toMatch(/Math\.round.*100.*%/);
  });
});

// ── Trust-safe check on registry reason strings ────────────────────────────────

describe("Registry reason strings are trust-safe", () => {
  const allReasons = [
    ...REDIRECTED_LEGACY_ROUTES.map((r) => r.reason),
    ...ACTIVE_LEGACY_ROUTES.map((r) => r.reason),
  ];

  for (const reason of allReasons) {
    it(`reason "${reason.slice(0, 50)}..." is trust-safe`, () => {
      expect(isTrustSafe(reason)).toBe(true);
    });
  }
});
