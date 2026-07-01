import { describe, expect, it } from "vitest";

import {
  buildInspectorSelection,
  isInspectorSelectableObjectType,
  parseSelectableObjectFromHref,
  resolveActiveModelUpdateId,
  resolveInspectorSourceSurfaceFromPathname,
  shouldClearInspectorSelectionOnNavigation,
} from "../inspector-selection";

describe("inspector-selection helpers", () => {
  it("builds lightweight selection without storing backend objects", () => {
    const selection = buildInspectorSelection({
      objectType: "usermap_conclusion",
      objectId: "umc-1",
      title: " Recovery pattern ",
      sourceSurface: "map",
    });

    expect(selection).toEqual({
      selectedObjectType: "usermap_conclusion",
      selectedObjectId: "umc-1",
      selectedModelUpdateId: null,
      selectedTitle: "Recovery pattern",
      sourceSurface: "map",
    });
  });

  it("normalizes model_update ids into selectedModelUpdateId", () => {
    const selection = buildInspectorSelection({
      objectType: "model_update",
      objectId: "mu-1",
      sourceSurface: "today",
    });

    expect(selection?.selectedModelUpdateId).toBe("mu-1");
    expect(resolveActiveModelUpdateId(selection)).toBe("mu-1");
  });

  it("accepts model_goal as a published-safe selector type", () => {
    const selection = buildInspectorSelection({
      objectType: "model_goal",
      objectId: "goal-m-goal-1",
      title: "Build Orvek into a private intelligence system",
      sourceSurface: "map",
    });

    expect(selection).toEqual({
      selectedObjectType: "model_goal",
      selectedObjectId: "goal-m-goal-1",
      selectedModelUpdateId: null,
      selectedTitle: "Build Orvek into a private intelligence system",
      sourceSurface: "map",
    });
    expect(isInspectorSelectableObjectType("model_goal")).toBe(true);
  });

  it("rejects unsupported object types and blank ids", () => {
    expect(
      buildInspectorSelection({
        objectType: "investigation" as "usermap_conclusion",
        objectId: "inv-1",
      })
    ).toBeNull();
    expect(
      buildInspectorSelection({
        objectType: "pattern_claim",
        objectId: "   ",
      })
    ).toBeNull();
    expect(isInspectorSelectableObjectType("candidate")).toBe(false);
  });

  it("parses public-safe hrefs into selectable objects", () => {
    expect(parseSelectableObjectFromHref("/your-map/umc-1")).toEqual({
      objectType: "usermap_conclusion",
      objectId: "umc-1",
    });
    expect(parseSelectableObjectFromHref("/patterns/pc-1")).toEqual({
      objectType: "pattern_claim",
      objectId: "pc-1",
    });
    expect(parseSelectableObjectFromHref("/contradictions/cn-1")).toEqual({
      objectType: "contradiction_node",
      objectId: "cn-1",
    });
    expect(parseSelectableObjectFromHref("/library/journal-1")).toBeNull();
    expect(parseSelectableObjectFromHref("/what-changed")).toBeNull();
  });

  it("resolves active model update id from selection variants", () => {
    expect(
      resolveActiveModelUpdateId({
        selectedObjectType: "usermap_conclusion",
        selectedObjectId: "umc-1",
        selectedModelUpdateId: "mu-linked",
        selectedTitle: null,
        sourceSurface: "today",
      })
    ).toBe("mu-linked");

    expect(resolveActiveModelUpdateId(null)).toBeNull();
  });

  it("maps pathnames to inspector source surfaces", () => {
    expect(resolveInspectorSourceSurfaceFromPathname("/")).toBe("today");
    expect(resolveInspectorSourceSurfaceFromPathname("/your-map/abc")).toBe("map");
    expect(resolveInspectorSourceSurfaceFromPathname("/timeline")).toBe("timeline");
    expect(resolveInspectorSourceSurfaceFromPathname("/explore")).toBe("explore");
    expect(resolveInspectorSourceSurfaceFromPathname("/actions")).toBe("decisions");
    expect(resolveInspectorSourceSurfaceFromPathname("/what-changed")).toBe("unknown");
  });

  it("clears selection only when navigating away from the owning surface", () => {
    const todaySelection = buildInspectorSelection({
      objectType: "model_update",
      objectId: "mu-1",
      sourceSurface: "today",
    });

    expect(
      shouldClearInspectorSelectionOnNavigation({
        pathname: "/",
        selection: todaySelection,
      })
    ).toBe(false);

    expect(
      shouldClearInspectorSelectionOnNavigation({
        pathname: "/your-map",
        selection: todaySelection,
      })
    ).toBe(true);

    const mapSelection = buildInspectorSelection({
      objectType: "usermap_conclusion",
      objectId: "umc-1",
      sourceSurface: "map",
    });

    expect(
      shouldClearInspectorSelectionOnNavigation({
        pathname: "/your-map/umc-1",
        selection: mapSelection,
      })
    ).toBe(false);

    expect(
      shouldClearInspectorSelectionOnNavigation({
        pathname: "/import",
        selection: mapSelection,
      })
    ).toBe(true);
  });
});
