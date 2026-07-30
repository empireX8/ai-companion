import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EvidencePanel } from "../../components/orvek-v0-authority/evidence-panel";
import { OBJECTS as FROZEN_REFERENCE_OBJECTS } from "../../components/orvek-v0-reference-frozen/reference-data";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import type { OrvekObject, OrvekObjectType } from "../orvek-v0/orvek-types";

Object.assign(globalThis, { React });

const renderState = vi.hoisted(() => ({
  api: null as unknown,
  objects: {} as Record<string, unknown>,
  selectedId: null as string | null,
  inspectorTab: "evidence" as "evidence" | "movement",
  exploreActive: false,
  handlers: {
    setInspectorTab: vi.fn(),
    setInspectorScrollTopCapture: vi.fn(),
    consumePendingInspectorScrollTop: vi.fn(() => null),
    pushSelection: vi.fn(),
    openReport: vi.fn(),
    setExtraction: vi.fn(),
    setPage: vi.fn(),
    applyCorrection: vi.fn(),
    mountDurableDecisionOutcome: vi.fn(),
    goBack: vi.fn(),
  },
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
  useOrvekData: () => renderState.api,
  useOrvekObjectGraph: () => ({
    getObject: (id?: string | null) =>
      id ? (renderState.objects[id] as OrvekObject | undefined) : undefined,
    getObjects: (ids?: string[]) =>
      (ids ?? [])
        .map((id) => renderState.objects[id])
        .filter(Boolean) as OrvekObject[],
  }),
}));

vi.mock("@/lib/orvek-v0/display-contract", () => ({
  isProductionDisplay: (api: OrvekDataApi) => api.referenceSurface !== true,
}));

vi.mock("@/lib/orvek-v0/production/free-explore-chat-presentation", () => ({
  hasLiveExploreChatFromProvider: (api: OrvekDataApi) =>
    Boolean(api.freeExploreChatSessionId && api.freeExploreSendHandlerAvailable),
}));

vi.mock("@/lib/explore-surface", () => ({
  EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY:
    "No model movement is available from this conversation yet.",
}));

vi.mock("@/components/orvek-v0/store", () => ({
  useWorkbench: () => ({
    page: "today",
    selectedId: renderState.selectedId,
    inspectorTab: renderState.inspectorTab,
    setInspectorTab: renderState.handlers.setInspectorTab,
    exploreActive: renderState.exploreActive,
    setInspectorScrollTopCapture: renderState.handlers.setInspectorScrollTopCapture,
    pendingInspectorScrollTop: null,
    consumePendingInspectorScrollTop:
      renderState.handlers.consumePendingInspectorScrollTop,
    canGoBack: false,
    backTarget: null,
    goBack: renderState.handlers.goBack,
    pushSelection: renderState.handlers.pushSelection,
    openReport: renderState.handlers.openReport,
    extractions: {},
    setExtraction: renderState.handlers.setExtraction,
    setPage: renderState.handlers.setPage,
    corrections: {},
    applyCorrection: renderState.handlers.applyCorrection,
  }),
}));

vi.mock("@/components/orvek-v0/primitives", async () => {
  const { createElement } = await import("react");
  const Icon = () => createElement("svg");
  const meta = (label: string) => ({ label, icon: Icon, tone: "neutral" });
  const typeMeta = {
    receipt: meta("Receipt"),
    decision: meta("Decision"),
    report: meta("Report"),
    fieldwork: meta("Fieldwork"),
    "map-object": meta("Model object"),
    "timeline-event": meta("Timeline event"),
    investigation: meta("Investigation"),
    context: meta("Context"),
    "model-goal": meta("Model goal"),
    "model-update": meta("Model update"),
    "active-question": meta("Active question"),
  };

  return {
    TYPE_META: typeMeta,
    TypeBadge: ({ type }: { type: keyof typeof typeMeta }) =>
      createElement("span", { "data-testid": "type-badge" }, typeMeta[type].label),
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

vi.mock("@/components/orvek-v0/durable-user-action-controls", async () => {
  const { createElement } = await import("react");
  const corrections = [
    "Confirm",
    "This is wrong",
    "Missing context",
    "Only true in this situation",
    "Used to be true",
    "Do not use this assumption",
  ];

  return {
    supportsCanonicalProposeCorrection: (object: OrvekObject) =>
      object.inspectorObjectType === "canonical_concept",
    CanonicalProposeCorrectionControls: ({ object }: { object: OrvekObject }) =>
      createElement(
        "button",
        {
          type: "button",
          "data-testid": "canonical-propose-correction-button",
          "data-shell-item": "inspector-canonical-correction-action",
          "data-live-object-id": object.id,
        },
        "Propose correction",
      ),
    supportsDurableCorrection: () => true,
    DurableCorrectionControls: ({ object }: { object: OrvekObject }) =>
      createElement(
        "section",
        { "data-testid": "durable-corrections" },
        corrections.map((label) =>
          createElement(
            "button",
            {
              key: label,
              type: "button",
              "data-shell-item": "inspector-correction-action",
              "data-live-object-id": object.id,
            },
            label,
          ),
        ),
      ),
    DurableDecisionOutcomeControls: ({ object }: { object: OrvekObject }) => {
      renderState.handlers.mountDurableDecisionOutcome(object.id);
      return createElement(
        "button",
        {
          type: "button",
          "data-testid": "durable-decision-outcome-controls",
          "data-shell-item": "inspector-decision-outcome-action",
          "data-live-object-id": object.id,
        },
        "Add outcome",
      );
    },
    DurableFieldworkCheckInControls: ({ object }: { object: OrvekObject }) =>
      createElement(
        "button",
        {
          type: "button",
          "data-shell-item": "inspector-fieldwork-checkin-action",
          "data-live-object-id": object.id,
        },
        "Save check-in",
      ),
  };
});

vi.mock("@/components/contradiction/ContradictionDualSourceView", async () => {
  const { createElement } = await import("react");
  return {
    ContradictionDualSourceView: () =>
      createElement(
        "div",
        { "data-shell-item": "inspector-contradiction-dual-source" },
        "Two stored interpretations",
      ),
  };
});

vi.mock("@/lib/contradiction-inspector-detail-state", () => ({
  createEmptyContradictionInspectorDetailState: () => ({}),
  beginContradictionInspectorDetailLoad: () => ({}),
  resolveContradictionInspectorDetailLoad: (state: unknown) => state,
  failContradictionInspectorDetailLoad: (state: unknown) => state,
  selectRenderableContradictionInspectorDetail: (_state: unknown, id: string | null) =>
    id
      ? {
          status: "active",
          evidenceCount: 2,
          sideA: "Stored interpretation A",
          sideB: "Stored interpretation B",
          dualSource: true,
        }
      : null,
}));

vi.mock("@/lib/orvek-v0/production/model-update-inspector-presentation", () => ({
  composeProductionModelUpdateCanonicalViewModel: () => null,
}));

vi.mock("@/lib/orvek-v0/inspector-object-overlay", async () => {
  const { createElement, Fragment } = await import("react");
  return {
    InspectorObjectOverlayProvider: ({ children }: { children: React.ReactNode }) =>
      createElement(Fragment, null, children),
  };
});

vi.mock("@/lib/inspector-object-api", () => ({
  INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT: "/api/test/model-update-evidence",
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT: "/api/test/user-map-evidence",
  fetchInspectorContradiction: vi.fn(async () => null),
  fetchInspectorEvidenceLinks: vi.fn(async () => []),
  fetchInspectorModelUpdateDetail: vi.fn(async () => null),
  fetchInspectorPatternClaim: vi.fn(async () => null),
  fetchInspectorUserMapDetail: vi.fn(async () => null),
}));

const COMMON_SIGNATURE = {
  identity: 1,
  summary: 1,
  why: 1,
  receipts: 1,
  receiptRows: 2,
  signals: 1,
  supportingRows: 1,
  conflictingRows: 1,
  context: 1,
  contextRows: 2,
  related: 1,
  relatedRows: 2,
  change: 1,
  changeRows: 2,
  ask: 1,
  corrections: 1,
  correctionActions: 6,
};

const REFERENCE_PERSONAL_CLAIMS = [
  "You often need visual expression before locking architecture.",
  "Use v0 architecture prototype before final design",
  "Why do I feel like we need to see the architecture visually before locking design?",
  "Model changed in 4 places",
];

function countAttribute(html: string, attribute: string, value: string): number {
  return Array.from(
    html.matchAll(new RegExp(`${attribute}="${value}"`, "g")),
  ).length;
}

function tagWithAttribute(html: string, attribute: string, value: string): string {
  return (
    html.match(new RegExp(`<[^>]+${attribute}="${value}"[^>]*>`))?.[0] ?? ""
  );
}

function evidenceSignature(html: string): typeof COMMON_SIGNATURE {
  return {
    identity: countAttribute(html, "data-shell-slot", "inspector-object-identity"),
    summary: countAttribute(html, "data-shell-slot", "inspector-summary"),
    why: countAttribute(html, "data-shell-slot", "inspector-why-it-matters"),
    receipts: countAttribute(html, "data-shell-slot", "inspector-receipts"),
    receiptRows: countAttribute(html, "data-shell-item", "inspector-receipt-row"),
    signals: countAttribute(html, "data-shell-slot", "inspector-signals"),
    supportingRows: countAttribute(
      html,
      "data-shell-item",
      "inspector-supporting-signal",
    ),
    conflictingRows: countAttribute(
      html,
      "data-shell-item",
      "inspector-conflicting-signal",
    ),
    context: countAttribute(html, "data-shell-slot", "inspector-context"),
    contextRows: countAttribute(html, "data-shell-item", "inspector-context-row"),
    related: countAttribute(html, "data-shell-slot", "inspector-related"),
    relatedRows: countAttribute(html, "data-shell-item", "inspector-related-row"),
    change: countAttribute(
      html,
      "data-shell-slot",
      "inspector-what-would-change",
    ),
    changeRows: countAttribute(
      html,
      "data-shell-item",
      "inspector-change-condition",
    ),
    ask: countAttribute(html, "data-shell-slot", "inspector-ask-explore"),
    corrections: countAttribute(html, "data-shell-slot", "inspector-corrections"),
    correctionActions: countAttribute(
      html,
      "data-shell-item",
      "inspector-correction-action",
    ),
  };
}

function movementSignature(html: string) {
  return {
    selected: countAttribute(
      html,
      "data-shell-slot",
      "inspector-selected-movement",
    ),
    before: countAttribute(html, "data-shell-item", "inspector-before"),
    after: countAttribute(html, "data-shell-item", "inspector-after"),
    confidence: countAttribute(
      html,
      "data-shell-slot",
      "inspector-movement-confidence",
    ),
    recent: countAttribute(
      html,
      "data-shell-item",
      "inspector-recent-movement",
    ),
    reportAction: countAttribute(
      html,
      "data-shell-slot",
      "inspector-movement-report-action",
    ),
  };
}

function linkedObjects(prefix: string): Record<string, OrvekObject> {
  return {
    [`${prefix}-receipt-1`]: {
      id: `${prefix}-receipt-1`,
      type: "receipt",
      title: `${prefix} stored receipt one`,
    },
    [`${prefix}-receipt-2`]: {
      id: `${prefix}-receipt-2`,
      type: "receipt",
      title: `${prefix} stored receipt two`,
    },
    [`${prefix}-context-1`]: {
      id: `${prefix}-context-1`,
      type: "context",
      title: `${prefix} stored context one`,
    },
    [`${prefix}-context-2`]: {
      id: `${prefix}-context-2`,
      type: "context",
      title: `${prefix} stored context two`,
    },
    [`${prefix}-related-1`]: {
      id: `${prefix}-related-1`,
      type: "map-object",
      title: `${prefix} stored related object one`,
    },
    [`${prefix}-related-2`]: {
      id: `${prefix}-related-2`,
      type: "active-question",
      title: `${prefix} stored related object two`,
    },
  };
}

function completeObject(prefix: string, type: OrvekObjectType): OrvekObject {
  return {
    id: `${prefix}-selected`,
    type,
    title: `${prefix} selected object`,
    summary: `${prefix} evidence-backed summary`,
    whyItMatters: `${prefix} evidence-backed significance`,
    lastUpdated: "Stored recently",
    receiptIds: [`${prefix}-receipt-1`, `${prefix}-receipt-2`],
    supporting: [`${prefix} supporting signal`],
    conflicting: [`${prefix} conflicting signal`],
    contextIds: [`${prefix}-context-1`, `${prefix}-context-2`],
    relatedIds: [`${prefix}-related-1`, `${prefix}-related-2`],
    whatWouldChange: [
      `${prefix} first change condition`,
      `${prefix} second change condition`,
    ],
  };
}

function buildApi({
  objects,
  referenceSurface = false,
  loading = false,
  recentIds = [],
  exploreMovement = [],
}: {
  objects: Record<string, OrvekObject>;
  referenceSurface?: boolean;
  loading?: boolean;
  recentIds?: string[];
  exploreMovement?: Array<{
    id: string;
    kind: string;
    text: string;
    linkId?: string;
  }>;
}): OrvekDataApi {
  return {
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? []).map((id) => objects[id]).filter(Boolean) as OrvekObject[],
    exploreGrounding: [],
    exploreMovement: exploreMovement as OrvekDataApi["exploreMovement"],
    mapCategories: [],
    timelineGroups: [],
    timelineFilters: [],
    decisionListGroups: [],
    referenceSurface,
    todayIsLoading: loading,
    mapIsLoading: loading,
    timelineIsLoading: loading,
    decisionsIsLoading: loading,
    exploreIsLoading: loading,
    activeQuestionsIsLoading: loading,
    investigationsIsLoading: loading,
    experimentIsLoading: loading,
    today: {
      movements: recentIds.map((id) => ({ id })),
    } as OrvekDataApi["today"],
  };
}

function renderInspector({
  selectedId = null,
  tab = "evidence",
  objects = {},
  referenceSurface = false,
  loading = false,
  recentIds = [],
  exploreActive = false,
  exploreMovement = [],
}: {
  selectedId?: string | null;
  tab?: "evidence" | "movement";
  objects?: Record<string, OrvekObject>;
  referenceSurface?: boolean;
  loading?: boolean;
  recentIds?: string[];
  exploreActive?: boolean;
  exploreMovement?: Array<{
    id: string;
    kind: string;
    text: string;
    linkId?: string;
  }>;
} = {}): string {
  renderState.objects = objects;
  renderState.selectedId = selectedId;
  renderState.inspectorTab = tab;
  renderState.exploreActive = exploreActive;
  renderState.api = buildApi({
    objects,
    referenceSurface,
    loading,
    recentIds,
    exploreMovement,
  });
  return renderToStaticMarkup(<EvidencePanel />);
}

function renderFrozenReferenceInspector({
  selectedId,
  tab,
}: {
  selectedId: string;
  tab: "evidence" | "movement";
}): string {
  renderState.objects = FROZEN_REFERENCE_OBJECTS;
  renderState.selectedId = selectedId;
  renderState.inspectorTab = tab;
  renderState.exploreActive = false;
  renderState.api = buildApi({
    objects: FROZEN_REFERENCE_OBJECTS,
    referenceSurface: true,
  });
  return renderToStaticMarkup(<EvidencePanel />);
}

beforeEach(() => {
  renderState.api = null;
  renderState.objects = {};
  renderState.selectedId = null;
  renderState.inspectorTab = "evidence";
  renderState.exploreActive = false;
  Object.values(renderState.handlers).forEach((handler) => handler.mockClear());
});

describe("permanent shared Inspector shell", () => {
  it("keeps the full Evidence / Context hierarchy in empty, loading, partial, live, and reference states", () => {
    const partial: OrvekObject = {
      id: "live-partial",
      type: "map-object",
      title: "Stored partial object",
    };
    const live = completeObject("live", "map-object");
    const liveObjects = { ...linkedObjects("live"), [live.id]: live };
    const reference = completeObject("reference", "map-object");
    const referenceObjects = {
      ...linkedObjects("reference"),
      [reference.id]: reference,
    };

    const states = [
      renderInspector(),
      renderInspector({ loading: true }),
      renderInspector({
        selectedId: partial.id,
        objects: { [partial.id]: partial },
      }),
      renderInspector({ selectedId: live.id, objects: liveObjects }),
      renderInspector({
        selectedId: reference.id,
        objects: referenceObjects,
        referenceSurface: true,
      }),
    ];

    for (const html of states) {
      expect(evidenceSignature(html)).toEqual(COMMON_SIGNATURE);
      expect(html).not.toContain("Nothing selected");
    }
  });

  it("keeps the common Inspector signature for every representative object type", () => {
    const types: OrvekObjectType[] = [
      "map-object",
      "decision",
      "fieldwork",
      "investigation",
      "report",
      "receipt",
      "model-update",
      "active-question",
    ];
    const states = [
      renderInspector(),
      renderInspector({ loading: true }),
      ...types.map((type) => {
        const object: OrvekObject = {
          id: `partial-${type}`,
          type,
          title: `Stored ${type}`,
        };
        return renderInspector({
          selectedId: object.id,
          objects: { [object.id]: object },
        });
      }),
    ];

    for (const html of states) {
      expect(evidenceSignature(html)).toEqual(COMMON_SIGNATURE);
    }
  });

  it("renders truthful neutral evidence slots without actionable ids", () => {
    for (const html of [renderInspector(), renderInspector({ loading: true })]) {
      expect(html).not.toContain("data-live-object-id=");
      expect(html).toContain("No object is selected");
      expect(html).toContain("Receipts · 0");

      for (const marker of [
        "inspector-receipt-row",
        "inspector-context-row",
        "inspector-related-row",
        "inspector-ask-explore-action",
        "inspector-correction-action",
      ]) {
        const tag = tagWithAttribute(html, "data-shell-item", marker);
        expect(tag, marker).toContain('disabled=""');
      }
    }
  });

  it("fills common slots from genuine selected objects and keeps missing optional data neutral", () => {
    const complete = completeObject("live", "map-object");
    const completeHtml = renderInspector({
      selectedId: complete.id,
      objects: { ...linkedObjects("live"), [complete.id]: complete },
    });
    const partial: OrvekObject = {
      id: "partial-object",
      type: "map-object",
      title: "Stored partial object",
    };
    const partialHtml = renderInspector({
      selectedId: partial.id,
      objects: { [partial.id]: partial },
    });

    expect(completeHtml).toContain("live evidence-backed summary");
    expect(completeHtml).toContain("live stored receipt one");
    expect(completeHtml).toContain('data-live-object-id="live-selected"');
    expect(
      tagWithAttribute(
        completeHtml,
        "data-shell-item",
        "inspector-ask-explore-action",
      ),
    ).not.toContain('disabled=""');

    expect(partialHtml).toContain("No current summary is available.");
    expect(partialHtml).toContain("No supporting receipt is available.");
    expect(partialHtml).not.toContain("reference selected object");
  });

  it("keeps Decision, Fieldwork, Investigation, Report, Receipt, ModelUpdate, and contradiction-specific shells permanent", () => {
    const decision: OrvekObject = {
      id: "partial-decision",
      type: "decision",
      title: "Stored decision",
    };
    const decisionHtml = renderInspector({
      selectedId: decision.id,
      objects: { [decision.id]: decision },
    });
    expect(countAttribute(decisionHtml, "data-shell-item", "inspector-decision-option")).toBe(3);
    expect(
      countAttribute(
        decisionHtml,
        "data-shell-item",
        "inspector-decision-context-row",
      ),
    ).toBe(4);
    for (const slot of [
      "inspector-decision-recommendation",
      "inspector-decision-options",
      "inspector-decision-context",
      "inspector-decision-projection",
      "inspector-decision-outcome",
    ]) {
      expect(countAttribute(decisionHtml, "data-shell-slot", slot), slot).toBe(1);
    }

    const fieldwork: OrvekObject = {
      id: "partial-fieldwork",
      type: "fieldwork",
      title: "Stored fieldwork",
    };
    const fieldworkHtml = renderInspector({
      selectedId: fieldwork.id,
      objects: { [fieldwork.id]: fieldwork },
    });
    for (const slot of [
      "inspector-fieldwork-purpose",
      "inspector-fieldwork-signal",
      "inspector-fieldwork-observation",
      "inspector-fieldwork-calibration",
      "inspector-fieldwork-checkin",
    ]) {
      expect(countAttribute(fieldworkHtml, "data-shell-slot", slot), slot).toBe(1);
    }

    const investigation: OrvekObject = {
      id: "partial-investigation",
      type: "investigation",
      title: "Stored investigation",
    };
    const investigationHtml = renderInspector({
      selectedId: investigation.id,
      objects: { [investigation.id]: investigation },
    });
    expect(
      countAttribute(
        investigationHtml,
        "data-shell-item",
        "inspector-investigation-hypothesis",
      ),
    ).toBe(2);
    expect(
      countAttribute(
        investigationHtml,
        "data-shell-item",
        "inspector-investigation-missing-row",
      ),
    ).toBe(2);

    const report: OrvekObject = {
      id: "stored-report",
      type: "report",
      title: "Stored report",
    };
    const reportHtml = renderInspector({
      selectedId: report.id,
      objects: { [report.id]: report },
    });
    expect(countAttribute(reportHtml, "data-shell-slot", "inspector-report")).toBe(1);
    expect(countAttribute(reportHtml, "data-shell-item", "inspector-open-report")).toBe(1);
    expect(reportHtml).toContain('data-live-object-id="stored-report"');

    const receipt: OrvekObject = {
      id: "stored-receipt",
      type: "receipt",
      title: "Stored receipt",
    };
    const receiptHtml = renderInspector({
      selectedId: receipt.id,
      objects: { [receipt.id]: receipt },
    });
    expect(
      countAttribute(receiptHtml, "data-shell-slot", "inspector-receipt-source"),
    ).toBe(1);
    expect(receiptHtml).toContain("No source text is available.");

    const modelUpdate: OrvekObject = {
      id: "stored-model-update",
      type: "model-update",
      title: "Stored model update",
    };
    const modelUpdateHtml = renderInspector({
      selectedId: modelUpdate.id,
      objects: { [modelUpdate.id]: modelUpdate },
    });
    expect(
      countAttribute(modelUpdateHtml, "data-shell-slot", "inspector-object-movement"),
    ).toBe(1);
    expect(countAttribute(modelUpdateHtml, "data-shell-item", "inspector-before")).toBe(1);
    expect(countAttribute(modelUpdateHtml, "data-shell-item", "inspector-after")).toBe(1);

    const contradiction: OrvekObject = {
      id: "stored-contradiction",
      type: "map-object",
      title: "Stored contradiction",
      inspectorObjectType: "contradiction_node",
      inspectorObjectId: "contradiction-1",
    };
    const contradictionHtml = renderInspector({
      selectedId: contradiction.id,
      objects: { [contradiction.id]: contradiction },
    });
    expect(
      countAttribute(
        contradictionHtml,
        "data-shell-slot",
        "inspector-contradiction-signal",
      ),
    ).toBe(1);
    expect(
      countAttribute(
        contradictionHtml,
        "data-shell-item",
        "inspector-contradiction-dual-source",
      ),
    ).toBe(1);
  });

  it("keeps partial Decision outcome geometry neutral without broadening durable writes", () => {
    const partialDecision: OrvekObject = {
      id: "partial-decision-without-outcome-capability",
      type: "decision",
      title: "Stored partial decision",
    };
    const partialHtml = renderInspector({
      selectedId: partialDecision.id,
      objects: { [partialDecision.id]: partialDecision },
    });
    const neutralInput = tagWithAttribute(
      partialHtml,
      "data-shell-item",
      "inspector-decision-outcome-input",
    );
    const neutralSubmit = tagWithAttribute(
      partialHtml,
      "data-shell-item",
      "inspector-decision-outcome-action",
    );

    expect(
      countAttribute(
        partialHtml,
        "data-shell-slot",
        "inspector-decision-outcome",
      ),
    ).toBe(1);
    expect(neutralInput).toContain('disabled=""');
    expect(neutralInput).not.toContain("data-live-object-id");
    expect(neutralSubmit).toContain('disabled=""');
    expect(neutralSubmit).not.toContain("data-live-object-id");
    expect(partialHtml).not.toContain(
      'data-testid="durable-decision-outcome-controls"',
    );
    expect(
      renderState.handlers.mountDurableDecisionOutcome,
    ).not.toHaveBeenCalled();

    const supportedDecision: OrvekObject = {
      ...partialDecision,
      id: "supported-decision",
      outcomeWindow: "Review after the stored decision window.",
      outcomeState: "open",
    };
    const supportedHtml = renderInspector({
      selectedId: supportedDecision.id,
      objects: { [supportedDecision.id]: supportedDecision },
    });
    expect(supportedHtml).toContain(
      'data-testid="durable-decision-outcome-controls"',
    );
    expect(
      tagWithAttribute(
        supportedHtml,
        "data-shell-item",
        "inspector-decision-outcome-action",
      ),
    ).toContain('data-live-object-id="supported-decision"');
    expect(
      renderState.handlers.mountDurableDecisionOutcome,
    ).toHaveBeenCalledWith("supported-decision");
  });

  it("keeps unsupported common actions visible, disabled, and identity-free", () => {
    for (const type of ["fieldwork", "report", "timeline-event"] as const) {
      const object: OrvekObject = {
        id: `unsupported-${type}`,
        type,
        title: `Stored ${type}`,
      };
      const html = renderInspector({
        selectedId: object.id,
        objects: { [object.id]: object },
      });
      const ask = tagWithAttribute(
        html,
        "data-shell-item",
        "inspector-ask-explore-action",
      );
      const corrections = Array.from(
        html.matchAll(
          /<button[^>]+data-shell-item="inspector-correction-action"[^>]*>/g,
        ),
        (match) => match[0],
      );

      expect(countAttribute(html, "data-shell-slot", "inspector-ask-explore")).toBe(
        1,
      );
      expect(
        countAttribute(html, "data-shell-slot", "inspector-corrections"),
      ).toBe(1);
      expect(corrections).toHaveLength(6);
      for (const correction of corrections) {
        expect(correction).toContain('disabled=""');
        expect(correction).not.toContain("data-live-object-id");
      }
      if (type === "report") {
        expect(ask).toContain('disabled=""');
        expect(ask).not.toContain("data-live-object-id");
      } else {
        expect(ask).not.toContain('disabled=""');
        expect(ask).toContain(`data-live-object-id="${object.id}"`);
      }
    }
  });

  it("keeps the Model Movement hierarchy stable across empty, loading, selected, and reference states", () => {
    const liveMovements = [1, 2, 3].map<OrvekObject>((number) => ({
      id: `live-movement-${number}`,
      type: "model-update",
      title: `Stored movement ${number}`,
      before: `Stored before ${number}`,
      after: `Stored after ${number}`,
      canonicalReportId: `live-movement-${number}`,
    }));
    const liveObjects = Object.fromEntries(
      liveMovements.map((movement) => [movement.id, movement]),
    );
    const referenceMovements = [1, 2, 3].map<OrvekObject>((number) => ({
      id: `mu-${number}`,
      type: "model-update",
      title: `Reference movement ${number}`,
      before: `Reference before ${number}`,
      after: `Reference after ${number}`,
    }));
    const referenceObjects = Object.fromEntries(
      referenceMovements.map((movement) => [movement.id, movement]),
    );
    const expected = {
      selected: 1,
      before: 4,
      after: 4,
      confidence: 1,
      recent: 3,
      reportAction: 1,
    };

    const states = [
      renderInspector({ tab: "movement" }),
      renderInspector({ tab: "movement", loading: true }),
      renderInspector({
        tab: "movement",
        selectedId: liveMovements[0]!.id,
        objects: liveObjects,
        recentIds: liveMovements.map((movement) => movement.id),
      }),
      renderInspector({
        tab: "movement",
        selectedId: referenceMovements[0]!.id,
        objects: referenceObjects,
        referenceSurface: true,
      }),
    ];

    for (const html of states) {
      expect(movementSignature(html)).toEqual(expected);
    }
  });

  it("matches the actual frozen-reference Inspector hierarchy on both tabs", () => {
    const frozenEvidence = renderFrozenReferenceInspector({
      selectedId: "m-claim-1",
      tab: "evidence",
    });
    const frozenMovement = renderFrozenReferenceInspector({
      selectedId: "mu-1",
      tab: "movement",
    });

    const evidence = evidenceSignature(frozenEvidence);
    expect(evidence).toMatchObject({
      identity: 1,
      summary: 1,
      why: 1,
      receipts: 1,
      signals: 1,
      context: 1,
      related: 1,
      change: 1,
      ask: 1,
      corrections: 1,
    });
    expect(evidence.receiptRows).toBeGreaterThanOrEqual(2);
    expect(evidence.supportingRows).toBeGreaterThanOrEqual(1);
    expect(evidence.conflictingRows).toBeGreaterThanOrEqual(1);
    expect(evidence.contextRows).toBeGreaterThanOrEqual(2);
    expect(evidence.relatedRows).toBeGreaterThanOrEqual(2);
    expect(evidence.changeRows).toBeGreaterThanOrEqual(2);
    expect(movementSignature(frozenMovement)).toEqual({
      selected: 1,
      before: 4,
      after: 4,
      confidence: 1,
      recent: 3,
      reportAction: 1,
    });
  });

  it("keeps unavailable Movement actions disabled and real report actions on genuine report ids", () => {
    const empty = renderInspector({ tab: "movement" });
    const emptyReport = tagWithAttribute(
      empty,
      "data-shell-slot",
      "inspector-movement-report-action",
    );
    expect(emptyReport).toContain('disabled=""');
    expect(emptyReport).not.toContain("data-live-object-id");
    for (const tag of Array.from(
      empty.matchAll(
        /<button[^>]+data-shell-item="inspector-recent-movement"[^>]*>/g,
      ),
      (match) => match[0],
    )) {
      expect(tag).toContain('disabled=""');
      expect(tag).not.toContain("data-live-object-id");
    }

    const movementWithoutReport: OrvekObject = {
      id: "live-movement-without-report",
      type: "model-update",
      title: "Stored movement without a report",
      before: "Stored prior state",
      after: "Stored updated state",
    };
    const unavailable = renderInspector({
      tab: "movement",
      selectedId: movementWithoutReport.id,
      objects: { [movementWithoutReport.id]: movementWithoutReport },
      recentIds: [movementWithoutReport.id],
    });
    const unavailableReport = tagWithAttribute(
      unavailable,
      "data-shell-slot",
      "inspector-movement-report-action",
    );
    expect(unavailableReport).toContain('disabled=""');
    expect(unavailableReport).not.toContain("data-live-object-id");
    expect(renderState.handlers.openReport).not.toHaveBeenCalled();

    const movement: OrvekObject = {
      id: "live-movement",
      type: "model-update",
      title: "Stored live movement",
      before: "Stored prior state",
      after: "Stored updated state",
      canonicalReportId: "live-report",
    };
    const live = renderInspector({
      tab: "movement",
      selectedId: movement.id,
      objects: { [movement.id]: movement },
      recentIds: [movement.id],
    });
    const liveReport = tagWithAttribute(
      live,
      "data-shell-slot",
      "inspector-movement-report-action",
    );
    expect(liveReport).toContain('data-live-object-id="live-report"');
    expect(liveReport).not.toContain('disabled=""');
  });

  it("keeps empty Explore movement neutral and only signals activity for real proposals", () => {
    const empty = renderInspector({
      tab: "movement",
      exploreActive: true,
    });
    expect(empty).toContain('data-inspector-explore-activity="idle"');
    expect(empty).not.toContain("o-breathe");
    expect(empty).toContain("No model movement is available from this conversation yet.");
    expect(empty).not.toContain("This may update your model in");

    const active = renderInspector({
      tab: "movement",
      exploreActive: true,
      exploreMovement: [
        {
          id: "stored-proposal",
          kind: "Possible update",
          text: "Stored proposal from the current conversation.",
        },
      ],
    });
    expect(active).toContain('data-inspector-explore-activity="active"');
    expect(active).toContain("o-breathe");
    expect(active).toContain("Stored proposal from the current conversation.");
  });

  it("does not leak frozen reference claims into production empty, loading, or partial Inspector output", () => {
    const partial: OrvekObject = {
      id: "production-partial",
      type: "active-question",
      title: "Stored production question",
    };
    const outputs = [
      renderInspector(),
      renderInspector({ loading: true }),
      renderInspector({
        selectedId: partial.id,
        objects: { [partial.id]: partial },
      }),
    ];

    for (const html of outputs) {
      for (const claim of REFERENCE_PERSONAL_CLAIMS) {
        expect(html).not.toContain(claim);
      }
    }
  });
});
