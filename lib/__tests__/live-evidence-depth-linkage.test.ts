import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  assessSurfacedEvidencePointerReadiness,
  buildDepthSafeSurfacedEvidencePointerGraph,
  mergeSurfacedEvidenceDepthObjects,
  projectSurfacedEvidencePointerToOrvekObject,
  readSurfacedEvidencePointersForUser,
  resolveSurfacedEvidencePointerLinks,
  type SurfacedEvidenceDepthLinkageDeps,
  type SurfacedEvidencePointerRecord,
  type UnderstandingEvidenceLinkRow,
} from "../live-evidence-depth-linkage";
import {
  canUseLiveEvidenceInspectorDepth,
  canUseLiveEvidenceInspectorDepthList,
} from "../orvek-v0/production/evidence-inspector-depth-parity";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import type { OrvekObject } from "../orvek-v0/orvek-types";
import { uelMetaWithGraphSlot } from "../live-evidence-depth-write-contract";

const NOW = new Date("2026-07-09T10:00:00.000Z");

const STORED_POINTER: SurfacedEvidencePointerRecord = {
  id: "receipt-pattern-claim-1",
  userId: "user-1",
  sourceObjectType: "pattern_claim",
  sourceObjectId: "claim-1",
  sourceText: "I keep working past the stop point even when I said I would not.",
  sourceOrigin: "Recent Pattern",
  whyItMatters:
    "Connects evening overwork to the missing stop point before commitments lock.",
  whyResurfaced: null,
  surfacedAt: NOW,
  publicEligible: true,
  status: "active",
  detailHref: "/patterns/claim-1",
  libraryReceiptId: "/library/receipt-pattern-claim-1",
};

const RELATED_TARGET: OrvekObject = {
  id: "conclusion-1",
  type: "map-object",
  title: "Evening stop point matters",
  summary: "Commitments lock before the body signals a stop.",
  whyItMatters: "Explains why overwork repeats after stated boundaries.",
};

const CONTEXT_TARGET: OrvekObject = {
  id: "ctx-evening-1",
  type: "context",
  title: "Evening pressure context",
  summary: "Stress capture clusters around late-evening decisions.",
  supporting: ["Three captures in the same window"],
};

const NEAR_EMPTY_TARGET: OrvekObject = {
  id: "shell-1",
  type: "map-object",
  title: "Untitled pattern",
};

function linkRow(input: {
  targetId: string;
  graphSlot: "related" | "context";
  targetType?: UnderstandingEvidenceLinkRow["targetType"];
  summary?: string | null;
}): UnderstandingEvidenceLinkRow {
  return {
    sourceType: "pattern_claim",
    sourceId: "claim-1",
    targetType: input.targetType ?? "usermap_conclusion",
    targetId: input.targetId,
    role: input.graphSlot === "context" ? "context" : "supports",
    summary: input.summary ?? null,
    meta: uelMetaWithGraphSlot(input.graphSlot),
  };
}

function buildDeps(overrides?: Partial<SurfacedEvidenceDepthLinkageDeps>): SurfacedEvidenceDepthLinkageDeps {
  const hydrator = vi.fn(async ({ targetId }: { targetId: string }) => {
    if (targetId === RELATED_TARGET.id) {
      return RELATED_TARGET;
    }
    if (targetId === CONTEXT_TARGET.id) {
      return CONTEXT_TARGET;
    }
    if (targetId === NEAR_EMPTY_TARGET.id) {
      return NEAR_EMPTY_TARGET;
    }
    return null;
  });

  return {
    listSurfacedEvidencePointers: vi.fn(async () => [STORED_POINTER]),
    listUnderstandingEvidenceLinksForSources: vi.fn(async () => [
      linkRow({ targetId: RELATED_TARGET.id, graphSlot: "related", targetType: "usermap_conclusion" }),
      linkRow({
        targetId: CONTEXT_TARGET.id,
        graphSlot: "context",
        targetType: "usermap_conclusion",
      }),
    ]),
    checkPublicTargetEligibility: vi.fn(async ({ targetId }) => targetId !== "inv-private"),
    hydrateLinkedTargetObject: hydrator,
    ...overrides,
  };
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live evidence depth linkage", () => {
  it("projects a public active stored pointer into a receipt OrvekObject", async () => {
    const deps = buildDeps();
    const graph = await readSurfacedEvidencePointersForUser({ userId: "user-1" }, deps);

    expect(graph.pointerObjects).toHaveLength(1);
    const receipt = graph.pointerObjects[0]!;
    expect(receipt.id).toBe("receipt-pattern-claim-1");
    expect(receipt.type).toBe("receipt");
    expect(receipt.sourceText).toBe(STORED_POINTER.sourceText);
    expect(receipt.whyItMatters).toBe(STORED_POINTER.whyItMatters);
    expect(receipt.relatedIds).toEqual([RELATED_TARGET.id]);
    expect(receipt.contextIds).toEqual([CONTEXT_TARGET.id]);
  });

  it("hydrates linked targets and keeps them non-near-empty", async () => {
    const graph = await readSurfacedEvidencePointersForUser({ userId: "user-1" }, buildDeps());
    expect(graph.linkedObjects.map((object) => object.id)).toEqual([
      RELATED_TARGET.id,
      CONTEXT_TARGET.id,
    ]);
    expect(graph.linkedObjects.every((object) => object.summary || object.whyItMatters)).toBe(
      true,
    );
  });

  it("passes canUseLiveEvidenceInspectorDepthList for a stored fixture", async () => {
    const graph = await readSurfacedEvidencePointersForUser({ userId: "user-1" }, buildDeps());
    const api = mergeSurfacedEvidenceDepthObjects(EMPTY_ORVEK_DATA_API, graph);

    expect(graph.inspectorDepthListReady).toBe(true);
    expect(canUseLiveEvidenceInspectorDepthList(api, graph.depthSafePointerIds)).toBe(true);
    expect(canUseLiveEvidenceInspectorDepth(api, graph.depthSafePointerIds[0]!)).toBe(true);
  });

  it("fails generic or missing whyItMatters", async () => {
    const generic = await assessSurfacedEvidencePointerReadiness({
      userId: "user-1",
      pointer: { ...STORED_POINTER, whyItMatters: "Surfaced from your recent material." },
      linkRows: [linkRow({ targetId: RELATED_TARGET.id, graphSlot: "related" })],
      deps: buildDeps(),
    });
    expect(generic.ready).toBe(false);
    expect(generic.blockers).toContain("generic_why_it_matters");

    const missing = await assessSurfacedEvidencePointerReadiness({
      userId: "user-1",
      pointer: { ...STORED_POINTER, whyItMatters: "" },
      linkRows: [linkRow({ targetId: RELATED_TARGET.id, graphSlot: "related" })],
      deps: buildDeps(),
    });
    expect(missing.ready).toBe(false);
    expect(missing.blockers).toContain("missing_why_it_matters");
  });

  it("excludes links missing graphSlot in UEL meta", async () => {
    const resolved = await resolveSurfacedEvidencePointerLinks({
      userId: "user-1",
      pointer: STORED_POINTER,
      linkRows: [
        {
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          targetType: "usermap_conclusion",
          targetId: "conclusion-1",
          role: "supports",
          summary: null,
          meta: {},
        },
      ],
      checkPublicTargetEligibility: async () => true,
    });
    expect(resolved.eligibleLinks).toHaveLength(0);
    expect(resolved.blockers).toContain("missing_graph_slot");
  });

  it("excludes unauthorized/private links", async () => {
    const graph = await buildDepthSafeSurfacedEvidencePointerGraph({
      userId: "user-1",
      pointers: [STORED_POINTER],
      linkRows: [
        linkRow({ targetId: "inv-private", graphSlot: "related", targetType: "investigation" }),
      ],
      deps: {
        checkPublicTargetEligibility: async ({ targetId }) => targetId !== "inv-private",
        hydrateLinkedTargetObject: async () => RELATED_TARGET,
      },
    });
    expect(graph.depthSafePointerIds).toEqual([]);
    expect(graph.rejectedPointers[0]?.blockers).toContain("no_eligible_links");
  });

  it("rejects pointer when all links are excluded", async () => {
    const graph = await readSurfacedEvidencePointersForUser(
      { userId: "user-1" },
      buildDeps({
        checkPublicTargetEligibility: async () => false,
      }),
    );
    expect(graph.pointerObjects).toEqual([]);
    expect(graph.rejectedPointers[0]?.blockers).toContain("no_eligible_links");
  });

  it("rejects unhydrated targets without fabricating placeholders", async () => {
    const graph = await readSurfacedEvidencePointersForUser(
      { userId: "user-1" },
      buildDeps({
        hydrateLinkedTargetObject: async () => null,
      }),
    );
    expect(graph.depthSafePointerIds).toEqual([]);
    expect(graph.rejectedPointers[0]?.blockers).toContain("unhydrated_target");
  });

  it("rejects near-empty hydrated targets", async () => {
    const graph = await buildDepthSafeSurfacedEvidencePointerGraph({
      userId: "user-1",
      pointers: [STORED_POINTER],
      linkRows: [linkRow({ targetId: NEAR_EMPTY_TARGET.id, graphSlot: "related" })],
      deps: {
        checkPublicTargetEligibility: async () => true,
        hydrateLinkedTargetObject: async () => NEAR_EMPTY_TARGET,
      },
    });
    expect(graph.depthSafePointerIds).toEqual([]);
    expect(graph.rejectedPointers[0]?.blockers).toContain("near_empty_target");
  });

  it("maps graphSlot related/context to relatedIds and contextIds", () => {
    const receipt = projectSurfacedEvidencePointerToOrvekObject({
      pointer: STORED_POINTER,
      relatedIds: [RELATED_TARGET.id],
      contextIds: [CONTEXT_TARGET.id],
    });
    expect(receipt.relatedIds).toEqual([RELATED_TARGET.id]);
    expect(receipt.contextIds).toEqual([CONTEXT_TARGET.id]);
  });

  it("does not read publicEligible false pointers", async () => {
    const graph = await readSurfacedEvidencePointersForUser(
      { userId: "user-1" },
      buildDeps({
        listSurfacedEvidencePointers: async () => [
          { ...STORED_POINTER, publicEligible: false },
        ],
      }),
    );
    expect(graph.pointerObjects).toEqual([]);
    expect(graph.depthSafePointerIds).toEqual([]);
  });

  it("does not read inactive dismissed/expired/hidden pointers", async () => {
    for (const status of ["dismissed", "expired", "hidden"] as const) {
      const graph = await readSurfacedEvidencePointersForUser(
        { userId: "user-1" },
        buildDeps({
          listSurfacedEvidencePointers: async () => [
            { ...STORED_POINTER, status },
          ],
        }),
      );
      expect(graph.pointerObjects).toEqual([]);
    }
  });

  it("does not treat detailHref/receiptHref alone as depth-safe", async () => {
    const hrefOnly = await assessSurfacedEvidencePointerReadiness({
      userId: "user-1",
      pointer: {
        ...STORED_POINTER,
        detailHref: "/patterns/claim-1",
        libraryReceiptId: "/library/receipt-pattern-claim-1",
      },
      linkRows: [],
      deps: buildDeps(),
    });
    expect(hrefOnly.ready).toBe(false);
    expect(hrefOnly.blockers).toContain("no_eligible_links");
  });

  it("registers depth-safe objects in provider lookup without changing Today resurfaced ids", () => {
    const base = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-0-thin-live"],
      getObject: () => undefined,
    };
    const graph = {
      pointerObjects: [
        projectSurfacedEvidencePointerToOrvekObject({
          pointer: STORED_POINTER,
          relatedIds: [RELATED_TARGET.id],
          contextIds: [],
        }),
      ],
      linkedObjects: [RELATED_TARGET],
      depthSafePointerIds: [STORED_POINTER.id],
      rejectedPointers: [],
      inspectorDepthListReady: false,
    };
    const merged = mergeSurfacedEvidenceDepthObjects(base, graph);

    expect(merged.todayResurfacedIds).toEqual(["receipt-0-thin-live"]);
    expect(merged.getObject(STORED_POINTER.id)?.whyItMatters).toBe(STORED_POINTER.whyItMatters);
    expect(merged.getObject(RELATED_TARGET.id)?.summary).toBe(RELATED_TARGET.summary);
    expect(merged.getObject("receipt-0-thin-live")).toBeUndefined();
  });

  it("keeps reference route mock-only boundary intact", () => {
    const mockApi = createMockOrvekDataApi();
    expect(canUseLiveEvidenceInspectorDepth(mockApi, "r6")).toBe(true);
    expect(mockApi.displayContract).toBeUndefined();
  });

  it("does not change Today UI source files", () => {
    const todaySource = readSource("components/orvek-v0/pages/today.tsx");
    expect(todaySource.includes("live-evidence-depth-linkage")).toBe(false);
    expect(todaySource.includes("evidence-pointers")).toBe(false);
    expect(todaySource.includes("SurfacedEvidencePointer")).toBe(false);
  });
});
