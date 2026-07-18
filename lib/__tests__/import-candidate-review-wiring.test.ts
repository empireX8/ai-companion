import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Provider-surface and wiring proofs for DB-backed import review.
 * Mutation proofs live in import-candidate-review.test.ts (isolated mocks).
 */

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("canonical live import review wiring", () => {
  it("hybrid workbench overrides composition seed importReview with live fetch", () => {
    const hybrid = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    expect(hybrid).toContain("fetchImportReviewCandidates");
    expect(hybrid).toContain("importReview");
    expect(hybrid).toMatch(/Override any composition\/seed importReview/);
  });

  it("Import overlay never injects REFERENCE_IMPORT_CANDIDATES on live/canonical", () => {
    const overlays = readSource("components/orvek-v0/overlays.tsx");
    expect(overlays).toContain("isReferenceFixture");
    expect(overlays).toContain("decideImportReviewCandidate");
    expect(overlays).toMatch(
      /Live\/canonical must supply the same shape via OrvekDataApi\.importReview/,
    );
    // Seed fallback only under referenceSurface
    expect(overlays).toMatch(
      /const candidates = isReferenceFixture[\s\S]*REFERENCE_IMPORT_CANDIDATES/,
    );
  });

  it("production query requires IMPORTED_ARCHIVE provenance (no title guessing)", () => {
    const query = readSource("lib/import-candidate-review-query.ts");
    expect(query).toContain('origin: "IMPORTED_ARCHIVE"');
    expect(query).not.toContain("dev-exact-rt");
    expect(query).toContain("ReferenceItem");
    expect(query).toContain("ContradictionNode");
  });

  it("accept path does not create or delete PatternClaim rows", () => {
    const actions = readSource("lib/import-candidate-review-actions.ts");
    expect(actions).not.toMatch(/patternClaim\.(create|delete|update)/);
    expect(actions).toContain("Never mutates PatternClaim");
  });

  it("provider destinations for accepted objects remain the existing surfaces", () => {
    // Active references → mind-context / reference list
    const mind = readSource("lib/mind-context-surface.ts");
    expect(mind).toContain("/api/reference/list?status=active");

    // Open contradictions → contradiction surface eligible statuses
    const surface = readSource("lib/contradiction-surface.ts");
    expect(surface).toContain('"open"');
    expect(surface).toContain("TOP_ELIGIBLE_STATUSES");
  });
});

describe("fixture routes remain seed-capable", () => {
  it("frozen reference fixture provider keeps referenceSurface true", () => {
    const fixture = readSource(
      "components/orvek-v0-canonical/fixture-provider.ts",
    );
    expect(fixture).toMatch(/referenceSurface:\s*true/);
  });
});
