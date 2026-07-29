import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CanonicalRuntimeData } from "../../components/orvek-v0-canonical/canonical-contract";
import { buildCanonicalLiveRuntimeData } from "../../components/orvek-v0-canonical/live-provider";
import { DecisionsPage as CanonicalDecisionsPage } from "../../components/orvek-v0-canonical/pages/decisions";
import {
  ExplorePage as CanonicalExplorePage,
  type CanonicalExploreTab,
} from "../../components/orvek-v0-canonical/pages/explore";
import { MapPage as CanonicalMapPage } from "../../components/orvek-v0-canonical/pages/map";
import { TimelinePage as CanonicalTimelinePage } from "../../components/orvek-v0-canonical/pages/timeline";
import { DecisionsPage as ReferenceDecisionsPage } from "../../components/orvek-v0-reference-frozen/pages/decisions";
import { ExplorePage as ReferenceExplorePage } from "../../components/orvek-v0-reference-frozen/pages/explore";
import { MapPage as ReferenceMapPage } from "../../components/orvek-v0-reference-frozen/pages/map";
import { TimelinePage as ReferenceTimelinePage } from "../../components/orvek-v0-reference-frozen/pages/timeline";
import {
  EXPLORE_GROUNDING,
  EXPLORE_MOVEMENT,
  getObject as getReferenceObject,
  getObjects as getReferenceObjects,
} from "../../components/orvek-v0-reference-frozen/reference-data";
import { Sidebar } from "../../components/orvek-v0/sidebar";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import type { OrvekObject } from "../orvek-v0/orvek-types";

Object.assign(globalThis, { React });

const renderState = vi.hoisted(() => ({
  runtime: null as CanonicalRuntimeData | null,
  api: null as OrvekDataApi | null,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: unknown[]) => values.flat().filter(Boolean).join(" "),
}));

vi.mock("@/components/orvek-v0-canonical/permanent-presentation", () => ({
  minimumPermanentSlots: <T,>(items: readonly T[] | undefined, count: number) => {
    const values = items ?? [];
    return Array.from(
      { length: Math.max(values.length, count) },
      (_, index) => values[index] ?? null,
    );
  },
}));

vi.mock("@/lib/orvek-v0/data-provider", () => ({
  useOrvekData: () => {
    if (!renderState.api) throw new Error("Page rendered without Orvek data.");
    return renderState.api;
  },
}));

vi.mock("@/components/orvek-v0/primitives", async () => {
  const { createElement } = await import("react");
  const Icon = () => createElement("svg");
  const meta = (label: string) => ({ label, icon: Icon, tone: "neutral" });
  return {
    TYPE_META: {
      receipt: meta("Receipt"),
      decision: meta("Decision"),
      report: meta("Report"),
      fieldwork: meta("Fieldwork"),
      "map-object": meta("Model object"),
      "timeline-event": meta("Event"),
      investigation: meta("Investigation"),
      context: meta("Context"),
      "model-goal": meta("Model Goal"),
      "model-update": meta("Model update"),
      "active-question": meta("Active question"),
    },
    SectionLabel: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => createElement("h3", { className }, children),
    Chip: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => createElement("span", { className }, children),
  };
});

vi.mock("@/components/orvek-v0/MapPageHeaderStats", async () => {
  const { createElement } = await import("react");
  return {
    MapPageHeaderStats: () => createElement("div", { "data-testid": "map-header-stats" }),
  };
});

vi.mock("@/components/orvek-v0/durable-user-action-controls", async () => {
  const { createElement } = await import("react");
  return {
    supportsCanonicalProposeCorrection: (object: OrvekObject) =>
      object.inspectorObjectType === "canonical_concept",
    CanonicalProposeCorrectionControls: ({ object }: { object: OrvekObject }) =>
      createElement(
        "button",
        {
          type: "button",
          "data-testid": "canonical-propose-correction-button",
          "data-shell-item": "map-correction-action",
          "data-live-object-id": object.id,
        },
        "Propose correction",
      ),
    supportsDurableCorrection: () => true,
    DurableCorrectionControls: ({ object }: { object: OrvekObject }) =>
      createElement(
        "section",
        { "data-testid": "durable-corrections" },
        Array.from({ length: 6 }, (_, index) =>
          createElement(
            "button",
            {
              key: index,
              type: "button",
              "data-shell-item": "map-correction-action",
              "data-live-object-id": object.id,
            },
            `Correction ${index + 1}`,
          ),
        ),
      ),
  };
});

vi.mock("@/lib/map-profile-facts", () => ({
  profileSectionMappingForObject: () => null,
}));

vi.mock("@/lib/orvek-v0/page-handlers", () => ({
  useOrvekPageHandlers: () => ({}),
}));

vi.mock("@/lib/orvek-v0/display-contract", () => ({
  isProductionDisplay: (api: OrvekDataApi) => api.referenceSurface !== true,
}));

vi.mock("@/lib/orvek-v0/workbench-route-history", () => ({
  resolveWorkbenchRoutePath: () => "/",
  updateWorkbenchHistory: vi.fn(),
  isIsolatedWorkbenchPath: () => false,
}));

vi.mock("@/components/orvek-v0-reference-frozen/reference-data", async () =>
  import("../../components/orvek-v0-reference-frozen/reference-data"),
);

vi.mock("@/components/orvek-v0-canonical/canonical-data-context", () => ({
  useCanonicalData: () => {
    if (!renderState.runtime) {
      throw new Error("Canonical page rendered without runtime data.");
    }
    return renderState.runtime;
  },
}));

vi.mock("@/components/orvek-v0/store", () => ({
  useWorkbench: () => ({
    page: "today",
    selectedId: null,
    select: vi.fn(),
    setPage: vi.fn(),
    openReport: vi.fn(),
    setInspectorTab: vi.fn(),
    applyCorrection: vi.fn(),
    corrections: {},
    setExploreActive: vi.fn(),
  }),
}));

const EXPECTED = {
  map: {
    groups: 8,
    rows: 30,
    supporting: 2,
    conflicting: 1,
    related: 3,
    corrections: 6,
  },
  decisions: {
    groups: 4,
    rows: 8,
    stages: 5,
    options: 3,
    contexts: 4,
    contextChips: 3,
    receipts: 3,
    actions: 3,
  },
  timeline: {
    filters: 8,
    lanes: 4,
    groups: 5,
    rows: 15,
  },
  exploreFree: {
    tabs: 4,
    messages: 2,
    grounding: 5,
    movementNotes: 1,
    composers: 1,
    prompts: 4,
  },
  questions: {
    rows: 4,
    signalCards: 2,
    related: 3,
    actions: 4,
  },
  investigations: {
    rows: 3,
    hypotheses: 2,
    missingEvidence: 2,
    linked: 3,
    excerpts: 1,
    actions: 4,
  },
  fieldwork: {
    fields: 5,
    actions: 2,
  },
  navigator: {
    links: 5,
    pulses: 1,
  },
};

const EXPECTED_CANONICAL_MAP = {
  ...EXPECTED.map,
  corrections: 0,
};

const EXPECTED_CANONICAL_LIVE_MAP = {
  ...EXPECTED.map,
};

const REFERENCE_PERSONAL_CLAIMS = [
  "You often need visual expression before locking architecture.",
  "Use v0 architecture prototype before final design",
  "Why do I feel like we need to see the architecture visually before locking design?",
  "User Background / Context Profile added to system architecture",
  "Model changed in 4 places",
];

function count(html: string, pattern: RegExp): number {
  return Array.from(html.matchAll(pattern)).length;
}

function countAttribute(html: string, attribute: string, value: string): number {
  return count(html, new RegExp(`${attribute}="${value}"`, "g"));
}

function canonicalMapSignature(html: string): typeof EXPECTED.map {
  return {
    groups: countAttribute(html, "data-shell-item", "map-category"),
    rows: countAttribute(html, "data-shell-item", "map-rail-row"),
    supporting: countAttribute(html, "data-shell-item", "map-supporting-row"),
    conflicting: countAttribute(html, "data-shell-item", "map-conflicting-row"),
    related: countAttribute(html, "data-shell-item", "map-related-row"),
    corrections: countAttribute(html, "data-shell-item", "map-correction-action"),
  };
}

function canonicalDecisionsSignature(html: string): typeof EXPECTED.decisions {
  return {
    groups: countAttribute(html, "data-shell-item", "decision-group"),
    rows: countAttribute(html, "data-shell-item", "decision-rail-row"),
    stages: countAttribute(html, "data-shell-item", "decision-stage"),
    options: countAttribute(html, "data-shell-item", "decision-option"),
    contexts: countAttribute(html, "data-shell-item", "decision-context-row"),
    contextChips: countAttribute(html, "data-shell-item", "decision-context-chip"),
    receipts: countAttribute(html, "data-shell-item", "decision-receipt-row"),
    actions: countAttribute(html, "data-shell-item", "decision-workspace-action"),
  };
}

function canonicalTimelineSignature(html: string): typeof EXPECTED.timeline {
  return {
    filters: countAttribute(html, "data-shell-item", "timeline-filter"),
    lanes: countAttribute(html, "data-shell-item", "timeline-lane"),
    groups: countAttribute(html, "data-shell-item", "timeline-group"),
    rows: countAttribute(html, "data-shell-item", "timeline-row"),
  };
}

function canonicalExploreFreeSignature(html: string): typeof EXPECTED.exploreFree {
  return {
    tabs: countAttribute(html, "data-shell-item", "explore-tab"),
    messages: countAttribute(html, "data-shell-item", "explore-message"),
    grounding: countAttribute(html, "data-shell-item", "explore-grounding-chip"),
    movementNotes: countAttribute(html, "data-shell-slot", "explore-movement-note"),
    composers: countAttribute(html, "data-shell-slot", "explore-composer"),
    prompts: countAttribute(html, "data-shell-item", "explore-quick-prompt"),
  };
}

function canonicalQuestionsSignature(html: string): typeof EXPECTED.questions {
  return {
    rows: countAttribute(html, "data-shell-item", "question-row"),
    signalCards: countAttribute(html, "data-shell-item", "question-signal-card"),
    related: countAttribute(html, "data-shell-item", "question-related-chip"),
    actions: countAttribute(html, "data-shell-item", "question-action"),
  };
}

function canonicalInvestigationsSignature(
  html: string,
): typeof EXPECTED.investigations {
  return {
    rows: countAttribute(html, "data-shell-item", "investigation-row"),
    hypotheses: countAttribute(html, "data-shell-item", "investigation-hypothesis"),
    missingEvidence: countAttribute(html, "data-shell-item", "investigation-missing-row"),
    linked: countAttribute(html, "data-shell-item", "investigation-linked-chip"),
    excerpts: countAttribute(
      html,
      "data-shell-slot",
      "investigation-conversation-excerpt",
    ),
    actions: countAttribute(html, "data-shell-item", "investigation-action"),
  };
}

function canonicalFieldworkSignature(html: string): typeof EXPECTED.fieldwork {
  return {
    fields: countAttribute(html, "data-shell-item", "fieldwork-field"),
    actions: countAttribute(html, "data-shell-item", "fieldwork-action"),
  };
}

function navigatorSignature(html: string): typeof EXPECTED.navigator {
  return {
    links: countAttribute(html, "data-shell-item", "navigator-link"),
    pulses: countAttribute(html, "data-shell-slot", "navigator-model-pulse"),
  };
}

function referenceMapSignature(html: string): typeof EXPECTED.map {
  const labels = [
    "Patterns",
    "Claims",
    "Active conflicts",
    "Goals / directions",
    "Background / Context",
    "Active questions",
    "Model updates",
    "Uncertainty",
  ];
  return {
    groups: labels.filter((label) => html.includes(`>${label}</h3>`)).length,
    rows: count(
      html,
      /class="o-calm flex w-full items-center gap-2 rounded-\[7px\] px-2 py-1\.5 text-left text-\[13px\] leading-snug/g,
    ),
    supporting: count(html, /<span class="mt-0\.5 text-primary">\+<\/span>/g),
    conflicting: count(html, /<span class="mt-0\.5 text-destructive">−<\/span>/g),
    related: count(
      html,
      /class="o-calm group flex w-full items-center gap-2\.5 px-3 py-2 text-left hover:bg-accent\/40"/g,
    ),
    corrections: count(
      html,
      /class="o-calm rounded-full px-2\.5 py-1 text-xs font-medium/g,
    ),
  };
}

function referenceDecisionsSignature(html: string): typeof EXPECTED.decisions {
  return {
    groups: ["Active", "Chosen", "Outcome due", "Reviewed"].filter((label) =>
      html.includes(`>${label}</h3>`),
    ).length,
    rows: count(
      html,
      /class="o-calm flex w-full items-center gap-2 rounded-\[7px\] px-2 py-1\.5 text-left text-\[13px\] leading-snug/g,
    ),
    stages: count(
      html,
      /class="o-calm flex size-5 shrink-0 items-center justify-center rounded-full/g,
    ),
    options: count(html, /class="p-3\.5"/g),
    contexts: count(html, /class="flex gap-2 text-\[13px\]"/g),
    contextChips: count(html, /cursor-pointer hover:opacity-80/g),
    receipts: count(
      html,
      /class="o-calm block w-full rounded-\[9px\] rounded-l-sm border-l-2/g,
    ),
    actions: count(
      html,
      /class="o-calm inline-flex items-center gap-1\.5 rounded-\[8px\] bg-secondary\/70 px-2\.5 py-1\.5/g,
    ),
  };
}

function referenceTimelineSignature(html: string): typeof EXPECTED.timeline {
  return {
    filters: count(
      html,
      /class="o-calm w-full rounded-\[7px\] px-2\.5 py-1\.5 text-left text-\[13px\] font-medium/g,
    ),
    lanes: count(html, /class="flex items-center gap-2"><span class="size-2 rounded-full/g),
    groups: count(html, /class="mb-6"/g),
    rows: count(
      html,
      /class="o-calm relative flex w-full gap-3 px-4 py-3 pl-5 text-left/g,
    ),
  };
}

function referenceExploreFreeSignature(html: string): typeof EXPECTED.exploreFree {
  return {
    tabs: ["Free Explore", "Investigations", "Active Questions", "Fieldwork Bridge"].filter(
      (label) => html.includes(label),
    ).length,
    messages: count(html, /class="max-w-\[85%\] px-3\.5 py-2\.5 text-sm leading-relaxed/g),
    grounding: count(html, /cursor-pointer hover:opacity-80/g),
    movementNotes: count(
      html,
      /class="o-calm mt-2\.5 flex w-full items-center gap-2\.5 rounded-2xl/g,
    ),
    composers: count(
      html,
      /class="o-material mt-4 flex items-center gap-2 rounded-2xl p-2"/g,
    ),
    prompts: count(
      html,
      /class="o-calm rounded-full bg-secondary\/60 px-2\.5 py-1 text-xs/g,
    ),
  };
}

function renderCanonical(
  runtime: CanonicalRuntimeData,
  page:
    | "map"
    | "decisions"
    | "timeline"
    | "explore-free"
    | "explore-questions"
    | "explore-investigations"
    | "explore-fieldwork"
    | "navigator",
): string {
  renderState.runtime = runtime;
  renderState.api = runtime.orvekDataApi;
  let node: React.ReactNode;
  if (page === "map") node = <CanonicalMapPage />;
  else if (page === "decisions") node = <CanonicalDecisionsPage />;
  else if (page === "timeline") node = <CanonicalTimelinePage />;
  else if (page === "navigator") node = <Sidebar />;
  else {
    const tab = page.replace("explore-", "") as CanonicalExploreTab;
    node = <CanonicalExplorePage initialTab={tab} />;
  }
  return renderToStaticMarkup(node);
}

function frozenReferenceApi(): OrvekDataApi {
  return {
    ...EMPTY_ORVEK_DATA_API,
    getObject: getReferenceObject,
    getObjects: getReferenceObjects,
    exploreGrounding: EXPLORE_GROUNDING,
    exploreMovement: EXPLORE_MOVEMENT,
    modelStatusCard: {
      movementPlaceCount: 4,
      openQuestionCount: 7,
      openReviewCount: 3,
      destination: { kind: "workbench-page", page: "map" },
    },
    referenceSurface: true,
  };
}

function renderReference(node: React.ReactNode, api = frozenReferenceApi()): string {
  renderState.api = api;
  return renderToStaticMarkup(node);
}

function buildLiveApi(): OrvekDataApi {
  const objects: Record<string, OrvekObject> = {
    "map-live": {
      id: "map-live",
      type: "map-object",
      subtype: "claim",
      title: "Owned map claim",
      summary: "Owned map summary",
      whyItMatters: "Owned map rationale",
      supporting: ["Owned supporting evidence"],
      conflicting: ["Owned conflicting evidence"],
      relatedIds: ["decision-live"],
      lastUpdated: "Today",
    },
    "decision-live": {
      id: "decision-live",
      type: "decision",
      title: "Owned decision",
      summary: "Owned decision summary",
      recommendation: "Owned decision recommendation",
      options: [{ label: "A", text: "Owned option" }],
      decisionContext: [{ label: "Context", value: "Owned context" }],
      contextIds: ["context-live"],
      receiptIds: ["receipt-live"],
      projection: "Owned projection",
      confidence: "Evidence-backed",
      outcomeWindow: "Review tomorrow",
      relatedIds: ["map-live"],
      canonicalReportId: "report-live",
    },
    "context-live": {
      id: "context-live",
      type: "context",
      title: "Owned context",
    },
    "receipt-live": {
      id: "receipt-live",
      type: "receipt",
      title: "Owned receipt",
      sourceText: "Owned receipt text",
    },
    "report-live": {
      id: "report-live",
      type: "report",
      title: "Owned report",
      reportProvenance: "live_model_update",
    },
    "timeline-live": {
      id: "timeline-live",
      type: "timeline-event",
      eventType: "Model Update",
      title: "Owned timeline movement",
      summary: "Owned timeline summary",
      date: "Today",
      before: "Owned prior state",
      after: "Owned updated state",
    },
    "question-live": {
      id: "question-live",
      type: "active-question",
      title: "Owned active question",
      whyItMatters: "Owned question rationale",
      supporting: ["Owned yes signal"],
      conflicting: ["Owned no signal"],
      relatedIds: ["map-live"],
      status: "active",
      evidenceCount: 1,
    },
    "investigation-live": {
      id: "investigation-live",
      type: "investigation",
      title: "Owned investigation",
      whyItMatters: "Owned investigation rationale",
      hypotheses: ["Owned hypothesis"],
      missingEvidence: ["Owned evidence gap"],
      relatedIds: ["map-live"],
      status: "active",
      evidenceCount: 1,
    },
    "fieldwork-live": {
      id: "fieldwork-live",
      type: "fieldwork",
      title: "Owned fieldwork",
      expectedSignal: "Owned expected signal",
      whatToObserve: "Owned observation",
      confirmIf: "Owned confirmation condition",
      weakenIf: "Owned weakening condition",
      reviewWindow: "Owned review window",
      relatedIds: ["question-live"],
    },
  };

  return {
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? [])
        .map((id) => objects[id])
        .filter((item): item is OrvekObject => Boolean(item)),
    mapCategories: [{ id: "claims", label: "Claims", ids: ["map-live"] }],
    mapSelectedId: "map-live",
    mapHeader: {
      confidenceLabel: "current",
      receiptsLabel: "1",
      openQuestionsLabel: "1",
    },
    timelineGroups: [{ heading: "Today", ids: ["timeline-live"] }],
    timelineFilters: [
      "All",
      "Model Updates",
      "Receipts",
      "Decisions",
      "Reports",
      "Fieldwork",
      "Context Profile",
      "Imports",
    ],
    decisionListGroups: [{ heading: "Active", ids: ["decision-live"] }],
    decisionsSelectedId: "decision-live",
    exploreGrounding: ["map-live"],
    exploreMessages: [{ id: "message-live", role: "user", content: "Owned message" }],
    exploreQuestionIds: ["question-live"],
    exploreInvestigationIds: ["investigation-live"],
    exploreFieldworkIds: ["fieldwork-live"],
    modelStatusCard: {
      movementPlaceCount: 2,
      openQuestionCount: 1,
      openReviewCount: 1,
      destination: { kind: "workbench-page", page: "map" },
    },
  };
}

describe("desktop permanent shell cross-page and navigator regression", () => {
  it("locks the frozen default page and navigator structural signatures", () => {
    expect(referenceMapSignature(renderReference(<ReferenceMapPage />))).toEqual(
      EXPECTED.map,
    );
    expect(
      referenceDecisionsSignature(renderReference(<ReferenceDecisionsPage />)),
    ).toEqual(EXPECTED.decisions);
    expect(referenceTimelineSignature(renderReference(<ReferenceTimelinePage />))).toEqual(
      EXPECTED.timeline,
    );
    expect(
      referenceExploreFreeSignature(renderReference(<ReferenceExplorePage />)),
    ).toEqual(EXPECTED.exploreFree);
    expect(navigatorSignature(renderReference(<Sidebar />))).toEqual(EXPECTED.navigator);
  });

  it("keeps every production page and Explore subview complete with empty data", () => {
    const runtime = buildCanonicalLiveRuntimeData(EMPTY_ORVEK_DATA_API);
    const pages = {
      map: renderCanonical(runtime, "map"),
      decisions: renderCanonical(runtime, "decisions"),
      timeline: renderCanonical(runtime, "timeline"),
      free: renderCanonical(runtime, "explore-free"),
      questions: renderCanonical(runtime, "explore-questions"),
      investigations: renderCanonical(runtime, "explore-investigations"),
      fieldwork: renderCanonical(runtime, "explore-fieldwork"),
      navigator: renderCanonical(runtime, "navigator"),
    };
    const html = Object.values(pages).join("");

    expect(canonicalMapSignature(pages.map)).toEqual(EXPECTED_CANONICAL_MAP);
    expect(canonicalDecisionsSignature(pages.decisions)).toEqual(EXPECTED.decisions);
    expect(canonicalTimelineSignature(pages.timeline)).toEqual(EXPECTED.timeline);
    expect(canonicalExploreFreeSignature(pages.free)).toEqual(EXPECTED.exploreFree);
    expect(canonicalQuestionsSignature(pages.questions)).toEqual(EXPECTED.questions);
    expect(canonicalInvestigationsSignature(pages.investigations)).toEqual(
      EXPECTED.investigations,
    );
    expect(canonicalFieldworkSignature(pages.fieldwork)).toEqual(EXPECTED.fieldwork);
    expect(navigatorSignature(pages.navigator)).toEqual(EXPECTED.navigator);

    expect(html).not.toContain("data-live-object-id=");
    expect(html).toContain("No map item is available.");
    expect(html).toContain("No decision is available.");
    expect(html).toContain("No timeline activity is available.");
    expect(html).toContain("No grounded response is available yet.");
    expect(html).toContain("No model movement is ready for review");
    expect(pages.timeline).not.toContain('data-movement-state="moved"');
    expect(pages.navigator).toContain('data-navigator-activity="idle"');
    expect(pages.navigator).not.toMatch(
      /<span(?=[^>]*data-navigator-activity="idle")(?=[^>]*class="[^"]*o-breathe)/,
    );
    expect(pages.free).toContain('data-explore-activity="idle"');
    expect(pages.free).not.toMatch(
      /<span(?=[^>]*data-explore-activity="idle")(?=[^>]*class="[^"]*o-breathe)/,
    );
    for (const claim of REFERENCE_PERSONAL_CLAIMS) {
      expect(html).not.toContain(claim);
    }
  });

  it("keeps the same signatures while loading without restoring reference claims", () => {
    const runtime = buildCanonicalLiveRuntimeData({
      ...EMPTY_ORVEK_DATA_API,
      mapIsLoading: true,
      timelineIsLoading: true,
      decisionsIsLoading: true,
      exploreIsLoading: true,
      activeQuestionsIsLoading: true,
      investigationsIsLoading: true,
      experimentIsLoading: true,
    });
    const pages = {
      map: renderCanonical(runtime, "map"),
      decisions: renderCanonical(runtime, "decisions"),
      timeline: renderCanonical(runtime, "timeline"),
      free: renderCanonical(runtime, "explore-free"),
      questions: renderCanonical(runtime, "explore-questions"),
      investigations: renderCanonical(runtime, "explore-investigations"),
      fieldwork: renderCanonical(runtime, "explore-fieldwork"),
    };

    expect(canonicalMapSignature(pages.map)).toEqual(EXPECTED_CANONICAL_MAP);
    expect(canonicalDecisionsSignature(pages.decisions)).toEqual(EXPECTED.decisions);
    expect(canonicalTimelineSignature(pages.timeline)).toEqual(EXPECTED.timeline);
    expect(canonicalExploreFreeSignature(pages.free)).toEqual(EXPECTED.exploreFree);
    expect(canonicalQuestionsSignature(pages.questions)).toEqual(EXPECTED.questions);
    expect(canonicalInvestigationsSignature(pages.investigations)).toEqual(
      EXPECTED.investigations,
    );
    expect(canonicalFieldworkSignature(pages.fieldwork)).toEqual(EXPECTED.fieldwork);
    expect(Object.values(pages).join("")).toContain("Loading current understanding…");
    expect(Object.values(pages).join("")).not.toContain("data-live-object-id=");
    expect(pages.timeline).not.toContain('data-movement-state="moved"');
    expect(pages.free).toContain('data-explore-activity="active"');
  });

  it("fills only genuine live slots and leaves unavailable positions disabled", () => {
    const runtime = buildCanonicalLiveRuntimeData(buildLiveApi());
    const pages = {
      map: renderCanonical(runtime, "map"),
      decisions: renderCanonical(runtime, "decisions"),
      timeline: renderCanonical(runtime, "timeline"),
      free: renderCanonical(runtime, "explore-free"),
      questions: renderCanonical(runtime, "explore-questions"),
      investigations: renderCanonical(runtime, "explore-investigations"),
      fieldwork: renderCanonical(runtime, "explore-fieldwork"),
      navigator: renderCanonical(runtime, "navigator"),
    };
    const html = Object.values(pages).join("");

    expect(canonicalMapSignature(pages.map)).toEqual(EXPECTED_CANONICAL_LIVE_MAP);
    expect(canonicalDecisionsSignature(pages.decisions)).toEqual(EXPECTED.decisions);
    expect(canonicalTimelineSignature(pages.timeline)).toEqual(EXPECTED.timeline);
    expect(canonicalExploreFreeSignature(pages.free)).toEqual(EXPECTED.exploreFree);
    expect(canonicalQuestionsSignature(pages.questions)).toEqual(EXPECTED.questions);
    expect(canonicalInvestigationsSignature(pages.investigations)).toEqual(
      EXPECTED.investigations,
    );
    expect(canonicalFieldworkSignature(pages.fieldwork)).toEqual(EXPECTED.fieldwork);
    expect(navigatorSignature(pages.navigator)).toEqual(EXPECTED.navigator);

    for (const id of [
      "map-live",
      "decision-live",
      "timeline-live",
      "question-live",
      "investigation-live",
      "fieldwork-live",
    ]) {
      expect(html).toContain(`data-live-object-id="${id}"`);
    }
    expect(html).toContain('title="Model changed in 2 places"');
    expect(html).not.toContain('title="Model changed in 4 places"');
    expect(pages.timeline).toContain('data-movement-state="moved"');
    expect(pages.navigator).toContain('data-navigator-activity="active"');
    expect(html).toMatch(
      /<button(?=[^>]*data-shell-item="map-rail-row")(?=[^>]*data-live-object-id="map-live")[^>]*>/,
    );
    expect(html).toMatch(
      /<button(?=[^>]*data-shell-item="map-rail-row")(?=[^>]*disabled="")[^>]*>/,
    );
  });
});
