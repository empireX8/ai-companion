import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  assessEvidenceDepthGraphSlotLinkInput,
  buildEvidenceDepthGraphSlotLinkInput,
  createFindEligibleLinksForEvidenceDepthHook,
  EvidenceDepthGraphSlotLinkValidationError,
  graphSlotFromRoleOnly,
  listUnderstandingEvidenceLinkRowsForSource,
  resolveEvidenceDepthGraphSlotLinksForSource,
  upsertEvidenceDepthGraphSlotLinkForUser,
  upsertEvidenceDepthGraphSlotLinksForSource,
  type EvidenceDepthGraphSlotLinkWriterDb,
} from "../live-evidence-depth-graphslot-link-source";
import {
  buildDepthSafeSurfacedEvidencePointerGraph,
  type SurfacedEvidencePointerRecord,
} from "../live-evidence-depth-linkage";
import { graphSlotFromUelMeta, uelMetaWithGraphSlot } from "../live-evidence-depth-write-contract";
import {
  EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM,
  getEligibleEvidenceDepthLinksForSource,
  maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish,
} from "../live-evidence-depth-write-hook";
import {
  createResolveStoredSurfacingRationaleForModelUpdatePublish,
  upsertEvidencePointerSurfacingRationale,
  type EvidencePointerSurfacingRationaleWriterDb,
} from "../live-evidence-depth-rationale-source";
import type { OrvekObject } from "../orvek-v0/orvek-types";
import { UnderstandingEvidenceLinkDuplicateError } from "../understanding-evidence-link-writer";

const NOW = new Date("2026-07-09T16:00:00.000Z");

const HONEST_RATIONALE =
  "Connects evening overwork to the missing stop point before commitments lock.";

const SOURCE_TEXT =
  "I keep working past the stop point even when I said I would not.";

const RELATED_TARGET: OrvekObject = {
  id: "conclusion-1",
  type: "map-object",
  title: "Evening stop point matters",
  summary: "Commitments lock before the body signals a stop.",
  whyItMatters: "Explains why overwork repeats after stated boundaries.",
};

function makeGraphSlotLinkDb() {
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

  const links: LinkRow[] = [];
  let nextId = 1;

  const ownership = {
    patternClaim: { findFirst: vi.fn(async () => ({ id: "claim-1" })) },
    contradictionNode: { findFirst: vi.fn(async () => ({ id: "node-1" })) },
    userMapConclusion: { findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === "conclusion-1" ? { id: "conclusion-1" } : null,
    ) },
    investigation: { findFirst: vi.fn(async () => null) },
    modelUpdate: { findFirst: vi.fn(async () => null) },
    fieldworkAssignment: { findFirst: vi.fn(async () => null) },
    surfacedAction: { findFirst: vi.fn(async () => null) },
    patternClaimEvidence: { findFirst: vi.fn(async () => null) },
    contradictionEvidence: { findFirst: vi.fn(async () => null) },
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
    understandingEvidenceLink: {
      create: vi.fn(async ({ data }: { data: Omit<LinkRow, "id"> }) => {
        const duplicate = links.find(
          (row) =>
            row.userId === data.userId &&
            row.targetType === data.targetType &&
            row.targetId === data.targetId &&
            row.sourceType === data.sourceType &&
            row.sourceId === data.sourceId &&
            row.role === data.role,
        );
        if (duplicate) {
          throw new UnderstandingEvidenceLinkDuplicateError();
        }
        const row: LinkRow = {
          id: `uel-${nextId++}`,
          userId: data.userId,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          targetType: data.targetType,
          targetId: data.targetId,
          role: data.role,
          summary: data.summary ?? null,
          meta: data.meta,
        };
        links.push(row);
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
          links.find(
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
          where: {
            userId: string;
            sourceType: string;
            sourceId: string;
          };
        }) =>
          links
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
          data: { meta?: unknown; summary?: string };
        }) => {
          const row = links.find((candidate) => candidate.id === where.id);
          if (!row) {
            throw new Error("not found");
          }
          if (data.meta !== undefined) {
            row.meta = data.meta;
          }
          if (data.summary !== undefined) {
            row.summary = data.summary;
          }
          return { id: row.id };
        },
      ),
    },
  } as unknown as EvidenceDepthGraphSlotLinkWriterDb;

  return { db, links };
}

function makeRationaleDb() {
  type Row = {
    id: string;
    userId: string;
    sourceObjectType: string;
    sourceObjectId: string;
    rationale: string;
    whyResurfaced: string | null;
    sourceEvidenceId: string | null;
    authoredFrom: string | null;
  };
  const rows: Row[] = [];

  const db = {
    evidencePointerSurfacingRationale: {
      upsert: vi.fn(async ({ create, update, where }: {
        where: { userId_sourceObjectType_sourceObjectId: { userId: string; sourceObjectType: string; sourceObjectId: string } };
        create: Omit<Row, "id">;
        update: Partial<Row>;
      }) => {
        const key = where.userId_sourceObjectType_sourceObjectId;
        const existing = rows.find(
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
        rows.push(created);
        return { id: created.id };
      }),
      findFirst: vi.fn(async ({ where }: { where: { userId: string; sourceObjectType: string; sourceObjectId: string } }) =>
        rows.find(
          (row) =>
            row.userId === where.userId &&
            row.sourceObjectType === where.sourceObjectType &&
            row.sourceObjectId === where.sourceObjectId,
        ) ?? null,
      ),
    },
  } as unknown as EvidencePointerSurfacingRationaleWriterDb;

  return { db };
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live evidence depth graphSlot link source", () => {
  it("accepts explicit related graphSlot and preserves it in UEL meta", async () => {
    const { db } = makeGraphSlotLinkDb();
    const outcome = await upsertEvidenceDepthGraphSlotLinkForUser({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        targetType: "usermap_conclusion",
        targetId: "conclusion-1",
        role: "supports",
        graphSlot: "related",
      },
      db,
      checkPublicTargetEligibility: async () => true,
    });

    expect("skipped" in outcome && outcome.skipped).toBe(false);
    if ("skipped" in outcome && outcome.skipped) return;
    expect(outcome.created).toBe(true);
    expect(
      graphSlotFromUelMeta(
        (db.understandingEvidenceLink.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
          ?.data?.meta,
      ),
    ).toBe("related");
  });

  it("accepts explicit context graphSlot and preserves it in UEL meta", () => {
    const built = buildEvidenceDepthGraphSlotLinkInput({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      targetType: "investigation",
      targetId: "inv-1",
      role: "context",
      graphSlot: "context",
    });
    expect(graphSlotFromUelMeta(built.meta)).toBe("context");
    expect(built.graphSlot).toBe("context");
  });

  it("rejects missing graphSlot", () => {
    const assessment = assessEvidenceDepthGraphSlotLinkInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      targetId: "conclusion-1",
      graphSlot: undefined as unknown as "related",
    });
    expect(assessment.accepted).toBe(false);
    expect(assessment.blockers).toContain("missing_graph_slot");
  });

  it("rejects invalid graphSlot", () => {
    const assessment = assessEvidenceDepthGraphSlotLinkInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      targetId: "conclusion-1",
      graphSlot: "sidebar" as "related",
    });
    expect(assessment.accepted).toBe(false);
    expect(assessment.blockers).toContain("invalid_graph_slot");
  });

  it("does not infer slot from role", () => {
    expect(graphSlotFromRoleOnly("context")).toBeNull();
    expect(graphSlotFromRoleOnly("supports")).toBeNull();
  });

  it("does not infer slot from target type during eligible-link resolution", async () => {
    const resolution = await getEligibleEvidenceDepthLinksForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      linkRows: [
        {
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          targetType: "usermap_conclusion",
          targetId: "conclusion-1",
          role: "context",
          summary: null,
          meta: {},
        },
      ],
      checkPublicTargetEligibility: async () => true,
    });
    expect(resolution.eligible).toEqual([]);
    expect(resolution.excludedMissingGraphSlot).toBe(1);
  });

  it("excludes private/ineligible targets", async () => {
    const { db } = makeGraphSlotLinkDb();
    const outcome = await upsertEvidenceDepthGraphSlotLinkForUser({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        targetType: "usermap_conclusion",
        targetId: "conclusion-private",
        role: "supports",
        graphSlot: "related",
      },
      db,
      checkPublicTargetEligibility: async () => false,
    });
    expect(outcome).toEqual({ skipped: true });
    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("returns no eligible depth links when all targets are excluded", async () => {
    const { db } = makeGraphSlotLinkDb();
    const resolution = await resolveEvidenceDepthGraphSlotLinksForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      db,
      checkPublicTargetEligibility: async () => false,
    });
    expect(resolution.eligible).toEqual([]);
    expect(resolution.excludedIneligible).toBe(0);
  });

  it("upserts graphSlot onto duplicate source-target-role links", async () => {
    const { db, links } = makeGraphSlotLinkDb();
    links.push({
      id: "uel-existing",
      userId: "user-1",
      sourceType: "pattern_claim",
      sourceId: "claim-1",
      targetType: "usermap_conclusion",
      targetId: "conclusion-1",
      role: "supports",
      summary: null,
      meta: { legacy: true },
    });

    const outcome = await upsertEvidenceDepthGraphSlotLinkForUser({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        targetType: "usermap_conclusion",
        targetId: "conclusion-1",
        role: "supports",
        graphSlot: "related",
      },
      db,
      checkPublicTargetEligibility: async () => true,
    });

    expect("skipped" in outcome && outcome.skipped).toBe(false);
    if ("skipped" in outcome && outcome.skipped) return;
    expect(outcome.created).toBe(false);
    expect(graphSlotFromUelMeta(links[0]?.meta)).toBe("related");
    expect((links[0]?.meta as { legacy?: boolean }).legacy).toBe(true);
  });

  it("returns graphSlot links via getEligibleEvidenceDepthLinksForSource", async () => {
    const { db } = makeGraphSlotLinkDb();
    await upsertEvidenceDepthGraphSlotLinksForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      links: [
        {
          targetType: "usermap_conclusion",
          targetId: "conclusion-1",
          role: "supports",
          graphSlot: "related",
        },
      ],
      db,
      checkPublicTargetEligibility: async () => true,
    });

    const rows = await listUnderstandingEvidenceLinkRowsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      db,
    });
    const resolution = await getEligibleEvidenceDepthLinksForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      linkRows: rows,
      checkPublicTargetEligibility: async () => true,
    });

    expect(resolution.eligible).toHaveLength(1);
    expect(resolution.eligible[0]?.graphSlot).toBe("related");
  });

  it("#118 hook passes eligible-link check with resolver + graphSlot helper", async () => {
    const { db: linkDb } = makeGraphSlotLinkDb();
    const { db: rationaleDb } = makeRationaleDb();

    await upsertEvidencePointerSurfacingRationale({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        rationale: HONEST_RATIONALE,
        authoredFrom: "internal_review",
      },
      db: rationaleDb,
      now: NOW,
    });

    await upsertEvidenceDepthGraphSlotLinksForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      links: [
        {
          targetType: "usermap_conclusion",
          targetId: "conclusion-1",
          role: "supports",
          graphSlot: "related",
        },
      ],
      db: linkDb,
      checkPublicTargetEligibility: async () => true,
    });

    const outcome = await maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish(
      {
        userId: "user-1",
        modelUpdateId: "mu-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: "There is early evidence that energy drops after meetings.",
        publishedAt: NOW,
      },
      {
        now: () => NOW,
        db: { surfacedEvidencePointer: { upsert: vi.fn() } } as never,
        upsertSurfacedEvidencePointer: vi
          .fn()
          .mockResolvedValue({ id: "receipt-pattern-claim-1" }),
        createUnderstandingEvidenceLink: vi.fn().mockResolvedValue({ id: "uel-1" }),
        findSourceEvidence: async () => ({
          sourceText: SOURCE_TEXT,
          sourceOrigin: "Recent Pattern",
        }),
        findEligibleLinks: createFindEligibleLinksForEvidenceDepthHook({
          db: linkDb,
          checkPublicTargetEligibility: async () => true,
        }),
        resolveStoredSurfacingRationale:
          createResolveStoredSurfacingRationaleForModelUpdatePublish({ db: rationaleDb }),
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.pointer?.whyItMatters).toBe(HONEST_RATIONALE);
    expect(outcome.pointer?.materializedFrom).toBe(
      EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM.modelUpdatePublish,
    );
  });

  it("#116 linkage still requires graphSlot and works with helper-written meta", async () => {
    const pointer: SurfacedEvidencePointerRecord = {
      id: "receipt-pattern-claim-1",
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      sourceText: SOURCE_TEXT,
      sourceOrigin: "Recent Pattern",
      whyItMatters: HONEST_RATIONALE,
      whyResurfaced: null,
      surfacedAt: NOW,
      publicEligible: true,
      status: "active",
    };

    const graph = await buildDepthSafeSurfacedEvidencePointerGraph({
      userId: "user-1",
      pointers: [pointer],
      linkRows: [
        {
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          targetType: "usermap_conclusion",
          targetId: RELATED_TARGET.id,
          role: "supports",
          summary: null,
          meta: uelMetaWithGraphSlot("related", {
            evidenceDepthGraphSlotMaterialization: true,
          }),
        },
      ],
      deps: {
        checkPublicTargetEligibility: async () => true,
        hydrateLinkedTargetObject: async () => RELATED_TARGET,
      },
    });

    expect(graph.depthSafePointerIds).toEqual([pointer.id]);
    expect(graph.linkedObjects[0]?.id).toBe(RELATED_TARGET.id);
  });

  it("does not change Today UI source files", () => {
    const todaySource = readSource("components/orvek-v0/pages/today.tsx");
    expect(todaySource.includes("live-evidence-depth-graphslot-link-source")).toBe(false);
    expect(todaySource.includes("graphSlotFromRoleOnly")).toBe(false);
  });

  it("rejects build when graphSlot validation fails", () => {
    expect(() =>
      buildEvidenceDepthGraphSlotLinkInput({
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        targetType: "usermap_conclusion",
        targetId: "conclusion-1",
        role: "supports",
        graphSlot: "invalid" as "related",
      }),
    ).toThrow(EvidenceDepthGraphSlotLinkValidationError);
  });
});
