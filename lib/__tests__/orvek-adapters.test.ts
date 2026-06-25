import { describe, expect, it } from "vitest";

import { mapTodayDataToV0Props } from "../orvek-adapters/today";
import { mapWhatChangedDataToV0Props } from "../orvek-adapters/what-changed";
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

describe("orvek adapters", () => {
  it("mapTodayDataToV0Props keeps v0 geometry slots with honest empty copy", () => {
    const props = mapTodayDataToV0Props({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });

    expect(props.hero).toBeNull();
    expect(props.nowRows).toEqual([]);
    expect(props.movements).toEqual([]);
    expect(props.report).toBeNull();
    expect(props.receipts).toEqual([]);
    expect(props.priorReadEmptyCopy).toContain("Prior read");
    expect(props.primaryActions.length).toBeGreaterThan(0);
    expect(props.checkIns.length).toBe(5);
  });

  it("mapTodayDataToV0Props maps movement without fabricating previous read", () => {
    const props = mapTodayDataToV0Props({
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
      briefingDate: "Tuesday",
    });

    expect(props.movements).toHaveLength(1);
    expect(props.movements[0]?.previous).toBeNull();
    expect(props.movements[0]?.updated).toBe("Updated summary");
    expect(props.report?.href).toBe("/what-changed");
  });

  it("mapWhatChangedDataToV0Props maps primary and earlier without beforeSummary", () => {
    const view = mapWhatChangedDataToV0Props({
      primary: {
        id: "mu-1",
        updateTypeLabel: "Pattern shift",
        affectedObjectTypeLabel: "Pattern",
        userFacingSummary: "Summary",
        createdAt: "2026-06-24T10:00:00.000Z",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "p-1",
        affectedObjectHref: "/patterns/p-1",
      },
      earlier: [],
      evidenceItems: [],
    });

    expect(view.primary?.title).toContain("Pattern shift");
    expect(view.primary?.summary).toBe("Summary");
    expect(JSON.stringify(view)).not.toContain("beforeSummary");
  });
});
