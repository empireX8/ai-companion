import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { SurfacedActionView } from "../actions-api";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildDecisionsProductionDataApi } from "../../lib/orvek-v0/production/decisions-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import {
  referenceTagsForDecisionGroup,
  resolveDecisionsOpenSelectionId,
  shouldMergeDecisionsProductionApi,
} from "../../lib/orvek-v0/production/decisions-presentation";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function decisionAction(
  id: string,
  status: SurfacedActionView["status"],
  overrides: Partial<SurfacedActionView> = {},
): SurfacedActionView {
  return {
    id,
    title: `Choice ${id}`,
    whySuggested: "Because recent pattern signal supports it.",
    bucket: "stabilize",
    effort: "Low",
    linkedFamily: null,
    linkedFamilyLabel: null,
    linkedClaimId: "pc-1",
    linkedClaimSummary: "I overcommit when scope expands.",
    linkedGoalId: null,
    linkedGoalStatement: null,
    linkedSourceLabel: "Pattern",
    status,
    note: null,
    surfacedAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

const READY_DECISIONS_ACTIONS: SurfacedActionView[] = [
  decisionAction("act-active", "not_started"),
  decisionAction("act-chosen", "done", {
    note: "Chose the simpler path.",
    linkedClaimId: "pc-2",
    linkedClaimSummary: "Scope pressure rises near deadlines.",
  }),
  decisionAction("act-outcome", "done", {
    linkedClaimId: "pc-3",
    linkedClaimSummary: "Navigation complexity slows decisions.",
  }),
  decisionAction("act-reviewed", "helped", {
    note: "The change held through the release cycle.",
    linkedClaimId: "pc-4",
    linkedClaimSummary: "Investigations feel disconnected when isolated.",
  }),
];

describe("bounded decisions hybrid fetch bridge", () => {
  it("wires Decisions production fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchActionsPageData");
    expect(hookSource).toContain("buildDecisionsProductionDataApi");
    expect(hookSource).toContain("buildHybridWorkbenchDataApi(");
    expect(hookSource).toContain("decisionsApi");
    expect(hookSource).not.toContain("searchParams");
    expect(hookSource).not.toContain("DECISIONS_STABILIZE_TAB_LABEL");
    expect(hookSource).not.toMatch(/router\.(push|replace)\([^)]*\/actions/);
  });

  it("can surface ready Decisions production data through the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const decisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);

    expect(shouldMergeDecisionsProductionApi(decisionsApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      decisionsApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.decisionListGroups.some((group) => group.ids.length > 0)).toBe(true);
    expect(hybridApi.getObject("act-active")?.tags).toEqual(referenceTagsForDecisionGroup("Active"));
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
  });

  it("falls back to reference Decisions when production fetch fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeDecisionsApi = buildDecisionsProductionDataApi([
      decisionAction("act-active", "not_started", {
        linkedClaimId: "pc-missing",
        linkedClaimSummary: null,
      }),
    ]);

    expect(shouldMergeDecisionsProductionApi(unsafeDecisionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      unsafeDecisionsApi,
    );

    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
  });

  it("falls back to reference Decisions when production data is thin or empty", () => {
    const baseApi = createMockOrvekDataApi();
    const emptyDecisionsApi = buildDecisionsProductionDataApi([]);

    expect(shouldMergeDecisionsProductionApi(emptyDecisionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      emptyDecisionsApi,
    );

    expect(hybridApi.decisionListGroups).toEqual([]);
    expect(hybridApi.getObject("d1")?.title).toBe(baseApi.getObject("d1")?.title);
  });

  it("falls back to reference Decisions while production Decisions data is loading", () => {
    const baseApi = createMockOrvekDataApi();
    const loadingDecisionsApi = {
      ...buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS),
      decisionsIsLoading: true,
    };

    expect(shouldMergeDecisionsProductionApi(loadingDecisionsApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      loadingDecisionsApi,
    );

    expect(hybridApi.decisionListGroups).toEqual([]);
  });

  it("preserves linked claim aliases through the hybrid Decisions overlay", () => {
    const baseApi = createMockOrvekDataApi();
    const decisionsApi = buildDecisionsProductionDataApi(READY_DECISIONS_ACTIONS);
    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      decisionsApi,
    );

    expect(hybridApi.getObject("pc-2")?.inspectorObjectType).toBe("pattern_claim");
    expect(hybridApi.getObject("act-chosen")?.receiptIds).toEqual(["pc-2"]);
  });

  it("resolves linked claim inspector targets when provider lookup can resolve them", () => {
    const objects: Record<string, OrvekObject> = {
      "act-active": {
        id: "act-active",
        type: "decision",
        title: "Choice act-active",
        inspectorObjectType: "pattern_claim",
        inspectorObjectId: "pc-1",
        receiptIds: ["pc-1"],
      },
      "pc-1": {
        id: "pc-1",
        type: "receipt",
        title: "Linked pattern",
        inspectorObjectType: "pattern_claim",
        inspectorObjectId: "pc-1",
      },
      d1: {
        id: "d1",
        type: "decision",
        title: "Reference decision",
      },
    };

    const getObject = (id: string | null | undefined) => (id ? objects[id] : undefined);

    expect(resolveDecisionsOpenSelectionId("act-active", getObject)).toBe("pc-1");
    expect(resolveDecisionsOpenSelectionId("pc-1", getObject)).toBe("pc-1");
    expect(resolveDecisionsOpenSelectionId("d1", getObject)).toBe("d1");
  });

  it("DecisionsPage resolves linked receipt inspector targets without bucket tabs", () => {
    const pageSource = readSource("components/orvek-v0/pages/decisions.tsx");

    expect(pageSource).toContain("resolveDecisionsOpenSelectionId");
    expect(pageSource).toContain("resolveInspectorSelection(r.id)");
    expect(pageSource).toContain("select(id)");
    expect(pageSource).not.toContain("V0DecisionsView");
    expect(pageSource).not.toContain("DECISIONS_STABILIZE_TAB_LABEL");
    expect(pageSource).not.toContain("searchParams");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<DecisionsPage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});
