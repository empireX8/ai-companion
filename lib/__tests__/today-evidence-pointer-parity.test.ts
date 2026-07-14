import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHybridWorkbenchDataApi } from "../orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
import {
  buildParitySafeEvidencePointerObjects,
  canUseLiveTodayEvidencePointer,
  canUseLiveTodayEvidencePointerList,
  getInspectableEvidencePointers,
  hasEvidencePointerProvenance,
  hasInspectableEvidencePointerContent,
  hasInspectableEvidencePointerSourceText,
  isBlockedAsEvidencePointer,
  isReceiptEvidencePointerObject,
  resolveLiveEvidencePointerTarget,
} from "../orvek-v0/production/today-evidence-pointer-parity";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import {
  resolveOrvekObjectFromGraph,
  resolveOrvekObjectsFromGraph,
} from "../orvek-v0/data-provider";
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

const LIVE_RECEIPT_SNAPSHOT: TodayReentrySnapshot = {
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
};

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live Today evidence pointer parity", () => {
  it("accepts live receipts with type receipt, sourceText, and provenance", () => {
    const api = buildTodayProductionDataApi({
      snapshot: LIVE_RECEIPT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const receiptId = api.todayResurfacedIds?.[0];
    expect(receiptId).toBeTruthy();

    const object = api.getObject(receiptId ?? "");
    expect(isReceiptEvidencePointerObject(object)).toBe(true);
    expect(hasInspectableEvidencePointerSourceText(object)).toBe(true);
    expect(hasEvidencePointerProvenance(object)).toBe(true);
    expect(canUseLiveTodayEvidencePointer(api, receiptId)).toBe(true);

    const target = resolveLiveEvidencePointerTarget(api, receiptId);
    expect(target).toEqual({
      objectId: receiptId,
      inspectorTab: "evidence",
      sourceText: "Grounded capture.",
      provenanceLabel: "Recent Pattern · recently",
    });
  });

  it("blocks live receipts missing sourceText or provenance", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-no-text", "receipt-no-provenance", "receipt-ok"],
      getObject: (id?: string | null) => {
        if (id === "receipt-no-text") {
          return {
            id: "receipt-no-text",
            type: "receipt" as const,
            title: " ",
            sourceText: " ",
            sourceOrigin: "Journal",
            date: "Today",
          };
        }
        if (id === "receipt-no-provenance") {
          return {
            id: "receipt-no-provenance",
            type: "receipt" as const,
            title: "Receipt",
            sourceText: "Some capture text.",
            sourceOrigin: "Receipt",
          };
        }
        if (id === "receipt-ok") {
          return {
            id: "receipt-ok",
            type: "receipt" as const,
            title: "Grounded capture.",
            sourceText: "Grounded capture.",
            sourceOrigin: "Pattern",
            date: "recently",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(canUseLiveTodayEvidencePointer(api, "receipt-no-text")).toBe(false);
    expect(canUseLiveTodayEvidencePointer(api, "receipt-no-provenance")).toBe(false);
    expect(canUseLiveTodayEvidencePointer(api, "receipt-ok")).toBe(true);
    expect(canUseLiveTodayEvidencePointerList(api, api.todayResurfacedIds)).toBe(false);
    expect(getInspectableEvidencePointers(api)).toHaveLength(1);
    expect(isBlockedAsEvidencePointer(api, "receipt-no-text")).toBe(true);
  });

  it("does not pass parity when only an evidence count or movement id is present", () => {
    const api = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["mu-1"],
      today: {
        hero: {
          linkedReceipts: "6 receipts",
        },
      } as never,
      getObject: (id?: string | null) => {
        if (id === "mu-1") {
          return {
            id: "mu-1",
            type: "model-update" as const,
            title: "Scope pressure increased",
            summary: "6 receipts tied pressure to repeated scope reopening.",
            before: "Earlier read",
            after: "Updated read",
          };
        }
        return undefined;
      },
      getObjects: (ids?: string[] | null) =>
        (ids ?? [])
          .map((id) => api.getObject(id))
          .filter((object): object is NonNullable<typeof object> => Boolean(object)),
    };

    expect(canUseLiveTodayEvidencePointerList(api, api.todayResurfacedIds)).toBe(false);
    expect(buildParitySafeEvidencePointerObjects(api).size).toBe(0);
    expect(resolveLiveEvidencePointerTarget(api, "mu-1")).toBeNull();
  });

  it("resolves parity-safe evidence objects through hybrid getObject and provider lookup", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: LIVE_RECEIPT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);
    const receiptId = productionTodayApi.todayResurfacedIds?.[0];
    expect(receiptId).toBeTruthy();

    const mergedObject = hybridApi.getObject(receiptId ?? "");
    expect(hasInspectableEvidencePointerContent(mergedObject)).toBe(true);
    expect(resolveOrvekObjectFromGraph(hybridApi, receiptId)?.sourceText).toBe(
      "Grounded capture.",
    );
    expect(
      resolveOrvekObjectsFromGraph(hybridApi, [receiptId ?? ""]).map((object) => object.id),
    ).toEqual([receiptId]);
    expect(hybridApi.todayObjectGraphParity?.paritySafeEvidencePointers[0]?.inspectorTab).toBe(
      "evidence",
    );
  });

  it("never treats evidence pointers as model movement targets", () => {
    const api = buildTodayProductionDataApi({
      snapshot: LIVE_RECEIPT_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const receiptId = api.todayResurfacedIds?.[0];
    const target = resolveLiveEvidencePointerTarget(api, receiptId);

    expect(target?.inspectorTab).toBe("evidence");
    expect(target?.inspectorTab).not.toBe("movement");
    expect(isReceiptEvidencePointerObject(api.getObject(receiptId ?? ""))).toBe(true);
    expect(isBlockedAsEvidencePointer(api, "iu-1")).toBe(true);
  });

  it("preserves reference Today UI and avoids global production displayContract", () => {
    const todayPage = readSource("components/orvek-v0/pages/today.tsx");
    const hybridApi = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");

    expect(todayPage).toContain("isProductionDisplay(data)");
    expect(todayPage).toContain("hasLiveTodayPresentation");
    expect(todayPage).toContain('REFERENCE_RESURFACED = ["r6", "r5", "r2"]');
    expect(todayPage).not.toContain("isTodayLiveReady");
    expect(todayPage).not.toContain("getInspectableEvidencePointers");
    expect(hybridApi).not.toMatch(/displayContract:\s*["']production["']/);
    expect(referenceRoute).not.toContain("useOrvekHybridWorkbenchDataApi");
  });
});
