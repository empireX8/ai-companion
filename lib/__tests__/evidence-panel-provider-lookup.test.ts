import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { buildTodayProductionDataApi } from "../../lib/orvek-v0/production/today-api";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import {
  resolveOrvekObjectFromGraph,
  resolveOrvekObjectsFromGraph,
} from "../../lib/orvek-v0/data-provider";
import { buildMapProductionDataApi } from "../../lib/orvek-v0/production/map-api";
import { getObject as getZipObject } from "../../lib/orvek-v0/orvek-data";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("evidence panel provider lookup", () => {
  it("EvidencePanel resolves objects through useOrvekObjectGraph", () => {
    const source = readSource("components/orvek-v0/evidence-panel.tsx");

    expect(source).toContain("useOrvekObjectGraph");
    expect(source).toContain('from "@/lib/orvek-v0/data-provider"');
    expect(source).not.toMatch(
      /import\s*\{[^}]*\bgetObject\b[^}]*\}\s*from\s*"@\/lib\/orvek-v0\/orvek-data"/,
    );
  });

  it("prefers provider-backed objects when present", () => {
    const providerObject: OrvekObject = {
      id: "conclusion-c-1",
      type: "map-object",
      title: "Provider-backed map object",
      summary: "Hydrated through OrvekDataProvider.",
    };
    const dataApi = {
      ...createMockOrvekDataApi(),
      getObject: (id: string | null | undefined) =>
        id === "conclusion-c-1" ? providerObject : undefined,
      getObjects: (ids: string[] | undefined) =>
        resolveOrvekObjectsFromGraph(
          {
            ...createMockOrvekDataApi(),
            getObject: (id) => (id === "conclusion-c-1" ? providerObject : undefined),
            getObjects: (ids) =>
              resolveOrvekObjectsFromGraph(null, ids).filter(
                (object) => object.id !== "conclusion-c-1",
              ),
          },
          ids,
        ),
    };

    expect(resolveOrvekObjectFromGraph(dataApi, "conclusion-c-1")).toEqual(providerObject);
  });

  it("falls back to reference zip objects when provider lookup misses", () => {
    const dataApi = createMockOrvekDataApi();

    expect(resolveOrvekObjectFromGraph(dataApi, "m-claim-1")).toMatchObject(
      getZipObject("m-claim-1") ?? {},
    );
    expect(resolveOrvekObjectFromGraph(dataApi, "r6")).toMatchObject(getZipObject("r6") ?? {});
  });

  it("falls back safely when provider and zip both miss", () => {
    expect(resolveOrvekObjectFromGraph(createMockOrvekDataApi(), "missing-object-id")).toBeUndefined();
    expect(resolveOrvekObjectFromGraph(null, "missing-object-id")).toBeUndefined();
  });

  it("keeps Today reference ids available through fallback", () => {
    const dataApi = createMockOrvekDataApi();

    expect(resolveOrvekObjectFromGraph(dataApi, "d1")?.title).toBe(
      getZipObject("d1")?.title,
    );
    expect(resolveOrvekObjectsFromGraph(dataApi, ["r6", "r5", "r2"]).map((object) => object.id)).toEqual([
      "r6",
      "r5",
      "r2",
    ]);
  });

  it("wires bounded Map fetch through the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchYourMapConclusions");
    expect(hookSource).toContain("buildMapProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/your-map/);
  });

  it("resolves safe production Map objects through the provider graph when merged", () => {
    const baseApi = createMockOrvekDataApi();
    const readyMapApi = buildMapProductionDataApi({
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
      ],
      openQuestionsCount: 1,
      mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: { isLoading: false, items: [] },
    });
    const hybridApi = {
      ...baseApi,
      getObject: (id: string | null | undefined) =>
        readyMapApi.getObject(id) ?? resolveOrvekObjectFromGraph(baseApi, id),
      getObjects: (ids: string[] | undefined) =>
        resolveOrvekObjectsFromGraph(
          {
            ...baseApi,
            getObject: (id) => readyMapApi.getObject(id) ?? resolveOrvekObjectFromGraph(baseApi, id),
            getObjects: (ids) => resolveOrvekObjectsFromGraph(baseApi, ids),
          },
          ids,
        ),
    };

    expect(hybridApi.getObject("conclusion-c-1")?.title).toBe("Scope reopening under uncertainty");
    expect(resolveOrvekObjectFromGraph(hybridApi, "conclusion-c-1")?.summary).toBe(
      "The most active loop; directly raises decision pressure.",
    );
  });

  it("resolves parity-safe live Today receipts through the provider graph when merged", () => {
    const baseApi = createMockOrvekDataApi();
    const productionTodayApi = buildTodayProductionDataApi({
      snapshot: {
        surfacingCards: [
          {
            kind: "Recent Pattern",
            title: "Evening stress",
            body: "Grounded capture.",
            meta: "recently",
            detailHref: "/patterns/pattern-1",
            receiptHref: "/patterns/pattern-1",
          },
        ],
        intelligenceUpdates: [],
        userMapConclusions: [],
        watchForItems: [],
        investigations: [],
        actions: [],
        timelineMovements: [],
      },
      isLoading: false,
      briefingDate: "Tuesday · 24 June",
    });
    const hybridApi = buildHybridWorkbenchDataApi(baseApi, productionTodayApi);
    const receiptId = productionTodayApi.todayResurfacedIds?.[0];

    expect(receiptId).toBeTruthy();
    expect(resolveOrvekObjectFromGraph(hybridApi, receiptId)?.sourceText).toBe(
      "Grounded capture.",
    );
    expect(hybridApi.todayObjectGraphParity?.paritySafeEvidencePointers[0]?.inspectorTab).toBe(
      "evidence",
    );
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(shellSource).not.toContain("OrvekEvidencePanel");
    expect(workbenchSource).toContain("<EvidencePanel />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});
