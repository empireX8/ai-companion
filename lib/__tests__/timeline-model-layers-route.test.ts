import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("/api/timeline/model-layers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/timeline/model-layers/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline/model-layers?window=30d")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("queries only authenticated user-owned meaningful user_visible rows in the requested window with ordering and cap", async () => {
    const route = await import("../../app/api/timeline/model-layers/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline/model-layers?window=14d")
    );

    expect(response.status).toBe(200);
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: "user_visible",
        isMeaningful: true,
        createdAt: { gte: new Date("2026-05-04T00:00:00.000Z") },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        updateType: true,
        affectedObjectType: true,
        affectedObjectId: true,
        userFacingSummary: true,
        createdAt: true,
      },
    });
  });

  it("returns only allowlisted safe fields and keeps unsupported or blank targets in explicit non-link state", async () => {
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
        userFacingSummary: "Unsupported target type must remain non-link.",
        createdAt: new Date("2026-05-18T08:30:00.000Z"),
      },
      {
        id: "mu-3",
        updateType: "strategy_adjusted",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "   ",
        userFacingSummary: "Blank target ID must remain non-link.",
        createdAt: new Date("2026-05-18T07:30:00.000Z"),
      },
      {
        id: " ",
        updateType: "strategy_adjusted",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-never",
        userFacingSummary: "mu-from-summary should never become an ID",
        createdAt: new Date("2026-05-18T06:30:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/timeline/model-layers/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline/model-layers")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
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
          userFacingSummary: "Unsupported target type must remain non-link.",
          createdAt: "2026-05-18T08:30:00.000Z",
        },
        {
          id: "mu-3",
          updateTypeLabel: "Strategy Adjusted",
          affectedObjectType: "pattern_claim",
          affectedObjectTypeLabel: "Pattern Claim",
          affectedObjectId: null,
          affectedObjectHref: null,
          userFacingSummary: "Blank target ID must remain non-link.",
          createdAt: "2026-05-18T07:30:00.000Z",
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
});
