import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import type { OrvekObject } from "../orvek-v0/orvek-types";
import { mergeSurfacedEvidenceDepthObjects } from "../live-evidence-depth-linkage";
import { applySurfacedEvidenceDepthGate } from "../orvek-v0/production/today-evidence-pointer-depth-gate";

const STORED_POINTER: OrvekObject = {
  id: "receipt-pattern-claim-1",
  type: "receipt",
  title: "Kept working past the stop point again",
  sourceText: "Kept working past the stop point again even though I said I would not.",
  sourceOrigin: "Recent Pattern",
  date: "Jul 9",
  whyItMatters: "Connects evening stress to the missing stop point.",
  relatedIds: ["conclusion-1"],
};

const LINKED_TARGET: OrvekObject = {
  id: "conclusion-1",
  type: "map-object",
  title: "Evening stop point matters",
  summary: "Commitments lock before the body signals a stop.",
  whyItMatters: "Explains why overwork repeats after stated boundaries.",
};

describe("Today evidence pointer UI depth gate", () => {
  it("keeps /dev/orvek-v0-reference mock-only and does not require production fetch", () => {
    const api = createMockOrvekDataApi();
    expect(api.getObject("r6")?.whyItMatters).toBeTruthy();
    expect(api.getObject("receipt-pattern-claim-1")).toBeUndefined();
  });

  it("does not silently replace thin production todayResurfacedIds with reference fallback ids", () => {
    const api: OrvekDataApi = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-0-thin-live"],
    };

    const gated = applySurfacedEvidenceDepthGate({
      api,
      overlay: null,
    });
    expect(gated.todayResurfacedIds).toEqual(["receipt-0-thin-live"]);
    expect(gated.todayObjectGraphParity?.blockedEvidencePointerIds).toEqual([
      "receipt-0-thin-live",
    ]);
  });

  it("registers stored depth-safe pointer objects without mutating todayResurfacedIds", () => {
    const base = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-0-thin-live"],
      getObject: () => undefined,
    };

    const merged = mergeSurfacedEvidenceDepthObjects(base, {
      pointerObjects: [STORED_POINTER],
      linkedObjects: [LINKED_TARGET],
      depthSafePointerIds: [STORED_POINTER.id],
      rejectedPointers: [],
      inspectorDepthListReady: true,
    });

    expect(merged.todayResurfacedIds).toEqual(["receipt-0-thin-live"]);
    expect(merged.getObject(STORED_POINTER.id)?.whyItMatters).toBe(STORED_POINTER.whyItMatters);
    expect(merged.getObject(LINKED_TARGET.id)?.summary).toBe(LINKED_TARGET.summary);
  });

  it("surfaces stored depth-safe pointer ids only when inspectorDepthListReady is true", () => {
    const base: OrvekDataApi = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-0-thin-live"],
      getObject: () => undefined,
    };

    const gated = applySurfacedEvidenceDepthGate({
      api: base,
      overlay: {
        pointerObjects: [STORED_POINTER],
        linkedObjects: [LINKED_TARGET],
        depthSafePointerIds: [STORED_POINTER.id],
        inspectorDepthListReady: true,
      },
    });

    expect(gated.todayResurfacedIds).toEqual([STORED_POINTER.id]);
    expect(gated.surfacedEvidenceDepthProvenance).toEqual({
      depthSafePointerIds: [STORED_POINTER.id],
      linkedObjectIds: [LINKED_TARGET.id],
    });
    expect(gated.getObject(STORED_POINTER.id)?.whyItMatters).toBe(STORED_POINTER.whyItMatters);
    expect(gated.getObject(LINKED_TARGET.id)?.summary).toBe(LINKED_TARGET.summary);
  });
});
