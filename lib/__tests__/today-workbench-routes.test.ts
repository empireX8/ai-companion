import { describe, expect, it } from "vitest";

import { mapTodayDataToV0Props } from "../orvek-adapters/today";
import {
  isIntegratedOrvekWorkbenchHref,
  INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES,
} from "../orvek-v0/today-workbench-routes";
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

describe("today-workbench-routes", () => {
  it("allows integrated v0 workbench hrefs", () => {
    expect(isIntegratedOrvekWorkbenchHref("/")).toBe(true);
    expect(isIntegratedOrvekWorkbenchHref("/your-map")).toBe(true);
    expect(isIntegratedOrvekWorkbenchHref("/your-map/abc")).toBe(true);
    expect(isIntegratedOrvekWorkbenchHref("/actions")).toBe(true);
    expect(isIntegratedOrvekWorkbenchHref("/timeline")).toBe(true);
    expect(isIntegratedOrvekWorkbenchHref("/explore")).toBe(true);
  });

  it("rejects what-changed until it shares the integrated workbench shell", () => {
    expect(isIntegratedOrvekWorkbenchHref("/what-changed")).toBe(false);
  });

  it("rejects legacy and orphan surface hrefs", () => {
    expect(isIntegratedOrvekWorkbenchHref("/watch-for")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref("/watch-for/fw-1")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref("/journal-chat")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref("/active-questions/aq-1")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref("/patterns/p-1")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref("/check-ins")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref(null)).toBe(false);
  });

  it("covers all integrated route prefixes", () => {
    expect(INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES).toEqual([
      "/your-map",
      "/actions",
      "/timeline",
      "/explore",
    ]);
  });
});

describe("today primary action routing", () => {
  it("marks legacy capture and fieldwork actions disabled in production props", () => {
    const props = mapTodayDataToV0Props({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    const byLabel = Object.fromEntries(props.primaryActions.map((a) => [a.label, a]));

    expect(byLabel["Continue from what changed"]?.disabled).toBe(true);
    expect(byLabel["Review outcome"]?.disabled).toBeFalsy();
    expect(byLabel["Add what happened"]?.disabled).toBe(true);
    expect(byLabel["Check in on fieldwork"]?.disabled).toBe(true);
    expect(byLabel["Capture new signal"]?.disabled).toBe(true);
  });

  it("disables Continue from what changed when report output is present", () => {
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

    expect(props.report?.primaryMovement?.summary).toBe("Updated summary");
    expect(props.report?.primaryMovement?.inspectSelectId).toBe("mu-1");
    expect(props.report?.fullReportAvailable).toBe(false);
    expect(props.report?.fullReportDeferredCopy).toBe(
      "Full report view not available in this workbench yet."
    );
    const continueAction = props.primaryActions.find(
      (a) => a.label === "Continue from what changed"
    );
    expect(continueAction?.disabled).toBe(true);
  });

  it("does not link hero to non-integrated fieldwork href", () => {
    const props = mapTodayDataToV0Props({
      snapshot: {
        ...EMPTY_SNAPSHOT,
        watchForItems: [
          {
            id: "wf-1",
            prompt: "Watch for shutdown",
            reason: "Needs observation",
            status: "active",
            statusLabel: "Active",
            linkedObjectType: "",
            linkedObjectId: null,
            linkedObjectHref: null,
            createdAt: "2026-06-24T10:00:00.000Z",
            updatedAt: "2026-06-24T10:00:00.000Z",
          },
        ],
      },
      isLoading: false,
      briefingDate: "Tuesday",
    });

    expect(props.hero?.primaryAction).toBeNull();
  });
});
