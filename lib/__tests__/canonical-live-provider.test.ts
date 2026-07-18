import { describe, expect, it } from "vitest";

import { buildCanonicalLiveRuntimeData } from "../../components/orvek-v0-canonical/live-provider";
import { EMPTY_ORVEK_DATA_API } from "../../lib/orvek-v0/empty-api";
import type { OrvekDataApi } from "../../lib/orvek-v0/data-provider";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

describe("buildCanonicalLiveRuntimeData honesty", () => {
  it("does not invent fixture identities on an empty live API", () => {
    const runtime = buildCanonicalLiveRuntimeData(EMPTY_ORVEK_DATA_API);

    expect(runtime.orvekDataApi.referenceSurface).toBe(false);
    expect(runtime.orvekDataApi.canonicalRuntime).toBe(true);
    expect(runtime.today.leadId).toBe("");
    expect(runtime.today.reportId).toBe("");
    expect(runtime.today.briefingTitle).toBe("");
    expect(runtime.today.nowRows).toEqual([]);
    expect(runtime.today.movements).toEqual([]);
    expect(runtime.today.resurfacedIds).toEqual([]);
    expect(runtime.mapCategories).toEqual([]);
    expect(runtime.decisionListGroups).toEqual([]);
    expect(runtime.exploreQuestionIds).toEqual([]);
    expect(runtime.getObject("d1")).toBeUndefined();
    expect(runtime.getObject("rep-weekly")).toBeUndefined();
  });

  it("maps live today composition from hybrid fields without fixture fill", () => {
    const liveObject: OrvekObject = {
      id: "mu-live-1",
      type: "model-update",
      title: "Live movement",
      summary: "Owned live summary",
    };
    const receiptObject: OrvekObject = {
      id: "r-live-1",
      type: "receipt",
      title: "Resurfaced note",
      sourceText: "Resurfaced note body",
    };

    const liveApi = {
      ...EMPTY_ORVEK_DATA_API,
      getObject: (id: string | null | undefined) => {
        if (id === "mu-live-1") return liveObject;
        if (id === "r-live-1") return receiptObject;
        return undefined;
      },
      getObjects: (ids: string[] | undefined) =>
        (ids ?? [])
          .map((id) =>
            id === "mu-live-1" ? liveObject : id === "r-live-1" ? receiptObject : undefined,
          )
          .filter((obj): obj is OrvekObject => Boolean(obj)),
      today: {
        briefingDate: "Wednesday · since your last visit",
        briefingTitle: "Your model moved in 1 place.",
        briefingMeta: "Live meta",
        isLoading: false,
        loadingCopy: "",
        heroEmptyCopy: "",
        hero: {
          inspectSelectId: "mu-live-1",
          selectionId: "mu-live-1",
          movementId: "mu-live-1",
        },
        primaryActions: [{ label: "Continue", primary: true }],
        nowRows: [
          {
            id: "mu-live-1",
            kicker: "Watch For",
            status: "Active",
            title: "Live watch row",
          },
        ],
        nowEmptyCopy: "",
        movements: [
          {
            id: "mu-live-1",
            previous: "Before",
            evidence: "Evidence",
            updated: "After",
          },
        ],
        movementEmptyCopy: "",
        priorReadEmptyCopy: "",
        report: {
          title: "Live report",
          meta: "Ready",
          reportId: "mu-live-1",
        },
        receipts: [],
        checkIns: [],
      },
      todayResurfacedIds: ["r-live-1"],
      todayCopy: {
        briefingLine: "Wednesday · since your last visit",
        briefingTitle: "Your model moved in 1 place.",
        briefingMeta: "Live meta",
      },
    } as unknown as OrvekDataApi;

    const runtime = buildCanonicalLiveRuntimeData(liveApi);

    expect(runtime.today.leadId).toBe("mu-live-1");
    expect(runtime.today.reportId).toBe("mu-live-1");
    expect(runtime.today.leadNarrative).toBe("Owned live summary");
    expect(runtime.today.leadWhatChanged).toBe("");
    expect(runtime.today.leadLastEvidence).toBe("");
    expect(runtime.today.briefingTitle).toBe("Your model moved in 1 place.");
    expect(runtime.today.nowRows[0]?.id).toBe("mu-live-1");
    expect(runtime.today.resurfacedIds).toEqual(["r-live-1"]);
    expect(runtime.getObject("mu-live-1")?.title).toBe("Live movement");
    expect(runtime.getObject("d1")).toBeUndefined();
  });

  it("maps hero whatChanged/lastEvidence/kicker into Today lead slots when live provides them", () => {
    const liveObject: OrvekObject = {
      id: "dec-live-1",
      type: "decision",
      title: "Ship or refine?",
      summary: "Outcome window narrative",
    };
    const liveApi = {
      ...EMPTY_ORVEK_DATA_API,
      getObject: (id: string | null | undefined) =>
        id === "dec-live-1" ? liveObject : undefined,
      getObjects: () => [],
      today: {
        briefingDate: "",
        briefingTitle: "Your model moved in 1 place.",
        briefingMeta: "",
        isLoading: false,
        loadingCopy: "",
        heroEmptyCopy: "",
        hero: {
          kicker: "decision outcome due",
          summary: "Outcome window narrative",
          whatChanged: "Outcome window closed",
          lastEvidence: "2 hours ago",
          inspectSelectId: "dec-live-1",
          selectionId: "dec-live-1",
        },
        primaryActions: [],
        nowRows: [],
        nowEmptyCopy: "",
        movements: [],
        movementEmptyCopy: "",
        priorReadEmptyCopy: "",
        report: { title: "", meta: "" },
        receipts: [],
        checkIns: [],
      },
    } as unknown as OrvekDataApi;

    const runtime = buildCanonicalLiveRuntimeData(liveApi);
    expect(runtime.today.leadWhatChanged).toBe("Outcome window closed");
    expect(runtime.today.leadLastEvidence).toBe("2 hours ago");
    expect(runtime.today.leadKicker).toBe("Most consequential now · decision outcome due");
    expect(runtime.today.leadNarrative).toBe("Outcome window narrative");
  });

  it("uses Loading… only while todayIsLoading when title is absent", () => {
    const loading = buildCanonicalLiveRuntimeData({
      ...EMPTY_ORVEK_DATA_API,
      todayIsLoading: true,
    });
    const idle = buildCanonicalLiveRuntimeData(EMPTY_ORVEK_DATA_API);

    expect(loading.today.briefingTitle).toBe("Loading…");
    expect(idle.today.briefingTitle).toBe("");
  });

  it("does not invent a blank report card from heroSelectionId when report title is absent", () => {
    const liveObject: OrvekObject = {
      id: "mu-live-1",
      type: "model-update",
      title: "Live movement",
      summary: "Owned live summary",
    };
    const liveApi = {
      ...EMPTY_ORVEK_DATA_API,
      getObject: (id: string | null | undefined) =>
        id === "mu-live-1" ? liveObject : undefined,
      getObjects: () => [],
      today: {
        briefingDate: "",
        briefingTitle: "Your model moved in 1 place.",
        briefingMeta: "",
        isLoading: false,
        loadingCopy: "",
        heroEmptyCopy: "",
        hero: {
          inspectSelectId: "mu-live-1",
          selectionId: "mu-live-1",
          movementId: "mu-live-1",
        },
        primaryActions: [{ label: "Continue", primary: true }],
        nowRows: [],
        nowEmptyCopy: "",
        movements: [],
        movementEmptyCopy: "",
        priorReadEmptyCopy: "",
        report: null,
        receipts: [],
        checkIns: [],
      },
    } as unknown as OrvekDataApi;

    const runtime = buildCanonicalLiveRuntimeData(liveApi);
    expect(runtime.today.reportId).toBe("");
    expect(runtime.today.reportTitle).toBe("");
    expect(runtime.today.reportMeta).toBe("");
  });

  it("drops primary actions and now rows with empty labels/titles", () => {
    const liveApi = {
      ...EMPTY_ORVEK_DATA_API,
      today: {
        briefingDate: "",
        briefingTitle: "",
        briefingMeta: "",
        isLoading: false,
        loadingCopy: "",
        heroEmptyCopy: "",
        hero: null,
        primaryActions: [
          { label: "Continue from what changed", primary: true },
          { label: "   " },
          { label: "" },
        ],
        nowRows: [
          { id: "row-1", kicker: "Watch For", title: "Visible row", status: "Active" },
          { id: "row-2", kicker: "Watch For", title: "", status: "Active" },
        ],
        nowEmptyCopy: "",
        movements: [],
        movementEmptyCopy: "",
        priorReadEmptyCopy: "",
        report: null,
        receipts: [],
        checkIns: [],
      },
    } as unknown as OrvekDataApi;

    const runtime = buildCanonicalLiveRuntimeData(liveApi);
    expect(runtime.today.primaryActions.map((a) => a.label)).toEqual([
      "Continue from what changed",
    ]);
    expect(runtime.today.nowRows.map((r) => r.title)).toEqual(["Visible row"]);
  });
});
