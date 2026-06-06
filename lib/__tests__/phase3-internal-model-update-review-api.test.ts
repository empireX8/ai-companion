import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const OLD_ENV = process.env;

const prismaMock = {
  modelUpdate: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
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

describe("Phase 3 internal model update review candidates API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };
    authMock.mockResolvedValue({ userId: "reviewer-1" });
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.derivationArtifact.findMany.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/internal/model-updates/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/model-updates/review-candidates")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-reviewers", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/model-updates/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/model-updates/review-candidates")
    );

    expect(response.status).toBe(403);
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("returns safe model update review candidates for reviewer", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-internal-1",
        updateType: "conclusion_strengthened",
        userFacingSummary: "Confidence increased on operating logic",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-1",
        beforeSummary: "Emerging",
        afterSummary: "Supported",
        confidenceDelta: 0.1,
        visibility: "internal_only",
        isMeaningful: false,
        sourceRunId: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    const route = await import(
      "../../app/api/internal/model-updates/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/model-updates/review-candidates")
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{
        id: string;
        userFacingSummary: string;
        updateType: string;
      }>;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "mu-internal-1",
      userFacingSummary: "Confidence increased on operating logic",
      updateType: "conclusion_strengthened",
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("snippet");
    expect(serialized).not.toContain("quote");
    expect(serialized).not.toContain("internalNotes");
  });

  it("rejects invalid limit values", async () => {
    const route = await import(
      "../../app/api/internal/model-updates/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/model-updates/review-candidates?limit=101"
      )
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid updateType values", async () => {
    const route = await import(
      "../../app/api/internal/model-updates/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/model-updates/review-candidates?updateType=not_a_type"
      )
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "updateType" })])
    );
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });
});
