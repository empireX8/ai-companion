import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const OLD_ENV = process.env;

const prismaMock = {
  investigation: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
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

describe("Phase 3 internal investigation review candidates API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };
    authMock.mockResolvedValue({ userId: "reviewer-1" });
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/internal/investigations/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/investigations/review-candidates")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-reviewers", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/investigations/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/investigations/review-candidates")
    );

    expect(response.status).toBe(403);
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
  });

  it("returns safe investigation review candidates for reviewer", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-internal-1",
        title: "Investigation 1",
        organizingQuestion: "Question 1",
        evidenceNeeded: ["Evidence gap 1"],
        status: "open",
        seedType: "pattern",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const route = await import(
      "../../app/api/internal/investigations/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/investigations/review-candidates")
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ id: string; title: string; summary: string }>;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "inv-internal-1",
      title: "Investigation 1",
      summary: "Evidence gap 1",
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("snippet");
    expect(serialized).not.toContain("quote");
  });

  it("rejects invalid limit values", async () => {
    const route = await import(
      "../../app/api/internal/investigations/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/investigations/review-candidates?limit=101"
      )
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid status values", async () => {
    const route = await import(
      "../../app/api/internal/investigations/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/investigations/review-candidates?status=not_a_status"
      )
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "status" }),
      ])
    );
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid seedType values", async () => {
    const route = await import(
      "../../app/api/internal/investigations/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/investigations/review-candidates?seedType=not_a_seed"
      )
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "seedType" }),
      ])
    );
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
  });
});
