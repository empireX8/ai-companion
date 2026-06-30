import { describe, expect, it } from "vitest";

import { mapTodayDataToV0Props } from "../orvek-adapters/today";
import {
  isIntegratedOrvekWorkbenchHref,
  INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES,
  isTodayReentryHref,
  resolveTodayNowRowTarget,
  TODAY_REENTRY_ROUTE_PREFIXES,
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
    expect(isIntegratedOrvekWorkbenchHref("/what-changed")).toBe(true);
  });

  it("keeps non-shell routes out of the integrated workbench allowlist", () => {
    expect(isIntegratedOrvekWorkbenchHref("/watch-for")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref("/watch-for/fw-1")).toBe(false);
    expect(isIntegratedOrvekWorkbenchHref("/journal-chat")).toBe(false);
  });

  it("allows only live Today re-entry targets", () => {
    expect(isTodayReentryHref("/")).toBe(true);
    expect(isTodayReentryHref("/what-changed")).toBe(true);
    expect(isTodayReentryHref("/journal-chat")).toBe(true);
    expect(isTodayReentryHref("/watch-for/fw-1")).toBe(true);
    expect(isTodayReentryHref("/actions")).toBe(true);
    expect(isTodayReentryHref("/timeline")).toBe(true);
    expect(isTodayReentryHref("/explore")).toBe(true);
    expect(isTodayReentryHref("/your-map/abc")).toBe(true);
  });

  it("rejects blocked legacy and orphan surface hrefs from Today re-entry", () => {
    expect(isIntegratedOrvekWorkbenchHref("/active-questions/aq-1")).toBe(false);
    expect(isTodayReentryHref("/active-questions/aq-1")).toBe(false);
    expect(isTodayReentryHref("/patterns/p-1")).toBe(false);
    expect(isTodayReentryHref("/check-ins")).toBe(false);
    expect(isTodayReentryHref(null)).toBe(false);
  });

  it("covers all integrated route prefixes", () => {
    expect(INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES).toEqual([
      "/your-map",
      "/actions",
      "/timeline",
      "/explore",
      "/what-changed",
    ]);
  });

  it("covers all Today re-entry route prefixes", () => {
    expect(TODAY_REENTRY_ROUTE_PREFIXES).toEqual([
      "/your-map",
      "/actions",
      "/timeline",
      "/explore",
      "/what-changed",
      "/watch-for",
      "/journal-chat",
    ]);
  });
});

describe("today primary action routing", () => {
  it("keeps valid Today re-entry actions enabled in production props", () => {
    const props = mapTodayDataToV0Props({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    const byLabel = Object.fromEntries(props.primaryActions.map((a) => [a.label, a]));

    expect(byLabel["Continue from what changed"]?.disabled).toBeFalsy();
    expect(byLabel["Review outcome"]?.disabled).toBeFalsy();
    expect(byLabel["Add what happened"]?.disabled).toBeFalsy();
    expect(byLabel["Check in on fieldwork"]?.disabled).toBeFalsy();
    expect(byLabel["Capture new signal"]?.disabled).toBeFalsy();
  });

  it("keeps the report CTA and Continue action wired when report output is present", () => {
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
    expect(props.report?.fullReportAvailable).toBe(true);
    const continueAction = props.primaryActions.find(
      (a) => a.label === "Continue from what changed"
    );
    expect(continueAction?.disabled).toBeFalsy();
  });

  it("links fieldwork hero cards to the live Watch For detail route", () => {
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

    expect(props.hero?.primaryAction).toEqual({
      kind: "link",
      href: "/watch-for/wf-1",
      label: "Open",
    });
  });

  it("marks quick check-in chips unavailable instead of routing to blocked /check-ins pages", () => {
    const props = mapTodayDataToV0Props({
      snapshot: EMPTY_SNAPSHOT,
      isLoading: false,
      briefingDate: "Tuesday",
    });

    expect(props.checkIns).toHaveLength(5);
    expect(props.checkIns.every((item) => item.disabled)).toBe(true);
    expect(props.checkIns.every((item) => item.href === "#")).toBe(true);
  });
});

describe("today now-row routing", () => {
  it("prefers a live row route over inspector fallback when both exist", () => {
    expect(
      resolveTodayNowRowTarget({
        href: "/watch-for/fw-1",
        hasSelection: true,
        hasRegisteredSelection: true,
      })
    ).toEqual({
      kind: "route",
      href: "/watch-for/fw-1",
    });
  });

  it("falls back to inspector when the row route is blocked but selection is available", () => {
    expect(
      resolveTodayNowRowTarget({
        href: "/patterns/p-1",
        hasSelection: true,
        hasRegisteredSelection: true,
      })
    ).toEqual({
      kind: "inspect",
    });
  });

  it("returns no target when neither a live route nor a registered selection exists", () => {
    expect(
      resolveTodayNowRowTarget({
        href: "/active-questions/aq-1",
        hasSelection: false,
        hasRegisteredSelection: false,
      })
    ).toBeNull();
  });
});
