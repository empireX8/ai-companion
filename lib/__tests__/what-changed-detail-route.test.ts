import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  modelUpdate: {
    findFirst: vi.fn(),
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

describe("/api/what-changed/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.modelUpdate.findFirst.mockResolvedValue(null);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/what-changed/[id]/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "mu-1" }),
    });

    expect(response.status).toBe(401);
    expect(prismaMock.modelUpdate.findFirst).not.toHaveBeenCalled();
  });

  it("queries only user_visible meaningful model updates for the authenticated user", async () => {
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce({
      id: "mu-1",
      updateType: "conclusion_strengthened",
      affectedObjectType: "usermap_conclusion",
      affectedObjectId: "umc-1",
      userFacingSummary: "A stable recovery pattern strengthened.",
      createdAt: new Date("2026-05-21T09:30:00.000Z"),
    });
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);

    const route = await import("../../app/api/what-changed/[id]/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "mu-1" }),
    });

    expect(response.status).toBe(200);
    expect(prismaMock.modelUpdate.findFirst).toHaveBeenCalledWith({
      where: {
        id: "mu-1",
        userId: "user-1",
        visibility: "user_visible",
        isMeaningful: true,
      },
      select: {
        id: true,
        updateType: true,
        affectedObjectType: true,
        affectedObjectId: true,
        userFacingSummary: true,
        createdAt: true,
      },
    });

    const payload = await response.json();
    expect(payload.item?.id).toBe("mu-1");
    expect(payload.item?.affectedObjectHref).toBe("/your-map/umc-1");

    const body = JSON.stringify(payload);
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("internalNotes");
  });

  it("returns 404 when the update is missing or not public-safe", async () => {
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/what-changed/[id]/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "mu-hidden" }),
    });

    expect(response.status).toBe(404);
  });

  it("keeps detail route read-only with public-safe projection only", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "app/api/what-changed/[id]/route.ts"),
      "utf8"
    );
    const routeBody = routeSource
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    expect(routeSource.includes("export async function GET")).toBe(true);
    expect(routeSource.includes("export async function POST")).toBe(false);
    expect(routeBody.includes("beforeSummary")).toBe(false);
    expect(routeBody.includes("afterSummary")).toBe(false);
    expect(routeSource.includes("/api/model-updates/[id]")).toBe(false);
  });
});
