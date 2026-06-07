import {
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishModelUpdateCandidate } from "../model-update-candidate-publish-helper";

vi.mock("server-only", () => ({}));

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    modelUpdate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    patternClaim: {
      findMany: vi.fn(),
    },
    contradictionNode: {
      findMany: vi.fn(),
    },
    userMapConclusion: {
      findMany: vi.fn(),
    },
    investigation: {
      findMany: vi.fn(),
    },
    understandingEvidenceLink: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

function buildWhatChangedPublicWhere(userId: string) {
  return {
    userId,
    visibility: ModelUpdateVisibility.user_visible,
    isMeaningful: true,
  };
}

function buildTodayPublicWhere(userId: string) {
  return buildWhatChangedPublicWhere(userId);
}

function buildTimelinePublicWhere(userId: string) {
  return buildWhatChangedPublicWhere(userId);
}

function matchesModelUpdateWhere(
  row: {
    userId: string;
    visibility: ModelUpdateVisibility;
    isMeaningful: boolean;
  },
  where: {
    userId: string;
    visibility: ModelUpdateVisibility;
    isMeaningful: boolean;
  }
): boolean {
  return (
    row.userId === where.userId &&
    row.visibility === where.visibility &&
    row.isMeaningful === where.isMeaningful
  );
}

type InMemoryModelUpdate = {
  id: string;
  userId: string;
  updateType: ModelUpdateType;
  visibility: ModelUpdateVisibility;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  userFacingSummary: string;
  isMeaningful: boolean;
  beforeSummary: string | null;
  afterSummary: string | null;
  confidenceDelta: number | null;
  meaningfulDeltaScore: number | null;
  sourceRunId: string | null;
  internalNotes: string | null;
  createdAt: Date;
};

function makePublishDbMock(seed: InMemoryModelUpdate[]) {
  const rows = seed.map((row) => ({ ...row }));
  const evidenceLinks = rows.map((row) => ({
    id: `link-${row.id}`,
    userId: row.userId,
    targetType: UnderstandingLinkTargetType.model_update,
    targetId: row.id,
  }));

  const understandingEvidenceLink = {
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          userId: string;
          targetType: UnderstandingLinkTargetType;
          targetId: string;
        };
      }) => {
        const link = evidenceLinks.find(
          (candidate) =>
            candidate.userId === where.userId &&
            candidate.targetType === where.targetType &&
            candidate.targetId === where.targetId
        );
        return link ? { id: link.id } : null;
      }
    ),
  };

  const modelUpdate = {
    findFirst: vi.fn(
      async ({ where }: { where: { id?: string; userId?: string } }) => {
        const row = rows.find(
          (candidate) =>
            (!where.id || candidate.id === where.id) &&
            (!where.userId || candidate.userId === where.userId)
        );
        return row ?? null;
      }
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          id: string;
          userId: string;
          visibility: ModelUpdateVisibility;
          isMeaningful: boolean;
        };
        data: {
          visibility: ModelUpdateVisibility;
          isMeaningful: boolean;
        };
      }) => {
        const row = rows.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.userId === where.userId &&
            candidate.visibility === where.visibility &&
            candidate.isMeaningful === where.isMeaningful
        );

        if (!row) {
          return { count: 0 };
        }

        row.visibility = data.visibility;
        row.isMeaningful = data.isMeaningful;
        return { count: 1 };
      }
    ),
    create: vi.fn(),
  };

  const tx = { modelUpdate };

  return {
    modelUpdate,
    understandingEvidenceLink,
    rows,
    $transaction: vi.fn(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx)
    ),
  };
}

describe("ModelUpdate candidate publish public safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
    prismaMock.modelUpdate.findFirst.mockResolvedValue(null);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.investigation.findMany.mockResolvedValue([]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
  });

  it("excludes internal_only + isMeaningful false candidates from public filters before publish", async () => {
    const candidate: InMemoryModelUpdate = {
      id: "mu-candidate",
      userId: "user-1",
      updateType: ModelUpdateType.link_detected,
      visibility: ModelUpdateVisibility.internal_only,
      affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
      affectedObjectId: "pc-safe",
      userFacingSummary: "Energy drops after meetings.",
      isMeaningful: false,
      beforeSummary: null,
      afterSummary: null,
      confidenceDelta: null,
      meaningfulDeltaScore: null,
      sourceRunId: "run-1",
      internalNotes: "candidateLane:internal_only",
      createdAt: new Date("2026-05-31T10:00:00.000Z"),
    };

    expect(
      matchesModelUpdateWhere(candidate, buildWhatChangedPublicWhere("user-1"))
    ).toBe(false);
    expect(matchesModelUpdateWhere(candidate, buildTodayPublicWhere("user-1"))).toBe(
      false
    );
    expect(
      matchesModelUpdateWhere(candidate, buildTimelinePublicWhere("user-1"))
    ).toBe(false);
  });

  it("includes published user_visible + isMeaningful true rows on public filters after publish", async () => {
    const candidate: InMemoryModelUpdate = {
      id: "mu-candidate",
      userId: "user-1",
      updateType: ModelUpdateType.link_detected,
      visibility: ModelUpdateVisibility.internal_only,
      affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
      affectedObjectId: "pc-safe",
      userFacingSummary: "Energy drops after meetings.",
      isMeaningful: false,
      beforeSummary: null,
      afterSummary: null,
      confidenceDelta: null,
      meaningfulDeltaScore: null,
      sourceRunId: "run-1",
      internalNotes: "candidateLane:internal_only",
      createdAt: new Date("2026-05-31T10:00:00.000Z"),
    };

    const db = makePublishDbMock([candidate]);
    await publishModelUpdateCandidate("user-1", "mu-candidate", {
      db: db as never,
    });

    const published = db.rows[0]!;
    expect(
      matchesModelUpdateWhere(published, buildWhatChangedPublicWhere("user-1"))
    ).toBe(true);
    expect(matchesModelUpdateWhere(published, buildTodayPublicWhere("user-1"))).toBe(
      true
    );
    expect(
      matchesModelUpdateWhere(published, buildTimelinePublicWhere("user-1"))
    ).toBe(true);
    expect(db.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("resolves supported affectedObjectType href on What Changed after publish", async () => {
    const publishedRow = {
      id: "mu-published",
      updateType: ModelUpdateType.link_detected,
      affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
      affectedObjectId: "pc-safe",
      userFacingSummary: "Energy drops after meetings.",
      createdAt: new Date("2026-05-31T10:00:00.000Z"),
    };

    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([publishedRow]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-safe" }]);

    const route = await import("../../app/api/what-changed/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([
      expect.objectContaining({
        id: "mu-published",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-safe",
        affectedObjectHref: "/patterns/pc-safe",
      }),
    ]);
  });

  it("allows publish for unsupported affectedObjectType with null href on projection", async () => {
    const candidate: InMemoryModelUpdate = {
      id: "mu-unsupported",
      userId: "user-1",
      updateType: ModelUpdateType.strategy_adjusted,
      visibility: ModelUpdateVisibility.internal_only,
      affectedObjectType: UnderstandingLinkTargetType.model_update,
      affectedObjectId: "mu-target-1",
      userFacingSummary: "Unsupported target type remains publishable.",
      isMeaningful: false,
      beforeSummary: null,
      afterSummary: null,
      confidenceDelta: null,
      meaningfulDeltaScore: null,
      sourceRunId: "run-1",
      internalNotes: null,
      createdAt: new Date("2026-05-31T10:00:00.000Z"),
    };

    const db = makePublishDbMock([candidate]);
    const result = await publishModelUpdateCandidate("user-1", "mu-unsupported", {
      db: db as never,
    });

    expect(result.newVisibility).toBe(ModelUpdateVisibility.user_visible);
    expect(result.newIsMeaningful).toBe(true);

    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-unsupported",
        updateType: ModelUpdateType.strategy_adjusted,
        affectedObjectType: UnderstandingLinkTargetType.model_update,
        affectedObjectId: "mu-target-1",
        userFacingSummary: "Unsupported target type remains publishable.",
        createdAt: new Date("2026-05-31T10:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/what-changed/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items[0]).toMatchObject({
      id: "mu-unsupported",
      affectedObjectType: "model_update",
      affectedObjectHref: null,
    });
  });

  it("keeps evidence continuity safe and snippet/quote-free after publish", async () => {
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce({ id: "mu-published" });
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        sourceType: "pattern_claim",
        sourceId: "pc-safe",
        createdAt: new Date("2026-05-31T10:00:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-safe" }]);

    const route = await import("../../app/api/what-changed/[id]/evidence/route");
    const response = await route.GET(
      new Request("http://localhost/api/what-changed/mu-published/evidence"),
      { params: Promise.resolve({ id: "mu-published" }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      items: [
        {
          sourceTypeLabel: "Related pattern",
          evidenceSummaryLabel: "Linked evidence",
          sourceObjectHref: "/patterns/pc-safe",
          createdAt: "2026-05-31T10:00:00.000Z",
          hasEvidence: true,
        },
      ],
    });

    const body = JSON.stringify(payload);
    expect(body).not.toContain("snippet");
    expect(body).not.toContain("quote");
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("sourceId");
  });
});
