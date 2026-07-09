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
  assessSurfacedEvidencePointerReadiness,
  type SurfacedEvidencePointerRecord,
} from "../live-evidence-depth-linkage";
import {
  EVIDENCE_DEPTH_PUBLISH_SUPPORTED_AFFECTED_TYPES,
  maybeMaterializeEvidenceDepthForPublishedModelUpdate,
} from "../live-evidence-depth-publish-route-wiring";
import { buildSurfacedEvidencePointerId } from "../live-evidence-depth-write-path";
import { publishModelUpdateCandidate } from "../model-update-candidate-publish-helper";
import type { OrvekObject } from "../orvek-v0/orvek-types";

const NOW = new Date("2026-07-09T18:00:00.000Z");

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

function makePublishWiringDb(seed?: {
  modelUpdate?: Partial<ModelUpdateRow>;
  sourceObjectType?: "pattern_claim" | "contradiction_node";
  sourceObjectId?: string;
}) {
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

  const sourceObjectType = seed?.sourceObjectType ?? "pattern_claim";
  const sourceObjectId = seed?.sourceObjectId ?? "claim-1";

  const rationaleRows: RationaleRow[] = [];
  const linkRows: LinkRow[] = [];
  const pointerRows = new Map<string, PointerRow>();
  let linkId = 1;

  const modelUpdateRow: ModelUpdateRow = {
    id: "mu-candidate-1",
    userId: "user-1",
    updateType: ModelUpdateType.link_detected,
    visibility: ModelUpdateVisibility.user_visible,
    affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
    affectedObjectId: sourceObjectId,
    userFacingSummary: MOVEMENT_SUMMARY,
    isMeaningful: true,
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
    modelUpdate: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string } }) =>
        (!where.id || modelUpdateRow.id === where.id) &&
        (!where.userId || modelUpdateRow.userId === where.userId)
          ? {
              id: modelUpdateRow.id,
              userId: modelUpdateRow.userId,
              affectedObjectType: modelUpdateRow.affectedObjectType,
              affectedObjectId: modelUpdateRow.affectedObjectId,
              userFacingSummary: modelUpdateRow.userFacingSummary,
            }
          : null,
      ),
    },
    fieldworkAssignment: { findFirst: vi.fn(async () => null) },
    surfacedAction: { findFirst: vi.fn(async () => null) },
    patternClaimEvidenceOwnership: { findFirst: vi.fn(async () => null) },
    contradictionEvidenceOwnership: { findFirst: vi.fn(async () => null) },
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
    },
  };

  return {
    db,
    rationaleRows,
    linkRows,
    pointerRows,
    modelUpdateRow,
    sourceObjectType,
    sourceObjectId,
  };
}

async function seedAuthoredDepth(
  fixture: ReturnType<typeof makePublishWiringDb>,
  authoring = BASE_AUTHORING,
) {
  await persistEvidenceDepthAuthoringInputsForSource({
    userId: "user-1",
    sourceObjectType: fixture.sourceObjectType,
    sourceObjectId: fixture.sourceObjectId,
    input: authoring,
    deps: {
      db: fixture.db as never,
      now: NOW,
      checkPublicTargetEligibility: async () => true,
    },
  });
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function wiringDeps(fixture: ReturnType<typeof makePublishWiringDb>) {
  return {
    db: fixture.db as never,
    now: () => NOW,
    checkPublicTargetEligibility: async () => true,
  };
}

describe("live evidence depth publish route wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("materializes pattern_claim publish when stored rationale + graphSlot links exist", async () => {
    const fixture = makePublishWiringDb();
    await seedAuthoredDepth(fixture);

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("materialized");
    expect(outcome.pointerId).toBe(
      buildSurfacedEvidencePointerId({
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
      }),
    );
    expect(fixture.pointerRows.size).toBe(1);
    const pointer = [...fixture.pointerRows.values()][0];
    expect(pointer?.whyItMatters).toBe(HONEST_RATIONALE);
    expect(pointer?.publicEligible).toBe(true);
  });

  it("materializes contradiction_node publish when authored inputs exist", async () => {
    const fixture = makePublishWiringDb({
      sourceObjectType: "contradiction_node",
      sourceObjectId: "node-1",
      modelUpdate: {
        affectedObjectType: UnderstandingLinkTargetType.contradiction_node,
        affectedObjectId: "node-1",
      },
    });
    await seedAuthoredDepth(fixture);

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("materialized");
    expect(outcome.pointerId).toBe("receipt-tension-node-1");
  });

  it("skips unsupported affectedObjectType", async () => {
    const fixture = makePublishWiringDb({
      modelUpdate: {
        affectedObjectType: UnderstandingLinkTargetType.investigation,
        affectedObjectId: "inv-1",
      },
    });

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("skipped_unsupported_source");
    expect(fixture.pointerRows.size).toBe(0);
  });

  it("skips when stored rationale is missing and publish still succeeds via helper", async () => {
    const fixture = makePublishWiringDb();
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: fixture.sourceObjectType,
      sourceObjectId: fixture.sourceObjectId,
      input: BASE_AUTHORING,
      deps: {
        db: fixture.db as never,
        now: NOW,
        checkPublicTargetEligibility: async () => true,
      },
    });
    fixture.rationaleRows.splice(0, fixture.rationaleRows.length);

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("skipped_missing_rationale");
    expect(fixture.pointerRows.size).toBe(0);
  });

  it("does not use movement-copy userFacingSummary as rationale", async () => {
    const fixture = makePublishWiringDb();
    await seedAuthoredDepth(fixture);
    fixture.rationaleRows.splice(0, fixture.rationaleRows.length);

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("skipped_missing_rationale");
    expect(outcome.blockers).toContain("missing_stored_rationale");
    expect(fixture.pointerRows.size).toBe(0);
  });

  it("skips generic stored rationale", async () => {
    const fixture = makePublishWiringDb();
    fixture.rationaleRows.push({
      id: "rat-bad",
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      rationale: "Surfaced from your recent material.",
      whyResurfaced: null,
      sourceEvidenceId: null,
      authoredFrom: "internal_review",
    });
    fixture.linkRows.push({
      id: "uel-1",
      userId: "user-1",
      sourceType: "pattern_claim",
      sourceId: "claim-1",
      targetType: "usermap_conclusion",
      targetId: "conclusion-1",
      role: "supports",
      summary: null,
      meta: { graphSlot: "related" },
    });

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("skipped_invalid_rationale");
    expect(outcome.blockers).toContain("generic_stored_rationale");
    expect(fixture.pointerRows.size).toBe(0);
  });

  it("skips rationale equal to sourceText", async () => {
    const fixture = makePublishWiringDb();
    fixture.rationaleRows.push({
      id: "rat-bad",
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      rationale: SOURCE_TEXT,
      whyResurfaced: null,
      sourceEvidenceId: null,
      authoredFrom: "internal_review",
    });
    fixture.linkRows.push({
      id: "uel-1",
      userId: "user-1",
      sourceType: "pattern_claim",
      sourceId: "claim-1",
      targetType: "usermap_conclusion",
      targetId: "conclusion-1",
      role: "supports",
      summary: null,
      meta: { graphSlot: "related" },
    });

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("skipped_invalid_rationale");
    expect(outcome.blockers).toContain("rationale_equals_source_text");
    expect(fixture.pointerRows.size).toBe(0);
  });

  it("skips when no graphSlot links exist", async () => {
    const fixture = makePublishWiringDb();
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: fixture.sourceObjectType,
      sourceObjectId: fixture.sourceObjectId,
      input: { ...BASE_AUTHORING, graphSlotLinks: [] },
      deps: {
        db: fixture.db as never,
        now: NOW,
        checkPublicTargetEligibility: async () => true,
      },
    });

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("skipped_missing_eligible_links");
    expect(fixture.pointerRows.size).toBe(0);
  });

  it("skips when graphSlot links are only private/ineligible", async () => {
    const fixture = makePublishWiringDb();
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: fixture.sourceObjectType,
      sourceObjectId: fixture.sourceObjectId,
      input: BASE_AUTHORING,
      deps: {
        db: fixture.db as never,
        now: NOW,
        checkPublicTargetEligibility: async () => false,
      },
    });

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: {
        db: fixture.db as never,
        now: () => NOW,
        checkPublicTargetEligibility: async () => false,
      },
    });

    expect(outcome.status).toBe("skipped_missing_eligible_links");
    expect(fixture.pointerRows.size).toBe(0);
  });

  it("upserts duplicate publish without duplicating pointer rows", async () => {
    const fixture = makePublishWiringDb();
    await seedAuthoredDepth(fixture);

    const first = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });
    const second = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(first.status).toBe("materialized");
    expect(second.status).toBe("materialized");
    expect(fixture.pointerRows.size).toBe(1);
    expect(first.pointerId).toBe(second.pointerId);
  });

  it("publish helper captures unexpected materializer failure without failing publish", async () => {
    const fixture = makePublishWiringDb({
      modelUpdate: {
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
      },
    });

    const publishDb = {
      ...fixture.db,
      understandingEvidenceLink: {
        ...fixture.db.understandingEvidenceLink,
        findFirst: vi.fn(async () => ({ id: "link-1" })),
      },
      modelUpdate: {
        findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string } }) => {
          if (!where.id || where.id === fixture.modelUpdateRow.id) {
            return {
              id: fixture.modelUpdateRow.id,
              userId: fixture.modelUpdateRow.userId,
              visibility: fixture.modelUpdateRow.visibility,
              isMeaningful: fixture.modelUpdateRow.isMeaningful,
              affectedObjectType: fixture.modelUpdateRow.affectedObjectType,
              affectedObjectId: fixture.modelUpdateRow.affectedObjectId,
              userFacingSummary: fixture.modelUpdateRow.userFacingSummary,
            };
          }
          return null;
        }),
        updateMany: vi.fn(async () => {
          fixture.modelUpdateRow.visibility = ModelUpdateVisibility.user_visible;
          fixture.modelUpdateRow.isMeaningful = true;
          return { count: 1 };
        }),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          modelUpdate: {
            updateMany: vi.fn(async () => {
              fixture.modelUpdateRow.visibility = ModelUpdateVisibility.user_visible;
              fixture.modelUpdateRow.isMeaningful = true;
              return { count: 1 };
            }),
            findFirst: vi.fn(async () => ({
              id: fixture.modelUpdateRow.id,
              userId: fixture.modelUpdateRow.userId,
              visibility: ModelUpdateVisibility.user_visible,
              isMeaningful: true,
            })),
          },
        }),
      ),
    };

    const result = await publishModelUpdateCandidate("user-1", "mu-candidate-1", {
      db: publishDb as never,
      materializeEvidenceDepthForPublish: async () => {
        throw new Error("db_write_failed");
      },
    });

    expect(result.newVisibility).toBe(ModelUpdateVisibility.user_visible);
    expect(result.evidenceDepthMaterialization?.status).toBe("failed_unexpected");
    expect(result.evidenceDepthMaterialization?.blockers).toContain("db_write_failed");
  });

  it("preserves public eligibility on materialized pointer", async () => {
    const fixture = makePublishWiringDb();
    await seedAuthoredDepth(fixture);

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });

    expect(outcome.status).toBe("materialized");
    const pointer = [...fixture.pointerRows.values()][0];
    expect(pointer?.publicEligible).toBe(true);
  });

  it("#116 linkage depth readiness passes for hook-created fixture", async () => {
    const fixture = makePublishWiringDb();
    await seedAuthoredDepth(fixture);

    const outcome = await maybeMaterializeEvidenceDepthForPublishedModelUpdate({
      userId: "user-1",
      modelUpdateId: "mu-candidate-1",
      publishedAt: NOW,
      deps: wiringDeps(fixture),
    });
    expect(outcome.status).toBe("materialized");

    const pointer = [...fixture.pointerRows.values()][0] as SurfacedEvidencePointerRecord;
    const readiness = await assessSurfacedEvidencePointerReadiness({
      userId: "user-1",
      pointer: {
        ...pointer,
        detailHref: null,
        libraryReceiptId: null,
      },
      linkRows: fixture.linkRows.map((row) => ({
        sourceType: row.sourceType as "pattern_claim",
        sourceId: row.sourceId,
        targetType: row.targetType as "usermap_conclusion",
        targetId: row.targetId,
        role: row.role as "supports",
        summary: row.summary,
        meta: row.meta,
      })),
      deps: {
        checkPublicTargetEligibility: async () => true,
        hydrateLinkedTargetObject: async ({ targetId }) =>
          targetId === RELATED_TARGET.id ? RELATED_TARGET : null,
      },
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.relatedIds).toContain("conclusion-1");
  });

  it("does not change Today UI source files", () => {
    const todaySource = readSource("components/orvek-v0/pages/today.tsx");
    expect(todaySource.includes("live-evidence-depth-publish-route-wiring")).toBe(false);
    expect(todaySource.includes("SurfacedEvidencePointer")).toBe(false);
  });

  it("does not add read-time rationale generation in publish wiring module", () => {
    const source = readSource("lib/live-evidence-depth-publish-route-wiring.ts");
    expect(source.includes("userFacingSummary")).toBe(true);
    expect(source.includes("generate")).toBe(false);
    expect(source.includes("synthesize")).toBe(false);
  });

  it("documents supported affected object types", () => {
    expect(EVIDENCE_DEPTH_PUBLISH_SUPPORTED_AFFECTED_TYPES.has("pattern_claim")).toBe(
      true,
    );
    expect(
      EVIDENCE_DEPTH_PUBLISH_SUPPORTED_AFFECTED_TYPES.has("contradiction_node"),
    ).toBe(true);
    expect(EVIDENCE_DEPTH_PUBLISH_SUPPORTED_AFFECTED_TYPES.has("investigation")).toBe(
      false,
    );
  });

  it("wires publish helper to materializer when authored inputs exist", async () => {
    const fixture = makePublishWiringDb({
      modelUpdate: {
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
      },
    });
    await seedAuthoredDepth(fixture);

    const publishDb = {
      ...fixture.db,
      understandingEvidenceLink: {
        ...fixture.db.understandingEvidenceLink,
        findFirst: vi.fn(async () => ({ id: "link-1" })),
      },
      modelUpdate: {
        findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string } }) => {
          if (!where.id || where.id === fixture.modelUpdateRow.id) {
            const row = fixture.modelUpdateRow;
            if (where.userId && where.userId !== row.userId) return null;
            return {
              id: row.id,
              userId: row.userId,
              visibility: row.visibility,
              isMeaningful: row.isMeaningful,
              affectedObjectType: row.affectedObjectType,
              affectedObjectId: row.affectedObjectId,
              userFacingSummary: row.userFacingSummary,
            };
          }
          return null;
        }),
        updateMany: vi.fn(async () => {
          fixture.modelUpdateRow.visibility = ModelUpdateVisibility.user_visible;
          fixture.modelUpdateRow.isMeaningful = true;
          return { count: 1 };
        }),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          modelUpdate: {
            updateMany: vi.fn(async () => {
              fixture.modelUpdateRow.visibility = ModelUpdateVisibility.user_visible;
              fixture.modelUpdateRow.isMeaningful = true;
              return { count: 1 };
            }),
            findFirst: vi.fn(async () => ({
              id: fixture.modelUpdateRow.id,
              userId: fixture.modelUpdateRow.userId,
              visibility: ModelUpdateVisibility.user_visible,
              isMeaningful: true,
            })),
          },
        }),
      ),
    };

    const result = await publishModelUpdateCandidate("user-1", "mu-candidate-1", {
      db: publishDb as never,
      now: () => NOW,
      checkPublicTargetEligibility: async () => true,
    });

    expect(result.newVisibility).toBe(ModelUpdateVisibility.user_visible);
    expect(result.evidenceDepthMaterialization?.status).toBe("materialized");
    expect(fixture.pointerRows.size).toBe(1);
  });
});
