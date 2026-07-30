import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live canonical Explore proposal browser regression source guard", () => {
  it("registers the new Playwright regression in the repo test match", () => {
    const config = read("playwright.config.ts");
    expect(config).toContain("live-canonical-explore-proposal");
  });

  it("uses the baseline tea seed without seeding proposal rows or special message headers", () => {
    const script = read("scripts/live-canonical-explore-proposal.playwright.ts");
    const fixture = read("lib/__tests__/helpers/live-tea-explore-proposal-fixture.ts");
    expect(script).toContain("seedLiveTeaMapUnderstanding");
    expect(script).toContain("LIVE_TEA_CORRECTION_MESSAGE");
    expect(script).toContain("referenceItem.count");
    expect(script).toContain("userMapConclusion.count");
    expect(script).toContain("canonicalConcept.count");
    expect(fixture).toContain("referenceItem.create");
    expect(fixture).not.toContain("userMapConclusion.create");
    expect(script).toContain('data-free-explore-send-handler');
    expect(script).not.toContain("seedPhase6CanonicalProposal");
    expect(script).not.toContain("ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER");
    expect(script).not.toContain("ORVEK_PHASE6_CREATION_ATTEMPT_HEADER");
    expect(script).not.toContain('page.route("**/api/message"');
  });

  it("asserts the Explore proposal review UI before publication", () => {
    const script = read("scripts/live-canonical-explore-proposal.playwright.ts");
    expect(script).toContain("explore-proposed-movement");
    expect(script).toContain("explore-proposal-rationale");
    expect(script).toContain("explore-proposal-evidence");
    expect(script).toContain("explore-publish-movement");
    expect(script).toContain("A proposed model update is ready for review.");
  });
});
