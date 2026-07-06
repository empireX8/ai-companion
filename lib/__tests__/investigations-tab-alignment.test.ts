import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildActiveQuestionsProductionDataApi } from "../../lib/orvek-v0/production/active-questions-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildInvestigationsProductionDataApi } from "../../lib/orvek-v0/production/investigations-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import {
  referenceTagsForInvestigationStatus,
  resolveInvestigationsOpenSelectionId,
  shouldMergeInvestigationsProductionApi,
} from "../../lib/orvek-v0/production/investigations-presentation";
import {
  referenceTagsForFieldworkStatus,
  shouldMergeExperimentProductionApi,
} from "../../lib/orvek-v0/production/experiment-presentation";
import {
  referenceTagsForActiveQuestionStatus,
  shouldMergeActiveQuestionsProductionApi,
} from "../../lib/orvek-v0/production/active-questions-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";
import type { ActiveQuestionItem } from "../active-questions";
import type { ExploreInvestigationItem } from "../investigations";
import type { WatchForItem } from "../watch-for";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function exploreInvestigationItem(
  id: string,
  overrides: Partial<ExploreInvestigationItem> = {},
): ExploreInvestigationItem {
  return {
    id,
    title: "Why do I reopen scope before design?",
    organizingQuestion: "Understanding the trigger could break the most expensive loop.",
    status: "resolved",
    statusLabel: "Resolved",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

const READY_INVESTIGATION_ENRICHMENTS = {
  "inv-resolved-1": {
    hypotheses: [
      "Visibility raises the stakes and triggers overbuilding.",
      "Uncertainty feels safer to expand than to narrow.",
    ],
    missingEvidence: ["A prototype result", "A shipped narrow test"],
    evidenceCount: 8,
  },
};

const READY_INVESTIGATIONS: ExploreInvestigationItem[] = [
  exploreInvestigationItem("inv-resolved-1"),
];

const READY_ACTIVE_QUESTIONS: ActiveQuestionItem[] = [
  {
    id: "aq-live-1",
    title: "Does public visibility trigger overbuilding?",
    organizingQuestion: "Testing whether anticipated visibility drives scope reopening.",
    status: "open",
    statusLabel: "Open",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
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

describe("investigations tab alignment", () => {
  it("Investigations tab consumes exploreInvestigationIds when readiness-gated production data passes", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";

    expect(investigationsBlock).toContain("exploreInvestigationIds");
    expect(investigationsBlock).toContain("exploreInvestigationSelectedId");
    expect(investigationsBlock).toContain("hasLiveInvestigations");
    expect(investigationsBlock).toContain("resolveInvestigationsOpenSelectionId");
    expect(investigationsBlock).toContain("resolveInspectorSelection");
    expect(investigationsBlock).not.toContain("isProductionDisplay");
  });

  it("can surface ready Investigation production data through the hybrid provider path", () => {
    const baseApi = createMockOrvekDataApi();
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });

    expect(shouldMergeInvestigationsProductionApi(investigationsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1"]);
    expect(hybridApi.exploreInvestigationSelectedId).toBe("inv-resolved-1");
    expect(hybridApi.getObject("inv-resolved-1")?.tags).toEqual(
      referenceTagsForInvestigationStatus("resolved", "Resolved"),
    );
    expect(hybridApi.displayContract).toBeUndefined();
  });

  it("falls back to reference Investigations tab when production data fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeInvestigationsApi = buildInvestigationsProductionDataApi([
      exploreInvestigationItem("inv-broken", {
        title: "   ",
        organizingQuestion: "Understanding the trigger could break the most expensive loop.",
      }),
    ]);

    expect(shouldMergeInvestigationsProductionApi(unsafeInvestigationsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      unsafeInvestigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("falls back to reference Investigations tab when production fetch returns empty data", () => {
    const baseApi = createMockOrvekDataApi();
    const emptyInvestigationsApi = buildInvestigationsProductionDataApi([]);

    expect(shouldMergeInvestigationsProductionApi(emptyInvestigationsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      emptyInvestigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.getObject("inv-2")?.title).toBe(baseApi.getObject("inv-2")?.title);
  });

  it("falls back to reference Investigations tab while production Investigations data is loading", () => {
    const baseApi = createMockOrvekDataApi();
    const loadingInvestigationsApi = {
      ...buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
        enrichments: READY_INVESTIGATION_ENRICHMENTS,
      }),
      investigationsIsLoading: true,
    };

    expect(shouldMergeInvestigationsProductionApi(loadingInvestigationsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      loadingInvestigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("thin list-only rows do not replace rich reference Investigations", () => {
    const baseApi = createMockOrvekDataApi();
    const thinInvestigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS);

    expect(shouldMergeInvestigationsProductionApi(thinInvestigationsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      thinInvestigationsApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.getObject("inv-1")?.hypotheses?.length).toBeGreaterThan(0);
  });

  it("rejects Active-Questions-owned rows from Investigations production merge", () => {
    const baseApi = createMockOrvekDataApi();
    const activeQuestionOwnedApi = buildInvestigationsProductionDataApi([
      exploreInvestigationItem("inv-open", {
        status: "open",
        statusLabel: "Open",
      }),
    ]);

    expect(activeQuestionOwnedApi.exploreInvestigationIds).toEqual([]);
    expect(shouldMergeInvestigationsProductionApi(activeQuestionOwnedApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      activeQuestionOwnedApi,
    );

    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
  });

  it("resolves linked inspector targets for Investigation selection", () => {
    const objects: Record<string, OrvekObject> = {
      "inv-resolved-1": {
        id: "inv-resolved-1",
        type: "investigation",
        title: "Why do I reopen scope before design?",
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
      "inv-1": {
        id: "inv-1",
        type: "investigation",
        title: "Reference investigation",
      },
    };

    const getObject = (id: string | null | undefined) => (id ? objects[id] : undefined);

    expect(resolveInvestigationsOpenSelectionId("inv-resolved-1", getObject)).toBe("c-map-1");
    expect(resolveInvestigationsOpenSelectionId("inv-1", getObject)).toBe("inv-1");
  });

  it("preserves reference Investigations tab fallback wiring", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain('referenceInvestigationIds = ["inv-1", "inv-2", "inv-3"]');
    expect(explorePageSource).toContain(
      "Does seeing the system standing up actually lower the uncertainty, or just move it?",
    );
  });

  it("Active Questions remains unchanged", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const questionsBlock =
      explorePageSource.match(/function Questions\(\) \{([\s\S]*?)\n\}\n\nfunction Investigations/)?.[1] ??
      "";

    expect(questionsBlock).toContain("hasLiveQuestions");
    expect(questionsBlock).toContain("resolveActiveQuestionsOpenSelectionId");
    expect(questionsBlock).not.toContain("hasLiveInvestigations");
  });

  it("Fieldwork Bridge remains unchanged", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("function FieldworkBridge");
    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(explorePageSource).toContain("resolveExperimentOpenSelectionId");
    expect(explorePageSource).toContain('referenceFieldworkId = "f2"');
  });

  it("keeps Explore chat untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(explorePageSource).toContain("function FreeExplore()");
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
    expect(freeExploreBlock).not.toContain("exploreInvestigationIds");
    expect(freeExploreBlock).not.toContain("resolveInvestigationsOpenSelectionId");
  });

  it("preserves Active Questions and Experiment / Fieldwork parity when Investigations tab aligns", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });

    expect(shouldMergeExperimentProductionApi(experimentApi)).toBe(true);
    expect(shouldMergeActiveQuestionsProductionApi(activeQuestionsApi)).toBe(true);
    expect(shouldMergeInvestigationsProductionApi(investigationsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
      activeQuestionsApi,
      investigationsApi,
    );

    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active"]);
    expect(hybridApi.getObject("fw-active")?.tags).toEqual(
      referenceTagsForFieldworkStatus("active", "Active"),
    );
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1"]);
    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1"]);
  });

  it("does not introduce /investigations route navigation", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).not.toMatch(/router\.(push|replace)\([^)]*\/investigations/);
    expect(explorePageSource).not.toContain('href="/investigations"');
  });

  it("does not use raw /api/investigations in the Investigations tab", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";

    expect(investigationsBlock).not.toContain("/api/investigations");
    expect(investigationsBlock).not.toContain("fetchExploreInvestigationItems");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(workbenchSource).not.toContain("V0ExploreView");
  });
});
