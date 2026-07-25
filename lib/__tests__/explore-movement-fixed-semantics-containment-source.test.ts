import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE,
  UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY,
} from "../explore-movement-fixed-semantics-containment";

const ROOT = join(__dirname, "../..");

function readRepo(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("explore fixed-semantics containment source regression", () => {
  it("removes fixed production prose from the orchestrator executable path", () => {
    const orchestrator = readRepo("lib/explore-grounding-orchestrator.ts");
    expect(orchestrator).not.toContain("stop-point sensitivity after meetings");
    expect(orchestrator).not.toContain("evening stop-point signal after meetings");
    expect(orchestrator).not.toContain(UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE);
    expect(orchestrator).not.toContain(
      UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY
    );
    expect(orchestrator).not.toContain("createExploreMovementProposal");
    expect(orchestrator).toContain('status: "insufficient_evidence"');
    expect(orchestrator).toContain("proposalCreated: false");
  });

  it("keeps unsafe signature detection only in the containment module for app code", () => {
    const containment = readRepo(
      "lib/explore-movement-fixed-semantics-containment.ts"
    );
    const proposal = readRepo("lib/explore-movement-proposal.ts");
    const publishRoute = readRepo(
      "app/api/explore/sessions/[id]/movement-proposals/[proposalId]/publish/route.ts"
    );

    expect(containment).toContain("stop-point sensitivity after meetings");
    expect(containment).toContain("evening stop-point signal after meetings");
    expect(containment).toContain(UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE);
    expect(proposal).toContain("matchesUnsafeFixedExploreMovementSignature");
    expect(proposal).toContain("EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS");
    expect(proposal).not.toContain("stop-point sensitivity after meetings");
    expect(proposal).not.toContain("evening stop-point signal after meetings");
    expect(publishRoute).toContain("EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS");
    expect(publishRoute).toContain('status: "blocked"');
  });

  it("does not alter Explore shell presentation files in this containment slice", () => {
    const changed = execSync("git diff --name-only HEAD && git ls-files --others --exclude-standard", {
      cwd: ROOT,
      encoding: "utf8",
    });
    const shellFiles = [
      "components/orvek-v0/pages/explore.tsx",
      "components/explore/ExploreMovementProposalCard.tsx",
      "components/explore/ExploreConversationReviewStrip.tsx",
    ];
    for (const relativePath of shellFiles) {
      expect(changed).not.toContain(relativePath);
      expect(readRepo(relativePath).length).toBeGreaterThan(0);
    }
  });
});
