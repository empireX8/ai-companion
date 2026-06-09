import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const authMock = vi.fn();

const prismaMock = {
  userMapConclusion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  investigation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  modelUpdate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  fieldworkAssignment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  patternClaim: {
    findFirst: vi.fn(),
  },
  patternClaimEvidence: {
    findFirst: vi.fn(),
  },
  contradictionNode: {
    findFirst: vi.fn(),
  },
  contradictionEvidence: {
    findFirst: vi.fn(),
  },
  profileArtifact: {
    findFirst: vi.fn(),
  },
  evidenceSpan: {
    findFirst: vi.fn(),
  },
  referenceItem: {
    findFirst: vi.fn(),
  },
  surfacedAction: {
    findFirst: vi.fn(),
  },
  quickCheckIn: {
    findFirst: vi.fn(),
  },
  journalEntry: {
    findFirst: vi.fn(),
  },
  session: {
    findFirst: vi.fn(),
  },
  message: {
    findFirst: vi.fn(),
  },
  importUploadSession: {
    findFirst: vi.fn(),
  },
  importUploadChunk: {
    findFirst: vi.fn(),
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

const JSON_HEADERS = { "content-type": "application/json" };

describe("Understanding Engine Phase 1B API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });

    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.investigation.findMany.mockResolvedValue([]);
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);

    prismaMock.patternClaim.findFirst.mockResolvedValue({ id: "claim-1" });
    prismaMock.patternClaimEvidence.findFirst.mockResolvedValue({ id: "pce-1" });
    prismaMock.contradictionNode.findFirst.mockResolvedValue({ id: "cn-1" });
    prismaMock.contradictionEvidence.findFirst.mockResolvedValue({ id: "ce-1" });
    prismaMock.profileArtifact.findFirst.mockResolvedValue({ id: "pa-1" });
    prismaMock.evidenceSpan.findFirst.mockResolvedValue({ id: "es-1" });
    prismaMock.referenceItem.findFirst.mockResolvedValue({ id: "ri-1" });
    prismaMock.surfacedAction.findFirst.mockResolvedValue({ id: "sa-1" });
    prismaMock.quickCheckIn.findFirst.mockResolvedValue({ id: "qc-1" });
    prismaMock.journalEntry.findFirst.mockResolvedValue({ id: "je-1" });
    prismaMock.session.findFirst.mockResolvedValue({ id: "session-1" });
    prismaMock.message.findFirst.mockResolvedValue({ id: "msg-1" });
    prismaMock.importUploadSession.findFirst.mockResolvedValue({ id: "import-1" });
    prismaMock.importUploadChunk.findFirst.mockResolvedValue(null);
  });

  it("requires auth for user-map conclusions list", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
  });

  it("requires auth for investigations list", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/investigations/route");
    const response = await route.GET(
      new Request("http://localhost/api/investigations")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
  });

  it("requires auth for model-updates list", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/model-updates/route");
    const response = await route.GET(
      new Request("http://localhost/api/model-updates")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("requires auth for fieldwork list", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/fieldwork/route");
    const response = await route.GET(new Request("http://localhost/api/fieldwork"));

    expect(response.status).toBe(401);
    expect(prismaMock.fieldworkAssignment.findMany).not.toHaveBeenCalled();
  });

  it("requires auth for evidence-link list", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion&targetId=umc-1"
      )
    );

    expect(response.status).toBe(401);
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 on cross-user user-map conclusion detail", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions/other-user-row"),
      { params: Promise.resolve({ id: "other-user-row" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns user-map conclusion detail when row is user_visible", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-visible-1",
      title: "Visible conclusion",
      summary: "Visible summary",
      area: "operating_logic",
      status: "hypothesis",
      confidenceLevel: "low",
      evidenceCount: 2,
      sourceDiversity: 1,
      timeSpreadDays: 3,
      createdAt: new Date("2026-05-10T08:00:00.000Z"),
      updatedAt: new Date("2026-05-15T10:00:00.000Z"),
    });

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions/umc-visible-1"),
      { params: Promise.resolve({ id: "umc-visible-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("returns 404 for internal_only user-map conclusion detail by default", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions/umc-internal-1"),
      { params: Promise.resolve({ id: "umc-internal-1" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "user_visible",
        }),
      })
    );
  });

  it("returns 404 on cross-user investigation patch", async () => {
    prismaMock.investigation.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/investigations/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/investigations/other-user-row", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "gathering_evidence" }),
      }),
      { params: Promise.resolve({ id: "other-user-row" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.investigation.update).not.toHaveBeenCalled();
  });

  it("returns 404 on cross-user model-update detail", async () => {
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/model-updates/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/model-updates/other-user-row"),
      { params: Promise.resolve({ id: "other-user-row" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 on cross-user fieldwork patch", async () => {
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/fieldwork/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/fieldwork/other-user-row", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "active" }),
      }),
      { params: Promise.resolve({ id: "other-user-row" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.fieldworkAssignment.update).not.toHaveBeenCalled();
  });

  it("scopes evidence-link list queries by authenticated user", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion&targetId=umc-1"
      )
    );

    expect(response.status).toBe(200);
    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });

  it("rejects invalid user-map status enum", async () => {
    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions?status=not_real")
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid investigation status enum", async () => {
    const route = await import("../../app/api/investigations/route");
    const response = await route.GET(
      new Request("http://localhost/api/investigations?status=not_real")
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid model-update visibility enum", async () => {
    const route = await import("../../app/api/model-updates/route");
    const response = await route.GET(
      new Request("http://localhost/api/model-updates?visibility=not_real")
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid fieldwork status enum", async () => {
    const route = await import("../../app/api/fieldwork/route");
    const response = await route.GET(
      new Request("http://localhost/api/fieldwork?status=not_real")
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid evidence-link role enum", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion&targetId=umc-1&role=not_real"
      )
    );

    expect(response.status).toBe(400);
  });

  it("creates user-map conclusion with authenticated userId", async () => {
    prismaMock.userMapConclusion.create.mockResolvedValueOnce({
      id: "umc-1",
      userId: "user-1",
      area: "operating_logic",
      status: "hypothesis",
      title: "Title",
      summary: "Summary",
      confidenceScore: 0.3,
      confidenceLevel: "low",
      evidenceCount: 0,
      sourceDiversity: 0,
      timeSpreadDays: 0,
      version: 1,
      createdAt: new Date("2026-05-14T10:00:00.000Z"),
      updatedAt: new Date("2026-05-14T10:00:00.000Z"),
    });

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.POST(
      new Request("http://localhost/api/user-map/conclusions", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          userId: "attacker-user",
          area: "operating_logic",
          status: "hypothesis",
          title: "Title",
          summary: "Summary",
          confidenceScore: 0.3,
          confidenceLevel: "low",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(prismaMock.userMapConclusion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          visibility: "user_visible",
        }),
        select: expect.objectContaining({
          id: true,
          sourceDiversity: true,
          timeSpreadDays: true,
          createdAt: true,
        }),
      })
    );
  });

  it("omits internal lifecycle fields from public user-map conclusion POST response", async () => {
    prismaMock.userMapConclusion.create.mockResolvedValueOnce({
      id: "umc-new-1",
      title: "New conclusion",
      summary: "New summary",
      area: "operating_logic",
      status: "hypothesis",
      confidenceLevel: "low",
      evidenceCount: 0,
      sourceDiversity: 0,
      timeSpreadDays: 0,
      createdAt: new Date("2026-05-14T10:00:00.000Z"),
      updatedAt: new Date("2026-05-14T10:00:00.000Z"),
    });

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.POST(
      new Request("http://localhost/api/user-map/conclusions", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          area: "operating_logic",
          status: "hypothesis",
          title: "New conclusion",
          summary: "New summary",
          confidenceScore: 0.3,
          confidenceLevel: "low",
        }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("candidateLifecycleStatus");
    expect(serialized).not.toContain("confidenceScore");
    expect(serialized).not.toContain('"notes"');
    expect(serialized).not.toContain("internal_only");
    expect(body.item).toEqual({
      id: "umc-new-1",
      title: "New conclusion",
      summary: "New summary",
      area: "operating_logic",
      status: "hypothesis",
      confidenceLevel: "low",
      evidenceCount: 0,
      sourceDiversity: 0,
      timeSpreadDays: 0,
      createdAt: "2026-05-14T10:00:00.000Z",
      updatedAt: "2026-05-14T10:00:00.000Z",
    });
    expect(body.item).not.toHaveProperty("visibility");
    expect(body.item).not.toHaveProperty("userId");
    expect(body.item).not.toHaveProperty("version");
    expect(body.item).not.toHaveProperty("supersededById");
  });

  it("rejects user-map create when visibility is supplied", async () => {
    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.POST(
      new Request("http://localhost/api/user-map/conclusions", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          area: "operating_logic",
          status: "hypothesis",
          title: "Title",
          summary: "Summary",
          confidenceScore: 0.3,
          confidenceLevel: "low",
          visibility: "internal_only",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.userMapConclusion.create).not.toHaveBeenCalled();
  });

  it("rejects user-map supersededById that is not same-user owned", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.POST(
      new Request("http://localhost/api/user-map/conclusions", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          area: "operating_logic",
          status: "hypothesis",
          title: "Title",
          summary: "Summary",
          confidenceScore: 0.4,
          confidenceLevel: "low",
          supersededById: "other-user-row",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.userMapConclusion.create).not.toHaveBeenCalled();
  });

  it("blocks disputed -> supported transition for user-map conclusions", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-1",
      userId: "user-1",
      status: "disputed",
      evidenceCount: 1,
      sourceDiversity: 1,
      timeSpreadDays: 1,
    });

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/user-map/conclusions/umc-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "supported" }),
      }),
      { params: Promise.resolve({ id: "umc-1" }) }
    );

    expect(response.status).toBe(422);
    expect(prismaMock.userMapConclusion.update).not.toHaveBeenCalled();
  });

  it("applies pagination envelope for user-map conclusions list", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-2",
        title: "Second conclusion",
        summary: "Second summary",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "medium",
        evidenceCount: 4,
        updatedAt: new Date("2026-05-14T12:00:00.000Z"),
      },
      {
        id: "umc-3",
        title: "Third conclusion",
        summary: "Third summary",
        area: "identity",
        status: "hypothesis",
        confidenceLevel: "low",
        evidenceCount: 1,
        updatedAt: new Date("2026-05-14T11:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions?limit=1")
    );

    expect(response.status).toBe(200);
    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          visibility: "user_visible",
        }),
        select: expect.objectContaining({
          id: true,
          title: true,
          summary: true,
          area: true,
          status: true,
          confidenceLevel: true,
          evidenceCount: true,
          updatedAt: true,
        }),
      })
    );
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "umc-2",
          title: "Second conclusion",
          summary: "Second summary",
          area: "operating_logic",
          status: "emerging",
          confidenceLevel: "medium",
          evidenceCount: 4,
          updatedAt: "2026-05-14T12:00:00.000Z",
        },
      ],
      pageInfo: {
        nextCursor: "2026-05-14T12:00:00.000Z",
        limit: 1,
        hasMore: true,
      },
    });
  });

  it("omits internal lifecycle fields from public user-map conclusion list GET", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-visible-1",
        title: "Visible conclusion",
        summary: "Visible summary",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "low",
        evidenceCount: 50,
        updatedAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("candidateLifecycleStatus");
    expect(serialized).not.toContain("confidenceScore");
    expect(serialized).not.toContain('"notes"');
    expect(serialized).not.toContain("internal_only");
    expect(serialized).not.toContain("user-1");
    expect(body.items[0]).toEqual({
      id: "umc-visible-1",
      title: "Visible conclusion",
      summary: "Visible summary",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "low",
      evidenceCount: 50,
      updatedAt: "2026-05-15T10:00:00.000Z",
    });
  });

  it("omits internal lifecycle fields from public user-map conclusion PATCH response", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-1",
      status: "emerging",
      evidenceCount: 5,
      sourceDiversity: 2,
      timeSpreadDays: 7,
    });
    prismaMock.userMapConclusion.update.mockResolvedValueOnce({
      id: "umc-1",
      title: "Updated conclusion",
      summary: "Updated summary",
      area: "operating_logic",
      status: "supported",
      confidenceLevel: "high",
      evidenceCount: 6,
      sourceDiversity: 3,
      timeSpreadDays: 10,
      createdAt: new Date("2026-05-10T08:00:00.000Z"),
      updatedAt: new Date("2026-05-16T10:00:00.000Z"),
    });

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/user-map/conclusions/umc-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "supported" }),
      }),
      { params: Promise.resolve({ id: "umc-1" }) }
    );

    expect(response.status).toBe(200);
    expect(prismaMock.userMapConclusion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "umc-1" },
        data: { status: "supported" },
        select: expect.objectContaining({
          id: true,
          sourceDiversity: true,
          timeSpreadDays: true,
          createdAt: true,
        }),
      })
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("candidateLifecycleStatus");
    expect(serialized).not.toContain("confidenceScore");
    expect(serialized).not.toContain('"notes"');
    expect(serialized).not.toContain("internal_only");
    expect(body.item).toEqual({
      id: "umc-1",
      title: "Updated conclusion",
      summary: "Updated summary",
      area: "operating_logic",
      status: "supported",
      confidenceLevel: "high",
      evidenceCount: 6,
      sourceDiversity: 3,
      timeSpreadDays: 10,
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-16T10:00:00.000Z",
    });
    expect(body.item).not.toHaveProperty("visibility");
    expect(body.item).not.toHaveProperty("userId");
  });

  it("omits internal lifecycle fields from public user-map conclusion detail GET", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-visible-1",
      title: "Visible conclusion",
      summary: "Visible summary",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "low",
      evidenceCount: 50,
      sourceDiversity: 8,
      timeSpreadDays: 14,
      createdAt: new Date("2026-05-10T08:00:00.000Z"),
      updatedAt: new Date("2026-05-15T10:00:00.000Z"),
    });

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions/umc-visible-1"),
      { params: Promise.resolve({ id: "umc-visible-1" }) }
    );

    expect(response.status).toBe(200);
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "user_visible",
        }),
        select: expect.objectContaining({
          id: true,
          sourceDiversity: true,
          timeSpreadDays: true,
          createdAt: true,
        }),
      })
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("candidateLifecycleStatus");
    expect(serialized).not.toContain("confidenceScore");
    expect(serialized).not.toContain('"notes"');
    expect(serialized).not.toContain("internal_only");
    expect(body.item).toEqual({
      id: "umc-visible-1",
      title: "Visible conclusion",
      summary: "Visible summary",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "low",
      evidenceCount: 50,
      sourceDiversity: 8,
      timeSpreadDays: 14,
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-15T10:00:00.000Z",
    });
  });

  it("keeps user-map list filters while excluding internal_only rows", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/user-map/conclusions?status=hypothesis&area=operating_logic&confidenceLevel=low"
      )
    );

    expect(response.status).toBe(200);
    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "user_visible",
          status: "hypothesis",
          area: "operating_logic",
          confidenceLevel: "low",
        }),
      })
    );
  });

  it("returns 404 for patching internal_only user-map conclusion by default", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/user-map/conclusions/umc-internal-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "emerging" }),
      }),
      { params: Promise.resolve({ id: "umc-internal-1" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.userMapConclusion.update).not.toHaveBeenCalled();
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "user_visible",
        }),
      })
    );
  });

  it("rejects user-map patch when visibility field is supplied", async () => {
    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/user-map/conclusions/umc-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ visibility: "internal_only" }),
      }),
      { params: Promise.resolve({ id: "umc-1" }) }
    );

    expect(response.status).toBe(400);
    expect(prismaMock.userMapConclusion.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.userMapConclusion.update).not.toHaveBeenCalled();
  });

  it("rejects investigation resolvedIntoUserMapConclusionId not owned by user", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/investigations/route");
    const response = await route.POST(
      new Request("http://localhost/api/investigations", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          title: "Investigation title",
          organizingQuestion: "What is happening?",
          status: "resolving",
          seedType: "pattern",
          competingTheories: [],
          evidenceNeeded: [],
          resolvedIntoUserMapConclusionId: "other-user-conclusion",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.investigation.create).not.toHaveBeenCalled();
  });

  it("blocks abandoned -> resolved transition for investigations", async () => {
    prismaMock.investigation.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      userId: "user-1",
      status: "abandoned",
    });

    const route = await import("../../app/api/investigations/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/investigations/inv-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "resolved" }),
      }),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(422);
    expect(prismaMock.investigation.update).not.toHaveBeenCalled();
  });

  it("supports filtered/paginated investigation list", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-2",
        updatedAt: new Date("2026-05-14T12:00:00.000Z"),
      },
      {
        id: "inv-3",
        updatedAt: new Date("2026-05-14T11:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/investigations/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/investigations?status=open&seedType=pattern&priority=2&sortOrder=desc&limit=1"
      )
    );

    expect(response.status).toBe(200);
    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "open",
          seedType: "pattern",
          priority: 2,
        }),
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      })
    );
  });

  it("excludes internal_only model updates by default in list route", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/model-updates/route");
    const response = await route.GET(
      new Request("http://localhost/api/model-updates")
    );

    expect(response.status).toBe(200);
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: { not: "internal_only" },
        }),
      })
    );
  });

  it("blocks internal_only -> user_visible visibility transition", async () => {
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce({
      id: "mu-1",
      visibility: "internal_only",
    });

    const route = await import("../../app/api/model-updates/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/model-updates/mu-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ visibility: "user_visible" }),
      }),
      { params: Promise.resolve({ id: "mu-1" }) }
    );

    expect(response.status).toBe(422);
    expect(prismaMock.modelUpdate.update).not.toHaveBeenCalled();
  });

  it("rejects completed fieldwork create without observation payload", async () => {
    const route = await import("../../app/api/fieldwork/route");
    const response = await route.POST(
      new Request("http://localhost/api/fieldwork", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          prompt: "Watch for energy drop",
          reason: "Investigating state switch",
          status: "completed",
          linkedObjectType: "investigation",
          linkedObjectId: "inv-1",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.fieldworkAssignment.create).not.toHaveBeenCalled();
  });

  it("allows completed fieldwork create with observation payload", async () => {
    prismaMock.investigation.findFirst.mockResolvedValueOnce({ id: "inv-1" });
    prismaMock.fieldworkAssignment.create.mockResolvedValueOnce({
      id: "fw-2",
      userId: "user-1",
      prompt: "Watch for energy drop",
      reason: "Investigating state switch",
      status: "completed",
      linkedObjectType: "investigation",
      linkedObjectId: "inv-1",
      observationNote: "Drop happened after meeting",
    });

    const route = await import("../../app/api/fieldwork/route");
    const response = await route.POST(
      new Request("http://localhost/api/fieldwork", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          prompt: "Watch for energy drop",
          reason: "Investigating state switch",
          status: "completed",
          linkedObjectType: "investigation",
          linkedObjectId: "inv-1",
          observationNote: "Drop happened after meeting",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(prismaMock.fieldworkAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          status: "completed",
        }),
      })
    );
  });

  it("rejects fieldwork create when surfaced_action link is not user-owned", async () => {
    prismaMock.surfacedAction.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/fieldwork/route");
    const response = await route.POST(
      new Request("http://localhost/api/fieldwork", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          prompt: "Track if this action stabilizes energy",
          reason: "Turn action into observation-first experiment",
          status: "assigned",
          linkedObjectType: "surfaced_action",
          linkedObjectId: "sa-other-user",
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      details: expect.arrayContaining([
        expect.objectContaining({ field: "linkedObjectId" }),
      ]),
    });
    expect(prismaMock.fieldworkAssignment.create).not.toHaveBeenCalled();
    expect(prismaMock.surfacedAction.findFirst).toHaveBeenCalledWith({
      where: {
        id: "sa-other-user",
        userId: "user-1",
      },
      select: { id: true },
    });
  });

  it("allows fieldwork create when surfaced_action link is user-owned", async () => {
    prismaMock.fieldworkAssignment.create.mockResolvedValueOnce({
      id: "fw-action-1",
      userId: "user-1",
      prompt: "Track if this action stabilizes energy",
      reason: "Turn action into observation-first experiment",
      status: "assigned",
      linkedObjectType: "surfaced_action",
      linkedObjectId: "sa-1",
      observationNote: null,
      observationOutcome: null,
      completedAt: null,
      expiresAt: null,
      priority: null,
      createdAt: new Date("2026-05-14T10:00:00.000Z"),
      updatedAt: new Date("2026-05-14T10:00:00.000Z"),
    });

    const route = await import("../../app/api/fieldwork/route");
    const response = await route.POST(
      new Request("http://localhost/api/fieldwork", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          prompt: "Track if this action stabilizes energy",
          reason: "Turn action into observation-first experiment",
          status: "assigned",
          linkedObjectType: "surfaced_action",
          linkedObjectId: "sa-1",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(prismaMock.fieldworkAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          linkedObjectType: "surfaced_action",
          linkedObjectId: "sa-1",
          status: "assigned",
        }),
      })
    );
    expect(prismaMock.surfacedAction.findFirst).toHaveBeenCalledWith({
      where: {
        id: "sa-1",
        userId: "user-1",
      },
      select: { id: true },
    });
    expect(prismaMock.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("requires observation note or outcome when completing fieldwork patch", async () => {
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValueOnce({
      id: "fw-1",
      userId: "user-1",
      status: "active",
      observationNote: null,
      observationOutcome: null,
      completedAt: null,
    });

    const route = await import("../../app/api/fieldwork/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/fieldwork/fw-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "completed" }),
      }),
      { params: Promise.resolve({ id: "fw-1" }) }
    );

    expect(response.status).toBe(400);
    expect(prismaMock.fieldworkAssignment.update).not.toHaveBeenCalled();
  });

  it("rejects fieldwork patch when surfaced_action link is not user-owned", async () => {
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValueOnce({
      id: "fw-1",
      userId: "user-1",
      status: "assigned",
      linkedObjectType: "investigation",
      linkedObjectId: "inv-1",
      observationNote: null,
      observationOutcome: null,
      completedAt: null,
    });
    prismaMock.surfacedAction.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/fieldwork/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/fieldwork/fw-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          linkedObjectType: "surfaced_action",
          linkedObjectId: "sa-other-user",
        }),
      }),
      { params: Promise.resolve({ id: "fw-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      details: expect.arrayContaining([
        expect.objectContaining({ field: "linkedObjectId" }),
      ]),
    });
    expect(prismaMock.fieldworkAssignment.update).not.toHaveBeenCalled();
    expect(prismaMock.surfacedAction.findFirst).toHaveBeenCalledWith({
      where: {
        id: "sa-other-user",
        userId: "user-1",
      },
      select: { id: true },
    });
  });

  it("supports filtered fieldwork list with activeOnly", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/fieldwork/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/fieldwork?linkedObjectType=investigation&linkedObjectId=inv-1&activeOnly=1"
      )
    );

    expect(response.status).toBe(200);
    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          linkedObjectType: "investigation",
          linkedObjectId: "inv-1",
          status: { in: ["assigned", "active"] },
        }),
      })
    );
  });

  it("rejects evidence-links query with no anchors", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request("http://localhost/api/understanding/evidence-links")
    );

    expect(response.status).toBe(400);
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("rejects evidence-links query with targetId alone", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request("http://localhost/api/understanding/evidence-links?targetId=umc-1")
    );

    expect(response.status).toBe(400);
  });

  it("rejects evidence-links query with targetType alone", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion"
      )
    );

    expect(response.status).toBe(400);
  });

  it("rejects evidence-links query with sourceId alone", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request("http://localhost/api/understanding/evidence-links?sourceId=claim-1")
    );

    expect(response.status).toBe(400);
  });

  it("rejects evidence-links query with sourceType alone", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?sourceType=pattern_claim"
      )
    );

    expect(response.status).toBe(400);
  });

  it("rejects evidence-links query with role alone", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request("http://localhost/api/understanding/evidence-links?role=supports")
    );

    expect(response.status).toBe(400);
  });

  it("accepts evidence-links query anchored by targetType+targetId", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion&targetId=umc-1"
      )
    );

    expect(response.status).toBe(200);
  });

  it("accepts evidence-links query anchored by sourceType+sourceId", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?sourceType=pattern_claim&sourceId=claim-1"
      )
    );

    expect(response.status).toBe(200);
  });

  it("accepts evidence-links query with anchor pair plus role", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion&targetId=umc-1&role=supports"
      )
    );

    expect(response.status).toBe(200);
  });

  it("handles evidence-link dedupe uniqueness as 409", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({ id: "umc-1" });
    prismaMock.patternClaim.findFirst.mockResolvedValueOnce({ id: "claim-1" });
    prismaMock.understandingEvidenceLink.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("rejects evidence-link create when target is not user-owned", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "usermap_conclusion",
          targetId: "other-user-target",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects evidence-link create when source is not user-owned", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({ id: "umc-1" });
    prismaMock.patternClaim.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "pattern_claim",
          sourceId: "other-user-source",
          role: "supports",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects non-verifiable timeline_aggregation source type in Phase 1B", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({ id: "umc-1" });

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "timeline_aggregation",
          sourceId: "agg-1",
          role: "context",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects unverified import_record source in Phase 1B", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({ id: "umc-1" });
    prismaMock.importUploadSession.findFirst.mockResolvedValueOnce(null);
    prismaMock.importUploadChunk.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "import_record",
          sourceId: "missing-import-source",
          role: "derived_from",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });
});
