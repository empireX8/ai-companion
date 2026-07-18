import { describe, expect, it } from "vitest";

import { createCanonicalFixtureRuntimeData } from "../../components/orvek-v0-canonical/fixture-provider";
import {
  EXPLORE_GROUNDING,
  EXPLORE_MOVEMENT,
  getObject,
} from "../../components/orvek-v0-reference-frozen/reference-data";

/**
 * Structural fixture gate: canonical fixture provider must reproduce the cold
 * authority object graph and composition identities before visual proof.
 */
describe("canonical fixture composition matches cold authority", () => {
  const fixture = createCanonicalFixtureRuntimeData();

  it("resolves the same lead / report / resurfaced identities", () => {
    expect(fixture.today.leadId).toBe("d1");
    expect(fixture.today.reportId).toBe("rep-weekly");
    expect(fixture.today.resurfacedIds).toEqual(["r6", "r5", "r2"]);
    expect(getObject("d1")?.id).toBe(fixture.getObject("d1")?.id);
    expect(fixture.getObject("rep-weekly")?.type).toBe(getObject("rep-weekly")?.type);
  });

  it("reproduces map / timeline / decisions / explore composition ids", () => {
    expect(fixture.mapDefaultSelectedId).toBe("m-claim-1");
    expect(fixture.mapCategories.find((c) => c.id === "patterns")?.ids).toEqual([
      "m-loop-1",
      "m-loop-2",
      "m-loop-3",
    ]);
    expect(fixture.timelineGroups[0]).toEqual({
      heading: "Today",
      ids: ["t1", "t2", "t3", "t4"],
    });
    expect(fixture.decisionListGroups[0]).toEqual({
      heading: "Active",
      ids: ["d1", "d2", "d3"],
    });
    expect(fixture.decisionsDefaultId).toBe("d1");
    expect(fixture.exploreGroundingIds).toEqual(EXPLORE_GROUNDING);
    expect(fixture.exploreMovement).toEqual(EXPLORE_MOVEMENT);
    expect(fixture.exploreQuestionIds).toEqual(["aq-1", "aq-2", "aq-3", "aq-4"]);
    expect(fixture.exploreInvestigationIds).toEqual(["inv-1", "inv-2", "inv-3"]);
  });

  it("marks fixture OrvekDataApi as reference + canonical runtime", () => {
    expect(fixture.orvekDataApi.referenceSurface).toBe(true);
    expect(fixture.orvekDataApi.canonicalRuntime).toBe(true);
    expect(fixture.syncRoutesFromPathname).toBe(false);
  });
});
