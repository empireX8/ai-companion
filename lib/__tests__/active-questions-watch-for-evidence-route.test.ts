import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";
import { buildPublicWatchForWhere } from "../fieldwork-public-visibility";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  investigation: {
    findFirst: vi.fn(),
  },
  fieldworkAssignment: {
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

describe("/api/active-questions/[id]/evidence and /api/watch-for/[id]/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.investigation.findFirst.mockResolvedValue(null);
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValue(null);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValue(null);
  });

  it("requires auth", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const activeRoute = await import(
      "../../app/api/active-questions/[id]/evidence/route"
    );
    const activeResponse = await activeRoute.GET(
      new Request("http://localhost/api/active-questions/inv-1/evidence"),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(activeResponse.status).toBe(401);
    expect(prismaMock.investigation.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();

    authMock.mockResolvedValueOnce({ userId: null });
    const watchForRoute = await import(
      "../../app/api/watch-for/[id]/evidence/route"
    );
    const watchForResponse = await watchForRoute.GET(
      new Request("http://localhost/api/watch-for/fw-1/evidence"),
      { params: Promise.resolve({ id: "fw-1" }) }
    );

    expect(watchForResponse.status).toBe(401);
    expect(prismaMock.fieldworkAssignment.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for missing, unowned, or unsafe-status targets", async () => {
    prismaMock.investigation.findFirst.mockResolvedValueOnce(null);

    const activeRoute = await import(
      "../../app/api/active-questions/[id]/evidence/route"
    );
    const activeResponse = await activeRoute.GET(
      new Request("http://localhost/api/active-questions/inv-hidden/evidence"),
      { params: Promise.resolve({ id: "inv-hidden" }) }
    );

    expect(activeResponse.status).toBe(404);
    expect(prismaMock.investigation.findFirst).toHaveBeenCalledWith({
      where: buildPublicActiveInvestigationWhere({
        userId: "user-1",
        id: "inv-hidden",
      }),
      select: { id: true },
    });
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();

    prismaMock.fieldworkAssignment.findFirst.mockResolvedValueOnce(null);

    const watchForRoute = await import(
      "../../app/api/watch-for/[id]/evidence/route"
    );
    const watchForResponse = await watchForRoute.GET(
      new Request("http://localhost/api/watch-for/fw-hidden/evidence"),
      { params: Promise.resolve({ id: "fw-hidden" }) }
    );

    expect(watchForResponse.status).toBe(404);
    expect(prismaMock.fieldworkAssignment.findFirst).toHaveBeenCalledWith({
      where: buildPublicWatchForWhere({
        userId: "user-1",
        id: "fw-hidden",
      }),
      select: { id: true },
    });
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("returns minimal safe active-question evidence projection with allowlisted verified sources only", async () => {
    prismaMock.investigation.findFirst.mockResolvedValueOnce({ id: "inv-1" });
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

    const route = await import("../../app/api/active-questions/[id]/evidence/route");
    const response = await route.GET(
      new Request("http://localhost/api/active-questions/inv-1/evidence"),
      { params: Promise.resolve({ id: "inv-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        targetType: "investigation",
        targetId: "inv-1",
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
          sourceTypeLabel: "Pattern Claim",
          evidenceSummaryLabel: "Pattern evidence is linked.",
          sourceObjectHref: "/patterns/pc-safe",
          createdAt: "2026-05-23T10:00:00.000Z",
          hasEvidence: true,
        },
        {
          sourceTypeLabel: "Contradiction Node",
          evidenceSummaryLabel: "Tension evidence is linked.",
          sourceObjectHref: "/contradictions/cn-safe",
          createdAt: "2026-05-23T08:00:00.000Z",
          hasEvidence: true,
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
    expect(body).not.toContain("sourceId");
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("receipt-user-map-");
    expect(body).not.toContain("raw user text");
  });

  it("returns minimal safe watch-for evidence projection and empty items when no verified links exist", async () => {
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValueOnce({ id: "fw-1" });
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
      {
        id: "link-3",
        sourceType: "contradiction_node",
        sourceId: "   ",
        createdAt: new Date("2026-05-23T08:00:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/watch-for/[id]/evidence/route");
    const response = await route.GET(
      new Request("http://localhost/api/watch-for/fw-1/evidence"),
      { params: Promise.resolve({ id: "fw-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        targetType: "fieldwork_assignment",
        targetId: "fw-1",
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
    expect(payload).toEqual({ items: [] });
  });

  it("keeps evidence routes read-only and free of internal review/raw evidence endpoints", () => {
    const activeSource = readFileSync(
      path.join(process.cwd(), "app/api/active-questions/[id]/evidence/route.ts"),
      "utf8"
    );
    const watchSource = readFileSync(
      path.join(process.cwd(), "app/api/watch-for/[id]/evidence/route.ts"),
      "utf8"
    );
    const combined = `${activeSource}\n${watchSource}`;

    expect(combined.includes("/api/understanding/evidence-links")).toBe(false);
    expect(combined.includes("/api/internal/user-map/review-candidates")).toBe(
      false
    );
    expect(combined.includes("receipt-user-map")).toBe(false);
    expect(combined.includes("receipt-action")).toBe(false);
    expect(combined.includes("export async function POST")).toBe(false);
    expect(combined.includes("export async function PUT")).toBe(false);
    expect(combined.includes("export async function PATCH")).toBe(false);
    expect(combined.includes("export async function DELETE")).toBe(false);
  });
});
