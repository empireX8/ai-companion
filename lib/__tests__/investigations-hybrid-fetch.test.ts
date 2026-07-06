import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

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
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";
import type { ActiveQuestionItem } from "../active-questions";
import {
  EXPLORE_INVESTIGATIONS_ENDPOINT,
  fetchExploreInvestigationItems,
  normalizeExploreInvestigationItemsPayload,
  type ExploreInvestigationItem,
} from "../investigations";
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

describe("bounded investigations hybrid fetch bridge", () => {
  it("wires Explore Investigations production fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const investigationsSource = readSource("lib/investigations.ts");

    expect(hookSource).toContain("fetchExploreInvestigationItems");
    expect(hookSource).toContain("buildInvestigationsProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("investigationsApi");
    expect(hookSource).toContain("isLoadingInvestigations");
    expect(investigationsSource).toContain(EXPLORE_INVESTIGATIONS_ENDPOINT);
    expect(investigationsSource).not.toContain("/api/investigations");
    expect(hookSource).not.toContain("/api/investigations");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/investigations/);
  });

  it("passes investigationsApi as the eighth argument and freeExploreChatApi as the ninth", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toMatch(
      /buildHybridWorkbenchDataApi\(\s*baseApi,\s*todayApi,\s*mapApi,\s*timelineApi,\s*decisionsApi,\s*experimentApi,\s*activeQuestionsApi,\s*investigationsApi,\s*freeExploreChatApi,\s*\)/,
    );
  });

  it("can surface ready Investigation production data through the hybrid workbench when enriched", () => {
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

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1"]);
    expect(hybridApi.getObject("inv-resolved-1")?.tags).toEqual(
      referenceTagsForInvestigationStatus("resolved", "Resolved"),
    );
    expect(hybridApi.getObject("inv-1")?.title).toBe(baseApi.getObject("inv-1")?.title);
  });

  it("falls back to reference Investigations when production fetch fails readiness", () => {
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

  it("falls back to reference Investigations when production data is thin or empty", () => {
    const baseApi = createMockOrvekDataApi();
    const emptyInvestigationsApi = buildInvestigationsProductionDataApi([]);
    const thinInvestigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS);

    expect(shouldMergeInvestigationsProductionApi(emptyInvestigationsApi)).toBe(false);
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
    expect(hybridApi.getObject("inv-2")?.title).toBe(baseApi.getObject("inv-2")?.title);
  });

  it("falls back to reference Investigations while production data is loading", () => {
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
  });

  it("rejects Active Questions-owned statuses from Investigations hybrid path", () => {
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

  it("fetchExploreInvestigationItems returns [] on fetch failure", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ items: [] }),
    }) as typeof fetch;

    await expect(fetchExploreInvestigationItems()).resolves.toEqual([]);

    globalThis.fetch = originalFetch;
  });

  it("fetchExploreInvestigationItems tolerates malformed payloads", () => {
    expect(
      normalizeExploreInvestigationItemsPayload({
        items: [
          {
            id: "inv-resolved-1",
            title: "Resolved thread",
            organizingQuestion: "Did the prototype help?",
            status: "resolved",
            statusLabel: "Resolved",
            createdAt: "2026-05-21T09:00:00.000Z",
            updatedAt: "2026-05-21T10:00:00.000Z",
          },
          { id: "inv-bad", title: "Missing fields" },
          null,
        ],
      }),
    ).toEqual([
      {
        id: "inv-resolved-1",
        title: "Resolved thread",
        organizingQuestion: "Did the prototype help?",
        status: "resolved",
        statusLabel: "Resolved",
        createdAt: "2026-05-21T09:00:00.000Z",
        updatedAt: "2026-05-21T10:00:00.000Z",
      },
    ]);
  });

  it("Investigations tab consumes readiness-gated exploreInvestigationIds", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";

    expect(investigationsBlock).toContain('referenceInvestigationIds = ["inv-1", "inv-2", "inv-3"]');
    expect(investigationsBlock).toContain("hasLiveInvestigations");
    expect(investigationsBlock).toContain("exploreInvestigationSelectedId");
    expect(investigationsBlock).not.toContain("isProductionDisplay");
  });

  it("preserves Active Questions and Experiment / Fieldwork parity when Investigations overlay is ready", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS, {
      enrichments: READY_INVESTIGATION_ENRICHMENTS,
    });

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
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1"]);
    expect(hybridApi.exploreInvestigationIds).toEqual(["inv-resolved-1"]);
    expect(hybridApi.getObject("f2")?.title).toBe(baseApi.getObject("f2")?.title);
  });

  it("keeps Fieldwork Bridge, Active Questions tab, and Explore chat untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(explorePageSource).toContain("hasLiveQuestions");
    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
    expect(freeExploreBlock).not.toContain("exploreInvestigationIds");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});
