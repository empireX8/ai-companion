import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assessEvidenceInspectorDepth,
  canUseLiveEvidenceInspectorDepth,
  canUseLiveEvidenceInspectorDepthList,
  filterInspectorDepthSafeEvidencePointerIds,
  hasReferenceDepthEvidenceShape,
  isNearEmptyInspectorObject,
  resolveEvidenceInspectorDepthTarget,
} from "../orvek-v0/production/evidence-inspector-depth-parity";
import {
  canUseLiveTodayEvidencePointer,
  hasInspectableEvidencePointerContent,
} from "../orvek-v0/production/today-evidence-pointer-parity";
import { assessLiveTodayObjectGraphParity } from "../orvek-v0/production/today-object-graph-parity";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import { getObject as getZipObject } from "../orvek-v0/orvek-data";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import type { OrvekObject } from "../orvek-v0/orvek-types";
import type { TodayReentrySnapshot } from "../today-reentry";

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

const RICH_CONTEXT_TARGET: OrvekObject = {
  id: "live-ctx-1",
  type: "context",
  title: "Evening pressure context",
  summary: "Stress capture clusters around late-evening decisions.",
  supporting: ["Three captures in the same window"],
};

const RICH_RELATED_TARGET: OrvekObject = {
  id: "live-pattern-1",
  type: "map-object",
  title: "Evening stress pattern",
  summary: "Stress rises when the day ends without a clear stop point.",
  whyItMatters: "Explains recurring evening capture spikes.",
};

const NEAR_EMPTY_TARGET: OrvekObject = {
  id: "live-shell-1",
  type: "map-object",
  title: "Untitled pattern",
};

const DEPTH_SAFE_RECEIPT: OrvekObject = {
  id: "live-r-1",
  type: "receipt",
  title: "Kept working past the stop point again.",
  sourceText: "Kept working past the stop point again even though I said I would not.",
  sourceOrigin: "Journal",
  date: "Today",
  whyItMatters: "Connects evening stress to the missing stop point.",
  contextIds: ["live-ctx-1"],
  relatedIds: ["live-pattern-1"],
};

function buildApiWithObjects(
  objects: Record<string, OrvekObject>,
  todayResurfacedIds?: string[],
): OrvekDataApi {
  return {
    ...EMPTY_ORVEK_DATA_API,
    todayResurfacedIds,
    getObject: (id?: string | null) => (id ? objects[id] : undefined),
    getObjects: (ids?: string[]) =>
      (ids ?? []).map((id) => objects[id]).filter(Boolean) as OrvekObject[],
  };
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("evidence inspector depth parity", () => {
  it("passes reference Evidence Pointer objects r6, r5, r2", () => {
    const api = createMockOrvekDataApi();

    for (const id of ["r6", "r5", "r2"]) {
      const assessment = assessEvidenceInspectorDepth(api.getObject(id), api.getObject);
      expect(assessment.inspectorDepthSafe, `${id} blockers: ${assessment.blockers}`).toBe(true);
      expect(assessment.blockers).toEqual([]);
      expect(canUseLiveEvidenceInspectorDepth(api, id)).toBe(true);
    }

    expect(canUseLiveEvidenceInspectorDepthList(api, ["r6", "r5", "r2"])).toBe(true);
  });

  it("resolves reference targets with the fixture fields the trace identified", () => {
    const api = createMockOrvekDataApi();
    const target = resolveEvidenceInspectorDepthTarget(api, "r6");

    expect(target).toEqual({
      objectId: "r6",
      inspectorTab: "evidence",
      sourceText: "Need to see everything expressed before I can stop reopening it.",
      provenanceLabel: "Explore conversation · Today",
      whyItMatters: "Links visual expression to the scope-reopening loop.",
      contextIds: ["ctx-self"],
      relatedIds: ["m-loop-1", "m-claim-1"],
    });
  });

  it("fails when whyItMatters is removed from a reference-shaped receipt", () => {
    const base = getZipObject("r6");
    expect(base).toBeTruthy();
    const stripped: OrvekObject = { ...base!, whyItMatters: undefined };
    const api = createMockOrvekDataApi();

    const assessment = assessEvidenceInspectorDepth(stripped, api.getObject);
    expect(assessment.inspectorDepthSafe).toBe(false);
    expect(assessment.blockers).toContain("missing_why_it_matters");
  });

  it("fails when contextIds/relatedIds do not resolve through the graph", () => {
    const receipt: OrvekObject = {
      ...DEPTH_SAFE_RECEIPT,
      contextIds: ["missing-ctx"],
      relatedIds: ["missing-related"],
    };
    const api = buildApiWithObjects({ [receipt.id]: receipt });

    const assessment = assessEvidenceInspectorDepth(receipt, api.getObject);
    expect(assessment.inspectorDepthSafe).toBe(false);
    expect(assessment.blockers).toContain("unresolved_linked_ids");
    expect(assessment.unresolvedLinkedIds).toEqual(["missing-ctx", "missing-related"]);
  });

  it("fails a source-safe receipt that has only sourceText/sourceOrigin/date", () => {
    const thin: OrvekObject = {
      id: "live-thin-1",
      type: "receipt",
      title: "Grounded capture.",
      sourceText: "Grounded capture.",
      sourceOrigin: "Recent Pattern",
      date: "recently",
    };
    const api = buildApiWithObjects({ [thin.id]: thin }, [thin.id]);

    // Still source-safe under the existing lower-level gate…
    expect(hasInspectableEvidencePointerContent(thin)).toBe(true);
    expect(canUseLiveTodayEvidencePointer(api, thin.id)).toBe(true);

    // …but blocked by the stricter inspector-depth gate.
    const assessment = assessEvidenceInspectorDepth(thin, api.getObject);
    expect(assessment.inspectorDepthSafe).toBe(false);
    expect(assessment.blockers).toContain("missing_why_it_matters");
    expect(assessment.blockers).toContain("no_context_or_related_ids");
    expect(canUseLiveEvidenceInspectorDepthList(api, [thin.id])).toBe(false);
  });

  it("fails generic title/sourceText/provenance fallbacks", () => {
    const generic: OrvekObject = {
      id: "live-generic-1",
      type: "receipt",
      title: "Receipt",
      sourceText: "Receipt",
      sourceOrigin: "Receipt",
      whyItMatters: "Some reason.",
      relatedIds: ["live-pattern-1"],
    };
    const api = buildApiWithObjects({
      [generic.id]: generic,
      "live-pattern-1": RICH_RELATED_TARGET,
    });

    const assessment = assessEvidenceInspectorDepth(generic, api.getObject);
    expect(assessment.inspectorDepthSafe).toBe(false);
    expect(assessment.blockers).toContain("generic_title");
    expect(assessment.blockers).toContain("generic_source_text");
    expect(assessment.blockers).toContain("missing_provenance");
  });

  it("fails when a linked target resolves to a near-empty shell object", () => {
    const receipt: OrvekObject = {
      ...DEPTH_SAFE_RECEIPT,
      contextIds: undefined,
      relatedIds: ["live-shell-1"],
    };
    const api = buildApiWithObjects({
      [receipt.id]: receipt,
      "live-shell-1": NEAR_EMPTY_TARGET,
    });

    expect(isNearEmptyInspectorObject(NEAR_EMPTY_TARGET)).toBe(true);
    const assessment = assessEvidenceInspectorDepth(receipt, api.getObject);
    expect(assessment.inspectorDepthSafe).toBe(false);
    expect(assessment.blockers).toContain("near_empty_linked_objects");
    expect(assessment.nearEmptyLinkedIds).toEqual(["live-shell-1"]);
    expect(resolveEvidenceInspectorDepthTarget(api, receipt.id)).toBeNull();
  });

  it("passes a live-shaped receipt with truthful whyItMatters and rich resolvable targets", () => {
    const api = buildApiWithObjects(
      {
        [DEPTH_SAFE_RECEIPT.id]: DEPTH_SAFE_RECEIPT,
        [RICH_CONTEXT_TARGET.id]: RICH_CONTEXT_TARGET,
        [RICH_RELATED_TARGET.id]: RICH_RELATED_TARGET,
      },
      [DEPTH_SAFE_RECEIPT.id],
    );

    expect(hasReferenceDepthEvidenceShape(DEPTH_SAFE_RECEIPT, api.getObject)).toBe(true);
    expect(canUseLiveEvidenceInspectorDepthList(api, [DEPTH_SAFE_RECEIPT.id])).toBe(true);

    const target = resolveEvidenceInspectorDepthTarget(api, DEPTH_SAFE_RECEIPT.id);
    expect(target).toEqual({
      objectId: "live-r-1",
      inspectorTab: "evidence",
      sourceText:
        "Kept working past the stop point again even though I said I would not.",
      provenanceLabel: "Journal · Today",
      whyItMatters: "Connects evening stress to the missing stop point.",
      contextIds: ["live-ctx-1"],
      relatedIds: ["live-pattern-1"],
    });
  });

  it("never fabricates context/related ids to force parity", () => {
    const api = buildApiWithObjects(
      {
        [DEPTH_SAFE_RECEIPT.id]: DEPTH_SAFE_RECEIPT,
        [RICH_CONTEXT_TARGET.id]: RICH_CONTEXT_TARGET,
        [RICH_RELATED_TARGET.id]: RICH_RELATED_TARGET,
      },
      [DEPTH_SAFE_RECEIPT.id],
    );
    const target = resolveEvidenceInspectorDepthTarget(api, DEPTH_SAFE_RECEIPT.id);

    // Resolved ids must be a subset of what the object truthfully declares.
    expect(
      target?.contextIds.every((id) => (DEPTH_SAFE_RECEIPT.contextIds ?? []).includes(id)),
    ).toBe(true);
    expect(
      target?.relatedIds.every((id) => (DEPTH_SAFE_RECEIPT.relatedIds ?? []).includes(id)),
    ).toBe(true);

    // An object without links is blocked, not enriched.
    const linkless: OrvekObject = {
      ...DEPTH_SAFE_RECEIPT,
      id: "live-r-2",
      contextIds: undefined,
      relatedIds: undefined,
    };
    const linklessApi = buildApiWithObjects({ [linkless.id]: linkless });
    expect(resolveEvidenceInspectorDepthTarget(linklessApi, linkless.id)).toBeNull();
  });

  it("blocks current live production Today receipts (source-safe only, no depth fields)", () => {
    const api = buildTodayProductionDataApi({
      snapshot: {
        ...EMPTY_SNAPSHOT,
        surfacingCards: [
          {
            kind: "Recent Pattern",
            title: "Evening stress",
            body: "Grounded capture.",
            meta: "recently",
            detailHref: "/patterns/pattern-1",
            receiptHref: "/patterns/pattern-1",
          },
        ],
      },
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    const receiptId = api.todayResurfacedIds?.[0];
    expect(receiptId).toBeTruthy();
    // Source-safe today…
    expect(canUseLiveTodayEvidencePointer(api, receiptId)).toBe(true);
    // …but not inspector-depth-safe: adapter objects carry no whyItMatters,
    // contextIds, or relatedIds.
    expect(canUseLiveEvidenceInspectorDepth(api, receiptId)).toBe(false);
    const assessment = assessEvidenceInspectorDepth(api.getObject(receiptId), api.getObject);
    expect(assessment.blockers).toContain("missing_why_it_matters");
    expect(assessment.blockers).toContain("no_context_or_related_ids");

    const parity = assessLiveTodayObjectGraphParity(api);
    expect(parity.evidencePointerListReady).toBe(true);
    expect(parity.evidencePointerInspectorDepthReady).toBe(false);
    expect(parity.inspectorDepthSafeEvidencePointerIds).toEqual([]);
  });

  it("exposes inspector-depth metadata strictly narrower than source-safe metadata", () => {
    const mixedApi = buildApiWithObjects(
      {
        [DEPTH_SAFE_RECEIPT.id]: DEPTH_SAFE_RECEIPT,
        [RICH_CONTEXT_TARGET.id]: RICH_CONTEXT_TARGET,
        [RICH_RELATED_TARGET.id]: RICH_RELATED_TARGET,
        "live-thin-1": {
          id: "live-thin-1",
          type: "receipt",
          title: "Grounded capture.",
          sourceText: "Grounded capture.",
          sourceOrigin: "Recent Pattern",
          date: "recently",
        },
      },
      [DEPTH_SAFE_RECEIPT.id, "live-thin-1"],
    );

    const depthSafeIds = filterInspectorDepthSafeEvidencePointerIds(
      mixedApi,
      mixedApi.todayResurfacedIds,
    );
    expect(depthSafeIds).toEqual([DEPTH_SAFE_RECEIPT.id]);

    const parity = assessLiveTodayObjectGraphParity(mixedApi);
    expect(parity.inspectableEvidencePointerIds).toEqual([DEPTH_SAFE_RECEIPT.id, "live-thin-1"]);
    expect(parity.inspectorDepthSafeEvidencePointerIds).toEqual([DEPTH_SAFE_RECEIPT.id]);
    // All-or-nothing: one thin row blocks depth-readiness for the whole list.
    expect(parity.evidencePointerInspectorDepthReady).toBe(false);
  });

  it("keeps the depth gate out of visible UI: Today and evidence panel do not consume it", () => {
    const todaySource = readSource("components/orvek-v0/pages/today.tsx");
    const evidencePanelSource = readSource("components/orvek-v0/evidence-panel.tsx");

    for (const source of [todaySource, evidencePanelSource]) {
      expect(source.includes("evidence-inspector-depth-parity")).toBe(false);
      expect(source.includes("canUseLiveEvidenceInspectorDepth")).toBe(false);
    }

    // Reference click path unchanged.
    expect(todaySource.includes("select(r.id)")).toBe(true);
    expect(todaySource.includes('REFERENCE_RESURFACED = ["r6", "r5", "r2"]')).toBe(true);

    // Reference route remains mock-only.
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");
    expect(referenceRoute.includes("Workbench")).toBe(true);
    expect(referenceRoute.includes("displayContract")).toBe(false);
  });
});
