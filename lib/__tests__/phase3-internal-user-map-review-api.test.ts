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
  derivationArtifact: {
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

describe("Phase 3 internal user-map review candidates API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };
    authMock.mockResolvedValue({ userId: "reviewer-1" });
    prismaMock.derivationArtifact.findMany.mockResolvedValue([]);
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
        notes: "sourceRun:run-1; decision:pass",
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
        notes: null,
        createdAt: new Date("2026-05-15T09:00:00.000Z"),
        updatedAt: new Date("2026-05-15T10:30:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        targetId: "umc-internal-1",
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        meta: { publicSafetyLevel: "safe_summary" },
      },
      {
        targetId: "umc-internal-1",
        sourceType: "message",
        sourceId: "msg-1",
        meta: null,
      },
      {
        targetId: "umc-internal-1",
        sourceType: "pattern_claim",
        sourceId: "pc-2",
        meta: null,
      },
    ]);

    prismaMock.derivationArtifact.findMany.mockResolvedValueOnce([
      {
        id: "artifact-1",
        type: "understanding_dark_engine_diagnostics",
        runId: "run-1",
        payload: {
          processorVersion: "understanding-dark-engine-v1",
          warnings: [],
          blockedWriteReasons: [],
        },
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
            safetyLevels: {
              safe_summary: 1,
            },
            linkedSources: [
              {
                sourceType: "pattern_claim",
                sourceId: "pc-1",
                safetyLevel: "safe_summary",
              },
              {
                sourceType: "message",
                sourceId: "msg-1",
                safetyLevel: null,
              },
              {
                sourceType: "pattern_claim",
                sourceId: "pc-2",
                safetyLevel: null,
              },
            ],
          },
          diagnostics: {
            latestRunId: "run-1",
            latestArtifactId: "artifact-1",
            latestArtifactType: "understanding_dark_engine_diagnostics",
            processorVersion: "understanding-dark-engine-v1",
            blockedWriteReasons: [],
            warnings: [],
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
            safetyLevels: {},
            linkedSources: [],
          },
          diagnostics: {
            latestRunId: null,
            latestArtifactId: null,
            latestArtifactType: null,
            processorVersion: null,
            blockedWriteReasons: [],
            warnings: [],
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
          sourceId: true,
          meta: true,
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

  it("does not expose provenance fields on public user-map list responses", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-visible-1",
        area: "operating_logic",
        status: "emerging",
        visibility: "user_visible",
        title: "Visible",
        summary: "Visible summary",
        confidenceScore: 0.4,
        confidenceLevel: "low",
        evidenceCount: 2,
        sourceDiversity: 2,
        timeSpreadDays: 3,
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
    expect(serialized).not.toContain("linkedSources");
    expect(serialized).not.toContain("safetyLevels");
    expect(serialized).not.toContain("latestRunId");
    expect(serialized).not.toContain("candidateLifecycleStatus");
    expect(serialized).not.toContain("confidenceScore");
    expect(serialized).not.toContain('"notes"');
    expect(serialized).not.toContain("internal_only");
    expect(body.items[0]).not.toHaveProperty("visibility");
    expect(body.items[0]).not.toHaveProperty("userId");
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
