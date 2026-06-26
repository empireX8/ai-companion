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
