import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const OLD_ENV = process.env;

const prismaMock = {
  fieldworkAssignment: {
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

describe("Phase 3 internal fieldwork review candidates API", () => {
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
      "../../app/api/internal/fieldwork/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/fieldwork/review-candidates")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.fieldworkAssignment.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-reviewers", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/fieldwork/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/fieldwork/review-candidates")
    );

    expect(response.status).toBe(403);
    expect(prismaMock.fieldworkAssignment.findMany).not.toHaveBeenCalled();
  });

  it("returns safe fieldwork review candidates for reviewer", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([
      {
        id: "fw-internal-1",
        prompt: "Watch for Sunday tension",
        reason: "Need more weekend signal",
        status: "assigned",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-1",
        expiresAt: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const route = await import(
      "../../app/api/internal/fieldwork/review-candidates/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/internal/fieldwork/review-candidates")
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ id: string; prompt: string; reason: string }>;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "fw-internal-1",
      prompt: "Watch for Sunday tension",
      reason: "Need more weekend signal",
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("snippet");
    expect(serialized).not.toContain("quote");
    expect(serialized).not.toContain("observationNote");
  });

  it("rejects invalid limit values", async () => {
    const route = await import(
      "../../app/api/internal/fieldwork/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/fieldwork/review-candidates?limit=101"
      )
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(prismaMock.fieldworkAssignment.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid status values", async () => {
    const route = await import(
      "../../app/api/internal/fieldwork/review-candidates/route"
    );
    const response = await route.GET(
      new Request(
        "http://localhost/api/internal/fieldwork/review-candidates?status=not_a_status"
      )
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status" })])
    );
    expect(prismaMock.fieldworkAssignment.findMany).not.toHaveBeenCalled();
  });
});
