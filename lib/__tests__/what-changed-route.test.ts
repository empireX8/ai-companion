import { readFileSync } from "node:fs";
import path from "node:path";
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

describe("/api/what-changed", () => {
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

    const route = await import("../../app/api/what-changed/route");
    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("queries only authenticated user-owned meaningful user_visible rows with fixed ordering and cap", async () => {
    const route = await import("../../app/api/what-changed/route");
    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: "user_visible",
        isMeaningful: true,
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

  it("returns only allowlisted fields, verifies affected-object hrefs, and keeps unsupported or unverified links null", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-1",
        updateType: "conclusion_strengthened",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-1",
        userFacingSummary: "A stable recovery pattern strengthened.",
        createdAt: new Date("2026-05-21T09:30:00.000Z"),
      },
      {
        id: "mu-1b",
        updateType: "conclusion_disputed",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-hidden",
        userFacingSummary: "Unverified conclusion target should remain non-link.",
        createdAt: new Date("2026-05-21T09:20:00.000Z"),
      },
      {
        id: "mu-2",
        updateType: "correction_applied",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-candidate",
        userFacingSummary: "Candidate target should remain non-link.",
        createdAt: new Date("2026-05-21T09:10:00.000Z"),
      },
      {
        id: "mu-3",
        updateType: "conclusion_disputed",
        affectedObjectType: "contradiction_node",
        affectedObjectId: "cn-safe",
        userFacingSummary: "Safe contradiction target should link.",
        createdAt: new Date("2026-05-21T09:00:00.000Z"),
      },
      {
        id: "mu-4",
        updateType: "strategy_adjusted",
        affectedObjectType: "model_update",
        affectedObjectId: "mu-target-1",
        userFacingSummary: "Unsupported target type should remain non-link.",
        createdAt: new Date("2026-05-21T08:50:00.000Z"),
      },
      {
        id: "mu-5",
        updateType: "strategy_adjusted",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "   ",
        userFacingSummary: "Blank target IDs should remain non-link.",
        createdAt: new Date("2026-05-21T08:40:00.000Z"),
      },
      {
        id: " ",
        updateType: "strategy_adjusted",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-never",
        userFacingSummary: "mu-from-summary should never become an ID",
        createdAt: new Date("2026-05-21T08:30:00.000Z"),
      },
    ]);
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-safe" }]);

    const route = await import("../../app/api/what-changed/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      items: [
        {
          id: "mu-1",
          updateType: "conclusion_strengthened",
          affectedObjectType: "usermap_conclusion",
          affectedObjectId: "umc-1",
          affectedObjectHref: "/your-map/umc-1",
          userFacingSummary: "A stable recovery pattern strengthened.",
          createdAt: "2026-05-21T09:30:00.000Z",
        },
        {
          id: "mu-1b",
          updateType: "conclusion_disputed",
          affectedObjectType: "usermap_conclusion",
          affectedObjectId: "umc-hidden",
          affectedObjectHref: null,
          userFacingSummary: "Unverified conclusion target should remain non-link.",
          createdAt: "2026-05-21T09:20:00.000Z",
        },
        {
          id: "mu-2",
          updateType: "correction_applied",
          affectedObjectType: "pattern_claim",
          affectedObjectId: "pc-candidate",
          affectedObjectHref: null,
          userFacingSummary: "Candidate target should remain non-link.",
          createdAt: "2026-05-21T09:10:00.000Z",
        },
        {
          id: "mu-3",
          updateType: "conclusion_disputed",
          affectedObjectType: "contradiction_node",
          affectedObjectId: "cn-safe",
          affectedObjectHref: "/contradictions/cn-safe",
          userFacingSummary: "Safe contradiction target should link.",
          createdAt: "2026-05-21T09:00:00.000Z",
        },
        {
          id: "mu-4",
          updateType: "strategy_adjusted",
          affectedObjectType: "model_update",
          affectedObjectId: "mu-target-1",
          affectedObjectHref: null,
          userFacingSummary: "Unsupported target type should remain non-link.",
          createdAt: "2026-05-21T08:50:00.000Z",
        },
        {
          id: "mu-5",
          updateType: "strategy_adjusted",
          affectedObjectType: "pattern_claim",
          affectedObjectId: null,
          affectedObjectHref: null,
          userFacingSummary: "Blank target IDs should remain non-link.",
          createdAt: "2026-05-21T08:40:00.000Z",
        },
      ],
    });

    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: "user_visible",
        id: { in: ["umc-1", "umc-hidden"] },
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

  it("keeps what-changed list route read-only with no internal-review/write semantics", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "app/api/what-changed/route.ts"),
      "utf8"
    );

    expect(routeSource.includes("applyVerifiedAffectedObjectHrefs")).toBe(true);
    expect(routeSource.includes("/api/model-updates/[id]")).toBe(false);
    expect(routeSource.includes("/api/internal/user-map/review-candidates")).toBe(
      false
    );
    expect(routeSource.includes("/internal/user-map/review")).toBe(false);
    expect(routeSource.includes("internal_only")).toBe(false);
    expect(routeSource.includes("sourceRunId")).toBe(false);
    expect(routeSource.includes("internalNotes")).toBe(false);
    expect(routeSource.includes("beforeSummary")).toBe(false);
    expect(routeSource.includes("afterSummary")).toBe(false);
    expect(routeSource.includes("confidenceDelta")).toBe(false);
    expect(routeSource.includes("meaningfulDeltaScore")).toBe(false);
    expect(routeSource.includes("metadata")).toBe(false);
    expect(routeSource.includes("evidence")).toBe(false);
    expect(routeSource.includes("candidate")).toBe(false);
    expect(routeSource.includes("export async function POST")).toBe(false);
    expect(routeSource.includes("export async function PUT")).toBe(false);
    expect(routeSource.includes("export async function PATCH")).toBe(false);
    expect(routeSource.includes("export async function DELETE")).toBe(false);
    expect(routeSource.includes("promote")).toBe(false);
    expect(routeSource.includes("edit")).toBe(false);
    expect(routeSource.includes("delete")).toBe(false);
  });
});
