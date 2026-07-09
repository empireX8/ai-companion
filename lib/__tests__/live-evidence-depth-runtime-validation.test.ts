import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import { persistEvidenceDepthAuthoringInputsForSource } from "../live-evidence-depth-authoring-path";
import {
  applyTodayEvidenceDepthGateFromReadGraph,
  buildLinkageDepsFromStoredState,
  fetchEvidencePointersGraphService,
  linkRowsFromStoredUel,
  pointerRecordsFromMaterializedRows,
} from "../live-evidence-depth-runtime-validation";
import { maybeMaterializeEvidenceDepthForPublishedModelUpdate } from "../live-evidence-depth-publish-route-wiring";
import { uelMetaWithGraphSlot } from "../live-evidence-depth-write-contract";
import { buildSurfacedEvidencePointerId } from "../live-evidence-depth-write-path";
import { publishModelUpdateCandidate } from "../model-update-candidate-publish-helper";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import {
  applySurfacedEvidenceDepthGate,
  REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS,
} from "../orvek-v0/production/today-evidence-pointer-depth-gate";
import type { OrvekObject } from "../orvek-v0/orvek-types";

const NOW = new Date("2026-07-09T19:00:00.000Z");

const HONEST_RATIONALE =
  "Connects evening overwork to the missing stop point before commitments lock.";

const SOURCE_TEXT =
  "I keep working past the stop point even when I said I would not.";

const MOVEMENT_SUMMARY =
  "There is early evidence that energy drops after meetings.";

const BASE_AUTHORING = {
  authoredRationale: HONEST_RATIONALE,
  authoredFrom: "internal_review",
  sourceTextForValidation: SOURCE_TEXT,
  graphSlotLinks: [
    {
      targetType: "usermap_conclusion" as const,
      targetId: "conclusion-1",
      role: "supports" as const,
      graphSlot: "related" as const,
    },
  ],
};

const RELATED_TARGET: OrvekObject = {
  id: "conclusion-1",
  type: "map-object",
  title: "Evening stop point matters",
  summary: "Commitments lock before the body signals a stop.",
  whyItMatters: "Explains why overwork repeats after stated boundaries.",
};

type ModelUpdateRow = {
  id: string;
  userId: string;
  updateType: ModelUpdateType;
  visibility: ModelUpdateVisibility;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  userFacingSummary: string;
  isMeaningful: boolean;
};

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function makeRuntimeValidationFixture(seed?: {
  modelUpdate?: Partial<ModelUpdateRow>;
  sourceObjectType?: "pattern_claim" | "contradiction_node";
  sourceObjectId?: string;
  userId?: string;
}) {
  const userId = seed?.userId ?? "user-1";
  const sourceObjectType = seed?.sourceObjectType ?? "pattern_claim";
  const sourceObjectId = seed?.sourceObjectId ?? "claim-1";

  type RationaleRow = {
    id: string;
    userId: string;
    sourceObjectType: string;
    sourceObjectId: string;
    rationale: string;
    whyResurfaced: string | null;
    sourceEvidenceId: string | null;
    authoredFrom: string | null;
  };
  type LinkRow = {
    id: string;
    userId: string;
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    role: string;
    summary: string | null;
    meta: unknown;
  };
  type PointerRow = {
    id: string;
    userId: string;
    pointerKind: string;
    sourceObjectType: string;
    sourceObjectId: string;
    sourceText: string;
    sourceOrigin: string;
    whyItMatters: string;
    whyResurfaced: string | null;
    surfacedAt: Date;
    publicEligible: boolean;
    status: string;
    materializedFrom: string;
    sourceEvidenceId: string | null;
    libraryReceiptId: string | null;
    detailHref: string | null;
  };

  const rationaleRows: RationaleRow[] = [];
  const linkRows: LinkRow[] = [];
  const pointerRows = new Map<string, PointerRow>();
  let linkId = 1;

  const modelUpdateRow: ModelUpdateRow = {
    id: "mu-candidate-1",
    userId,
    updateType: ModelUpdateType.link_detected,
    visibility: ModelUpdateVisibility.internal_only,
    affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
    affectedObjectId: sourceObjectId,
    userFacingSummary: MOVEMENT_SUMMARY,
    isMeaningful: false,
    ...seed?.modelUpdate,
  };

  const ownership = {
    patternClaim: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        sourceObjectType === "pattern_claim" && where.id === sourceObjectId
          ? { id: sourceObjectId, summary: "Evening overwork pattern" }
          : null,
      ),
    },
    patternClaimEvidence: {
      findFirst: vi.fn(async () =>
        sourceObjectType === "pattern_claim"
          ? { id: "pce-1", quote: SOURCE_TEXT }
          : null,
      ),
    },
    contradictionNode: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        sourceObjectType === "contradiction_node" && where.id === sourceObjectId
          ? {
              id: sourceObjectId,
              title: "Stop point tension",
              sideA: "I want to stop at 6pm",
              sideB: "I keep working past 8pm",
            }
          : null,
      ),
    },
    contradictionEvidence: {
      findFirst: vi.fn(async () =>
        sourceObjectType === "contradiction_node"
          ? { id: "ce-1", quote: SOURCE_TEXT }
          : null,
      ),
    },
    userMapConclusion: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "conclusion-1" ? { id: "conclusion-1" } : null,
      ),
    },
    investigation: { findFirst: vi.fn(async () => null) },
    fieldworkAssignment: { findFirst: vi.fn(async () => null) },
    surfacedAction: { findFirst: vi.fn(async () => null) },
    profileArtifact: { findFirst: vi.fn(async () => null) },
    evidenceSpan: { findFirst: vi.fn(async () => null) },
    referenceItem: { findFirst: vi.fn(async () => null) },
    quickCheckIn: { findFirst: vi.fn(async () => null) },
    journalEntry: { findFirst: vi.fn(async () => null) },
    session: { findFirst: vi.fn(async () => null) },
    message: { findFirst: vi.fn(async () => null) },
    importUploadSession: { findFirst: vi.fn(async () => null) },
    importUploadChunk: { findFirst: vi.fn(async () => null) },
  };

  const db = {
    ...ownership,
    evidencePointerSurfacingRationale: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: {
            userId_sourceObjectType_sourceObjectId: {
              userId: string;
              sourceObjectType: string;
              sourceObjectId: string;
            };
          };
          create: Omit<RationaleRow, "id">;
          update: Partial<RationaleRow>;
        }) => {
          const key = where.userId_sourceObjectType_sourceObjectId;
          const existing = rationaleRows.find(
            (row) =>
              row.userId === key.userId &&
              row.sourceObjectType === key.sourceObjectType &&
              row.sourceObjectId === key.sourceObjectId,
          );
          if (existing) {
            Object.assign(existing, update);
            return { id: existing.id };
          }
          const created = { id: "rat-1", ...create };
          rationaleRows.push(created);
          return { id: created.id };
        },
      ),
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            sourceObjectType: string;
            sourceObjectId: string;
          };
        }) =>
          rationaleRows.find(
            (row) =>
              row.userId === where.userId &&
              row.sourceObjectType === where.sourceObjectType &&
              row.sourceObjectId === where.sourceObjectId,
          ) ?? null,
      ),
    },
    understandingEvidenceLink: {
      create: vi.fn(async ({ data }: { data: Omit<LinkRow, "id"> }) => {
        const row: LinkRow = { id: `uel-${linkId++}`, ...data };
        linkRows.push(row);
        return row;
      }),
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            targetType: string;
            targetId: string;
            sourceType: string;
            sourceId: string;
            role: string;
          };
        }) =>
          linkRows.find(
            (row) =>
              row.userId === where.userId &&
              row.targetType === where.targetType &&
              row.targetId === where.targetId &&
              row.sourceType === where.sourceType &&
              row.sourceId === where.sourceId &&
              row.role === where.role,
          ) ?? null,
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; sourceType: string; sourceId: string };
        }) =>
          linkRows
            .filter(
              (row) =>
                row.userId === where.userId &&
                row.sourceType === where.sourceType &&
                row.sourceId === where.sourceId,
            )
            .map((row) => ({
              sourceType: row.sourceType,
              sourceId: row.sourceId,
              targetType: row.targetType,
              targetId: row.targetId,
              role: row.role,
              summary: row.summary,
              meta: row.meta,
            })),
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { meta?: unknown };
        }) => {
          const row = linkRows.find((candidate) => candidate.id === where.id);
          if (!row) throw new Error("missing");
          if (data.meta !== undefined) row.meta = data.meta;
          return { id: row.id };
        },
      ),
    },
    surfacedEvidencePointer: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { id: string };
          create: PointerRow;
          update: Partial<PointerRow>;
        }) => {
          const existing = pointerRows.get(where.id);
          if (existing) {
            Object.assign(existing, update);
            return { id: existing.id };
          }
          const created = { ...create };
          pointerRows.set(where.id, created);
          return { id: created.id };
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        [...pointerRows.values()].filter((row) => row.userId === where.userId),
      ),
    },
    modelUpdate: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string } }) => {
        if (where.id && where.id !== modelUpdateRow.id) return null;
        if (where.userId && where.userId !== modelUpdateRow.userId) return null;
        return {
          id: modelUpdateRow.id,
          userId: modelUpdateRow.userId,
          visibility: modelUpdateRow.visibility,
          isMeaningful: modelUpdateRow.isMeaningful,
          affectedObjectType: modelUpdateRow.affectedObjectType,
          affectedObjectId: modelUpdateRow.affectedObjectId,
          userFacingSummary: modelUpdateRow.userFacingSummary,
        };
      }),
      updateMany: vi.fn(async () => {
        modelUpdateRow.visibility = ModelUpdateVisibility.user_visible;
        modelUpdateRow.isMeaningful = true;
        return { count: 1 };
      }),
    },
    understandingEvidenceLinkForPublish: {
      findFirst: vi.fn(async () => ({ id: "link-1" })),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        modelUpdate: {
          updateMany: vi.fn(async () => {
            modelUpdateRow.visibility = ModelUpdateVisibility.user_visible;
            modelUpdateRow.isMeaningful = true;
            return { count: 1 };
          }),
          findFirst: vi.fn(async () => ({
            id: modelUpdateRow.id,
            userId: modelUpdateRow.userId,
            visibility: ModelUpdateVisibility.user_visible,
            isMeaningful: true,
          })),
        },
      }),
    ),
  };

  return {
    db,
    rationaleRows,
    linkRows,
    pointerRows,
    modelUpdateRow,
    sourceObjectType,
    sourceObjectId,
    userId,
  };
}

function authoringDeps(fixture: ReturnType<typeof makeRuntimeValidationFixture>) {
  return {
    db: fixture.db as never,
    now: NOW,
    checkPublicTargetEligibility: async () => true,
  };
}

function publishWiringDeps(fixture: ReturnType<typeof makeRuntimeValidationFixture>) {
  return {
    db: fixture.db as never,
    now: () => NOW,
    checkPublicTargetEligibility: async () => true,
  };
}

async function seedAuthoredDepth(fixture: ReturnType<typeof makeRuntimeValidationFixture>) {
  return persistEvidenceDepthAuthoringInputsForSource({
    userId: fixture.userId,
    sourceObjectType: fixture.sourceObjectType,
    sourceObjectId: fixture.sourceObjectId,
    input: BASE_AUTHORING,
    deps: authoringDeps(fixture),
  });
}

function buildPublishDb(fixture: ReturnType<typeof makeRuntimeValidationFixture>) {
  return {
    ...fixture.db,
    understandingEvidenceLink: {
      ...fixture.db.understandingEvidenceLink,
      findFirst: fixture.db.understandingEvidenceLinkForPublish.findFirst,
    },
    $transaction: fixture.db.$transaction,
  };
}

async function publishCandidate(fixture: ReturnType<typeof makeRuntimeValidationFixture>) {
  return publishModelUpdateCandidate(fixture.userId, fixture.modelUpdateRow.id, {
    db: buildPublishDb(fixture) as never,
    now: () => NOW,
    checkPublicTargetEligibility: async () => true,
  });
}

function buildReadDeps(
  fixture: ReturnType<typeof makeRuntimeValidationFixture>,
  options?: {
    checkPublicTargetEligibility?: () => Promise<boolean>;
    hydrate?: (args: { targetId: string }) => Promise<OrvekObject | null>;
  },
) {
  const pointers = pointerRecordsFromMaterializedRows(fixture.pointerRows.values());
  return buildLinkageDepsFromStoredState({
    pointers,
    linkRows: linkRowsFromStoredUel(fixture.linkRows),
    checkPublicTargetEligibility:
      options?.checkPublicTargetEligibility ?? (async () => true),
    hydrateLinkedTargetObject:
      options?.hydrate ??
      (async ({ targetId }) => (targetId === RELATED_TARGET.id ? RELATED_TARGET : null)),
  });
}

describe("live evidence depth runtime validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proves full pattern_claim pipeline: authoring → publish → materialize → read → Today gate", async () => {
    const fixture = makeRuntimeValidationFixture();
    const authoring = await seedAuthoredDepth(fixture);
    expect(authoring.ready).toBe(true);
    expect(fixture.rationaleRows[0]?.rationale).toBe(HONEST_RATIONALE);
    expect(fixture.linkRows[0]?.meta).toEqual(
      expect.objectContaining({ graphSlot: "related" }),
    );

    const publish = await publishCandidate(fixture);
    expect(publish.newVisibility).toBe(ModelUpdateVisibility.user_visible);
    expect(publish.evidenceDepthMaterialization?.status).toBe("materialized");

    const pointerId = publish.evidenceDepthMaterialization?.pointerId;
    expect(pointerId).toBeTruthy();
    if (!pointerId) return;
    expect(fixture.pointerRows.size).toBe(1);
    const storedPointer = [...fixture.pointerRows.values()][0];
    expect(storedPointer?.whyItMatters).toBe(HONEST_RATIONALE);

    const readGraph = await fetchEvidencePointersGraphService({
      userId: fixture.userId,
      deps: buildReadDeps(fixture),
    });
    expect(readGraph.inspectorDepthListReady).toBe(true);
    expect(readGraph.depthSafePointerIds).toContain(pointerId);
    expect(readGraph.linkedObjects.map((object) => object.id)).toContain("conclusion-1");

    const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
    expect(gatedApi.todayResurfacedIds).toEqual([pointerId]);
    expect(gatedApi.todayResurfacedIds).not.toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
    expect(gatedApi.getObject(pointerId)?.whyItMatters).toBe(HONEST_RATIONALE);
  });

  it("proves full contradiction_node pipeline through materialization and read/linkage", async () => {
    const fixture = makeRuntimeValidationFixture({
      sourceObjectType: "contradiction_node",
      sourceObjectId: "node-1",
      modelUpdate: {
        affectedObjectType: UnderstandingLinkTargetType.contradiction_node,
        affectedObjectId: "node-1",
      },
    });
    await seedAuthoredDepth(fixture);
    const publish = await publishCandidate(fixture);
    expect(publish.evidenceDepthMaterialization?.status).toBe("materialized");

    const pointerId = "receipt-tension-node-1";
    const readGraph = await fetchEvidencePointersGraphService({
      userId: fixture.userId,
      deps: buildReadDeps(fixture),
    });
    expect(readGraph.depthSafePointerIds).toContain(pointerId);
    expect(readGraph.inspectorDepthListReady).toBe(true);
  });

  it("publish succeeds without pointer when stored rationale is missing; Today gate keeps fallback", async () => {
    const fixture = makeRuntimeValidationFixture();
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: fixture.userId,
      sourceObjectType: fixture.sourceObjectType,
      sourceObjectId: fixture.sourceObjectId,
      input: BASE_AUTHORING,
      deps: authoringDeps(fixture),
    });
    fixture.rationaleRows.splice(0, fixture.rationaleRows.length);

    const publish = await publishCandidate(fixture);
    expect(publish.newVisibility).toBe(ModelUpdateVisibility.user_visible);
    expect(publish.evidenceDepthMaterialization?.status).toBe("skipped_missing_rationale");
    expect(fixture.pointerRows.size).toBe(0);

    const readGraph = await fetchEvidencePointersGraphService({
      userId: fixture.userId,
      deps: buildReadDeps(fixture),
    });
    const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
    expect(gatedApi.todayResurfacedIds).toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
  });

  it.each([
    ["generic rationale", "Surfaced from your recent material.", "generic_stored_rationale"],
    ["movement-copy rationale", MOVEMENT_SUMMARY, "movement_copy_rationale"],
    [
      "sourceText-equal rationale",
      SOURCE_TEXT,
      "rationale_equals_source_text",
    ],
  ])(
    "blocks %s: publish succeeds, no pointer, Today fallback remains",
    async (_label, badRationale, blocker) => {
      const fixture = makeRuntimeValidationFixture();
      fixture.rationaleRows.push({
        id: "rat-bad",
        userId: fixture.userId,
        sourceObjectType: fixture.sourceObjectType,
        sourceObjectId: fixture.sourceObjectId,
        rationale: badRationale,
        whyResurfaced: null,
        sourceEvidenceId: null,
        authoredFrom: "internal_review",
      });
      fixture.linkRows.push({
        id: "uel-1",
        userId: fixture.userId,
        sourceType: fixture.sourceObjectType,
        sourceId: fixture.sourceObjectId,
        targetType: "usermap_conclusion",
        targetId: "conclusion-1",
        role: "supports",
        summary: null,
        meta: uelMetaWithGraphSlot("related"),
      });

      const materialization = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
        userId: fixture.userId,
        modelUpdateId: fixture.modelUpdateRow.id,
        publishedAt: NOW,
        deps: publishWiringDeps(fixture),
      });
      expect(materialization.status).toBe("skipped_invalid_rationale");
      expect(materialization.blockers).toContain(blocker);
      expect(fixture.pointerRows.size).toBe(0);

      const readGraph = await fetchEvidencePointersGraphService({
        userId: fixture.userId,
        deps: buildReadDeps(fixture),
      });
      const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
      expect(gatedApi.todayResurfacedIds).toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
    },
  );

  it("blocks missing graphSlot links: no pointer and Today fallback remains", async () => {
    const fixture = makeRuntimeValidationFixture();
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: fixture.userId,
      sourceObjectType: fixture.sourceObjectType,
      sourceObjectId: fixture.sourceObjectId,
      input: { ...BASE_AUTHORING, graphSlotLinks: [] },
      deps: authoringDeps(fixture),
    });

    const materialization = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: fixture.userId,
      modelUpdateId: fixture.modelUpdateRow.id,
      publishedAt: NOW,
      deps: publishWiringDeps(fixture),
    });
    expect(materialization.status).toBe("skipped_missing_eligible_links");
    expect(fixture.pointerRows.size).toBe(0);

    const readGraph = await fetchEvidencePointersGraphService({
      userId: fixture.userId,
      deps: buildReadDeps(fixture),
    });
    const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
    expect(gatedApi.todayResurfacedIds).toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
  });

  it("excludes private/ineligible graphSlot targets; no public pointer when none remain eligible", async () => {
    const fixture = makeRuntimeValidationFixture();
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: fixture.userId,
      sourceObjectType: fixture.sourceObjectType,
      sourceObjectId: fixture.sourceObjectId,
      input: BASE_AUTHORING,
      deps: {
        ...authoringDeps(fixture),
        checkPublicTargetEligibility: async () => false,
      },
    });

    const materialization = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: fixture.userId,
      modelUpdateId: fixture.modelUpdateRow.id,
      publishedAt: NOW,
      deps: {
        ...publishWiringDeps(fixture),
        checkPublicTargetEligibility: async () => false,
      },
    });
    expect(materialization.status).toBe("skipped_missing_eligible_links");
    expect(fixture.pointerRows.size).toBe(0);

    const readGraph = await fetchEvidencePointersGraphService({
      userId: fixture.userId,
      deps: buildReadDeps(fixture),
    });
    const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
    expect(gatedApi.todayResurfacedIds).toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
  });

  it("fails closed on thin/unsafe stored pointer and preserves Today fallback", async () => {
    const fixture = makeRuntimeValidationFixture();
    const pointerId = buildSurfacedEvidencePointerId({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
    });
    expect(pointerId).toBeTruthy();
    if (!pointerId) return;
    fixture.pointerRows.set(pointerId, {
      id: pointerId,
      userId: fixture.userId,
      pointerKind: "pattern",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      sourceText: SOURCE_TEXT,
      sourceOrigin: "Recent Pattern",
      whyItMatters: "Surfaced from your recent material.",
      whyResurfaced: null,
      surfacedAt: NOW,
      publicEligible: true,
      status: "active",
      materializedFrom: "model_update_publish",
      sourceEvidenceId: null,
      libraryReceiptId: null,
      detailHref: null,
    });
    fixture.linkRows.push({
      id: "uel-1",
      userId: fixture.userId,
      sourceType: "pattern_claim",
      sourceId: "claim-1",
      targetType: "usermap_conclusion",
      targetId: "conclusion-1",
      role: "supports",
      summary: null,
      meta: uelMetaWithGraphSlot("related"),
    });

    const readGraph = await fetchEvidencePointersGraphService({
      userId: fixture.userId,
      deps: buildReadDeps(fixture),
    });
    expect(readGraph.depthSafePointerIds).toEqual([]);
    expect(readGraph.inspectorDepthListReady).toBe(false);
    expect(readGraph.rejectedPointers[0]?.blockers).toContain("generic_why_it_matters");

    const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
    expect(gatedApi.todayResurfacedIds).toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
  });

  it("fails closed when linked target cannot hydrate; depth list not ready and fallback remains", async () => {
    const fixture = makeRuntimeValidationFixture();
    await seedAuthoredDepth(fixture);
    await publishCandidate(fixture);

    const readGraph = await fetchEvidencePointersGraphService({
      userId: fixture.userId,
      deps: buildReadDeps(fixture, {
        hydrate: async () => null,
      }),
    });
    expect(readGraph.depthSafePointerIds).toEqual([]);
    expect(readGraph.inspectorDepthListReady).toBe(false);
    expect(readGraph.rejectedPointers[0]?.blockers).toContain("unhydrated_target");

    const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
    expect(gatedApi.todayResurfacedIds).toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
  });

  it("upserts same SurfacedEvidencePointer on duplicate materialization without duplicating rows", async () => {
    const fixture = makeRuntimeValidationFixture();
    await seedAuthoredDepth(fixture);
    await publishCandidate(fixture);

    const first = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: fixture.userId,
      modelUpdateId: fixture.modelUpdateRow.id,
      publishedAt: NOW,
      deps: publishWiringDeps(fixture),
    });
    const second = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: fixture.userId,
      modelUpdateId: fixture.modelUpdateRow.id,
      publishedAt: NOW,
      deps: publishWiringDeps(fixture),
    });

    expect(first.status).toBe("materialized");
    expect(second.status).toBe("materialized");
    expect(fixture.pointerRows.size).toBe(1);
    expect(first.pointerId).toBe(second.pointerId);
    expect(first.pointerId).toBeTruthy();
  });

  it("evidence-pointers service is user-bound; wrong user cannot read another user's pointer", async () => {
    const fixture = makeRuntimeValidationFixture({ userId: "user-1" });
    await seedAuthoredDepth(fixture);
    await publishCandidate(fixture);

    const ownerGraph = await fetchEvidencePointersGraphService({
      userId: "user-1",
      deps: buildReadDeps(fixture),
    });
    expect(ownerGraph.depthSafePointerIds.length).toBe(1);

    const otherGraph = await fetchEvidencePointersGraphService({
      userId: "user-2",
      deps: buildReadDeps(fixture),
    });
    expect(otherGraph.depthSafePointerIds).toEqual([]);
    expect(otherGraph.inspectorDepthListReady).toBe(false);
  });

  it("Today gate regression: depth-ready stored pointers replace fallback; unsafe keeps r6/r5/r2; thin live rows blocked", () => {
    const thinLiveApi = {
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-0-thin-live"],
    };

    const withoutOverlay = applySurfacedEvidenceDepthGate({
      api: thinLiveApi,
      overlay: null,
    });
    expect(withoutOverlay.todayResurfacedIds).toEqual([...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS]);
    expect(withoutOverlay.todayResurfacedIds).not.toContain("receipt-0-thin-live");

    const withReadyOverlay = applySurfacedEvidenceDepthGate({
      api: thinLiveApi,
      overlay: {
        pointerObjects: [
          {
            id: "receipt-pattern-claim-1",
            type: "receipt",
            title: "Stored pointer",
            sourceText: SOURCE_TEXT,
            sourceOrigin: "Recent Pattern",
            whyItMatters: HONEST_RATIONALE,
            relatedIds: ["conclusion-1"],
          },
        ],
        linkedObjects: [RELATED_TARGET],
        depthSafePointerIds: ["receipt-pattern-claim-1"],
        inspectorDepthListReady: true,
      },
    });
    expect(withReadyOverlay.todayResurfacedIds).toEqual(["receipt-pattern-claim-1"]);
    expect(withReadyOverlay.getObject("receipt-pattern-claim-1")?.whyItMatters).toBe(
      HONEST_RATIONALE,
    );
  });

  it("reference route regression: /dev/orvek-v0-reference stays mock-only without production evidence-pointers fetch", () => {
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");
    const hybridHook = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const todayPage = readSource("components/orvek-v0/pages/today.tsx");

    expect(referenceRoute).toContain('data-testid="orvek-v0-reference-route"');
    expect(referenceRoute).not.toContain("/api/today/evidence-pointers");
    expect(referenceRoute).not.toContain("live-evidence-depth-runtime-validation");
    expect(hybridHook).toContain("/api/today/evidence-pointers");
    expect(todayPage).not.toContain("/api/today/evidence-pointers");
    expect(createMockOrvekDataApi().getObject("r6")?.whyItMatters).toBeTruthy();
  });

  it("documents service-level validation scope: route handler not executed with live auth/db", () => {
    const routeSource = readSource("app/api/today/evidence-pointers/route.ts");
    expect(routeSource).toContain("readSurfacedEvidencePointersForUser");
    expect(routeSource).toContain("createSurfacedEvidenceDepthLinkageDeps");
    expect(routeSource).not.toContain("live-evidence-depth-runtime-validation");
  });
});
