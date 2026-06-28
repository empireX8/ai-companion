import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  modelUpdate: {
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
  userMapConclusion: {
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

describe("/api/what-changed/[id]/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.modelUpdate.findFirst.mockResolvedValue(null);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValue(null);
  });

  it("requires auth", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/what-changed/[id]/evidence/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/what-changed/mu-1/evidence"),
      { params: Promise.resolve({ id: "mu-1" }) }
    );

    expect(response.status).toBe(401);
    expect(prismaMock.modelUpdate.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for missing, unowned, non-meaningful, or internal-hidden target", async () => {
    // Missing target
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce(null);

    const route = await import(
      "../../app/api/what-changed/[id]/evidence/route"
    );
    const missingResponse = await route.GET(
      new Request("http://localhost/api/what-changed/mu-missing/evidence"),
      { params: Promise.resolve({ id: "mu-missing" }) }
    );

    expect(missingResponse.status).toBe(404);
    expect(prismaMock.modelUpdate.findFirst).toHaveBeenCalledWith({
      where: {
        id: "mu-missing",
        userId: "user-1",
        visibility: "user_visible",
        isMeaningful: true,
      },
      select: { id: true },
    });
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("returns minimal safe evidence projection with allowlisted verified sources only", async () => {
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce({ id: "mu-1" });
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        sourceType: "pattern_claim",
        sourceId: "pc-safe",
        createdAt: new Date("2026-05-23T10:00:00.000Z"),
      },
      {
        id: "link-2",
        sourceType: "pattern_claim",
        sourceId: "pc-candidate",
        createdAt: new Date("2026-05-23T09:00:00.000Z"),
      },
      {
        id: "link-3",
        sourceType: "contradiction_node",
        sourceId: "cn-safe",
        createdAt: new Date("2026-05-23T08:00:00.000Z"),
      },
      {
        id: "link-4",
        sourceType: "session",
        sourceId: "sess-1",
        createdAt: new Date("2026-05-23T07:00:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-safe" }]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-safe" }]);

    const route = await import(
      "../../app/api/what-changed/[id]/evidence/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/what-changed/mu-1/evidence"),
      { params: Promise.resolve({ id: "mu-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        targetType: "model_update",
        targetId: "mu-1",
        sourceType: { in: ["pattern_claim", "contradiction_node"] },
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
          sourceType: "pattern_claim",
          sourceId: "pc-safe",
          sourceTypeLabel: "Related pattern",
          evidenceSummaryLabel: "Linked evidence",
          sourceObjectHref: "/patterns/pc-safe",
          createdAt: "2026-05-23T10:00:00.000Z",
          hasEvidence: true,
          objectTitle: null,
          linkRole: null,
        },
        {
          sourceType: "contradiction_node",
          sourceId: "cn-safe",
          sourceTypeLabel: "Related signal",
          evidenceSummaryLabel: "Linked evidence",
          sourceObjectHref: "/contradictions/cn-safe",
          createdAt: "2026-05-23T08:00:00.000Z",
          hasEvidence: true,
          objectTitle: null,
          linkRole: null,
        },
      ],
    });
    expect(payload.items.every((item: { hasEvidence: boolean }) => item.hasEvidence)).toBe(
      true
    );

    const body = JSON.stringify(payload);
    expect(body).not.toContain("quote");
    expect(body).not.toContain("snippet");
    expect(body).not.toContain("\"summary\":");
    expect(body).not.toContain("meta");
    expect(body).not.toContain("weight");
    expect(body).not.toContain("confidenceContribution");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("confidenceDelta");
    expect(body).not.toContain("meaningfulDeltaScore");
    expect(body).not.toContain("raw user text");
  });

  it("returns empty items when no verified links exist", async () => {
    prismaMock.modelUpdate.findFirst.mockResolvedValueOnce({ id: "mu-1" });
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        sourceType: "pattern_claim",
        sourceId: "pc-stale",
        createdAt: new Date("2026-05-23T10:00:00.000Z"),
      },
      {
        id: "link-2",
        sourceType: "contradiction_node",
        sourceId: "cn-stale",
        createdAt: new Date("2026-05-23T09:00:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([]);

    const route = await import(
      "../../app/api/what-changed/[id]/evidence/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/what-changed/mu-1/evidence"),
      { params: Promise.resolve({ id: "mu-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ items: [] });
  });

  it("keeps evidence route read-only and free of internal review/raw evidence endpoints", () => {
    const routeSource = readFileSync(
      path.join(
        process.cwd(),
        "app/api/what-changed/[id]/evidence/route.ts"
      ),
      "utf8"
    );

    expect(routeSource.includes("/api/understanding/evidence-links")).toBe(false);
    expect(routeSource.includes("/api/internal/user-map/review-candidates")).toBe(
      false
    );
    expect(routeSource.includes("receipt-user-map")).toBe(false);
    expect(routeSource.includes("receipt-action")).toBe(false);
    expect(routeSource.includes("export async function POST")).toBe(false);
    expect(routeSource.includes("export async function PUT")).toBe(false);
    expect(routeSource.includes("export async function PATCH")).toBe(false);
    expect(routeSource.includes("export async function DELETE")).toBe(false);
    expect(routeSource.includes("sourceRunId")).toBe(false);
    expect(routeSource.includes("internalNotes")).toBe(false);
    expect(routeSource.includes("beforeSummary")).toBe(false);
    expect(routeSource.includes("afterSummary")).toBe(false);
    expect(routeSource.includes("confidenceDelta")).toBe(false);
    expect(routeSource.includes("meaningfulDeltaScore")).toBe(false);
  });
});
