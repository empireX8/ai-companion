/**
 * Phase 6 — static honesty proofs for correction path + AI capture wiring.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("canonical Phase 6 — static path honesty", () => {
  it("28. GET canonical concept route does not register or publish", () => {
    const source = read(
      "app/api/current-understanding/canonical-concepts/[id]/route.ts",
    );
    expect(source).toContain("readCanonicalProductConceptForUser");
    expect(source).not.toContain("resolveOrRegisterCanonicalConcept");
    expect(source).not.toContain("publishExploreMovementProposal");
    expect(source).not.toContain("createOrReuseSemanticExploreMovementProposal");
  });

  it("GET current-understanding list does not lazy-register", () => {
    const source = read("app/api/current-understanding/route.ts");
    expect(source).toContain("readCurrentUnderstandingProductProjection");
    expect(source).not.toContain("resolveOrRegisterCanonicalConcept");
    expect(source).not.toContain("publishExploreMovementProposal");
  });

  it("AI capture is recorded before reference memory assembly in /api/message", () => {
    const source = read("app/api/message/route.ts");
    const assemblyStart = source.indexOf("let canonicalPromptBlock");
    expect(assemblyStart).toBeGreaterThan(0);
    const assembly = source.slice(assemblyStart);
    const captureAt = assembly.indexOf("recordCanonicalAiRequestCapture");
    const refMemAt = assembly.indexOf("getRelevantReferenceMemory(");
    const contradictionsAt = assembly.indexOf("getTop3WithOptionalSurfacing({");
    // Deterministic reply must run after full assembly (canonical → ref memory →
    // contradictions → transcript). The allow-check may appear earlier to skip
    // paid embedding queries; assert the reply branch itself is late.
    const deterministicAt = assembly.indexOf("buildPhase6DeterministicReply(");
    expect(captureAt).toBeGreaterThan(0);
    expect(refMemAt).toBeGreaterThan(captureAt);
    expect(contradictionsAt).toBeGreaterThan(captureAt);
    expect(deterministicAt).toBeGreaterThan(contradictionsAt);
    expect(deterministicAt).toBeGreaterThan(assembly.indexOf("Recent transcript:"));
  });

  it("Phase 6 deterministic reply is gated and runs after full context assembly", () => {
    const source = read("app/api/message/route.ts");
    expect(source).toContain("phase6DeterministicReplyAllowed");
    expect(source).toContain("X-Orvek-Explore-Provider");
    expect(source).toContain("phase6-deterministic-local");
    const det = read("lib/canonical-phase6-deterministic-reply.ts");
    expect(det).toContain("ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY");
    // Guard check now delegated to shared seam guard (not duplicated inline).
    expect(det).toContain("isPhase6TestSeamActive");
  });

  it("production Map never applies in-memory corrections for canonical concepts", () => {
    // Live production root mounts orvek-v0-canonical Map (not parallel orvek-v0 pages).
    const map = read("components/orvek-v0-canonical/pages/map.tsx");
    expect(map).toContain("supportsCanonicalProposeCorrection");
    expect(map).toContain("CanonicalProposeCorrectionControls");
    expect(map).toContain("orvek-map-correction-unavailable");
    expect(map).toMatch(
      /supportsCanonicalProposeCorrection\(obj\)[\s\S]*?CanonicalProposeCorrectionControls/,
    );
  });

  it("canonical Explore surfaces correction handoff context without mutating authority", () => {
    const explore = read("components/orvek-v0-canonical/pages/explore.tsx");
    expect(explore).toContain("explore-canonical-correction-context");
    // Banner is driven by in-memory workbench state only (no sessionStorage read).
    expect(explore).toContain("canonicalCorrectionHandoff");
    expect(explore).not.toContain("sessionStorage");
    expect(explore).not.toContain("parseCanonicalCorrectionHandoff");
    expect(explore).not.toContain("publishExploreMovementProposal");
    expect(explore).not.toContain("applyUserMapCorrection");
  });

  it("canonical propose button does not write to sessionStorage", () => {
    const controls = read("components/orvek-v0/durable-user-action-controls.tsx");
    expect(controls).toContain("setCanonicalCorrectionHandoff");
    expect(controls).not.toContain("storeCanonicalCorrectionHandoff");
    expect(controls).not.toContain("sessionStorage");
  });

  it("Phase 6 deterministic reply and creation attempt use the same seam guard", () => {
    const det = read("lib/canonical-phase6-deterministic-reply.ts");
    const creation = read("lib/canonical-phase6-creation-attempt.ts");
    const guard = read("lib/canonical-phase6-test-seam-guard.ts");
    // Both delegate to shared guard
    expect(det).toContain("isPhase6TestSeamActive");
    expect(creation).toContain("isPhase6TestSeamActive");
    // Guard requires all five conditions
    expect(guard).toContain("PHASE6_MANAGE_SERVER");
    expect(guard).toContain("ORVEK_CANONICAL_AI_REQUEST_CAPTURE");
    expect(guard).toContain("ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY");
    expect(guard).toContain("companion_canonical_authority_test");
    expect(guard).toContain("CANONICAL_AUTHORITY_DB_TEST_URL");
  });

  it("EvidencePanel wires canonical propose controls", () => {
    const panel = read("components/orvek-v0-authority/evidence-panel.tsx");
    expect(panel).toContain("CanonicalProposeCorrectionControls");
    expect(panel).toContain("supportsCanonicalProposeCorrection");
  });
});
