import { describe, expect, it } from "vitest";

import {
  goBackInspectorObject,
  inspectorNavigationCanGoBack,
  pushInspectorObject,
  selectInspectorObject,
  activeModelUpdateIdFromNavigation,
} from "../inspector-navigation-state";
import {
  buildProductionInspectorBridgeSignature,
} from "../inspector-selection";
import {
  resolveBridgedInspectorTab,
  resolveDefaultInspectorTabForObjectType,
  shouldSyncWorkbenchTabToInspector,
} from "../inspector-tab-contract";

describe("inspector tab contract", () => {
  it("defaults model updates to movement and other families to evidence", () => {
    expect(resolveDefaultInspectorTabForObjectType("model_update")).toBe("movement");
    expect(resolveDefaultInspectorTabForObjectType("receipt")).toBe("evidence");
    expect(resolveDefaultInspectorTabForObjectType("usermap_conclusion")).toBe("evidence");
  });

  it("honours explicit workbench tabs and otherwise applies object defaults", () => {
    expect(
      resolveBridgedInspectorTab({
        objectType: "model_update",
        workbenchTab: "evidence",
        explicitWorkbenchTab: true,
      }),
    ).toBe("evidence");

    expect(
      resolveBridgedInspectorTab({
        objectType: "model_update",
        workbenchTab: "evidence",
        explicitWorkbenchTab: false,
      }),
    ).toBe("movement");
  });

  it("syncs workbench tab changes only when the selected object is unchanged", () => {
    expect(
      shouldSyncWorkbenchTabToInspector({
        previousSelectedId: "receipt-1",
        nextSelectedId: "receipt-1",
      }),
    ).toBe(true);

    expect(
      shouldSyncWorkbenchTabToInspector({
        previousSelectedId: "receipt-1",
        nextSelectedId: "receipt-2",
      }),
    ).toBe(false);
  });

  it("dedupes bridge dispatch without encoding tab in the signature", () => {
    const signature = buildProductionInspectorBridgeSignature({
      selectedId: "receipt-1",
      inspectorObjectId: "receipt-1",
      objectType: "receipt",
      availability: "live",
      page: "today",
    });

    expect(signature).toBe("receipt-1:receipt-1:receipt:live:today");
    expect(signature).toBe(
      buildProductionInspectorBridgeSignature({
        selectedId: "receipt-1",
        inspectorObjectId: "receipt-1",
        objectType: "receipt",
        availability: "live",
        page: "today",
      }),
    );
  });
});

describe("inspector navigation state", () => {
  it("pushes into a linked object and restores the prior selection on goBack", () => {
    let state = selectInspectorObject(
      { selection: null, tab: "evidence", history: [] },
      {
        objectType: "receipt",
        objectId: "receipt-pattern-dev-live-evidence-depth-claim",
        title: "Depth-safe receipt",
        sourceSurface: "today",
        availability: "live",
      },
    );

    state = pushInspectorObject(state, {
      objectType: "usermap_conclusion",
      objectId: "dev-live-evidence-depth-conclusion",
      title: "Linked conclusion",
      sourceSurface: "today",
      availability: "live",
      trailLabel: "Viewing related",
    });

    expect(state.selection?.selectedObjectId).toBe("dev-live-evidence-depth-conclusion");
    expect(inspectorNavigationCanGoBack(state)).toBe(true);

    state = goBackInspectorObject(state);

    expect(state.selection?.selectedObjectId).toBe(
      "receipt-pattern-dev-live-evidence-depth-claim",
    );
    expect(state.tab).toBe("evidence");
    expect(inspectorNavigationCanGoBack(state)).toBe(false);
  });

  it("preserves selected model movement after returning from a linked object", () => {
    let state = selectInspectorObject(
      { selection: null, tab: "movement", history: [] },
      {
        objectType: "model_update",
        objectId: "cmrjd6ntp0002qlq3n6hbkh4c",
        modelUpdateId: "cmrjd6ntp0002qlq3n6hbkh4c",
        title: "Fixture movement",
        sourceSurface: "today",
        availability: "live",
        tab: "movement",
      },
    );

    expect(activeModelUpdateIdFromNavigation(state)).toBe("cmrjd6ntp0002qlq3n6hbkh4c");

    state = pushInspectorObject(state, {
      objectType: "receipt",
      objectId: "receipt-pattern-dev-live-evidence-depth-claim",
      title: "Linked receipt",
      sourceSurface: "today",
      availability: "live",
      trailLabel: "Viewing movement evidence",
    });

    state = goBackInspectorObject(state);

    expect(state.tab).toBe("movement");
    expect(activeModelUpdateIdFromNavigation(state)).toBe("cmrjd6ntp0002qlq3n6hbkh4c");
  });
});
