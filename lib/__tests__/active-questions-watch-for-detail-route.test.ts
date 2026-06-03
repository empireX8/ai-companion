import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();
const resolvePublicLinkedObjectHrefMock = vi.fn();

const prismaMock = {
  investigation: {
    findFirst: vi.fn(),
  },
  fieldworkAssignment: {
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

vi.mock("@/lib/public-linked-object-continuity", () => ({
  resolvePublicLinkedObjectHref: resolvePublicLinkedObjectHrefMock,
}));

describe("/api/active-questions/[id] and /api/watch-for/[id] safe mobile detail routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.investigation.findFirst.mockResolvedValue(null);
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValue(null);
    resolvePublicLinkedObjectHrefMock.mockResolvedValue(null);
  });

  it("requires auth for active-questions and watch-for detail routes", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const activeQuestionsRoute = await import(
      "../../app/api/active-questions/[id]/route"
    );
    const activeQuestionsResponse = await activeQuestionsRoute.GET(
      new Request("http://localhost/api/active-questions/inv-1"),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(activeQuestionsResponse.status).toBe(401);
    expect(prismaMock.investigation.findFirst).not.toHaveBeenCalled();

    authMock.mockResolvedValueOnce({ userId: null });
    const watchForRoute = await import("../../app/api/watch-for/[id]/route");
    const watchForResponse = await watchForRoute.GET(
      new Request("http://localhost/api/watch-for/fw-1"),
      { params: Promise.resolve({ id: "fw-1" }) }
    );

    expect(watchForResponse.status).toBe(401);
    expect(prismaMock.fieldworkAssignment.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for unowned or disallowed-status detail rows and enforces user/status gating", async () => {
    const activeQuestionsRoute = await import(
      "../../app/api/active-questions/[id]/route"
    );
    const activeQuestionsResponse = await activeQuestionsRoute.GET(
      new Request("http://localhost/api/active-questions/inv-hidden"),
      { params: Promise.resolve({ id: "inv-hidden" }) }
    );

    expect(activeQuestionsResponse.status).toBe(404);
    expect(prismaMock.investigation.findFirst).toHaveBeenCalledWith({
      where: buildPublicActiveInvestigationWhere({
        userId: "user-1",
        id: "inv-hidden",
      }),
      select: {
        id: true,
        title: true,
        organizingQuestion: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resolvedIntoUserMapConclusionId: true,
      },
    });

    const watchForRoute = await import("../../app/api/watch-for/[id]/route");
    const watchForResponse = await watchForRoute.GET(
      new Request("http://localhost/api/watch-for/fw-completed"),
      { params: Promise.resolve({ id: "fw-completed" }) }
    );

    expect(watchForResponse.status).toBe(404);
    expect(prismaMock.fieldworkAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        id: "fw-completed",
        userId: "user-1",
        status: { in: ["assigned", "active"] },
      },
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
  });

  it("returns allowlisted active-question detail fields and verified safe linked hrefs only", async () => {
    prismaMock.investigation.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      title: "Observe shutdown patterns",
      organizingQuestion: "What precedes shutdown mode?",
      status: "resolving",
      createdAt: new Date("2026-05-21T09:00:00.000Z"),
      updatedAt: new Date("2026-05-21T10:00:00.000Z"),
      resolvedIntoUserMapConclusionId: "umc-1",
      internalNotes: "hidden",
      sourceRunId: "hidden",
    });
    resolvePublicLinkedObjectHrefMock.mockResolvedValueOnce("/your-map/umc-1");

    const route = await import("../../app/api/active-questions/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/active-questions/inv-1"),
      { params: Promise.resolve({ id: "inv-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      item: {
        id: "inv-1",
        title: "Observe shutdown patterns",
        organizingQuestion: "What precedes shutdown mode?",
        status: "resolving",
        statusLabel: "Resolving",
        createdAt: "2026-05-21T09:00:00.000Z",
        updatedAt: "2026-05-21T10:00:00.000Z",
        resolvedIntoUserMapConclusionId: "umc-1",
        resolvedIntoUserMapConclusionHref: "/your-map/umc-1",
      },
    });
    expect(resolvePublicLinkedObjectHrefMock).toHaveBeenCalledWith({
      userId: "user-1",
      linkedObjectType: "usermap_conclusion",
      linkedObjectId: "umc-1",
    });

    const body = JSON.stringify(payload);
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("confidenceDelta");
    expect(body).not.toContain("meaningfulDeltaScore");
    expect(body).not.toContain("metadata");
    expect(body).not.toContain("evidence");
  });

  it("returns allowlisted watch-for detail fields and null for unsupported/unverified links", async () => {
    prismaMock.fieldworkAssignment.findFirst
      .mockResolvedValueOnce({
        id: "fw-1",
        prompt: "Watch map stabilization",
        reason: "Check if this remains reliable under pressure",
        status: "assigned",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-safe",
        createdAt: new Date("2026-05-21T09:00:00.000Z"),
        updatedAt: new Date("2026-05-21T10:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "fw-2",
        prompt: "Unsupported target should remain non-link",
        reason: "Never link from unsupported object types",
        status: "active",
        linkedObjectType: "investigation",
        linkedObjectId: "inv-1",
        createdAt: new Date("2026-05-21T08:50:00.000Z"),
        updatedAt: new Date("2026-05-21T09:50:00.000Z"),
      });
    resolvePublicLinkedObjectHrefMock
      .mockResolvedValueOnce("/patterns/pc-safe")
      .mockResolvedValueOnce(null);

    const route = await import("../../app/api/watch-for/[id]/route");

    const supportedResponse = await route.GET(
      new Request("http://localhost/api/watch-for/fw-1"),
      { params: Promise.resolve({ id: "fw-1" }) }
    );
    const supportedPayload = await supportedResponse.json();

    expect(supportedResponse.status).toBe(200);
    expect(supportedPayload).toEqual({
      item: {
        id: "fw-1",
        prompt: "Watch map stabilization",
        reason: "Check if this remains reliable under pressure",
        status: "assigned",
        statusLabel: "Assigned",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-safe",
        linkedObjectHref: "/patterns/pc-safe",
        createdAt: "2026-05-21T09:00:00.000Z",
        updatedAt: "2026-05-21T10:00:00.000Z",
      },
    });
    expect(resolvePublicLinkedObjectHrefMock).toHaveBeenCalledWith({
      userId: "user-1",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "pc-safe",
    });

    const unsupportedResponse = await route.GET(
      new Request("http://localhost/api/watch-for/fw-2"),
      { params: Promise.resolve({ id: "fw-2" }) }
    );
    const unsupportedPayload = await unsupportedResponse.json();

    expect(unsupportedResponse.status).toBe(200);
    expect(unsupportedPayload).toEqual({
      item: {
        id: "fw-2",
        prompt: "Unsupported target should remain non-link",
        reason: "Never link from unsupported object types",
        status: "active",
        statusLabel: "Active",
        linkedObjectType: "investigation",
        linkedObjectId: "inv-1",
        linkedObjectHref: null,
        createdAt: "2026-05-21T08:50:00.000Z",
        updatedAt: "2026-05-21T09:50:00.000Z",
      },
    });
    expect(resolvePublicLinkedObjectHrefMock).toHaveBeenCalledWith({
      userId: "user-1",
      linkedObjectType: "investigation",
      linkedObjectId: "inv-1",
    });

    const body = JSON.stringify({
      supportedPayload,
      unsupportedPayload,
    });
    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("confidenceDelta");
    expect(body).not.toContain("meaningfulDeltaScore");
    expect(body).not.toContain("metadata");
    expect(body).not.toContain("evidence");
  });

  it("keeps detail routes free of internal review and write semantics", () => {
    const activeDetailSource = readFileSync(
      path.join(process.cwd(), "app/api/active-questions/[id]/route.ts"),
      "utf8"
    );
    const watchDetailSource = readFileSync(
      path.join(process.cwd(), "app/api/watch-for/[id]/route.ts"),
      "utf8"
    );
    const combined = `${activeDetailSource}\n${watchDetailSource}`;

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
    expect(combined.includes("review")).toBe(false);
  });
});
