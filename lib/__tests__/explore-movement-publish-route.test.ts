import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE } from "../explore-movement-proposal-provenance";
import { EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS } from "../explore-movement-fixed-semantics-containment";

const ROOT = join(__dirname, "../..");
const ROUTE = "app/api/explore/sessions/[id]/movement-proposals/[proposalId]/publish/route.ts";

function readRepo(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("explore movement publish route wiring", () => {
  it("returns controlled 409 JSON for unverified semantic provenance and passes route conversationId", () => {
    const route = readRepo(ROUTE);
    expect(route).toContain("EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE");
    expect(route).toContain("EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS");
    expect(route).toContain('status: "blocked"');
    expect(route).toContain("status: 409");
    expect(route).toContain("conversationId: sessionId");
    expect(route).toContain("publishExploreMovementProposal");

    // Stable identifiers used by the route JSON body.
    expect(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE).toBe(
      "blocked_unverified_semantic_provenance"
    );
    expect(EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS).toBe(
      "blocked_unsafe_fixed_semantics"
    );
  });
});
