import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  assessEvidencePointerSurfacingRationale,
  assessStoredPublishRationaleForEvidencePointer,
  createResolveStoredSurfacingRationaleForModelUpdatePublish,
  EvidencePointerSurfacingRationaleValidationError,
  isModelUpdateMovementRationale,
  resolveStoredEvidencePointerSurfacingRationale,
  upsertEvidencePointerSurfacingRationale,
  type EvidencePointerSurfacingRationaleWriterDb,
} from "../live-evidence-depth-rationale-source";
import {
  EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM,
  maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish,
} from "../live-evidence-depth-write-hook";

const NOW = new Date("2026-07-09T14:00:00.000Z");

const HONEST_RATIONALE =
  "Connects evening overwork to the missing stop point before commitments lock.";

const SOURCE_TEXT =
  "I keep working past the stop point even when I said I would not.";

const ELIGIBLE_LINK = {
  targetType: "usermap_conclusion" as const,
  targetId: "conclusion-1",
  role: "supports" as const,
  graphSlot: "related" as const,
  publicEligible: true,
};

function makeDbStore() {
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
          create: Omit<Row, "id"> & { id?: string };
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
          const created: Row = {
            id: create.id ?? `rationale-${rows.length + 1}`,
            userId: create.userId,
            sourceObjectType: create.sourceObjectType,
            sourceObjectId: create.sourceObjectId,
            rationale: create.rationale,
            whyResurfaced: create.whyResurfaced ?? null,
            sourceEvidenceId: create.sourceEvidenceId ?? null,
            authoredFrom: create.authoredFrom ?? null,
          };
          rows.push(created);
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
          rows.find(
            (row) =>
              row.userId === where.userId &&
              row.sourceObjectType === where.sourceObjectType &&
              row.sourceObjectId === where.sourceObjectId,
          ) ?? null,
      ),
    },
  } as unknown as EvidencePointerSurfacingRationaleWriterDb;

  return { db, rows };
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live evidence depth rationale source", () => {
  it("accepts non-generic pointer-specific rationale", () => {
    const assessment = assessEvidencePointerSurfacingRationale({
      rationale: HONEST_RATIONALE,
      sourceText: SOURCE_TEXT,
      sourceObjectType: "pattern_claim",
    });
    expect(assessment.accepted).toBe(true);
    expect(assessment.blockers).toEqual([]);
  });

  it("rejects missing rationale", () => {
    const assessment = assessEvidencePointerSurfacingRationale({
      rationale: "   ",
      sourceObjectType: "pattern_claim",
    });
    expect(assessment.accepted).toBe(false);
    expect(assessment.blockers).toContain("missing_stored_rationale");
  });

  it("rejects generic rationale", () => {
    const assessment = assessEvidencePointerSurfacingRationale({
      rationale: "Surfaced from your recent material.",
      sourceObjectType: "pattern_claim",
    });
    expect(assessment.accepted).toBe(false);
    expect(assessment.blockers).toContain("generic_stored_rationale");
  });

  it("rejects movement-copy rationale", () => {
    expect(
      isModelUpdateMovementRationale(
        "There is early evidence that energy drops after meetings.",
      ),
    ).toBe(true);

    const assessment = assessEvidencePointerSurfacingRationale({
      rationale: "There is early evidence that energy drops after meetings.",
      sourceObjectType: "pattern_claim",
    });
    expect(assessment.accepted).toBe(false);
    expect(assessment.blockers).toContain("movement_copy_rationale");
  });

  it("rejects sourceText-equal rationale", () => {
    const assessment = assessEvidencePointerSurfacingRationale({
      rationale: SOURCE_TEXT,
      sourceText: SOURCE_TEXT,
      sourceObjectType: "pattern_claim",
    });
    expect(assessment.accepted).toBe(false);
    expect(assessment.blockers).toContain("rationale_equals_source_text");
  });

  it("upserts rationale by userId + source identity", async () => {
    const { db } = makeDbStore();

    const first = await upsertEvidencePointerSurfacingRationale({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        rationale: HONEST_RATIONALE,
        authoredFrom: "internal_review",
      },
      db,
      now: NOW,
    });
    const second = await upsertEvidencePointerSurfacingRationale({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        rationale: "Evening stop point keeps resurfacing before commitments lock.",
        authoredFrom: "internal_review",
      },
      db,
      now: NOW,
    });

    expect(first.id).toBe(second.id);
    expect(db.evidencePointerSurfacingRationale.upsert).toHaveBeenCalledTimes(2);
  });

  it("resolver returns stored rationale for exact source", async () => {
    const { db } = makeDbStore();
    await upsertEvidencePointerSurfacingRationale({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        rationale: HONEST_RATIONALE,
        authoredFrom: "internal_review",
      },
      db,
      now: NOW,
    });

    const resolved = await resolveStoredEvidencePointerSurfacingRationale({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      db,
    });

    expect(resolved?.rationale).toBe(HONEST_RATIONALE);
  });

  it("resolver does not return rationale for another user", async () => {
    const { db } = makeDbStore();
    await upsertEvidencePointerSurfacingRationale({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        rationale: HONEST_RATIONALE,
        authoredFrom: "internal_review",
      },
      db,
      now: NOW,
    });

    const resolved = await resolveStoredEvidencePointerSurfacingRationale({
      userId: "user-2",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      db,
    });

    expect(resolved).toBeNull();
  });

  it("resolver returns null when no row exists", async () => {
    const { db } = makeDbStore();
    const resolved = await resolveStoredEvidencePointerSurfacingRationale({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-missing",
      db,
    });
    expect(resolved).toBeNull();
  });

  it("#118 hook passes rationale when resolver + eligible links exist", async () => {
    const { db } = makeDbStore();
    await upsertEvidencePointerSurfacingRationale({
      input: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        rationale: HONEST_RATIONALE,
        authoredFrom: "internal_review",
      },
      db,
      now: NOW,
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
        findEligibleLinks: async () => [ELIGIBLE_LINK],
        resolveStoredSurfacingRationale:
          createResolveStoredSurfacingRationaleForModelUpdatePublish({ db }),
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.pointer?.whyItMatters).toBe(HONEST_RATIONALE);
    expect(outcome.pointer?.materializedFrom).toBe(
      EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM.modelUpdatePublish,
    );
  });

  it("#118 hook still blocks when resolver returns movement-copy rationale", async () => {
    const { db } = makeDbStore();
    await db.evidencePointerSurfacingRationale.upsert({
      where: {
        userId_sourceObjectType_sourceObjectId: {
          userId: "user-1",
          sourceObjectType: "pattern_claim",
          sourceObjectId: "claim-1",
        },
      },
      create: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        rationale: "There is early evidence that energy drops after meetings.",
        authoredFrom: "bad_seed",
        createdAt: NOW,
        updatedAt: NOW,
      },
      update: {},
      select: { id: true },
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
        findSourceEvidence: async () => ({
          sourceText: SOURCE_TEXT,
          sourceOrigin: "Recent Pattern",
        }),
        findEligibleLinks: async () => [ELIGIBLE_LINK],
        resolveStoredSurfacingRationale:
          createResolveStoredSurfacingRationaleForModelUpdatePublish({ db }),
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.blockers).toContain("missing_stored_rationale");
  });

  it("blocks upsert when movement summary would be persisted as rationale", async () => {
    const { db } = makeDbStore();
    await expect(
      upsertEvidencePointerSurfacingRationale({
        input: {
          userId: "user-1",
          sourceObjectType: "pattern_claim",
          sourceObjectId: "claim-1",
          rationale: "There is early evidence that energy drops after meetings.",
          authoredFrom: "model_update_candidate",
        },
        db,
      }),
    ).rejects.toBeInstanceOf(EvidencePointerSurfacingRationaleValidationError);
  });

  it("does not change Today UI source files", () => {
    const todaySource = readSource("components/orvek-v0/pages/today.tsx");
    expect(todaySource.includes("live-evidence-depth-rationale-source")).toBe(false);
    expect(todaySource.includes("EvidencePointerSurfacingRationale")).toBe(false);
  });

  it("does not add read-time generation paths", () => {
    const moduleSource = readSource("lib/live-evidence-depth-rationale-source.ts");
    expect(moduleSource.includes("generate")).toBe(false);
    expect(moduleSource.includes("openai")).toBe(false);
    expect(moduleSource.includes("buildTodaySurfacingCards")).toBe(false);
    expect(assessStoredPublishRationaleForEvidencePointer).toBeTypeOf("function");
  });
});
