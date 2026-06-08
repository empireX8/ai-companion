import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

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

describe("/api/today/intelligence-updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.investigation.findMany.mockResolvedValue([]);
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/today/intelligence-updates/route"
    );
    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("returns only authenticated user-owned meaningful user_visible rows with allowlisted fields and verified links", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-1",
        updateType: "conclusion_strengthened",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-1",
        userFacingSummary: "A stable recovery pattern strengthened.",
        createdAt: new Date("2026-05-18T09:30:00.000Z"),
      },
      {
        id: "mu-2",
        updateType: "correction_applied",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-candidate",
        userFacingSummary: "Candidate target must remain non-link.",
        createdAt: new Date("2026-05-18T08:30:00.000Z"),
      },
      {
        id: "mu-2b",
        updateType: "conclusion_disputed",
        affectedObjectType: "contradiction_node",
        affectedObjectId: "cn-safe",
        userFacingSummary: "Safe contradiction target should link.",
        createdAt: new Date("2026-05-18T08:20:00.000Z"),
      },
      {
        id: "mu-2c",
        updateType: "strategy_adjusted",
        affectedObjectType: "model_update",
        affectedObjectId: "mu-target-1",
        userFacingSummary: "Unsupported targets must remain non-link.",
        createdAt: new Date("2026-05-18T08:10:00.000Z"),
      },
      {
        id: " ",
        updateType: "strategy_adjusted",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-never",
        userFacingSummary: "mu-from-summary should never become an ID",
        createdAt: new Date("2026-05-18T07:30:00.000Z"),
      },
    ]);
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-safe" }]);

    const route = await import(
      "../../app/api/today/intelligence-updates/route"
    );
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: "user_visible",
        isMeaningful: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
      select: {
        id: true,
        updateType: true,
        affectedObjectType: true,
        affectedObjectId: true,
        userFacingSummary: true,
        createdAt: true,
      },
    });

    expect(payload).toEqual({
      items: [
        {
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
          id: "mu-2",
          updateTypeLabel: "Correction Applied",
          affectedObjectType: "pattern_claim",
          affectedObjectTypeLabel: "Related pattern",
          affectedObjectId: "pc-candidate",
          affectedObjectHref: null,
          userFacingSummary: "Candidate target must remain non-link.",
          createdAt: "2026-05-18T08:30:00.000Z",
        },
        {
          id: "mu-2b",
          updateTypeLabel: "Conclusion Disputed",
          affectedObjectType: "contradiction_node",
          affectedObjectTypeLabel: "Related signal",
          affectedObjectId: "cn-safe",
          affectedObjectHref: "/contradictions/cn-safe",
          userFacingSummary: "Safe contradiction target should link.",
          createdAt: "2026-05-18T08:20:00.000Z",
        },
        {
          id: "mu-2c",
          updateTypeLabel: "Strategy Adjusted",
          affectedObjectType: "model_update",
          affectedObjectTypeLabel: "Linked evidence",
          affectedObjectId: "mu-target-1",
          affectedObjectHref: null,
          userFacingSummary: "Unsupported targets must remain non-link.",
          createdAt: "2026-05-18T08:10:00.000Z",
        },
      ],
    });
    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: "user_visible",
        id: { in: ["umc-1"] },
      },
      select: { id: true },
    });
    expect(prismaMock.patternClaim.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["pc-candidate"] },
      },
      select: { id: true },
    });
    expect(prismaMock.contradictionNode.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["cn-safe"] },
      },
      select: { id: true },
    });

    const body = JSON.stringify(payload);
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("confidenceDelta");
    expect(body).not.toContain("meaningfulDeltaScore");
    expect(body).not.toContain("mu-from-summary should never become an ID");
  });

  it("returns honest non-link state data when affectedObjectId is blank", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-3",
        updateType: "strategy_adjusted",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "   ",
        userFacingSummary: "Blank target ID must stay non-link.",
        createdAt: new Date("2026-05-18T07:00:00.000Z"),
      },
    ]);

    const route = await import(
      "../../app/api/today/intelligence-updates/route"
    );
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      items: [
        {
          id: "mu-3",
          updateTypeLabel: "Strategy Adjusted",
          affectedObjectType: "pattern_claim",
          affectedObjectTypeLabel: "Related pattern",
          affectedObjectId: null,
          affectedObjectHref: null,
          userFacingSummary: "Blank target ID must stay non-link.",
          createdAt: "2026-05-18T07:00:00.000Z",
        },
      ],
    });
  });
});
