import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";
import { buildPublicWatchForWhere } from "../fieldwork-public-visibility";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  investigation: {
    findMany: vi.fn(),
  },
  fieldworkAssignment: {
    findMany: vi.fn(),
  },
  userMapConclusion: {
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

describe("/api/active-questions and /api/watch-for safe mobile list routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.investigation.findMany.mockResolvedValue([]);
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
  });

  it("requires auth for active-questions and watch-for list routes", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const activeQuestionsRoute = await import("../../app/api/active-questions/route");
    const activeQuestionsResponse = await activeQuestionsRoute.GET();

    expect(activeQuestionsResponse.status).toBe(401);
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();

    authMock.mockResolvedValueOnce({ userId: null });
    const watchForRoute = await import("../../app/api/watch-for/route");
    const watchForResponse = await watchForRoute.GET();

    expect(watchForResponse.status).toBe(401);
    expect(prismaMock.fieldworkAssignment.findMany).not.toHaveBeenCalled();
  });

  it("applies user ownership + status-gated allowlisted selection for active-questions", async () => {
    const route = await import("../../app/api/active-questions/route");
    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith({
      where: buildPublicActiveInvestigationWhere({ userId: "user-1" }),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        organizingQuestion: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("returns safe active-questions list fields only and drops invalid fallback rows", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        title: "Observe shutdown patterns",
        organizingQuestion: "What precedes shutdown mode?",
        status: "open",
        createdAt: new Date("2026-05-21T09:00:00.000Z"),
        updatedAt: new Date("2026-05-21T10:00:00.000Z"),
      },
      {
        id: "   ",
        title: "inv-from-title should never become an ID",
        organizingQuestion: "Synthetic fallback should be filtered.",
        status: "testing",
        createdAt: new Date("2026-05-21T08:00:00.000Z"),
        updatedAt: new Date("2026-05-21T08:30:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/active-questions/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      items: [
        {
          id: "inv-1",
          title: "Observe shutdown patterns",
          organizingQuestion: "What precedes shutdown mode?",
          status: "open",
          statusLabel: "Open",
          createdAt: "2026-05-21T09:00:00.000Z",
          updatedAt: "2026-05-21T10:00:00.000Z",
        },
      ],
    });

    const body = JSON.stringify(payload);
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("confidenceDelta");
    expect(body).not.toContain("meaningfulDeltaScore");
    expect(body).not.toContain("inv-from-title should never become an ID");
  });

  it("applies user ownership + status-gated allowlisted selection for watch-for and verifies links only", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([
      {
        id: "fw-1",
        prompt: "Watch map stabilization",
        reason: "Check if this remains reliable under pressure",
        status: "assigned",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-safe",
        createdAt: new Date("2026-05-21T09:00:00.000Z"),
        updatedAt: new Date("2026-05-21T10:00:00.000Z"),
      },
      {
        id: "fw-2",
        prompt: "Unsupported target should remain non-link",
        reason: "Never link from unsupported object types",
        status: "active",
        linkedObjectType: "investigation",
        linkedObjectId: "inv-1",
        createdAt: new Date("2026-05-21T08:50:00.000Z"),
        updatedAt: new Date("2026-05-21T09:50:00.000Z"),
      },
      {
        id: "fw-3",
        prompt: "Blank linked target should remain non-link",
        reason: "No synthetic links",
        status: "active",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "   ",
        createdAt: new Date("2026-05-21T08:40:00.000Z"),
        updatedAt: new Date("2026-05-21T09:40:00.000Z"),
      },
      {
        id: "  ",
        prompt: "fw-from-prompt should never become an ID",
        reason: "Synthetic fallback row",
        status: "active",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-fake",
        createdAt: new Date("2026-05-21T08:20:00.000Z"),
        updatedAt: new Date("2026-05-21T09:20:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-safe" }]);

    const route = await import("../../app/api/watch-for/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith({
      where: buildPublicWatchForWhere({ userId: "user-1" }),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        prompt: true,
        reason: true,
        status: true,
        linkedObjectType: true,
        linkedObjectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(payload).toEqual({
      items: [
        {
          id: "fw-1",
          prompt: "Watch map stabilization",
          reason: "Check if this remains reliable under pressure",
          status: "assigned",
          statusLabel: "Assigned",
          linkedObjectHref: "/patterns/pc-safe",
          createdAt: "2026-05-21T09:00:00.000Z",
          updatedAt: "2026-05-21T10:00:00.000Z",
        },
        {
          id: "fw-2",
          prompt: "Unsupported target should remain non-link",
          reason: "Never link from unsupported object types",
          status: "active",
          statusLabel: "Active",
          linkedObjectHref: null,
          createdAt: "2026-05-21T08:50:00.000Z",
          updatedAt: "2026-05-21T09:50:00.000Z",
        },
        {
          id: "fw-3",
          prompt: "Blank linked target should remain non-link",
          reason: "No synthetic links",
          status: "active",
          statusLabel: "Active",
          linkedObjectHref: null,
          createdAt: "2026-05-21T08:40:00.000Z",
          updatedAt: "2026-05-21T09:40:00.000Z",
        },
      ],
    });

    expect(prismaMock.patternClaim.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["pc-safe"] },
      },
      select: { id: true },
    });
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
    expect(prismaMock.contradictionNode.findMany).not.toHaveBeenCalled();

    const body = JSON.stringify(payload);
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("confidenceDelta");
    expect(body).not.toContain("meaningfulDeltaScore");
    expect(body).not.toContain("fw-from-prompt should never become an ID");
  });

  it("keeps safe active-questions and watch-for endpoints read-only and free of internal review or write semantics", () => {
    const activeQuestionsDetailRoutePath = path.join(
      process.cwd(),
      "app/api/active-questions/[id]/route.ts"
    );
    const watchForDetailRoutePath = path.join(
      process.cwd(),
      "app/api/watch-for/[id]/route.ts"
    );
    expect(existsSync(activeQuestionsDetailRoutePath)).toBe(true);
    expect(existsSync(watchForDetailRoutePath)).toBe(true);

    const activeQuestionsSource = readFileSync(
      path.join(process.cwd(), "app/api/active-questions/route.ts"),
      "utf8"
    );
    const watchForSource = readFileSync(
      path.join(process.cwd(), "app/api/watch-for/route.ts"),
      "utf8"
    );
    const activeQuestionsDetailSource = readFileSync(
      activeQuestionsDetailRoutePath,
      "utf8"
    );
    const watchForDetailSource = readFileSync(watchForDetailRoutePath, "utf8");
    const combined =
      `${activeQuestionsSource}\n${watchForSource}\n` +
      `${activeQuestionsDetailSource}\n${watchForDetailSource}`;

    expect(combined.includes("/api/internal/user-map/review-candidates")).toBe(
      false
    );
    expect(combined.includes("/internal/user-map/review")).toBe(false);
    expect(combined.includes("internal_only")).toBe(false);
    expect(combined.includes("sourceRunId")).toBe(false);
    expect(combined.includes("internalNotes")).toBe(false);
    expect(combined.includes("beforeSummary")).toBe(false);
    expect(combined.includes("afterSummary")).toBe(false);
    expect(combined.includes("confidenceDelta")).toBe(false);
    expect(combined.includes("meaningfulDeltaScore")).toBe(false);
    expect(combined.includes("metadata")).toBe(false);
    expect(combined.includes("evidence")).toBe(false);
    expect(combined.includes("candidate")).toBe(false);
    expect(combined.includes("export async function POST")).toBe(false);
    expect(combined.includes("export async function PUT")).toBe(false);
    expect(combined.includes("export async function PATCH")).toBe(false);
    expect(combined.includes("export async function DELETE")).toBe(false);
    expect(combined.includes("promote")).toBe(false);
    expect(combined.includes("edit")).toBe(false);
    expect(combined.includes("delete")).toBe(false);
  });
});
