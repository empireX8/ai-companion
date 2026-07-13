import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveOrvekObjectProvenance,
  type OrvekDataApi,
} from "../orvek-v0/data-provider";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import type { OrvekObject } from "../orvek-v0/orvek-types";
import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import {
  applySurfacedEvidenceDepthGate,
  buildSurfacedEvidenceDepthProvenance,
} from "../orvek-v0/production/today-evidence-pointer-depth-gate";
import {
  assessLiveTodayObjectGraphParity,
  withTodayObjectGraphParity,
} from "../orvek-v0/production/today-object-graph-parity";
import {
  buildInspectorSelection,
  buildProductionInspectorBridgeSignature,
  resolveInspectorObjectType,
} from "../inspector-selection";
import {
  goBackInspectorObject,
  pushInspectorObject,
  selectInspectorObject,
} from "../inspector-navigation-state";
import {
  resolveBridgedInspectorTab,
  shouldSyncWorkbenchTabToInspector,
} from "../inspector-tab-contract";

const DEPTH_SAFE_POINTER: OrvekObject = {
  id: "receipt-pattern-dev-live-evidence-depth-claim",
  type: "receipt",
  title: "Kept working past the stop point again",
  sourceText: "Kept working past the stop point even when I said I would not.",
  sourceOrigin: "Recent Pattern",
  date: "Jul 9",
  whyItMatters: "Connects evening stress to the missing stop point.",
  relatedIds: ["dev-live-evidence-depth-conclusion"],
};

const LINKED_CONCLUSION: OrvekObject = {
  id: "dev-live-evidence-depth-conclusion",
  type: "map-object",
  subtype: "claim",
  title: "Evening stop point matters",
  summary: "Commitments lock before the body signals a stop.",
  whyItMatters: "Explains why overwork repeats after stated boundaries.",
};

function apiWith(objects: OrvekObject[], overrides: Partial<OrvekDataApi> = {}): OrvekDataApi {
  const byId = new Map(objects.map((object) => [object.id, object]));
  return {
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? byId.get(id) : undefined),
    getObjects: (ids) =>
      (ids ?? []).map((id) => byId.get(id)).filter(Boolean) as OrvekObject[],
    ...overrides,
  };
}

describe("desktop Inspector assault shared capability", () => {
  it("classifies depth-overlay receipt and linked conclusion as live after hybrid + gate composition", () => {
    const baseApi = createMockOrvekDataApi();
    const hybridApi = buildHybridWorkbenchDataApi(baseApi);
    const staleParity = assessLiveTodayObjectGraphParity(hybridApi);
    const hybridWithStaleParity = withTodayObjectGraphParity(hybridApi, {
      ...staleParity,
      inspectorDepthSafeEvidencePointerIds: [],
      evidencePointerInspectorDepthReady: false,
    });

    expect(
      resolveOrvekObjectProvenance(hybridWithStaleParity, DEPTH_SAFE_POINTER),
    ).toBe("reference_fallback");

    const gated = applySurfacedEvidenceDepthGate({
      api: hybridWithStaleParity,
      overlay: {
        pointerObjects: [DEPTH_SAFE_POINTER],
        linkedObjects: [LINKED_CONCLUSION],
        depthSafePointerIds: [DEPTH_SAFE_POINTER.id],
        inspectorDepthListReady: true,
      },
    });

    expect(gated.surfacedEvidenceDepthProvenance).toEqual(
      buildSurfacedEvidenceDepthProvenance({
        pointerObjects: [DEPTH_SAFE_POINTER],
        linkedObjects: [LINKED_CONCLUSION],
        depthSafePointerIds: [DEPTH_SAFE_POINTER.id],
        inspectorDepthListReady: true,
      }),
    );
    expect(gated.todayObjectGraphParity?.inspectorDepthSafeEvidencePointerIds).toEqual([
      DEPTH_SAFE_POINTER.id,
    ]);
    expect(resolveOrvekObjectProvenance(gated, DEPTH_SAFE_POINTER)).toBe("live");
    expect(resolveOrvekObjectProvenance(gated, LINKED_CONCLUSION)).toBe("live");
  });

  it("distinguishes live active questions from reference-only decision/report objects", () => {
    const question: OrvekObject = {
      id: "inv-resolved-1",
      type: "active-question",
      title: "What changes under pressure?",
    };
    const decision: OrvekObject = { id: "d1", type: "decision", title: "Reference decision" };
    const report: OrvekObject = {
      id: "rep-weekly",
      type: "report",
      title: "Reference weekly report",
    };
    const api = apiWith([question, decision, report], {
      exploreQuestionIds: [question.id],
    });

    expect(resolveOrvekObjectProvenance(api, question)).toBe("live");
    expect(resolveOrvekObjectProvenance(api, decision)).toBe("reference_fallback");
    expect(resolveOrvekObjectProvenance(api, report)).toBe("reference_fallback");
    expect(resolveInspectorObjectType(decision)).toBe("reference_decision");
    expect(resolveInspectorObjectType(report)).toBe("reference_report");
    expect(
      buildInspectorSelection({
        objectType: "reference_report",
        objectId: report.id,
        availability: "reference_fallback",
        sourceSurface: "today",
      })?.availability,
    ).toBe("reference_fallback");
  });

  it("keeps user tab changes stable across bridge refresh and data-provider identity churn", () => {
    const signature = buildProductionInspectorBridgeSignature({
      selectedId: DEPTH_SAFE_POINTER.id,
      inspectorObjectId: DEPTH_SAFE_POINTER.id,
      objectType: "receipt",
      availability: "live",
      page: "today",
    });

    let navigation = selectInspectorObject(
      { selection: null, tab: "evidence", history: [] },
      {
        objectType: "receipt",
        objectId: DEPTH_SAFE_POINTER.id,
        title: DEPTH_SAFE_POINTER.title,
        sourceSurface: "today",
        availability: "live",
        tab: resolveBridgedInspectorTab({
          objectType: "receipt",
          workbenchTab: "evidence",
          explicitWorkbenchTab: false,
        }),
      },
    );

    navigation = {
      ...navigation,
      tab: "movement",
    };

    expect(
      shouldSyncWorkbenchTabToInspector({
        previousSelectedId: DEPTH_SAFE_POINTER.id,
        nextSelectedId: DEPTH_SAFE_POINTER.id,
      }),
    ).toBe(true);

    expect(signature).toBe(
      buildProductionInspectorBridgeSignature({
        selectedId: DEPTH_SAFE_POINTER.id,
        inspectorObjectId: DEPTH_SAFE_POINTER.id,
        objectType: "receipt",
        availability: "live",
        page: "today",
      }),
    );
    expect(navigation.tab).toBe("movement");
  });

  it("supports linked navigation and return without losing the original receipt selection", () => {
    let navigation = selectInspectorObject(
      { selection: null, tab: "evidence", history: [] },
      {
        objectType: "receipt",
        objectId: DEPTH_SAFE_POINTER.id,
        title: DEPTH_SAFE_POINTER.title,
        sourceSurface: "today",
        availability: "live",
      },
    );

    navigation = pushInspectorObject(navigation, {
      objectType: "usermap_conclusion",
      objectId: LINKED_CONCLUSION.id,
      title: LINKED_CONCLUSION.title,
      sourceSurface: "today",
      availability: "live",
      trailLabel: "Viewing related",
    });

    navigation = goBackInspectorObject(navigation);

    expect(navigation.selection?.selectedObjectId).toBe(DEPTH_SAFE_POINTER.id);
    expect(navigation.tab).toBe("evidence");
  });
});
