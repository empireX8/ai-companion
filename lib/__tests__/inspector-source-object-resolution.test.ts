import { describe, expect, it } from "vitest";

import {
  resolveInspectorSourceObject,
} from "../../lib/inspector-source-object";
import type { InspectorSelection } from "../../lib/inspector-selection";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

function makeObject(overrides: Partial<OrvekObject>): OrvekObject {
  return {
    id: "object-1",
    type: "map-object",
    title: "Object",
    ...overrides,
  };
}

function makeSelection(
  overrides: Partial<InspectorSelection> & Pick<InspectorSelection, "selectedObjectType" | "selectedObjectId">
): InspectorSelection {
  return {
    selectedObjectType: overrides.selectedObjectType,
    selectedObjectId: overrides.selectedObjectId,
    selectedModelUpdateId: overrides.selectedModelUpdateId ?? null,
    selectedTitle: overrides.selectedTitle ?? null,
    sourceSurface: overrides.sourceSurface ?? "map",
  };
}

describe("resolveInspectorSourceObject", () => {
  it("prefers the registered selected object id over the workbench wrapper", () => {
    const direct = makeObject({
      id: "conclusion-1",
      type: "map-object",
      title: "Direct conclusion",
    });
    const wrapper = makeObject({
      id: "row-1",
      type: "map-object",
      title: "Wrapper row",
      inspectorObjectType: "usermap_conclusion",
      inspectorObjectId: "conclusion-1",
    });

    const result = resolveInspectorSourceObject({
      selection: makeSelection({
        selectedObjectType: "usermap_conclusion",
        selectedObjectId: "conclusion-1",
      }),
      selectedWorkbenchId: wrapper.id,
      getObject: (id) => {
        if (id === direct.id) return direct;
        if (id === wrapper.id) return wrapper;
        return undefined;
      },
    });

    expect(result).toBe(direct);
  });

  it("uses the workbench wrapper when it matches the current selection", () => {
    const wrapper = makeObject({
      id: "row-1",
      type: "map-object",
      title: "Wrapper row",
      inspectorObjectType: "usermap_conclusion",
      inspectorObjectId: "conclusion-1",
    });

    const result = resolveInspectorSourceObject({
      selection: makeSelection({
        selectedObjectType: "usermap_conclusion",
        selectedObjectId: "conclusion-1",
      }),
      selectedWorkbenchId: wrapper.id,
      getObject: (id) => (id === wrapper.id ? wrapper : undefined),
    });

    expect(result).toBe(wrapper);
  });

  it("ignores a stale workbench wrapper when it does not match the current selection", () => {
    const staleWrapper = makeObject({
      id: "row-1",
      type: "map-object",
      title: "Stale wrapper",
      inspectorObjectType: "pattern_claim",
      inspectorObjectId: "pattern-1",
    });

    const result = resolveInspectorSourceObject({
      selection: makeSelection({
        selectedObjectType: "usermap_conclusion",
        selectedObjectId: "conclusion-1",
      }),
      selectedWorkbenchId: staleWrapper.id,
      getObject: (id) => (id === staleWrapper.id ? staleWrapper : undefined),
    });

    expect(result).toBeUndefined();
  });
});
