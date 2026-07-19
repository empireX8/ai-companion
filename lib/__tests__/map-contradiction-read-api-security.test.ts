import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const expireSnoozedContradictionsForUserMock = vi.fn();

const prismadbMock = {
  contradictionNode: {
    findMany: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
  modelUpdate: {
    findMany: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismadbMock,
}));

vi.mock("../prismadb", () => ({
  default: prismadbMock,
}));

vi.mock("@/lib/contradiction-escalation", async () => {
  const actual = await import("../contradiction-escalation");
  return actual;
});

vi.mock("@/lib/contradiction-enums", async () => {
  const actual = await import("../contradiction-enums");
  return actual;
});

vi.mock("@/lib/contradiction-schema", async () => {
  const actual = await import("../contradiction-schema");
  return actual;
});

vi.mock("@/lib/contradiction-snooze-expiry", () => ({
  expireSnoozedContradictionsForUser: expireSnoozedContradictionsForUserMock,
}));

vi.mock("@/lib/contradiction-surface", () => ({
  getTop3WithOptionalSurfacing: vi.fn(),
}));

vi.mock("@/lib/contradiction-source", () => ({
  ContradictionSourceError: class ContradictionSourceError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  resolveContradictionSource: vi.fn(),
}));

vi.mock("@/lib/understanding-links", async () => {
  const actual = await import("../understanding-links");
  return actual;
});

describe("GET /api/contradiction Map open read security", () => {
  beforeEach(() => {
    authMock.mockReset();
    expireSnoozedContradictionsForUserMock.mockReset();
    expireSnoozedContradictionsForUserMock.mockResolvedValue(undefined);
    prismadbMock.contradictionNode.findMany.mockReset();
    prismadbMock.session.findMany.mockReset();
    prismadbMock.session.findMany.mockResolvedValue([]);
  });

  it("scopes open list to authenticated user and status=open only", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findMany.mockResolvedValue([
      {
        id: "cn-a-open",
        userId: "user-a",
        title: "Mine",
        sideA: "A",
        sideB: "B",
        type: "value_conflict",
        confidence: "medium",
        status: "open",
        weight: 1,
        snoozeCount: 0,
        timesSurfaced: 0,
        lastSurfacedAt: null,
        lastEvidenceAt: null,
        evidenceCount: 1,
        recommendedRung: null,
        escalationLevel: 0,
        avoidanceCount: 0,
        lastEscalatedAt: null,
        lastAvoidedAt: null,
        rung: null,
        snoozedUntil: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        lastTouchedAt: new Date("2026-07-01T00:00:00.000Z"),
        sourceSessionId: null,
        sourceMessageId: null,
        evidence: [],
        _count: { evidence: 1 },
      },
    ]);

    const route = await import("../../app/api/contradiction/route");
    const response = await route.GET(
      new Request("http://localhost/api/contradiction?status=open&page=1&limit=50"),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].id).toBe("cn-a-open");
    expect(payload.items[0].status).toBe("open");
    expect(prismadbMock.contradictionNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          status: "open",
        }),
      }),
    );
  });

  it("rejects unauthenticated Map open reads", async () => {
    authMock.mockResolvedValue({ userId: null });
    const route = await import("../../app/api/contradiction/route");
    const response = await route.GET(
      new Request("http://localhost/api/contradiction?status=open&page=1&limit=50"),
    );
    expect(response.status).toBe(401);
    expect(prismadbMock.contradictionNode.findMany).not.toHaveBeenCalled();
  });

  it("GET performs no create/update/delete mutation", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findMany.mockResolvedValue([]);
    const route = await import("../../app/api/contradiction/route");
    const response = await route.GET(
      new Request("http://localhost/api/contradiction?status=open&page=1&limit=50"),
    );
    expect(response.status).toBe(200);
    expect(Object.keys(prismadbMock.contradictionNode)).toEqual(["findMany"]);
  });
});
