import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildActiveQuestionsProductionDataApi } from "../../lib/orvek-v0/production/active-questions-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import {
  referenceTagsForActiveQuestionStatus,
  resolveActiveQuestionsOpenSelectionId,
  shouldMergeActiveQuestionsProductionApi,
} from "../../lib/orvek-v0/production/active-questions-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";
import type { ActiveQuestionItem } from "../active-questions";
import { ACTIVE_QUESTIONS_ENDPOINT } from "../active-questions";
import type { WatchForItem } from "../watch-for";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function activeQuestionItem(
  id: string,
  overrides: Partial<ActiveQuestionItem> = {},
): ActiveQuestionItem {
  return {
    id,
    title: "Does public visibility trigger overbuilding?",
    organizingQuestion: "Testing whether anticipated visibility drives scope reopening.",
    status: "open",
    statusLabel: "Open",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

const READY_ACTIVE_QUESTIONS: ActiveQuestionItem[] = [
  activeQuestionItem("aq-live-1", {
    status: "gathering_evidence",
    statusLabel: "Gathering evidence",
  }),
  activeQuestionItem("aq-live-2", {
    title: "Does visual prototyping reduce architecture uncertainty?",
    organizingQuestion: "Whether a v0 prototype meaningfully lowers uncertainty before design.",
    status: "testing",
    statusLabel: "Testing",
  }),
];

const READY_WATCH_FOR_ITEMS: WatchForItem[] = [
  {
    id: "fw-active",
    prompt: "Notice whether scope pressure rises before the next review.",
    reason: "Recent pattern signal suggests visibility triggers overbuilding.",
    status: "active",
    statusLabel: "Active",
    linkedObjectType: "pattern_claim",
    linkedObjectId: "pc-fw-2",
    linkedObjectHref: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
];

describe("bounded active questions hybrid fetch bridge", () => {
  it("wires Active Questions production fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const activeQuestionsSource = readSource("lib/active-questions.ts");

    expect(hookSource).toContain("fetchActiveQuestionItems");
    expect(hookSource).toContain("buildActiveQuestionsProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("activeQuestionsApi");
    expect(hookSource).toContain("isLoadingActiveQuestions");
    expect(activeQuestionsSource).toContain(ACTIVE_QUESTIONS_ENDPOINT);
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/active-questions/);
  });

  it("passes activeQuestionsApi as the seventh argument to buildHybridWorkbenchDataApi", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toMatch(
      /buildHybridWorkbenchDataApi\(\s*baseApi,\s*todayApi,\s*mapApi,\s*timelineApi,\s*decisionsApi,\s*experimentApi,\s*activeQuestionsApi,\s*investigationsApi,\s*freeExploreChatApi,\s*\)/,
    );
  });

  it("can surface ready active-question production data through the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);

    expect(shouldMergeActiveQuestionsProductionApi(activeQuestionsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1", "aq-live-2"]);
    expect(hybridApi.getObject("aq-live-1")?.tags).toEqual(
      referenceTagsForActiveQuestionStatus("gathering_evidence", "Gathering evidence"),
    );
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("falls back to reference Active Questions when production fetch fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeActiveQuestionsApi = buildActiveQuestionsProductionDataApi([
      activeQuestionItem("aq-broken", {
        title: "   ",
        organizingQuestion: "Testing whether anticipated visibility drives scope reopening.",
      }),
    ]);

    expect(shouldMergeActiveQuestionsProductionApi(unsafeActiveQuestionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      unsafeActiveQuestionsApi,
    );

    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("falls back to reference Active Questions when production data is thin or empty", () => {
    const baseApi = createMockOrvekDataApi();
    const emptyActiveQuestionsApi = buildActiveQuestionsProductionDataApi([]);

    expect(shouldMergeActiveQuestionsProductionApi(emptyActiveQuestionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      emptyActiveQuestionsApi,
    );

    expect(hybridApi.exploreQuestionIds).toBeUndefined();
    expect(hybridApi.getObject("aq-1")?.title).toBe(baseApi.getObject("aq-1")?.title);
  });

  it("falls back to reference Active Questions while production Active Questions data is loading", () => {
    const baseApi = createMockOrvekDataApi();
    const loadingActiveQuestionsApi = {
      ...buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS),
      activeQuestionsIsLoading: true,
    };

    expect(shouldMergeActiveQuestionsProductionApi(loadingActiveQuestionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      loadingActiveQuestionsApi,
    );

    expect(hybridApi.exploreQuestionIds).toBeUndefined();
  });

  it("preserves linked object aliases through the hybrid Active Questions overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS, [
      { linkedObjectType: "usermap_conclusion", linkedObjectId: "c-map-1" },
    ]);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionsApi,
    );

    expect(hybridApi.getObject("c-map-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(hybridApi.getObject("aq-live-1")?.whyItMatters).toContain("visibility");
  });

  it("resolves linked inspector targets when provider lookup can resolve them", () => {
    const objects: Record<string, OrvekObject> = {
      "aq-live-1": {
        id: "aq-live-1",
        type: "active-question",
        title: "Does public visibility trigger overbuilding?",
        inspectorObjectId: "c-map-1",
        relatedIds: ["c-map-1"],
      },
      "c-map-1": {
        id: "c-map-1",
        type: "receipt",
        title: "Map conclusion",
        inspectorObjectType: "usermap_conclusion",
        inspectorObjectId: "c-map-1",
      },
      "aq-1": {
        id: "aq-1",
        type: "active-question",
        title: "Reference question",
      },
    };

    const getObject = (id: string | null | undefined) => (id ? objects[id] : undefined);

    expect(resolveActiveQuestionsOpenSelectionId("aq-live-1", getObject)).toBe("c-map-1");
    expect(resolveActiveQuestionsOpenSelectionId("aq-1", getObject)).toBe("aq-1");
  });

  it("Questions tab consumes readiness-gated exploreQuestionIds", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("function Questions()");
    expect(explorePageSource).toContain('["aq-1", "aq-2", "aq-3", "aq-4"]');
    expect(explorePageSource).toContain("hasLiveQuestions");
    expect(explorePageSource).toContain("exploreQuestionSelectedId");
    expect(explorePageSource).toContain("resolveActiveQuestionsOpenSelectionId");
    expect(explorePageSource).not.toMatch(/router\.(push|replace)\([^)]*\/active-questions/);
  });

  it("preserves Experiment / Fieldwork parity when Active Questions overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
      activeQuestionsApi,
    );

    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active"]);
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1", "aq-live-2"]);
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("keeps Investigations reference/mock and Explore chat untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(explorePageSource).toContain('["inv-1", "inv-2", "inv-3"]');
    expect(explorePageSource).toContain("function FieldworkBridge");
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
    expect(freeExploreBlock).not.toContain("exploreQuestionIds");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});
