import { describe, expect, it } from "vitest";

import type { MapMapDataInput } from "../orvek-adapters/map";
import { buildMapProductionDataApi } from "../orvek-v0/production/map-api";

const BASE_INPUT: MapMapDataInput = {
  items: [
    {
      id: "c-1",
      title: "Scope reopening under uncertainty",
      summary: "The most active loop; directly raises decision pressure.",
      area: "operating_logic",
      status: "disputed",
      confidenceLevel: "medium",
      evidenceCount: 6,
      updatedAt: "2026-06-24T10:00:00.000Z",
    },
  ],
  isLoading: false,
  loadError: null,
  selectedId: "c-1",
  detail: {
    id: "c-1",
    title: "Scope reopening under uncertainty",
    summary: "The most active loop; directly raises decision pressure.",
    area: "operating_logic",
    status: "disputed",
    confidenceLevel: "medium",
    evidenceCount: 6,
    updatedAt: "2026-06-24T10:00:00.000Z",
    sourceDiversity: 2,
    timeSpreadDays: 14,
    createdAt: "2026-06-20T10:00:00.000Z",
  },
  isDetailLoading: false,
  evidence: [
    {
      sourceTypeLabel: "Journal",
      evidenceSummaryLabel: "Scope reopened twice this week",
      sourceObjectHref: "/library/journal-1",
      createdAt: "2026-06-24T10:00:00.000Z",
      hasEvidence: true,
    },
    {
      sourceTypeLabel: "Pattern",
      evidenceSummaryLabel: "Linked to public-test avoidance",
      sourceObjectHref: "/patterns/pattern-1",
      createdAt: "2026-06-23T10:00:00.000Z",
      hasEvidence: true,
    },
  ],
  openQuestionsCount: 2,
  mindContext: {
    isLoading: false,
    items: [
      {
        id: "pattern-pc-1",
        kind: "pattern",
        title: "Constraints",
        categoryLabel: "Pattern",
        statusLabel: "Active",
        evidenceCount: 3,
        updatedAt: "2026-06-24T10:00:00.000Z",
        detailHref: "/patterns/pc-1",
        inspectorObjectId: "pc-1",
      },
    ],
    summaryCounts: { memories: 1, patterns: 1 },
  },
  movementPreview: { isLoading: false, items: [] },
  openQuestionsPreview: {
    isLoading: false,
    items: [
      {
        id: "aq-1",
        title: "Does public visibility trigger overbuilding?",
        organizingQuestion: "Does public visibility trigger overbuilding?",
        status: "open",
        statusLabel: "Active",
        createdAt: "2026-06-24T10:00:00.000Z",
        updatedAt: "2026-06-24T10:00:00.000Z",
      },
    ],
  },
};

describe("map production data bridge", () => {
  it("projects detail fields onto both rail and selected ids", () => {
    const api = buildMapProductionDataApi(BASE_INPUT);
    const railObject = api.getObject("conclusion-c-1");
    const selectedObject = api.getObject("c-1");

    expect(api.mapSelectedId).toBe("conclusion-c-1");
    expect(railObject?.whyItMatters).toBeUndefined();
    expect(railObject?.summary).toBe(
      "The most active loop; directly raises decision pressure."
    );
    expect(selectedObject?.summary).toBe(railObject?.summary);
    expect(railObject?.supporting).toEqual([
      "Scope reopened twice this week",
      "Linked to public-test avoidance",
    ]);
    expect(railObject?.conflicting?.length).toBeGreaterThan(0);
  });

  it("always exposes the full ontology rail shell", () => {
    const api = buildMapProductionDataApi(BASE_INPUT);

    expect(api.mapCategories).toHaveLength(8);
    expect(api.mapCategories?.every((category) => category.ids.length > 0)).toBe(false);
    expect(api.mapCategories?.some((category) => category.id === "patterns")).toBe(true);
  });

  it("resolves related objects across mixed ontology rails", () => {
    const api = buildMapProductionDataApi(BASE_INPUT);
    const detail = api.getObject("conclusion-c-1");
    const related = api.getObjects(detail?.relatedIds);

    expect(related.length).toBeGreaterThan(0);
    expect(related.some((item) => item.id.startsWith("question-"))).toBe(true);
    expect(related.some((item) => item.id.startsWith("context-"))).toBe(true);
    expect(related.every((item) => item.title.length > 0)).toBe(true);
  });

  it("exposes honest header stats instead of reference-only mock counts", () => {
    const api = buildMapProductionDataApi(BASE_INPUT);

    expect(api.mapHeader).toEqual({
      confidenceLabel: "mixed / evolving",
      receiptsLabel: "6",
      openQuestionsLabel: "2",
    });
  });

  it("never returns undefined entries from getObjects", () => {
    const api = buildMapProductionDataApi(BASE_INPUT);
    const detail = api.getObject("conclusion-c-1");
    const related = api.getObjects(detail?.relatedIds);

    expect(related.some((item) => item === undefined)).toBe(false);
  });

  it("does not collapse when conclusions exist but selectedId is unset", () => {
    const api = buildMapProductionDataApi({
      ...BASE_INPUT,
      selectedId: null,
      detail: null,
      evidence: [],
    });

    expect(api.mapHasContent).toBe(true);
    expect(api.mapSelectedId).toBe("conclusion-c-1");
    expect(api.getObject(api.mapSelectedId!)).toBeDefined();
    expect(api.mapCategories?.some((category) => category.ids.length > 0)).toBe(true);
  });

  it("keeps rails populated from mind context when conclusions are empty", () => {
    const api = buildMapProductionDataApi({
      ...BASE_INPUT,
      items: [],
      selectedId: null,
      detail: null,
      evidence: [],
      openQuestionsCount: 0,
    });

    expect(api.mapHasContent).toBe(true);
    expect(api.mapSelectedId).toBe("context-pattern-pc-1");
    expect(api.getObject("context-pattern-pc-1")).toBeDefined();
    expect(api.mapCategories?.some((category) => category.id === "context")).toBe(true);
    expect(api.mapHeader).toEqual({
      confidenceLabel: "—",
      receiptsLabel: "0",
      openQuestionsLabel: "0",
    });
  });

  it("projects model goals as first-class model-goal objects with safe map links", () => {
    const api = buildMapProductionDataApi({
      ...BASE_INPUT,
      items: [
        {
          id: "m-goal-1",
          title: "Build Orvek into a private intelligence system",
          summary: "Make Orvek a durable model of the user.",
          area: "developmental_vector",
          status: "supported",
          confidenceLevel: "high",
          evidenceCount: 4,
          updatedAt: "2026-06-24T09:00:00.000Z",
        },
      ],
      selectedId: "m-goal-1",
      detail: null,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: {
        isLoading: false,
        items: [],
        summaryCounts: { memories: 0, patterns: 0 },
      },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: {
        isLoading: false,
        items: [],
      },
    });

    const goalRail = api.getObject("goal-m-goal-1");
    const goalAlias = api.getObject("m-goal-1");

    expect(api.mapCategories.find((category) => category.id === "goals")?.ids).toEqual([
      "goal-m-goal-1",
    ]);
    expect(api.mapSelectedId).toBe("goal-m-goal-1");
    expect(goalRail?.type).toBe("model-goal");
    expect(goalRail?.inspectorObjectType).toBe("model_goal");
    expect(goalRail?.inspectorObjectId).toBe("m-goal-1");
    expect(goalRail?.summary).toBe("Make Orvek a durable model of the user.");
    expect(goalRail?.whyItMatters).toBe("Developmental Vector");
    expect(goalRail?.supporting).toEqual([
      "4 linked receipts",
      "Linked path: /your-map?selected=goal-m-goal-1",
    ]);
    expect(goalRail?.confidence).toBe("Supported by linked receipts");
    expect(goalRail?.detailHref).toBe("/your-map?selected=goal-m-goal-1");
    expect(goalRail?.missingEvidence).toBeUndefined();
    expect(goalRail?.whatWouldChange).toEqual(["Capture correction in Capture Life Data"]);
    expect(goalAlias?.id).toBe("m-goal-1");
    expect(goalAlias?.type).toBe("model-goal");
  });

  it("exposes mind context items as selectable context_profile objects and raw aliases", () => {
    const api = buildMapProductionDataApi({
      ...BASE_INPUT,
      items: [],
      selectedId: null,
      detail: null,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: {
        isLoading: false,
        items: [
          {
            id: "memory-ref-1",
            kind: "memory",
            title: "I prefer quiet mornings for deep work.",
            categoryLabel: "Preference",
            statusLabel: "Active",
            evidenceCount: null,
            updatedAt: "2026-06-24T11:00:00.000Z",
            detailHref: "/references/ref-1",
            inspectorObjectId: null,
          },
          {
            id: "pattern-pc-1",
            kind: "pattern",
            title: "I overcommit before deadlines.",
            categoryLabel: "Repetitive loops",
            statusLabel: "Active",
            evidenceCount: 3,
            updatedAt: "2026-06-24T12:00:00.000Z",
            detailHref: "/patterns/pc-1",
            inspectorObjectId: "pc-1",
          },
        ],
        summaryCounts: { memories: 1, patterns: 1 },
      },
    });

    expect(api.mapCategories?.find((category) => category.id === "context")?.ids).toEqual([
      "context-memory-ref-1",
      "context-pattern-pc-1",
    ]);
    expect(["context-memory-ref-1", "context-pattern-pc-1"]).toContain(api.mapSelectedId);

    const memoryRail = api.getObject("context-memory-ref-1");
    const memoryAlias = api.getObject("memory-ref-1");
    const patternRail = api.getObject("context-pattern-pc-1");
    const patternAlias = api.getObject("pattern-pc-1");

    expect(memoryRail?.type).toBe("context");
    expect(memoryRail?.inspectorObjectType).toBe("context_profile");
    expect(memoryRail?.detailHref).toBeUndefined();
    expect(memoryRail?.supporting).toEqual([
      "Linked memory record",
      "Linked path: /references/ref-1",
    ]);
    expect(memoryAlias?.id).toBe("memory-ref-1");
    expect(memoryAlias?.inspectorObjectType).toBe("context_profile");
    expect(memoryAlias?.detailHref).toBeUndefined();
    expect(patternRail?.type).toBe("context");
    expect(patternRail?.inspectorObjectType).toBe("context_profile");
    expect(patternRail?.detailHref).toBeUndefined();
    expect(patternRail?.supporting).toEqual([
      "3 linked receipts",
      "Linked path: /patterns/pc-1",
    ]);
    expect(patternRail?.whatWouldChange).toEqual(["Capture correction in Capture Life Data"]);
    expect(patternAlias?.id).toBe("pattern-pc-1");
    expect(patternAlias?.inspectorObjectId).toBe("pattern-pc-1");
    expect(patternAlias?.detailHref).toBeUndefined();
  });

  it("keeps v0-safe context hrefs clickable while blocking unavailable reference and pattern routes", () => {
    const api = buildMapProductionDataApi({
      ...BASE_INPUT,
      items: [],
      selectedId: null,
      detail: null,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: {
        isLoading: false,
        items: [
          {
            id: "safe-memory-1",
            kind: "memory",
            title: "I keep a map-linked overview of work in one place.",
            categoryLabel: "Preference",
            statusLabel: "Active",
            evidenceCount: null,
            updatedAt: "2026-06-24T13:00:00.000Z",
            detailHref: "/your-map/umc-9",
            inspectorObjectId: null,
          },
          {
            id: "blocked-pattern-1",
            kind: "pattern",
            title: "I reopen the same loop before decisions.",
            categoryLabel: "Pattern",
            statusLabel: "Active",
            evidenceCount: 2,
            updatedAt: "2026-06-24T14:00:00.000Z",
            detailHref: "/patterns/pc-9",
            inspectorObjectId: "pc-9",
          },
        ],
        summaryCounts: { memories: 1, patterns: 1 },
      },
    });

    expect(api.getObject("context-safe-memory-1")?.detailHref).toBe("/your-map/umc-9");
    expect(api.getObject("context-blocked-pattern-1")?.detailHref).toBeUndefined();
  });

  it("reports an empty map only when every production source is empty", () => {
    const api = buildMapProductionDataApi({
      items: [],
      isLoading: false,
      loadError: null,
      selectedId: null,
      detail: null,
      isDetailLoading: false,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: { isLoading: false, items: [] },
    });

    expect(api.mapHasContent).toBe(false);
    expect(api.mapSelectedId).toBeNull();
    expect(api.mapCategories).toHaveLength(8);
    expect(api.mapHeader).toEqual({
      confidenceLabel: "—",
      receiptsLabel: "0",
      openQuestionsLabel: "0",
    });
  });

  it("marks loading state without pretending the map is empty", () => {
    const api = buildMapProductionDataApi({
      ...BASE_INPUT,
      isLoading: true,
    });

    expect(api.mapIsLoading).toBe(true);
    expect(api.mapHasContent).toBe(true);
    expect(api.getObject("conclusion-c-1")).toBeDefined();
  });
});
