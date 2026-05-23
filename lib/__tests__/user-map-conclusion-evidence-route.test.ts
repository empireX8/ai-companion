import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  userMapConclusion: {
    findFirst: vi.fn(),
  },
  understandingEvidenceLink: {
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

describe("/api/user-map/conclusions/[id]/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.userMapConclusion.findFirst.mockResolvedValue({ id: "umc-1" });
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
  });

  it("requires auth", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/user-map/conclusions/[id]/evidence/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions/umc-1/evidence"),
      { params: Promise.resolve({ id: "umc-1" }) }
    );

    expect(response.status).toBe(401);
    expect(prismaMock.userMapConclusion.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for missing, unowned, or hidden targets", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import(
      "../../app/api/user-map/conclusions/[id]/evidence/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/user-map/conclusions/umc-missing/evidence"
      ),
      { params: Promise.resolve({ id: "umc-missing" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenCalledWith({
      where: {
        id: "umc-missing",
        userId: "user-1",
        visibility: "user_visible",
      },
      select: { id: true },
    });
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("returns minimal safe projection only, with allowlisted verified sources", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        sourceType: "pattern_claim",
        sourceId: "pc-safe",
        createdAt: new Date("2026-05-22T10:00:00.000Z"),
      },
      {
        id: "link-2",
        sourceType: "pattern_claim",
        sourceId: "pc-candidate",
        createdAt: new Date("2026-05-22T09:00:00.000Z"),
      },
      {
        id: "link-3",
        sourceType: "contradiction_node",
        sourceId: "cn-safe",
        createdAt: new Date("2026-05-22T08:00:00.000Z"),
      },
      {
        id: "link-4",
        sourceType: "contradiction_node",
        sourceId: "cn-candidate",
        createdAt: new Date("2026-05-22T07:00:00.000Z"),
      },
      {
        id: "link-5",
        sourceType: "session",
        sourceId: "sess-1",
        createdAt: new Date("2026-05-22T06:00:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-safe" }]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-safe" }]);

    const route = await import(
      "../../app/api/user-map/conclusions/[id]/evidence/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions/umc-1/evidence"),
      { params: Promise.resolve({ id: "umc-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        targetType: "usermap_conclusion",
        targetId: "umc-1",
        sourceType: {
          in: ["pattern_claim", "contradiction_node"],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 6,
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
      },
    });
    expect(payload).toEqual({
      items: [
        {
          sourceTypeLabel: "Pattern Claim",
          sourceObjectHref: "/patterns/pc-safe",
          createdAt: "2026-05-22T10:00:00.000Z",
          hasEvidence: true,
        },
        {
          sourceTypeLabel: "Contradiction Node",
          sourceObjectHref: "/contradictions/cn-safe",
          createdAt: "2026-05-22T08:00:00.000Z",
          hasEvidence: true,
        },
      ],
    });

    const body = JSON.stringify(payload);
    expect(body).not.toContain("quote");
    expect(body).not.toContain("snippet");
    expect(body).not.toContain("summary");
    expect(body).not.toContain("meta");
    expect(body).not.toContain("weight");
    expect(body).not.toContain("confidenceContribution");
    expect(body).not.toContain("sourceId");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("receipt-action-");
  });
});
