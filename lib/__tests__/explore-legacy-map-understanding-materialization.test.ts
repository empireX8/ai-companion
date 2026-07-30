import {
  ReferenceConfidence,
  ReferenceStatus,
  ReferenceType,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../canonical-model-authority-flag";
import {
  deriveLegacyReferenceUserMapConclusionId,
  resolveQualifyingExploreUserMapConclusions,
} from "../explore-movement-semantic-adjudicator";

type UmcRow = {
  id: string;
  userId: string;
  area: UserMapConclusionArea;
  status: UserMapConclusionStatus;
  visibility: UserMapConclusionVisibility;
  title: string;
  summary: string;
  confidenceScore: number;
  confidenceLevel: UserMapConfidenceLevel;
  evidenceCount: number;
  sourceDiversity: number;
  timeSpreadDays: number;
  firstEvidenceAt: Date | null;
  lastEvidenceAt: Date | null;
  notes: string | null;
  supersededById: string | null;
  candidateLifecycleStatus: null;
  updatedAt: Date;
};

const USER_ID = "user_legacy_reference_materialization";
const REFERENCE_ID = "ref_tea_memory";
const STATEMENT = "I don't like tea anymore";

function pickSelected<T extends Record<string, unknown>>(
  row: T,
  select?: Record<string, boolean>,
): Partial<T> {
  if (!select) return row;
  const out: Partial<T> = {};
  for (const [key, include] of Object.entries(select)) {
    if (include && key in row) {
      out[key as keyof T] = row[key] as T[keyof T];
    }
  }
  return out;
}

function createDb() {
  const now = new Date("2026-07-30T10:00:00.000Z");
  const reference = {
    id: REFERENCE_ID,
    userId: USER_ID,
    type: ReferenceType.preference,
    confidence: ReferenceConfidence.medium,
    status: ReferenceStatus.active,
    statement: STATEMENT,
    createdAt: now,
    updatedAt: now,
  };
  const umcs: UmcRow[] = [];
  const links: Array<{
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
    sourceType: UnderstandingLinkSourceType;
    sourceId: string;
    role: UnderstandingLinkRole;
    summary?: string;
    snippet?: string;
    quote?: string;
  }> = [];

  const db = {
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
    userMapConclusion: {
      findMany: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const idFilter = where.id as { in?: string[] } | undefined;
        const rows = umcs.filter((row) => {
          if (where.userId && row.userId !== where.userId) return false;
          if (idFilter?.in && !idFilter.in.includes(row.id)) return false;
          return true;
        });
        return rows.map((row) => pickSelected(row, select));
      }),
      findFirst: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const row =
          umcs.find((candidate) => {
            if (where.id && candidate.id !== where.id) return false;
            if (where.userId && candidate.userId !== where.userId) return false;
            return true;
          }) ?? null;
        return row ? pickSelected(row, select) : null;
      }),
      create: vi.fn(async ({ data, select }: { data: Partial<UmcRow>; select?: Record<string, boolean> }) => {
        if (umcs.some((row) => row.id === data.id)) {
          const error = new Error("Unique constraint failed") as Error & { code: string };
          error.code = "P2002";
          throw error;
        }
        const row: UmcRow = {
          id: String(data.id),
          userId: String(data.userId),
          area: data.area ?? UserMapConclusionArea.operating_logic,
          status: data.status ?? UserMapConclusionStatus.emerging,
          visibility: data.visibility ?? UserMapConclusionVisibility.user_visible,
          title: String(data.title),
          summary: String(data.summary),
          confidenceScore: Number(data.confidenceScore ?? 0.6),
          confidenceLevel: data.confidenceLevel ?? UserMapConfidenceLevel.medium,
          evidenceCount: Number(data.evidenceCount ?? 1),
          sourceDiversity: Number(data.sourceDiversity ?? 1),
          timeSpreadDays: Number(data.timeSpreadDays ?? 0),
          firstEvidenceAt: data.firstEvidenceAt ?? now,
          lastEvidenceAt: data.lastEvidenceAt ?? now,
          notes: typeof data.notes === "string" ? data.notes : null,
          supersededById: null,
          candidateLifecycleStatus: null,
          updatedAt: now,
        };
        umcs.push(row);
        return pickSelected(row, select);
      }),
    },
    referenceItem: {
      findMany: vi.fn(async ({ where, select }: { where: { id?: { in?: string[] }; userId?: string; status?: ReferenceStatus }; select?: Record<string, boolean> }) => {
        if (where.userId && where.userId !== reference.userId) return [];
        if (where.status && where.status !== reference.status) return [];
        if (where.id?.in && !where.id.in.includes(reference.id)) return [];
        return [pickSelected(reference, select)];
      }),
      findFirst: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        if (where.userId && where.userId !== reference.userId) return null;
        if (where.id && where.id !== reference.id) return null;
        return pickSelected(reference, select);
      }),
    },
    understandingEvidenceLink: {
      findMany: vi.fn(async ({ where }: { where: { sourceId?: { in?: string[] }; targetId?: { in?: string[] }; userId?: string } }) =>
        links.filter((link) => {
          if (where.userId && link.userId !== where.userId) return false;
          if (where.sourceId?.in && !where.sourceId.in.includes(link.sourceId)) return false;
          if (where.targetId?.in && !where.targetId.in.includes(link.targetId)) return false;
          return true;
        }),
      ),
      upsert: vi.fn(async ({ create, update, where }: { create: (typeof links)[number]; update: Partial<(typeof links)[number]>; where: { userId_targetType_targetId_sourceType_sourceId_role: (typeof links)[number] } }) => {
        const key = where.userId_targetType_targetId_sourceType_sourceId_role;
        const existing = links.find(
          (link) =>
            link.userId === key.userId &&
            link.targetType === key.targetType &&
            link.targetId === key.targetId &&
            link.sourceType === key.sourceType &&
            link.sourceId === key.sourceId &&
            link.role === key.role,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        links.push(create);
        return create;
      }),
    },
  };

  return { db, umcs, links };
}

describe("Explore legacy Map understanding materialization", () => {
  const prior = {
    flag: process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV],
    users: process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV],
  };

  afterEach(() => {
    if (prior.flag === undefined) {
      delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
    } else {
      process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = prior.flag;
    }
    if (prior.users === undefined) {
      delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];
    } else {
      process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] = prior.users;
    }
  });

  it("idempotently materializes an active reference memory into a qualifying UMC for canonical Explore", async () => {
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "1";
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] = USER_ID;

    const harness = createDb();
    const expectedId = deriveLegacyReferenceUserMapConclusionId({
      userId: USER_ID,
      referenceItemId: REFERENCE_ID,
    });

    const first = await resolveQualifyingExploreUserMapConclusions({
      userId: USER_ID,
      db: harness.db as never,
      queryText: "Correction: I like tea again now.",
      ownedSources: [
        {
          sourceId: REFERENCE_ID,
          sourceType: "reference_item",
          sourceFamily: "reference_item",
          userId: USER_ID,
          title: "preference reference",
          extract: STATEMENT,
          retrievalReason: "Owned memory was selected from the Map context lane.",
          claimSupport: "infers",
          epistemicStatus: "INFERRED",
        },
      ],
    });

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      id: expectedId,
      title: STATEMENT,
      summary: STATEMENT,
      status: UserMapConclusionStatus.emerging,
      visibility: UserMapConclusionVisibility.user_visible,
      evidenceCount: 1,
    });
    expect(harness.umcs).toHaveLength(1);
    expect(harness.links).toHaveLength(1);
    expect(harness.links[0]).toMatchObject({
      targetType: UnderstandingLinkTargetType.usermap_conclusion,
      targetId: expectedId,
      sourceType: UnderstandingLinkSourceType.reference_item,
      sourceId: REFERENCE_ID,
      role: UnderstandingLinkRole.supports,
    });

    const second = await resolveQualifyingExploreUserMapConclusions({
      userId: USER_ID,
      db: harness.db as never,
      queryText: "Correction: I like tea again now.",
      ownedSources: [
        {
          sourceId: REFERENCE_ID,
          sourceType: "reference_item",
          sourceFamily: "reference_item",
          userId: USER_ID,
          title: "preference reference",
          extract: STATEMENT,
          retrievalReason: "Owned memory was selected from the Map context lane.",
          claimSupport: "infers",
          epistemicStatus: "INFERRED",
        },
      ],
    });

    expect(second).toHaveLength(1);
    expect(second[0]?.id).toBe(expectedId);
    expect(harness.umcs).toHaveLength(1);
    expect(harness.links).toHaveLength(1);
  });

  it("does not materialize legacy reference memories when canonical authority is off", async () => {
    delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
    delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];

    const harness = createDb();
    const targets = await resolveQualifyingExploreUserMapConclusions({
      userId: USER_ID,
      db: harness.db as never,
      queryText: "Correction: I like tea again now.",
      ownedSources: [
        {
          sourceId: REFERENCE_ID,
          sourceType: "reference_item",
          sourceFamily: "reference_item",
          userId: USER_ID,
          title: "preference reference",
          extract: STATEMENT,
          retrievalReason: "Owned memory was selected from the Map context lane.",
          claimSupport: "infers",
          epistemicStatus: "INFERRED",
        },
      ],
    });

    expect(targets).toEqual([]);
    expect(harness.umcs).toHaveLength(0);
    expect(harness.links).toHaveLength(0);
  });
});
