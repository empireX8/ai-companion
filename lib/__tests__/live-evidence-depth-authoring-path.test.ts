import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  assessAuthoredEvidenceDepthHookReadiness,
  assessEvidenceDepthAuthoringInput,
  createEvidenceDepthAuthoringHookDeps,
  maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate,
  persistEvidenceDepthAuthoringInputsForSource,
  type EvidenceDepthAuthoringPathDb,
} from "../live-evidence-depth-authoring-path";
import { graphSlotFromUelMeta } from "../live-evidence-depth-write-contract";
import { maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish } from "../live-evidence-depth-write-hook";
import { UnderstandingEvidenceLinkDuplicateError } from "../understanding-evidence-link-writer";

const NOW = new Date("2026-07-09T17:00:00.000Z");

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

function makeAuthoringDb() {
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

  const rationaleRows: RationaleRow[] = [];
  const linkRows: LinkRow[] = [];
  let linkId = 1;

  const ownership = {
    patternClaim: { findFirst: vi.fn(async () => ({ id: "claim-1" })) },
    contradictionNode: { findFirst: vi.fn(async () => ({ id: "node-1" })) },
    userMapConclusion: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "conclusion-1" ? { id: "conclusion-1" } : null,
      ),
    },
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
        const duplicate = linkRows.find(
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
  } as unknown as EvidenceDepthAuthoringPathDb;

  return { db, rationaleRows, linkRows };
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live evidence depth authoring path", () => {
  it("persists valid authored rationale + related graphSlot link", async () => {
    const { db } = makeAuthoringDb();
    const outcome = await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: BASE_AUTHORING,
      deps: { db, now: NOW, checkPublicTargetEligibility: async () => true },
    });

    expect(outcome.ready).toBe(true);
    expect(outcome.rationalePersisted).toBe(true);
    expect(outcome.linksWritten).toHaveLength(1);
  });

  it("persists valid authored rationale + context graphSlot link", async () => {
    const { db } = makeAuthoringDb();
    db.investigation.findFirst = vi.fn(async () => ({ id: "inv-1" }));

    const outcome = await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: {
        ...BASE_AUTHORING,
        graphSlotLinks: [
          {
            targetType: "investigation",
            targetId: "inv-1",
            role: "context",
            graphSlot: "context",
          },
        ],
      },
      deps: {
        db,
        now: NOW,
        checkPublicTargetEligibility: async ({ targetId }) => targetId === "inv-1",
      },
    });

    expect(outcome.ready).toBe(true);
  });

  it("blocks missing rationale", async () => {
    const assessment = assessEvidenceDepthAuthoringInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: { ...BASE_AUTHORING, authoredRationale: "   " },
    });
    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("missing_stored_rationale");
  });

  it("blocks generic rationale", async () => {
    const assessment = assessEvidenceDepthAuthoringInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: {
        ...BASE_AUTHORING,
        authoredRationale: "Surfaced from your recent material.",
      },
    });
    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("generic_stored_rationale");
  });

  it("blocks movement-copy rationale", async () => {
    const assessment = assessEvidenceDepthAuthoringInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: { ...BASE_AUTHORING, authoredRationale: MOVEMENT_SUMMARY },
    });
    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("movement_copy_rationale");
  });

  it("blocks sourceText-equal rationale", async () => {
    const assessment = assessEvidenceDepthAuthoringInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: {
        ...BASE_AUTHORING,
        authoredRationale: SOURCE_TEXT,
        sourceTextForValidation: SOURCE_TEXT,
      },
    });
    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("rationale_equals_source_text");
  });

  it("rejects missing graphSlot on link intent", async () => {
    const assessment = assessEvidenceDepthAuthoringInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: {
        ...BASE_AUTHORING,
        graphSlotLinks: [
          {
            targetType: "usermap_conclusion",
            targetId: "conclusion-1",
            role: "supports",
            graphSlot: undefined as unknown as "related",
          },
        ],
      },
    });
    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("invalid_graph_slot_link");
  });

  it("rejects invalid graphSlot on link intent", async () => {
    const assessment = assessEvidenceDepthAuthoringInput({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: {
        ...BASE_AUTHORING,
        graphSlotLinks: [
          {
            targetType: "usermap_conclusion",
            targetId: "conclusion-1",
            role: "supports",
            graphSlot: "sidebar" as "related",
          },
        ],
      },
    });
    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("invalid_graph_slot_link");
  });

  it("skips private/ineligible targets", async () => {
    const { db } = makeAuthoringDb();
    const outcome = await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: BASE_AUTHORING,
      deps: { db, now: NOW, checkPublicTargetEligibility: async () => false },
    });

    expect(outcome.ready).toBe(false);
    expect(outcome.rationalePersisted).toBe(true);
    expect(outcome.linksWritten).toHaveLength(0);
    expect(outcome.blockers).toContain("no_eligible_graph_slot_links");
  });

  it("reports authoring readiness false when all links excluded", async () => {
    const { db } = makeAuthoringDb();
    const outcome = await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: BASE_AUTHORING,
      deps: { db, now: NOW, checkPublicTargetEligibility: async () => false },
    });
    expect(outcome.ready).toBe(false);
  });

  it("upserts duplicate source rationale without duplicating rows", async () => {
    const { db, rationaleRows } = makeAuthoringDb();
    const deps = { db, now: NOW, checkPublicTargetEligibility: async () => true };

    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: BASE_AUTHORING,
      deps,
    });
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: {
        ...BASE_AUTHORING,
        authoredRationale: "Evening stop point keeps resurfacing before commitments lock.",
      },
      deps,
    });

    expect(rationaleRows).toHaveLength(1);
  });

  it("upserts duplicate source-target graphSlot links", async () => {
    const { db, linkRows } = makeAuthoringDb();
    const deps = { db, now: NOW, checkPublicTargetEligibility: async () => true };

    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: BASE_AUTHORING,
      deps,
    });
    linkRows[0]!.meta = {};
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: BASE_AUTHORING,
      deps,
    });

    expect(linkRows).toHaveLength(1);
    expect(graphSlotFromUelMeta(linkRows[0]?.meta)).toBe("related");
  });

  it("#118 hook consumes authoring output through injected deps", async () => {
    const { db } = makeAuthoringDb();
    const deps = { db, now: NOW, checkPublicTargetEligibility: async () => true };
    const hookDeps = createEvidenceDepthAuthoringHookDeps(deps);

    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: BASE_AUTHORING,
      deps,
    });

    const outcome = await maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish(
      {
        userId: "user-1",
        modelUpdateId: "mu-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: MOVEMENT_SUMMARY,
        publishedAt: NOW,
      },
      {
        now: () => NOW,
        ...hookDeps,
        findSourceEvidence: async () => ({
          sourceText: SOURCE_TEXT,
          sourceOrigin: "Recent Pattern",
        }),
      },
    );

    expect(outcome.ok).toBe(true);
  });

  it("#118 hook blocks when only rationale exists but no graphSlot links", async () => {
    const { db } = makeAuthoringDb();
    await persistEvidenceDepthAuthoringInputsForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      input: { ...BASE_AUTHORING, graphSlotLinks: [] },
      deps: { db, now: NOW, checkPublicTargetEligibility: async () => true },
    });

    const readiness = await assessAuthoredEvidenceDepthHookReadiness({
      publishInput: {
        userId: "user-1",
        modelUpdateId: "mu-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: MOVEMENT_SUMMARY,
        publishedAt: NOW,
      },
      sourceText: SOURCE_TEXT,
      sourceOrigin: "Recent Pattern",
      deps: { db, checkPublicTargetEligibility: async () => true },
    });

    expect(readiness.hookReady).toBe(false);
    expect(readiness.blockers).toContain("missing_eligible_links");
  });

  it("#118 hook blocks when graphSlot links exist but no stored rationale", async () => {
    const { db, linkRows } = makeAuthoringDb();

    linkRows.push({
      id: "uel-1",
      userId: "user-1",
      sourceType: "pattern_claim",
      sourceId: "claim-1",
      targetType: "usermap_conclusion",
      targetId: "conclusion-1",
      role: "supports",
      summary: null,
      meta: { graphSlot: "related", evidenceDepthGraphSlotMaterialization: true },
    });

    const outcome = await maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish(
      {
        userId: "user-1",
        modelUpdateId: "mu-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: MOVEMENT_SUMMARY,
        publishedAt: NOW,
      },
      {
        ...createEvidenceDepthAuthoringHookDeps({
          db,
          checkPublicTargetEligibility: async () => true,
        }),
        findSourceEvidence: async () => ({
          sourceText: SOURCE_TEXT,
          sourceOrigin: "Recent Pattern",
        }),
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.blockers).toContain("missing_stored_rationale");
  });

  it("does not use ModelUpdate.userFacingSummary as authored rationale", async () => {
    const outcome = await maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate(
      {
        userId: "user-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: MOVEMENT_SUMMARY,
        authoring: {
          ...BASE_AUTHORING,
          authoredRationale: MOVEMENT_SUMMARY,
        },
      },
      { db: makeAuthoringDb().db, now: NOW, checkPublicTargetEligibility: async () => true },
    );

    expect("skipped" in outcome).toBe(false);
    if ("skipped" in outcome) return;
    expect(outcome.ready).toBe(false);
    expect(outcome.blockers).toContain("movement_copy_used_as_rationale");
  });

  it("does not change Today UI source files", () => {
    const todaySource = readSource("components/orvek-v0/pages/today.tsx");
    expect(todaySource.includes("live-evidence-depth-authoring-path")).toBe(false);
  });

  it("does not add read-time generation paths", () => {
    const moduleSource = readSource("lib/live-evidence-depth-authoring-path.ts");
    expect(moduleSource.includes("openai")).toBe(false);
    expect(moduleSource.includes("buildTodaySurfacingCards")).toBe(false);
    expect(moduleSource.includes("generate")).toBe(false);
  });
});
