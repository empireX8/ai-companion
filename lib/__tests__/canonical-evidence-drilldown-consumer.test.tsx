/**
 * SUBSYS-003 Slice B — canonical evidence selection consumer.
 *
 * Proves that the permanent Inspector renders the accepted PR #195
 * `canonicalEvidenceDrilldown` projection for direct-movement evidence, reuses
 * the existing selection and Back pattern, and leaves every capability that has
 * not passed its own exit gate unavailable.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EvidencePanel } from "../../components/orvek-v0-authority/evidence-panel";
import type {
  CanonicalModelUpdateEvidenceDrilldownProjection,
  CanonicalModelUpdateInspectorProjection,
  InspectorEvidenceLinkItem,
  InspectorModelUpdateDetail,
} from "../inspector-object-api";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import type { OrvekObject } from "../orvek-v0/orvek-types";
import { composeProductionModelUpdateCanonicalViewModel } from "../orvek-v0/production/model-update-inspector-presentation";
import type { RealityTrackingModelMovementReport } from "../reality-tracking-output-contract";

Object.assign(globalThis, { React });

const renderState = vi.hoisted(() => ({
  api: null as unknown,
  objects: {} as Record<string, unknown>,
  selectedId: null as string | null,
  canGoBack: false,
  backTarget: null as
    | { selectedId: string; inspectorTab: "evidence"; trailLabel: string | null }
    | null,
  handlers: {
    setInspectorTab: vi.fn(),
    setInspectorScrollTopCapture: vi.fn(),
    consumePendingInspectorScrollTop: vi.fn(() => null),
    pushSelection: vi.fn(),
    openReport: vi.fn(),
    setExtraction: vi.fn(),
    setPage: vi.fn(),
    applyCorrection: vi.fn(),
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
      (ids ?? []).map((id) => renderState.objects[id]).filter(Boolean) as OrvekObject[],
  }),
}));

vi.mock("@/lib/orvek-v0/display-contract", () => ({
  isProductionDisplay: (api: OrvekDataApi) => api.referenceSurface !== true,
}));

vi.mock("@/lib/orvek-v0/production/free-explore-chat-presentation", () => ({
  hasLiveExploreChatFromProvider: () => false,
}));

vi.mock("@/lib/explore-surface", () => ({
  EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY:
    "No model movement is available from this conversation yet.",
}));

vi.mock("@/components/orvek-v0/store", () => ({
  useWorkbench: () => ({
    page: "today",
    selectedId: renderState.selectedId,
    inspectorTab: "evidence",
    setInspectorTab: renderState.handlers.setInspectorTab,
    exploreActive: false,
    setInspectorScrollTopCapture: renderState.handlers.setInspectorScrollTopCapture,
    pendingInspectorScrollTop: null,
    consumePendingInspectorScrollTop: renderState.handlers.consumePendingInspectorScrollTop,
    canGoBack: renderState.canGoBack,
    backTarget: renderState.backTarget,
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
    SectionLabel: ({ children }: { children: React.ReactNode }) =>
      createElement("h3", null, children),
    Chip: ({ children }: { children: React.ReactNode }) =>
      createElement("span", null, children),
  };
});

vi.mock("@/components/orvek-v0/durable-user-action-controls", async () => {
  const { createElement } = await import("react");
  return {
    supportsCanonicalProposeCorrection: () => false,
    CanonicalProposeCorrectionControls: () => createElement("span"),
    supportsDurableCorrection: () => false,
    DurableCorrectionControls: () => createElement("span"),
    DurableDecisionOutcomeControls: () => createElement("span"),
    DurableFieldworkCheckInControls: () => createElement("span"),
  };
});

vi.mock("@/components/contradiction/ContradictionDualSourceView", async () => {
  const { createElement } = await import("react");
  return { ContradictionDualSourceView: () => createElement("div") };
});

vi.mock("@/lib/contradiction-inspector-detail-state", () => ({
  createEmptyContradictionInspectorDetailState: () => ({}),
  beginContradictionInspectorDetailLoad: () => ({}),
  resolveContradictionInspectorDetailLoad: (state: unknown) => state,
  failContradictionInspectorDetailLoad: (state: unknown) => state,
  selectRenderableContradictionInspectorDetail: () => null,
}));

// The workspace "@/" alias is not configured for vitest, so every aliased panel
// import needs a module mapping. This one resolves to the real composer.
vi.mock("@/lib/orvek-v0/production/model-update-inspector-presentation", async () =>
  import("../orvek-v0/production/model-update-inspector-presentation"),
);

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

const MODEL_UPDATE_ID = "mu-canonical-tea";
const MODEL_UPDATE_TITLE = "I like tea again now";
const FIRST_SELECTION_ID = "canonical-evidence-1a1a1a1a1a1a1a1a";
const SECOND_SELECTION_ID = "canonical-evidence-2b2b2b2b2b2b2b2b";
const REVISION_SELECTION_ID = "canonical-evidence-3c3c3c3c3c3c3c3c";
const CONCEPT_SELECTION_ID = "canonical-concept-4d4d4d4d4d4d4d4d";

/** Private values the browser must never receive or render. */
const PRIVATE_SOURCE_ID = "msg-private-000111";
const PRIVATE_RELATIONSHIP_ID = "uel-private-000111";
const PRIVATE_REDACTED_TEXT = "Private therapy note that must never reach the browser.";

/** Legacy envelope wording the consumer must not fall back to. */
const LEGACY_ENVELOPE_TITLE = "Legacy envelope title";
const LEGACY_ENVELOPE_SUMMARY = "Legacy envelope summary";

/** Deterministic report prose the evidence object must never be built from. */
const REPORT_FACT = "This movement is recorded as link detected on related pattern.";
const REPORT_CHANGE_CONDITION = "A week of evenings without the drop would weaken this read.";

function emptySection(key: string) {
  return { key, label: key, items: [], emptyState: null };
}

function buildReport(): RealityTrackingModelMovementReport {
  return {
    reportId: MODEL_UPDATE_ID,
    generatedAt: "2026-07-28T12:00:00.000Z",
    evidencePacketSummary: {
      receiptCount: 2,
      sourceTypeCount: 1,
      linkedObjectCount: 1,
      linkedDecisionCount: 0,
      fieldworkCount: 0,
      dateRangeLabel: "28 Jul 2026 → 28 Jul 2026",
      targetLabel: MODEL_UPDATE_TITLE,
    },
    facts: {
      key: "facts",
      label: "Facts",
      items: [{ text: REPORT_FACT, evidenceRefs: [] }],
      emptyState: null,
    },
    stronglySupportedClaims: emptySection("stronglySupportedClaims"),
    inferences: emptySection("inferences"),
    speculations: emptySection("speculations"),
    overreachGuardrails: emptySection("overreachGuardrails"),
    loopPatternDetection: emptySection("loopPatternDetection"),
    modelMovement: {
      key: "modelMovement",
      label: "Movement",
      before: "I don't like tea anymore",
      after: MODEL_UPDATE_TITLE,
      confidenceShift: null,
      items: [],
      emptyState: null,
    },
    realityGate: emptySection("realityGate"),
    fieldworkWatchFor: emptySection("fieldworkWatchFor"),
    reentryAction: emptySection("reentryAction"),
    whatWouldChangeThisConclusion: {
      key: "whatWouldChangeThisConclusion",
      label: "Change",
      items: [{ text: REPORT_CHANGE_CONDITION, evidenceRefs: [] }],
      emptyState: null,
    },
  } as unknown as RealityTrackingModelMovementReport;
}

function directDrilldown(
  overrides: Partial<CanonicalModelUpdateEvidenceDrilldownProjection> = {},
): CanonicalModelUpdateEvidenceDrilldownProjection {
  return {
    selectionId: FIRST_SELECTION_ID,
    evidenceClass: "direct_movement_evidence",
    evidenceClassLabel: "Movement evidence",
    sourceType: "message",
    sourceTypeLabel: "Conversation message",
    role: "supports",
    roleLabel: "Supporting",
    title: "The user said they like tea again now.",
    summary: "The user said they like tea again now.",
    snippet: "I like tea again now",
    recordedAt: "2026-07-28T12:01:00.000Z",
    recordedLabel: "28 Jul 2026, 13:01",
    provenanceLabel: "Movement evidence",
    sourceDisclosure: "available",
    ...overrides,
  };
}

function revisionDrilldown(
  overrides: Partial<CanonicalModelUpdateEvidenceDrilldownProjection> = {},
): CanonicalModelUpdateEvidenceDrilldownProjection {
  return {
    selectionId: REVISION_SELECTION_ID,
    evidenceClass: "resulting_revision_evidence",
    evidenceClassLabel: "Resulting revision evidence",
    sourceType: "journal_entry",
    sourceTypeLabel: "Journal entry",
    role: "supports",
    roleLabel: "Supporting",
    title: "The evening journal repeats the tea preference.",
    summary: "The evening journal repeats the tea preference.",
    snippet: "Made tea again tonight",
    recordedAt: null,
    recordedLabel: null,
    provenanceLabel: "Resulting revision evidence",
    sourceDisclosure: "available",
    ...overrides,
  };
}

/**
 * Mirrors the PR #195 producer envelope, but deliberately carries different
 * legacy label values and a raw source id so the consumer cannot pass by
 * reading the envelope instead of the accepted projection.
 */
function evidenceLinkItem(
  drilldown: CanonicalModelUpdateEvidenceDrilldownProjection,
): InspectorEvidenceLinkItem {
  return {
    id: drilldown.selectionId,
    sourceTypeLabel: drilldown.sourceTypeLabel,
    evidenceSummaryLabel: LEGACY_ENVELOPE_SUMMARY,
    sourceObjectHref: null,
    createdAt: drilldown.recordedAt,
    hasEvidence: true,
    sourceType: drilldown.sourceType,
    sourceId: PRIVATE_SOURCE_ID,
    objectTitle: LEGACY_ENVELOPE_TITLE,
    linkRole: drilldown.role,
    evidenceTarget:
      drilldown.evidenceClass === "direct_movement_evidence"
        ? "direct_movement"
        : "resulting_revision",
    evidenceTargetLabel: drilldown.evidenceClassLabel,
    canonicalEvidenceDrilldown: drilldown,
  };
}

function canonicalProjection(input: {
  direct?: CanonicalModelUpdateEvidenceDrilldownProjection[];
  resulting?: CanonicalModelUpdateEvidenceDrilldownProjection[];
  relatedObjects?: CanonicalModelUpdateInspectorProjection["relatedObjects"];
}): CanonicalModelUpdateInspectorProjection {
  return {
    projectionType: "canonical_model_update_inspector",
    modelUpdateId: MODEL_UPDATE_ID,
    updateLabel: "Conclusion Strengthened",
    displayedTitle: MODEL_UPDATE_TITLE,
    distinctSummary: null,
    createdAt: "2026-07-28T12:00:00.000Z",
    rationale: "The user explicitly corrected the previous tea preference.",
    before: "I don't like tea anymore",
    after: MODEL_UPDATE_TITLE,
    resultingStateAtPublication: {
      title: MODEL_UPDATE_TITLE,
      summary: MODEL_UPDATE_TITLE,
      version: 2,
      acceptedAt: "2026-07-28T12:00:00.000Z",
    },
    currentUnderstandingNow: {
      title: MODEL_UPDATE_TITLE,
      summary: MODEL_UPDATE_TITLE,
      version: 2,
      acceptedAt: "2026-07-28T12:00:00.000Z",
    },
    directMovementEvidence: (input.direct ?? []).map(evidenceLinkItem),
    resultingRevisionEvidence: (input.resulting ?? []).map(evidenceLinkItem),
    relatedObjects: input.relatedObjects ?? [],
  };
}

function modelUpdateDetail(
  projection: CanonicalModelUpdateInspectorProjection | null,
): InspectorModelUpdateDetail {
  return {
    item: {
      id: MODEL_UPDATE_ID,
      createdAt: "2026-07-28T12:00:00.000Z",
      updateTypeLabel: "Conclusion Strengthened",
      affectedObjectType: "canonical_concept_revision" as never,
      affectedObjectTypeLabel: "Canonical model revision",
      affectedObjectId: null,
      affectedObjectHref: null,
      userFacingSummary: MODEL_UPDATE_TITLE,
    },
    report: buildReport(),
    ...(projection ? { canonicalInspectorProjection: projection } : {}),
  };
}

function compose(input: {
  projection: CanonicalModelUpdateInspectorProjection | null;
  legacyEvidence?: InspectorEvidenceLinkItem[];
  inheritedPathways?: Partial<OrvekObject>;
  resolveSelectionId?: (
    objectType: string | null | undefined,
    objectId: string | null | undefined,
  ) => string | null;
}) {
  return composeProductionModelUpdateCanonicalViewModel({
    obj: {
      id: MODEL_UPDATE_ID,
      type: "model-update",
      title: MODEL_UPDATE_TITLE,
      inspectorObjectType: "model_update",
      inspectorObjectId: MODEL_UPDATE_ID,
      ...input.inheritedPathways,
    },
    detail: modelUpdateDetail(input.projection),
    modelUpdateEvidence: input.legacyEvidence ?? [],
    affectedContext: {
      userMap: null,
      pattern: null,
      contradiction: null,
      affectedEvidence: [],
    },
    resolveSelectionId: input.resolveSelectionId ?? (() => null),
    getObjectTitle: () => undefined,
  });
}

function buildApi(objects: Record<string, OrvekObject>): OrvekDataApi {
  return {
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) => (ids ?? []).map((id) => objects[id]).filter(Boolean) as OrvekObject[],
    exploreGrounding: [],
    exploreMovement: [],
    mapCategories: [],
    timelineGroups: [],
    timelineFilters: [],
    decisionListGroups: [],
    referenceSurface: false,
    todayIsLoading: false,
    mapIsLoading: false,
    timelineIsLoading: false,
    decisionsIsLoading: false,
    exploreIsLoading: false,
    activeQuestionsIsLoading: false,
    investigationsIsLoading: false,
    experimentIsLoading: false,
    today: { movements: [] } as unknown as OrvekDataApi["today"],
  };
}

/**
 * Renders the permanent Inspector over the composed view model. The composed
 * object plus its satellites are exactly what the panel keeps in its sticky
 * Inspector overlay, so a satellite id is resolvable for selection and Back.
 */
function renderInspector(input: {
  viewModel: ReturnType<typeof compose>;
  selectedId: string;
  canGoBack?: boolean;
  backTargetId?: string;
  backTrailLabel?: string;
}): string {
  const objects: Record<string, OrvekObject> = {
    ...input.viewModel.satellites,
    [input.viewModel.object.id]: input.viewModel.object,
  };
  renderState.objects = objects;
  renderState.selectedId = input.selectedId;
  renderState.canGoBack = input.canGoBack ?? false;
  renderState.backTarget = input.backTargetId
    ? {
        selectedId: input.backTargetId,
        inspectorTab: "evidence",
        trailLabel: input.backTrailLabel ?? null,
      }
    : null;
  renderState.api = buildApi(objects);
  return renderToStaticMarkup(<EvidencePanel />);
}

function tagWithAttribute(html: string, attribute: string, value: string): string {
  return html.match(new RegExp(`<[^>]+${attribute}="${value}"[^>]*>`))?.[0] ?? "";
}

function countAttribute(html: string, attribute: string, value: string): number {
  return Array.from(html.matchAll(new RegExp(`${attribute}="${value}"`, "g"))).length;
}

function countOccurrences(html: string, value: string): number {
  return html.split(value).length - 1;
}

const EMPTY_PATHWAY_COPY = [
  "No supporting receipt is available.",
  "No supporting signal is available.",
  "No conflicting signal is available.",
  "No relevant background is available.",
  "No related object is available.",
  "No change condition is available.",
];

beforeEach(() => {
  renderState.api = null;
  renderState.objects = {};
  renderState.selectedId = null;
  renderState.canGoBack = false;
  renderState.backTarget = null;
  Object.values(renderState.handlers).forEach((handler) => handler.mockClear());
});

describe("canonical evidence drill-down consumer", () => {
  it("turns one accepted direct-movement projection into exactly one selectable evidence object", () => {
    const { object, satellites } = compose({
      projection: canonicalProjection({ direct: [directDrilldown()] }),
    });

    expect(object.receiptIds).toEqual([FIRST_SELECTION_ID]);
    expect(satellites[FIRST_SELECTION_ID]).toBeDefined();
    expect(satellites[FIRST_SELECTION_ID]?.type).toBe("receipt");
    expect(Object.keys(satellites)).toEqual([FIRST_SELECTION_ID]);
  });

  it("builds the selected evidence object from the accepted projection, not the link envelope or report prose", () => {
    const drilldown = directDrilldown();
    const { satellites } = compose({
      projection: canonicalProjection({ direct: [drilldown] }),
    });
    const selected = satellites[FIRST_SELECTION_ID];

    expect(selected?.title).toBe(drilldown.title);
    expect(selected?.summary).toBe(drilldown.summary);
    expect(selected?.sourceText).toBe(drilldown.snippet);
    expect(selected?.lastUpdated).toBe(drilldown.recordedLabel);
    expect(selected?.date).toBe(drilldown.recordedLabel);
    expect(selected?.sourceOrigin).toBe(drilldown.sourceTypeLabel);
    expect(selected?.subtype).toBe("Movement evidence · Conversation message · Supporting");

    const serialized = JSON.stringify(selected);
    expect(serialized).not.toContain(LEGACY_ENVELOPE_TITLE);
    expect(serialized).not.toContain(LEGACY_ENVELOPE_SUMMARY);
    expect(serialized).not.toContain(REPORT_FACT);
    expect(serialized).not.toContain(REPORT_CHANGE_CONDITION);
  });

  it("exposes no raw source id, relationship id or navigation href on the selected evidence object", () => {
    const { satellites } = compose({
      projection: canonicalProjection({
        direct: [directDrilldown({ selectionId: FIRST_SELECTION_ID })],
      }),
    });
    const selected = satellites[FIRST_SELECTION_ID];

    expect(selected?.inspectorObjectId).toBeUndefined();
    expect(selected?.inspectorObjectType).toBeUndefined();
    expect(selected?.detailHref).toBeUndefined();
    expect(JSON.stringify(selected)).not.toContain(PRIVATE_SOURCE_ID);
    expect(JSON.stringify(selected)).not.toContain(PRIVATE_RELATIONSHIP_ID);
  });

  it("keeps every unprojected pathway empty on the selected evidence object", () => {
    const { satellites } = compose({
      projection: canonicalProjection({ direct: [directDrilldown()] }),
    });
    const selected = satellites[FIRST_SELECTION_ID];

    expect(selected?.receiptIds).toBeUndefined();
    expect(selected?.supporting).toBeUndefined();
    expect(selected?.conflicting).toBeUndefined();
    expect(selected?.contextIds).toBeUndefined();
    expect(selected?.relatedIds).toBeUndefined();
    expect(selected?.whatWouldChange).toBeUndefined();
    expect(selected?.whyItMatters).toBeUndefined();
  });

  it.each([
    ["supports", "Supporting"],
    ["contradicts", "Conflicting"],
    ["context", "Context"],
  ])(
    "turns a %s relationship into one receipt only and never a second pathway",
    (role, roleLabel) => {
      const { object, satellites } = compose({
        projection: canonicalProjection({ direct: [directDrilldown({ role, roleLabel })] }),
      });

      expect(object.receiptIds).toEqual([FIRST_SELECTION_ID]);
      expect(Object.keys(satellites)).toEqual([FIRST_SELECTION_ID]);
      expect(object.supporting).toBeUndefined();
      expect(object.conflicting).toBeUndefined();
      expect(object.contextIds).toBeUndefined();
      expect(object.relatedIds).toBeUndefined();
      expect(object.whatWouldChange).toBeUndefined();
    },
  );

  it("drops inherited pathway prose instead of carrying it onto the canonical ModelUpdate", () => {
    const inherited = "Receipt count makes this look stronger than it is.";
    const { object } = compose({
      projection: canonicalProjection({ direct: [directDrilldown()] }),
      inheritedPathways: {
        supporting: [inherited],
        conflicting: [inherited],
        contextIds: ["stale-context-id"],
        relatedIds: ["stale-related-id"],
        whatWouldChange: [REPORT_CHANGE_CONDITION],
      },
    });

    expect(object.supporting).toBeUndefined();
    expect(object.conflicting).toBeUndefined();
    expect(object.contextIds).toBeUndefined();
    expect(object.relatedIds).toBeUndefined();
    expect(object.whatWouldChange).toBeUndefined();
    expect(JSON.stringify(object)).not.toContain(inherited);
    expect(JSON.stringify(object)).not.toContain("stale-context-id");
    expect(JSON.stringify(object)).not.toContain("stale-related-id");
    expect(JSON.stringify(object)).not.toContain(REPORT_CHANGE_CONDITION);
  });

  it("fails closed for a direct item whose accepted drill-down projection is absent or blank", () => {
    const withoutDrilldown: InspectorEvidenceLinkItem = {
      ...evidenceLinkItem(directDrilldown()),
      canonicalEvidenceDrilldown: undefined,
    };
    const withBlankSelectionId = evidenceLinkItem(
      directDrilldown({ selectionId: "   " }),
    );

    const projection = canonicalProjection({});
    projection.directMovementEvidence = [withoutDrilldown, withBlankSelectionId];

    const { object, satellites } = compose({ projection });

    expect(object.receiptIds).toBeUndefined();
    expect(satellites).toEqual({});
    expect(
      Object.keys(satellites).some((id) => id.startsWith(`mu-receipt-${MODEL_UPDATE_ID}`)),
    ).toBe(false);
    expect(JSON.stringify({ object, satellites })).not.toContain(PRIVATE_SOURCE_ID);
  });

  it("keeps redacted and unavailable evidence private while still showing projected provenance", () => {
    const redacted = directDrilldown({
      selectionId: FIRST_SELECTION_ID,
      sourceDisclosure: "redacted",
      summary: PRIVATE_REDACTED_TEXT,
      snippet: PRIVATE_REDACTED_TEXT,
      title: "Conversation message · 28 Jul 2026, 13:01",
    });
    const unavailable = directDrilldown({
      selectionId: SECOND_SELECTION_ID,
      sourceDisclosure: "unavailable",
      summary: PRIVATE_REDACTED_TEXT,
      snippet: PRIVATE_REDACTED_TEXT,
      title: "Movement evidence · Conversation message",
      recordedAt: null,
      recordedLabel: null,
    });

    const { satellites } = compose({
      projection: canonicalProjection({ direct: [redacted, unavailable] }),
    });

    for (const selectionId of [FIRST_SELECTION_ID, SECOND_SELECTION_ID]) {
      const selected = satellites[selectionId];
      expect(selected?.summary).toBeUndefined();
      expect(selected?.sourceText).toBeUndefined();
      expect(JSON.stringify(selected)).not.toContain(PRIVATE_REDACTED_TEXT);
      expect(JSON.stringify(selected)).not.toContain(PRIVATE_SOURCE_ID);
      expect(selected?.subtype).toContain("Conversation message");
      expect(selected?.subtype).toContain("Movement evidence");
    }

    expect(satellites[FIRST_SELECTION_ID]?.lastUpdated).toBe("28 Jul 2026, 13:01");
    expect(satellites[SECOND_SELECTION_ID]?.lastUpdated).toBeUndefined();
  });

  it("keeps two relationships to the same source separate without semantic fan-out", () => {
    const first = directDrilldown({ selectionId: FIRST_SELECTION_ID });
    const second = directDrilldown({
      selectionId: SECOND_SELECTION_ID,
      recordedAt: "2026-07-28T12:02:00.000Z",
      recordedLabel: "28 Jul 2026, 13:02",
    });

    const { object, satellites } = compose({
      projection: canonicalProjection({ direct: [first, second] }),
    });

    expect(object.receiptIds).toHaveLength(2);
    expect(new Set(object.receiptIds)).toEqual(
      new Set([FIRST_SELECTION_ID, SECOND_SELECTION_ID]),
    );
    expect(satellites[FIRST_SELECTION_ID]?.id).toBe(FIRST_SELECTION_ID);
    expect(satellites[SECOND_SELECTION_ID]?.id).toBe(SECOND_SELECTION_ID);
    expect(Object.keys(satellites)).toHaveLength(2);
    expect(object.contextIds).toBeUndefined();
    expect(object.relatedIds).toBeUndefined();
  });

  it("leaves resulting-revision evidence selection unavailable in this slice", () => {
    const revision = revisionDrilldown();
    const { object, satellites } = compose({
      projection: canonicalProjection({
        direct: [directDrilldown()],
        resulting: [revision],
      }),
    });

    // No server-selection satellite, no positional fallback, no receipt id.
    expect(satellites[REVISION_SELECTION_ID]).toBeUndefined();
    expect(object.receiptIds).toEqual([FIRST_SELECTION_ID]);
    expect(Object.keys(satellites)).toEqual([FIRST_SELECTION_ID]);
    expect(
      Object.keys(satellites).some((id) => id.startsWith(`mu-receipt-${MODEL_UPDATE_ID}`)),
    ).toBe(false);
    expect(JSON.stringify({ object, satellites })).not.toContain(revision.title);
    expect(JSON.stringify({ object, satellites })).not.toContain(
      "Resulting revision evidence",
    );
  });

  it("leaves canonical concept related-object selection unavailable even when a resolver offers one", () => {
    const { object, satellites } = compose({
      projection: canonicalProjection({
        direct: [directDrilldown()],
        relatedObjects: [
          {
            selectionId: CONCEPT_SELECTION_ID,
            title: "I like green tea but not black tea",
            inspectorObjectType: "canonical_concept",
          },
        ],
      }),
      // SUBSYS-004 must stay unavailable even when the workbench could resolve it.
      resolveSelectionId: () => "existing-canonical-workbench-object",
    });

    expect(object.relatedIds).toBeUndefined();
    expect(satellites[CONCEPT_SELECTION_ID]).toBeUndefined();
    expect(satellites["existing-canonical-workbench-object"]).toBeUndefined();
    expect(Object.keys(satellites)).toEqual([FIRST_SELECTION_ID]);
    expect(JSON.stringify({ object, satellites })).not.toContain(
      "I like green tea but not black tea",
    );
  });

  it("leaves noncanonical ModelUpdate composition unchanged", () => {
    const legacyEvidence: InspectorEvidenceLinkItem[] = [
      {
        sourceTypeLabel: "Reference item",
        evidenceSummaryLabel: "I notice energy collapses after long meetings.",
        sourceObjectHref: "/references/ref-1",
        createdAt: "2026-07-17T19:38:00.000Z",
        hasEvidence: true,
        sourceType: "reference_item",
        sourceId: "ref-1",
        linkRole: "supports",
      },
    ];

    const { object, satellites } = compose({
      projection: null,
      legacyEvidence,
    });

    expect(object.receiptIds).toEqual([`mu-receipt-${MODEL_UPDATE_ID}-0`]);
    expect(satellites[`mu-receipt-${MODEL_UPDATE_ID}-0`]?.title).toContain(
      "energy collapses",
    );
    expect(
      Object.keys(satellites).some((id) => id.startsWith("canonical-evidence-")),
    ).toBe(false);
    expect(object.whatWouldChange).toEqual([REPORT_CHANGE_CONDITION]);
  });
});

describe("canonical evidence selection in the permanent Inspector", () => {
  it("renders the accepted evidence as a live receipt row carrying the server selection id", () => {
    const viewModel = compose({
      projection: canonicalProjection({ direct: [directDrilldown()] }),
    });
    const html = renderInspector({ viewModel, selectedId: MODEL_UPDATE_ID });
    const row = tagWithAttribute(html, "data-live-object-id", FIRST_SELECTION_ID);

    expect(row).toContain('data-shell-item="inspector-receipt-row"');
    expect(row).not.toContain('disabled=""');
    expect(html).toContain("The user said they like tea again now.");
    expect(html).not.toContain("Back to");
  });

  it("shows one accepted relationship once, and never repeats it as a signal or background", () => {
    const drilldown = directDrilldown();
    const viewModel = compose({
      projection: canonicalProjection({ direct: [drilldown] }),
    });
    const html = renderInspector({ viewModel, selectedId: MODEL_UPDATE_ID });

    expect(countAttribute(html, "data-live-object-id", FIRST_SELECTION_ID)).toBe(1);
    expect(countOccurrences(html, drilldown.title)).toBe(1);
    expect(html).toContain("Receipts · 1");
    expect(html).toContain("No supporting signal is available.");
    expect(html).toContain("No conflicting signal is available.");
    expect(html).toContain("No relevant background is available.");
    expect(html).toContain("No related object is available.");
    expect(html).toContain("No change condition is available.");
  });

  it("opens exactly one selected evidence object and offers Back to the originating ModelUpdate", () => {
    const viewModel = compose({
      projection: canonicalProjection({
        direct: [
          directDrilldown(),
          directDrilldown({
            selectionId: SECOND_SELECTION_ID,
            title: "A second relationship to the same conversation message.",
            summary: "A second relationship to the same conversation message.",
            snippet: "Second linked snippet",
            recordedAt: "2026-07-28T12:02:00.000Z",
            recordedLabel: "28 Jul 2026, 13:02",
          }),
        ],
      }),
    });

    const html = renderInspector({
      viewModel,
      selectedId: FIRST_SELECTION_ID,
      canGoBack: true,
      backTargetId: MODEL_UPDATE_ID,
      backTrailLabel: "Viewing supporting receipt",
    });

    expect(countAttribute(html, "data-shell-slot", "inspector-object-identity")).toBe(1);
    expect(countAttribute(html, "data-shell-slot", "inspector-receipt-source")).toBe(1);
    expect(html).toContain("The user said they like tea again now.");
    expect(html).toContain("I like tea again now");
    expect(html).toContain("Movement evidence · Conversation message · Supporting");
    expect(html).toContain("28 Jul 2026, 13:01");

    // Only the clicked relationship opens; the sibling relationship stays closed.
    expect(html).not.toContain("A second relationship to the same conversation message.");
    expect(html).not.toContain("Second linked snippet");

    expect(html).toContain(`Back to ${MODEL_UPDATE_TITLE}`);
    expect(html).toContain("Viewing supporting receipt");

    for (const copy of EMPTY_PATHWAY_COPY) {
      expect(html, copy).toContain(copy);
    }
    expect(html).not.toContain(PRIVATE_SOURCE_ID);
    expect(html).not.toContain(REPORT_FACT);
    expect(html).not.toContain(REPORT_CHANGE_CONDITION);
  });

  it("reopens the originating canonical ModelUpdate after Back", () => {
    const viewModel = compose({
      projection: canonicalProjection({ direct: [directDrilldown()] }),
    });

    const afterBack = renderInspector({ viewModel, selectedId: MODEL_UPDATE_ID });

    expect(afterBack).toContain(MODEL_UPDATE_TITLE);
    expect(afterBack).toContain(`>${MODEL_UPDATE_ID}<`);
    expect(afterBack).toContain('data-shell-slot="inspector-object-movement"');
    expect(afterBack).not.toContain("Back to");
    expect(tagWithAttribute(afterBack, "data-live-object-id", FIRST_SELECTION_ID)).toContain(
      'data-shell-item="inspector-receipt-row"',
    );
  });

  it("renders no private text for redacted evidence in the permanent Inspector", () => {
    const viewModel = compose({
      projection: canonicalProjection({
        direct: [
          directDrilldown({
            sourceDisclosure: "redacted",
            summary: PRIVATE_REDACTED_TEXT,
            snippet: PRIVATE_REDACTED_TEXT,
            title: "Conversation message · 28 Jul 2026, 13:01",
          }),
        ],
      }),
    });

    const html = renderInspector({
      viewModel,
      selectedId: FIRST_SELECTION_ID,
      canGoBack: true,
      backTargetId: MODEL_UPDATE_ID,
      backTrailLabel: "Viewing supporting receipt",
    });

    expect(html).not.toContain(PRIVATE_REDACTED_TEXT);
    expect(html).not.toContain(PRIVATE_SOURCE_ID);
    expect(html).toContain("No source text is available.");
    expect(html).toContain("No current summary is available.");
    expect(html).toContain("Conversation message · 28 Jul 2026, 13:01");
  });
});
