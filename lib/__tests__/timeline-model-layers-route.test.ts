import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();
const readMovementListMock = vi.fn();

const prismaMock = {
  modelUpdate: {
    findMany: vi.fn(),
  },
  userMapConclusion: {
    findMany: vi.fn(),
  },
  patternClaim: {
    findMany: vi.fn(),
  },
  contradictionNode: {
    findMany: vi.fn(),
  },
  investigation: {
    findMany: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../canonical-movement-list-merge", () => ({
  readCanonicalAndLegacyMovementList: (...args: unknown[]) =>
    readMovementListMock(...args),
}));

describe("/api/timeline/model-layers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    authMock.mockResolvedValue({ userId: "user-1" });
    readMovementListMock.mockResolvedValue({ items: [], canonicalConcepts: [] });
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.investigation.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/timeline/model-layers/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline/model-layers?window=30d"),
    );

    expect(response.status).toBe(401);
    expect(readMovementListMock).not.toHaveBeenCalled();
  });

  it("queries the shared movement reader with authenticated user, window, and cap", async () => {
    const route = await import("../../app/api/timeline/model-layers/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline/model-layers?window=14d"),
    );

    expect(response.status).toBe(200);
    expect(readMovementListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        limit: 20,
        createdAtGte: new Date("2026-05-04T00:00:00.000Z"),
      }),
    );
  });

  it("returns only allowlisted safe fields and keeps unsupported/unverified targets in explicit non-link state", async () => {
    readMovementListMock.mockResolvedValueOnce({
      canonicalConcepts: [],
      items: [
        {
          authorityType: "legacy_model_update",
          id: "mu-1",
          updateTypeLabel: "Conclusion Strengthened",
          affectedObjectType: "usermap_conclusion",
          affectedObjectTypeLabel: "Related map item",
          affectedObjectId: "umc-1",
          affectedObjectHref: "/your-map/umc-1",
          userFacingSummary: "A stable recovery pattern strengthened.",
          createdAt: "2026-05-18T09:30:00.000Z",
        },
        {
          authorityType: "legacy_model_update",
          id: "mu-2",
          updateTypeLabel: "Correction Applied",
          affectedObjectType: "pattern_claim",
          affectedObjectTypeLabel: "Related pattern",
          affectedObjectId: "pc-candidate",
          affectedObjectHref: "/patterns/pc-candidate",
          userFacingSummary: "Candidate target type must remain non-link.",
          createdAt: "2026-05-18T08:30:00.000Z",
        },
        {
          authorityType: "legacy_model_update",
          id: "mu-2b",
          updateTypeLabel: "Conclusion Disputed",
          affectedObjectType: "contradiction_node",
          affectedObjectTypeLabel: "Related signal",
          affectedObjectId: "cn-safe",
          affectedObjectHref: "/contradictions/cn-safe",
          userFacingSummary: "Verified contradiction target should link.",
          createdAt: "2026-05-18T08:15:00.000Z",
        },
        {
          authorityType: "legacy_model_update",
          id: "mu-2c",
          updateTypeLabel: "Strategy Adjusted",
          affectedObjectType: "model_update",
          affectedObjectTypeLabel: "Linked evidence",
          affectedObjectId: "mu-target-1",
          affectedObjectHref: null,
          userFacingSummary: "Unsupported target type must remain non-link.",
          createdAt: "2026-05-18T08:00:00.000Z",
        },
        {
          authorityType: "legacy_model_update",
          id: "mu-3",
          updateTypeLabel: "Strategy Adjusted",
          affectedObjectType: "pattern_claim",
          affectedObjectTypeLabel: "Related pattern",
          affectedObjectId: null,
          affectedObjectHref: null,
          userFacingSummary: "Blank target ID must remain non-link.",
          createdAt: "2026-05-18T07:30:00.000Z",
        },
      ],
    });
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-safe" }]);

    const route = await import("../../app/api/timeline/model-layers/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline/model-layers"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items[0].affectedObjectHref).toBe("/your-map/umc-1");
    expect(payload.items[1].affectedObjectHref).toBeNull();
    expect(payload.items[2].affectedObjectHref).toBe("/contradictions/cn-safe");
    expect(payload.items[3].affectedObjectHref).toBeNull();
    expect(payload.items[4].affectedObjectId).toBeNull();

    const body = JSON.stringify(payload);
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("meaningfulDeltaScore");
  });
});
