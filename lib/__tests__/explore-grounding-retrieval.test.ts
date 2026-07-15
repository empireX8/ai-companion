import { describe, expect, it } from "vitest";

import {
  selectExploreGroundingSources,
  tokenizeForExploreGrounding,
  type ExploreGroundingCandidate,
} from "../explore-grounding-retrieval";

const USER_ID = "user_explore_retrieval_unit";
const CROSS_USER_ID = "user_explore_retrieval_cross";

function candidate(
  overrides: Partial<ExploreGroundingCandidate> & Pick<ExploreGroundingCandidate, "sourceId" | "extract">
): ExploreGroundingCandidate {
  const extract = overrides.extract;
  return {
    sourceType: "journal_entry",
    sourceFamily: "journal_entry",
    userId: USER_ID,
    title: "Candidate",
    tokens: tokenizeForExploreGrounding(extract),
    ...overrides,
    extract,
  };
}

describe("explore grounding retrieval", () => {
  it("tokenizes text and drops short/stop words", () => {
    expect(tokenizeForExploreGrounding("The stop point after meetings")).toEqual([
      "stop",
      "point",
      "meetings",
    ]);
    expect(tokenizeForExploreGrounding("a an to be")).toEqual([]);
    expect(tokenizeForExploreGrounding("Energy-drops!!!")).toEqual(["energy", "drops"]);
  });

  it("selects a mixed VERIFIED and INFERRED set when available", () => {
    const sources = selectExploreGroundingSources({
      userId: USER_ID,
      queryText: "stop point evenings named boundary",
      replyText: "stop point evenings",
      candidates: [
        candidate({
          sourceId: "journal-verified",
          title: "Verified journal",
          extract: "I ignore stop point evenings repeatedly when tired.",
        }),
        candidate({
          sourceId: "pattern-inferred",
          sourceType: "pattern_claim_evidence",
          sourceFamily: "pattern_claim_evidence",
          title: "Inferred pattern",
          extract: "Named boundary matters for recovery energy after work.",
        }),
        candidate({
          sourceId: "weak-context",
          extract: "I bought groceries today and washed dishes.",
        }),
      ],
    });

    const statuses = new Set(sources.map((source) => source.epistemicStatus));
    expect(statuses.has("VERIFIED")).toBe(true);
    expect(statuses.has("INFERRED")).toBe(true);
    expect(sources.map((source) => source.sourceId)).toContain("journal-verified");
    expect(sources.map((source) => source.sourceId)).toContain("pattern-inferred");
    expect(sources.map((source) => source.sourceId)).not.toContain("weak-context");
  });

  it("filters cross-user candidates out of selection", () => {
    const sources = selectExploreGroundingSources({
      userId: USER_ID,
      queryText: "stop point after meetings energy commitments",
      replyText: "stop point after meetings energy commitments",
      candidates: [
        candidate({
          sourceId: "owned-journal",
          extract: "stop point after meetings energy commitments named clearly",
        }),
        candidate({
          sourceId: "cross-user-journal",
          userId: CROSS_USER_ID,
          extract: "stop point after meetings energy commitments named clearly",
        }),
      ],
    });

    expect(sources.every((source) => source.userId === USER_ID)).toBe(true);
    expect(sources.map((source) => source.sourceId)).toContain("owned-journal");
    expect(sources.map((source) => source.sourceId)).not.toContain("cross-user-journal");
  });
});
