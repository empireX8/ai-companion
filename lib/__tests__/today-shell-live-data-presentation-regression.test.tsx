import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildCanonicalLiveRuntimeData } from "../../components/orvek-v0-canonical/live-provider";
import { TodayPage as ProductionTodayPage } from "../../components/orvek-v0-canonical/pages/today";
import type { CanonicalRuntimeData } from "../../components/orvek-v0-canonical/canonical-contract";
import { TodayPage as ApprovedReferenceTodayPage } from "../../components/orvek-v0-reference-frozen/pages/today";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import type { OrvekObject } from "../orvek-v0/orvek-types";

Object.assign(globalThis, { React });

const renderState = vi.hoisted(() => ({
  runtime: null as CanonicalRuntimeData | null,
}));

vi.mock("@/components/orvek-v0-canonical/canonical-data-context", () => ({
  useCanonicalData: () => {
    if (!renderState.runtime) {
      throw new Error("Production Today rendered without canonical runtime data.");
    }
    return renderState.runtime;
  },
}));

vi.mock("@/components/orvek-v0/store", () => ({
  useWorkbench: () => ({
    select: vi.fn(),
    openReport: vi.fn(),
    setInspectorTab: vi.fn(),
  }),
}));

vi.mock("@/components/orvek-v0/primitives", async () => {
  const { createElement } = await import("react");
  return {
    SectionLabel: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => createElement("span", { className }, children),
  };
});

vi.mock("@/components/orvek-v0-reference-frozen/reference-data", () => {
  const objects: Record<string, OrvekObject> = {
    d1: {
      id: "d1",
      type: "decision",
      title: "Ship prototype or keep refining architecture?",
      evidenceCount: 6,
    },
    r6: {
      id: "r6",
      type: "receipt",
      title: "Reference receipt six",
      sourceText: "Reference receipt six",
    },
    r5: {
      id: "r5",
      type: "receipt",
      title: "Reference receipt five",
      sourceText: "Reference receipt five",
    },
    r2: {
      id: "r2",
      type: "receipt",
      title: "Reference receipt two",
      sourceText: "Reference receipt two",
    },
  };
  return {
    getObject: (id: string) => objects[id],
  };
});

const APPROVED_SIGNATURE = {
  twoColumnGrid: 1,
  leadCards: 1,
  leadMetrics: 3,
  leadActions: 2,
  primaryActions: 5,
  nowRows: 4,
  movementCards: 3,
  reportCards: 1,
  receiptRows: 3,
};

const SAMPLE_PERSONAL_CLAIMS = [
  "Scope-reopening pattern triggered again",
  "Small public test — narrow version before reopening",
  "Ship prototype or keep refining architecture?",
  "Decision pressure was treated as an isolated state.",
  "6 receipts tied pressure to repeated scope reopening.",
  "Weekly Model Movement report",
];

function count(html: string, pattern: RegExp): number {
  return Array.from(html.matchAll(pattern)).length;
}

function renderProductionToday(runtime: CanonicalRuntimeData): string {
  renderState.runtime = runtime;
  return renderToStaticMarkup(<ProductionTodayPage />);
}

function renderApprovedReferenceToday(): string {
  return renderToStaticMarkup(<ApprovedReferenceTodayPage />);
}

function productionSignature(html: string): typeof APPROVED_SIGNATURE {
  return {
    twoColumnGrid: count(html, /data-today-slot="two-column-grid"/g),
    leadCards: count(html, /data-today-slot="lead-card"/g),
    leadMetrics: count(html, /data-today-item="lead-metric"/g),
    leadActions: count(html, /data-today-item="lead-action"/g),
    primaryActions: count(html, /data-today-item="primary-action"/g),
    nowRows: count(html, /data-today-item="now-row"/g),
    movementCards: count(html, /data-today-item="movement-card"/g),
    reportCards: count(html, /data-today-slot="report-card"/g),
    receiptRows: count(html, /data-today-item="receipt-row"/g),
  };
}

function approvedReferenceSignature(html: string): typeof APPROVED_SIGNATURE {
  const primaryActionLabels = [
    "Continue from what changed",
    "Add what happened",
    "Review outcome",
    "Check in on fieldwork",
    "Capture new signal",
  ];

  return {
    twoColumnGrid: count(
      html,
      /lg:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(0,1fr\)\]/g,
    ),
    leadCards: count(
      html,
      /class="o-raised overflow-hidden rounded-2xl ring-1 ring-inset ring-action\/20"/g,
    ),
    leadMetrics: ["What changed", "Linked receipts", "Last evidence"].filter((label) =>
      html.includes(label),
    ).length,
    leadActions: ["Add outcome", "See why it moved"].filter((label) => html.includes(label))
      .length,
    primaryActions: primaryActionLabels.filter((label) => html.includes(label)).length,
    nowRows: count(
      html,
      /class="o-calm group flex w-full items-center gap-3\.5 px-4 py-3 text-left hover:bg-accent\/40"/g,
    ),
    movementCards: count(html, /class="o-material rounded-\[10px\] p-4"/g),
    reportCards: count(
      html,
      /class="o-calm flex w-full items-center gap-3 rounded-2xl bg-evidence-muted\/60/g,
    ),
    receiptRows: count(
      html,
      /class="o-calm flex w-full items-start gap-3 border-l-2 border-primary\/50/g,
    ),
  };
}

function openingButton(
  html: string,
  attribute: "data-today-item" | "data-today-slot",
  value: string,
  liveObjectId?: string,
): string {
  const liveObjectLookahead = liveObjectId
    ? `(?=[^>]*data-live-object-id="${liveObjectId}")`
    : "";
  const match = html.match(
    new RegExp(`<button(?=[^>]*${attribute}="${value}")${liveObjectLookahead}[^>]*>`),
  );
  expect(match, `missing ${attribute}=${value}`).not.toBeNull();
  return match![0];
}

function isDisabledButton(openingTag: string): boolean {
  return /\sdisabled(?:=""|>| )/.test(openingTag);
}

function buildLiveRuntime(): CanonicalRuntimeData {
  const objects: Record<string, OrvekObject> = {
    "decision-live-1": {
      id: "decision-live-1",
      type: "decision",
      title: "Review the live outcome",
      summary: "Owned decision summary",
      evidenceCount: 2,
    },
    "watch-live-1": {
      id: "watch-live-1",
      type: "map-object",
      title: "Review the live watch item",
      inspectorObjectType: "pattern_claim",
      inspectorObjectId: "watch-live-1",
    },
    "movement-live-1": {
      id: "movement-live-1",
      type: "model-update",
      title: "Live movement",
      inspectorObjectType: "model_update",
      inspectorObjectId: "movement-live-1",
    },
    "report-live-1": {
      id: "report-live-1",
      type: "report",
      title: "Live report",
      reportProvenance: "live_model_update",
    },
    "receipt-live-1": {
      id: "receipt-live-1",
      type: "receipt",
      title: "Live receipt",
      sourceText: "Owned live receipt text",
      sourceOrigin: "Journal",
      date: "26 July 2026",
    },
  };

  const liveApi = {
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id: string | null | undefined) => (id ? objects[id] : undefined),
    getObjects: (ids: string[] | undefined) =>
      (ids ?? []).map((id) => objects[id]).filter((item): item is OrvekObject => Boolean(item)),
    todayIsLoading: false,
    todayCopy: {
      briefingLine: "Sunday · since your last visit",
      briefingTitle: "Live current state",
      briefingMeta: "Live information is ready.",
    },
    today: {
      briefingDate: "Sunday · since your last visit",
      briefingTitle: "Live current state",
      briefingMeta: "Live information is ready.",
      isLoading: false,
      loadingCopy: "",
      heroEmptyCopy: "",
      hero: {
        kicker: "outcome review",
        title: "Review the live outcome",
        summary: "Owned decision summary",
        whyItMatters: null,
        whatChanged: "Outcome recorded",
        linkedReceipts: "2 receipts",
        lastEvidence: "Today",
        primaryAction: null,
        showSeeWhyMoved: true,
        inspectSelectId: "decision-live-1",
        movementId: "movement-live-1",
        selectionId: "decision-live-1",
      },
      primaryActions: [{ label: "Continue with live outcome", href: "/actions", primary: true }],
      nowRows: [
        {
          id: "watch-live-1",
          kicker: "Watch For",
          icon: "watch",
          title: "Review the live watch item",
          status: "Active",
          href: null,
          hasSelection: true,
          inspectorTab: "evidence",
          selectionId: "watch-live-1",
          inspectSelectId: "watch-live-1",
        },
      ],
      nowEmptyCopy: "",
      movements: [
        {
          id: "movement-live-1",
          previous: "Owned prior read",
          evidence: "Owned evidence summary",
          updated: "Owned updated understanding",
        },
      ],
      movementEmptyCopy: "",
      priorReadEmptyCopy: "",
      report: {
        title: "Live movement report",
        meta: "Ready",
        href: "/what-changed",
        fullReportLabel: "Open report",
        fullReportAvailable: true,
        fullReportDeferredCopy: "",
        primaryMovement: null,
        reportId: "report-live-1",
      },
      receipts: [],
      checkIns: [],
    },
    todayResurfacedIds: ["receipt-live-1"],
  } as OrvekDataApi;

  return buildCanonicalLiveRuntimeData(liveApi);
}

describe("TODAY-SHELL-LIVE-DATA-PRESENTATION-REGRESSION-REPAIR-001", () => {
  it("locks the approved reference presentation to a complete structural signature", () => {
    const html = renderApprovedReferenceToday();

    expect(approvedReferenceSignature(html)).toEqual(APPROVED_SIGNATURE);
    expect(html.indexOf("Most consequential now")).toBeLessThan(
      html.indexOf("Continue from what changed"),
    );
    expect(html.indexOf("Continue from what changed")).toBeLessThan(html.indexOf(">Now<"));
    expect(html.indexOf(">Now<")).toBeLessThan(html.indexOf("Recent model movement"));
    expect(html.indexOf("Recent model movement")).toBeLessThan(
      html.indexOf("Weekly Model Movement report"),
    );
    expect(html.indexOf("Weekly Model Movement report")).toBeLessThan(
      html.indexOf("Receipts resurfaced"),
    );
  });

  it("renders the complete approved centre with completely empty production data", () => {
    const html = renderProductionToday(buildCanonicalLiveRuntimeData(EMPTY_ORVEK_DATA_API));

    expect(productionSignature(html)).toEqual(APPROVED_SIGNATURE);
    expect(html).toContain("No current item is available.");
    expect(html).toContain("No movement is ready for review.");
    expect(html).toContain("No recent receipts are available.");
    expect(html).toContain("Nothing currently needs your attention.");
    expect(html).not.toContain("Nothing to show yet.");
    expect(html).not.toContain("data-live-object-id=");

    for (const claim of SAMPLE_PERSONAL_CLAIMS) {
      expect(html).not.toContain(claim);
    }

    for (const item of [
      "lead-title-action",
      "lead-action",
      "primary-action",
      "now-row",
      "movement-action",
      "receipt-row",
    ]) {
      expect(isDisabledButton(openingButton(html, "data-today-item", item))).toBe(true);
    }
    expect(isDisabledButton(openingButton(html, "data-today-slot", "report-card"))).toBe(
      true,
    );
  });

  it("keeps the same slots with live data and connects only genuine object-backed controls", () => {
    const html = renderProductionToday(buildLiveRuntime());

    expect(productionSignature(html)).toEqual(APPROVED_SIGNATURE);
    expect(html).toContain("Review the live outcome");
    expect(html).toContain("Owned updated understanding");
    expect(html).toContain("Owned live receipt text");

    for (const [item, id] of [
      ["lead-title-action", "decision-live-1"],
      ["lead-action", "decision-live-1"],
      ["now-row", "watch-live-1"],
      ["movement-action", "movement-live-1"],
      ["receipt-row", "receipt-live-1"],
    ] as const) {
      expect(isDisabledButton(openingButton(html, "data-today-item", item, id))).toBe(false);
    }
    expect(
      isDisabledButton(
        openingButton(html, "data-today-slot", "report-card", "report-live-1"),
      ),
    ).toBe(false);

    const unavailableNowRows = count(
      html,
      /<button(?=[^>]*data-today-item="now-row")(?=[^>]*disabled="")[^>]*>/g,
    );
    expect(unavailableNowRows).toBe(3);
  });

  it("keeps the same complete shell while production data is loading", () => {
    const loadingRuntime = buildCanonicalLiveRuntimeData({
      ...EMPTY_ORVEK_DATA_API,
      todayIsLoading: true,
    });
    const html = renderProductionToday(loadingRuntime);

    expect(productionSignature(html)).toEqual(APPROVED_SIGNATURE);
    expect(html).toContain(">Loading…</h1>");
    expect(html).toContain("Loading current item…");
    expect(html).toContain("Loading movement report…");
    expect(html).toContain("Loading receipt…");
    expect(html).not.toContain("data-live-object-id=");
  });
});
