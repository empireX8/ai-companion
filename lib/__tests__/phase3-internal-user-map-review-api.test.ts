import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const OLD_ENV = process.env;

const prismaMock = {
  userMapConclusion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
    create: vi.fn(),
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

describe("Phase 3 internal user-map review candidates API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };
    authMock.mockResolvedValue({ userId: "reviewer-1" });
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/internal/user-map/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/user-map/review-candidates")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-reviewers", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/user-map/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/user-map/review-candidates")
    );

    expect(response.status).toBe(403);
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
  });

  it("returns internal_only candidates with evidence source-type summary for reviewer", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-internal-1",
        title: "Candidate 1",
        summary: "Summary 1",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "low",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
      {
        id: "umc-internal-2",
        title: "Candidate 2",
        summary: "Summary 2",
        area: "state_ecology",
        status: "tentative",
        confidenceLevel: "medium",
        visibility: "internal_only",
        candidateLifecycleStatus: "held_for_more_evidence",
        createdAt: new Date("2026-05-15T09:00:00.000Z"),
        updatedAt: new Date("2026-05-15T10:30:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        targetId: "umc-internal-1",
        sourceType: "pattern_claim",
      },
      {
        targetId: "umc-internal-1",
        sourceType: "message",
      },
      {
        targetId: "umc-internal-1",
        sourceType: "pattern_claim",
      },
    ]);

    const route = await import(
      "../../app/api/internal/user-map/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/user-map/review-candidates?limit=25&area=operating_logic&status=emerging&confidenceLevel=low"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "umc-internal-1",
          title: "Candidate 1",
          summary: "Summary 1",
          area: "operating_logic",
          status: "emerging",
          confidenceLevel: "low",
          visibility: "internal_only",
          candidateLifecycleStatus: "proposed",
          createdAt: "2026-05-15T10:00:00.000Z",
          updatedAt: "2026-05-15T11:00:00.000Z",
          evidence: {
            linkCount: 3,
            sourceTypes: {
              pattern_claim: 2,
              message: 1,
            },
          },
          diagnostics: {
            latestRunId: null,
            latestArtifactId: null,
            latestArtifactType: null,
          },
        },
        {
          id: "umc-internal-2",
          title: "Candidate 2",
          summary: "Summary 2",
          area: "state_ecology",
          status: "tentative",
          confidenceLevel: "medium",
          visibility: "internal_only",
          candidateLifecycleStatus: "held_for_more_evidence",
          createdAt: "2026-05-15T09:00:00.000Z",
          updatedAt: "2026-05-15T10:30:00.000Z",
          evidence: {
            linkCount: 0,
            sourceTypes: {},
          },
          diagnostics: {
            latestRunId: null,
            latestArtifactId: null,
            latestArtifactType: null,
          },
        },
      ],
    });

    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "internal_only",
          area: "operating_logic",
          status: "emerging",
          confidenceLevel: "low",
        }),
        take: 25,
      })
    );

    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          targetType: "usermap_conclusion",
          targetId: { in: ["umc-internal-1", "umc-internal-2"] },
        }),
        select: {
          targetId: true,
          sourceType: true,
        },
      })
    );

    expect(prismaMock.userMapConclusion.create).not.toHaveBeenCalled();
    expect(prismaMock.userMapConclusion.update).not.toHaveBeenCalled();
    expect(prismaMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects invalid limit values", async () => {
    const route = await import(
      "../../app/api/internal/user-map/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/user-map/review-candidates?limit=101")
    );

    expect(response.status).toBe(400);
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
  });

  it("is GET-only (no POST/PATCH/DELETE handlers)", async () => {
    const route = await import(
      "../../app/api/internal/user-map/review-candidates/route"
    );

    expect((route as Record<string, unknown>).POST).toBeUndefined();
    expect((route as Record<string, unknown>).PATCH).toBeUndefined();
    expect((route as Record<string, unknown>).DELETE).toBeUndefined();
  });

  it("keeps public user-map list route hiding internal_only rows", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/user-map/conclusions/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions")
    );

    expect(response.status).toBe(200);
    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "user_visible",
        }),
      })
    );
  });

  it("keeps public user-map detail route returning 404 for internal_only rows", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/user-map/conclusions/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/user-map/conclusions/umc-internal-1"),
      {
        params: Promise.resolve({ id: "umc-internal-1" }),
      }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "user_visible",
        }),
      })
    );
  });
});
