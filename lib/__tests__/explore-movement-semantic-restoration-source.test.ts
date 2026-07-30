import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EXPLORE_MOVEMENT_MAX_RETRIES,
  EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS,
  isExploreMovementSemanticEnabled,
} from "../explore-movement-live-provider-adapters";
import {
  UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE,
  UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY,
} from "../explore-movement-fixed-semantics-containment";

const ROOT = join(__dirname, "../..");

function readRepo(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("explore movement semantic restoration source assertions", () => {
  it("keeps production gate default off and provider budget at two attempts / zero retries", () => {
    expect(isExploreMovementSemanticEnabled({})).toBe(false);
    expect(EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS).toBe(2);
    expect(EXPLORE_MOVEMENT_MAX_RETRIES).toBe(0);

    const adapters = readRepo("lib/explore-movement-live-provider-adapters.ts");
    expect(adapters).toContain("ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED");
    expect(adapters).toContain("EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS = 2");
    expect(adapters).toContain("EXPLORE_MOVEMENT_MAX_RETRIES = 0");
    expect(adapters).not.toContain("continuationAllowed: true,\n    errorMessage: null,\n    // auto");
  });

  it("does not hardcode fixed production movement prose into semantic modules", () => {
    const files = [
      "lib/explore-grounding-orchestrator.ts",
      "lib/explore-movement-semantic-adjudicator.ts",
      "lib/explore-movement-semantic-contract.ts",
      "lib/explore-movement-live-provider-adapters.ts",
      "lib/explore-movement-proposal-provenance.ts",
    ];
    for (const relativePath of files) {
      const source = readRepo(relativePath);
      expect(source).not.toContain(UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE);
      expect(source).not.toContain(UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY);
      expect(source).not.toContain(
        "Possible model movement from Explore: evening stop-point signal after meetings."
      );
    }
  });

  it("does not invent an auto-PASS production referee", () => {
    const adjudicator = readRepo("lib/explore-movement-semantic-adjudicator.ts");
    const adapters = readRepo("lib/explore-movement-live-provider-adapters.ts");
    expect(adjudicator).toContain("runObjectivityRefereeSafely");
    expect(adjudicator).not.toContain('outcome: "PASS" as const');
    expect(adapters).toContain("createExploreMovementObjectivityReferee");
    expect(adapters).not.toContain("auto-PASS");
    expect(adapters).not.toContain("autoPass");
  });

  it("preserves Explore shell and navigation sources", () => {
    const changed = execSync(
      "git diff --name-only HEAD && git ls-files --others --exclude-standard",
      {
        cwd: ROOT,
        encoding: "utf8",
      }
    );
    // ExploreMovementProposalCard may change for live proposal review surfacing
    // (rationale/evidence/Publish). Keep adjacent shell strips untouched.
    const shellFiles = [
      "components/orvek-v0/pages/explore.tsx",
      "components/explore/ExploreConversationReviewStrip.tsx",
      "components/explore/ExploreModelMovementStrip.tsx",
    ];
    for (const relativePath of shellFiles) {
      expect(changed).not.toContain(relativePath);
    }
  });

  it("does not add schema or migrations", () => {
    const changed = execSync(
      "git diff --name-only HEAD && git ls-files --others --exclude-standard",
      {
        cwd: ROOT,
        encoding: "utf8",
      }
    );
    expect(changed).not.toMatch(/prisma\/schema\.prisma/);
    expect(changed).not.toMatch(/prisma\/migrations\//);
  });
});
