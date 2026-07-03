import { describe, expect, it } from "vitest";

import {
  listV0TodayArrayEntries,
  mapTodayDataToV0Props,
  normalizeV0TodayViewProps,
} from "../orvek-adapters/today";
import { buildTodayProductionDataApi } from "../orvek-v0/production/today-api";
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

function renderResurfacedQuotes(
  getObjects: (ids: string[] | undefined) => Array<{ sourceText?: string; title: string }>,
  ids: string[]
): string[] {
  return getObjects(ids).map((receipt) => receipt.sourceText ?? receipt.title);
}

describe("today production data bridge", () => {
  it("buildTodayProductionDataApi normalizes sparse receipt cards without undefined objects", () => {
    const api = buildTodayProductionDataApi({
      snapshot: {
        ...EMPTY_SNAPSHOT,
        surfacingCards: [
          {
            kind: "Recent Pattern",
            title: "Evening stress",
            body: "",
            meta: "",
            detailHref: null,
            receiptHref: "/library/receipt-pattern-pattern-1",
          },
          {
            kind: "Recent Journal",
            title: "Morning note",
            body: "Grounded capture.",
            meta: "recently",
            detailHref: "/library/journal-1",
            receiptHref: "/library/receipt-journal-journal-1",
          },
        ],
      },
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    const ids = api.todayResurfacedIds ?? [];
    expect(ids.length).toBe(2);

    const receipts = api.getObjects(ids);
    expect(receipts).toHaveLength(2);
    expect(receipts.every((receipt) => receipt !== undefined)).toBe(true);

    for (const receipt of receipts) {
      expect(receipt.id).toBeTruthy();
      expect(receipt.title).toBeTruthy();
      expect(receipt.sourceText ?? receipt.title).toBeTruthy();
      expect(receipt.sourceOrigin ?? "Receipt").toBeTruthy();
      expect(receipt.date ?? receipt.lastUpdated ?? "Receipt").toBeTruthy();
    }

    expect(() => renderResurfacedQuotes(api.getObjects, ids)).not.toThrow();
    expect(renderResurfacedQuotes(api.getObjects, ids)).toEqual([
      "Evening stress",
      "Grounded capture.",
    ]);
  });

  it("returns an empty resurfaced receipt list for sparse production snapshots", () => {
    const api = buildTodayProductionDataApi({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(api.todayResurfacedIds).toEqual([]);
    expect(api.getObjects(api.todayResurfacedIds)).toEqual([]);
    expect(() => renderResurfacedQuotes(api.getObjects, api.todayResurfacedIds ?? [])).not.toThrow();
  });

  it("registers intelligence updates for Inspector selection on the report card", () => {
    const api = buildTodayProductionDataApi({
      snapshot: {
        ...EMPTY_SNAPSHOT,
        intelligenceUpdates: [
          {
            id: "mu-1",
            updateTypeLabel: "Pattern shift",
            affectedObjectTypeLabel: "Pattern",
            userFacingSummary: "Updated summary",
            createdAt: "2026-06-24T10:00:00.000Z",
            affectedObjectType: "pattern_claim",
            affectedObjectId: "p-1",
            affectedObjectHref: "/patterns/p-1",
          },
        ],
      },
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    const obj = api.getObject("mu-1");
    expect(obj).toMatchObject({
      id: "mu-1",
      inspectorObjectType: "model_update",
      inspectorObjectId: "mu-1",
    });
    expect(api.today?.report?.primaryMovement?.inspectSelectId).toBe("mu-1");
  });

  it("registers receipt inspector targets when href maps to a selectable object", () => {
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
    const receipt = api.getObject(receiptId!);
    expect(receipt).toMatchObject({
      inspectorObjectType: "pattern_claim",
      inspectorObjectId: "pattern-1",
    });
  });

  it("passes through workbench-native Today intent metadata while preserving href fallbacks", () => {
    const api = buildTodayProductionDataApi({
      snapshot: {
        ...EMPTY_SNAPSHOT,
        intelligenceUpdates: [
          {
            id: "mu-1",
            updateTypeLabel: "Pattern shift",
            affectedObjectTypeLabel: "Pattern",
            userFacingSummary: "Updated summary",
            createdAt: "2026-06-24T10:00:00.000Z",
            affectedObjectType: "pattern_claim",
            affectedObjectId: "p-1",
            affectedObjectHref: "/patterns/p-1",
          },
        ],
        actions: [
          {
            id: "a-1",
            title: "Pause evening commitments",
            whySuggested: "Pattern signal supports a smaller boundary.",
            bucket: "stabilize",
            effort: "Low",
            linkedFamily: null,
            linkedFamilyLabel: null,
            linkedClaimId: "pc-9",
            linkedClaimSummary: "I overcommit",
            linkedGoalId: null,
            linkedGoalStatement: null,
            linkedSourceLabel: "Pattern",
            status: "not_started",
            note: null,
            surfacedAt: "2026-06-20T10:00:00.000Z",
            updatedAt: "2026-06-20T10:00:00.000Z",
          },
        ],
        investigations: [
          {
            id: "inv-1",
            title: "Why do I stall before deadlines?",
            organizingQuestion: "What triggers the stall?",
            status: "open",
            statusLabel: "Open",
            createdAt: "2026-06-17T10:00:00.000Z",
            updatedAt: "2026-06-17T10:00:00.000Z",
          },
        ],
        timelineMovements: [
          {
            id: "t-1",
            updateTypeLabel: "Updated",
            affectedObjectTypeLabel: "Timeline",
            userFacingSummary: "Timeline movement summary",
            createdAt: "2026-06-23T10:00:00.000Z",
            affectedObjectType: "model_update",
            affectedObjectId: "mu-1",
            affectedObjectHref: "/timeline",
          },
        ],
      },
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(api.today).toMatchObject({
      report: {
        reportId: "rep-weekly",
        primaryMovement: {
          selectionId: "mu-1",
          inspectSelectId: "mu-1",
          movementId: "mu-1",
          inspectorTab: "movement",
        },
      },
    });

    const byLabel = Object.fromEntries(
      api.today?.primaryActions.map((action) => [action.label, action]) ?? []
    );

    expect(byLabel["Continue from what changed"]).toMatchObject({
      href: "/what-changed",
      reportId: "rep-weekly",
    });
    expect(byLabel["Add what happened"]).toMatchObject({
      href: "/journal-chat",
      overlayId: "capture",
    });
    expect(byLabel["Review outcome"]).toMatchObject({
      href: "/actions",
      pageId: "decisions",
    });
    expect(byLabel["Capture new signal"]).toMatchObject({
      href: "/journal-chat",
      overlayId: "capture",
    });
    expect(byLabel["Check in on fieldwork"]?.pageId ?? null).toBeNull();

    expect(api.today?.hero).toMatchObject({
      selectionId: "mu-1",
      inspectSelectId: "mu-1",
      movementId: "mu-1",
      pageId: "timeline",
      inspectorTab: "movement",
    });
    expect(api.today?.nowRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "attention-timeline-t-1",
          pageId: "timeline",
          selectionId: "t-1",
          inspectSelectId: "t-1",
          movementId: "t-1",
          inspectorTab: "movement",
        }),
        expect.objectContaining({
          id: "attention-action-a-1",
          pageId: "decisions",
        }),
        expect.objectContaining({
          id: "attention-investigation-inv-1",
          pageId: "explore",
          selectionId: "inv-1",
          inspectSelectId: "inv-1",
        }),
      ])
    );
  });
});

describe("v0 today adapter normalization", () => {
  it("filters undefined entries from v0 Today array props", () => {
    const props = normalizeV0TodayViewProps({
      briefingDate: "Tuesday",
      briefingTitle: "Today",
      briefingMeta: "Empty",
      isLoading: false,
      loadingCopy: "Loading",
      heroEmptyCopy: "Nothing yet",
      hero: null,
      primaryActions: [{ label: "Capture", href: "/journal-chat" }, undefined as never],
      nowRows: [
        {
          id: "row-1",
          kicker: "Watch For",
          icon: "watch",
          title: "Scope loop",
          status: "Active",
          href: null,
          hasSelection: false,
          inspectorTab: null,
        },
        undefined as never,
      ],
      nowEmptyCopy: "Nothing in Now",
      movements: [
        {
          id: "mu-1",
          previous: null,
          updated: "Updated summary",
          evidence: "Pattern shift · Pattern",
        },
        undefined as never,
      ],
      movementEmptyCopy: "No movement",
      priorReadEmptyCopy: "Prior read unavailable",
      report: null,
      receipts: [
        {
          id: "receipt-1",
          quote: "",
          meta: "",
          href: "#",
        },
        undefined as never,
      ],
      checkIns: [{ id: "calm", label: "Calm", color: "#fff", href: "/check-ins" }],
    });

    expect(listV0TodayArrayEntries(props).some((entry) => entry === undefined)).toBe(false);
    expect(props.receipts).toHaveLength(1);
    expect(props.receipts[0]).toMatchObject({
      id: "receipt-1",
      quote: "Receipt",
      meta: "Receipt",
      href: "#",
    });
  });

  it("mapTodayDataToV0Props never leaves undefined entries in array slots", () => {
    const props = mapTodayDataToV0Props({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(listV0TodayArrayEntries(props).some((entry) => entry === undefined)).toBe(false);
  });
});
