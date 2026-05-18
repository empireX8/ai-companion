import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

const prismaMock = {
  modelUpdate: {
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

  it("returns only authenticated user-owned meaningful user_visible rows with allowlisted fields", async () => {
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
        affectedObjectType: "model_update",
        affectedObjectId: "mu-target-1",
        userFacingSummary: "Unsupported targets must remain non-link.",
        createdAt: new Date("2026-05-18T08:30:00.000Z"),
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
          affectedObjectTypeLabel: "Usermap Conclusion",
          affectedObjectId: "umc-1",
          affectedObjectHref: "/your-map/umc-1",
          userFacingSummary: "A stable recovery pattern strengthened.",
          createdAt: "2026-05-18T09:30:00.000Z",
        },
        {
          id: "mu-2",
          updateTypeLabel: "Correction Applied",
          affectedObjectType: "model_update",
          affectedObjectTypeLabel: "Model Update",
          affectedObjectId: "mu-target-1",
          affectedObjectHref: null,
          userFacingSummary: "Unsupported targets must remain non-link.",
          createdAt: "2026-05-18T08:30:00.000Z",
        },
      ],
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
          affectedObjectTypeLabel: "Pattern Claim",
          affectedObjectId: null,
          affectedObjectHref: null,
          userFacingSummary: "Blank target ID must stay non-link.",
          createdAt: "2026-05-18T07:00:00.000Z",
        },
      ],
    });
  });
});
