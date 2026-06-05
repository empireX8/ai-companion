import { UserMapConclusionVisibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    userMapConclusion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    investigation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    fieldworkAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    modelUpdate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    understandingEvidenceLink: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    patternClaim: { findFirst: vi.fn() },
    patternClaimEvidence: { findFirst: vi.fn() },
    contradictionNode: { findFirst: vi.fn() },
    contradictionEvidence: { findFirst: vi.fn() },
    profileArtifact: { findFirst: vi.fn() },
    evidenceSpan: { findFirst: vi.fn() },
    referenceItem: { findFirst: vi.fn() },
    surfacedAction: { findFirst: vi.fn() },
    quickCheckIn: { findFirst: vi.fn() },
    journalEntry: { findFirst: vi.fn() },
    session: { findFirst: vi.fn() },
    message: { findFirst: vi.fn() },
    importUploadSession: { findFirst: vi.fn() },
    importUploadChunk: { findFirst: vi.fn() },
  },
}));

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

function mockPublicEligibleTargets() {
  prismaMock.userMapConclusion.findMany.mockResolvedValue([{ id: "umc-public" }]);
  prismaMock.investigation.findMany.mockResolvedValue([{ id: "inv-public" }]);
  prismaMock.fieldworkAssignment.findMany.mockResolvedValue([{ id: "fw-public" }]);
  prismaMock.modelUpdate.findMany.mockResolvedValue([{ id: "mu-public" }]);
}

function mockNoPublicEligibleTargets() {
  prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
  prismaMock.investigation.findMany.mockResolvedValue([]);
  prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
  prismaMock.modelUpdate.findMany.mockResolvedValue([]);
}

describe("generic evidence-links candidate visibility guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    mockNoPublicEligibleTargets();
    prismaMock.patternClaim.findFirst.mockResolvedValue({ id: "claim-1" });
    prismaMock.message.findFirst.mockResolvedValue({ id: "msg-1" });
    prismaMock.userMapConclusion.findFirst.mockResolvedValue({ id: "umc-public" });
  });

  it("GET by targetType+targetId returns no rows for internal_only UserMap targets", async () => {
    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion&targetId=umc-internal"
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toEqual([]);
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("GET by targetType+targetId returns rows for public eligible UserMap targets", async () => {
    mockPublicEligibleTargets();
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        userId: "user-1",
        targetType: "usermap_conclusion",
        targetId: "umc-public",
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "supports",
        snippet: null,
        quote: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?targetType=usermap_conclusion&targetId=umc-public"
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.targetId).toBe("umc-public");
  });

  it("GET by sourceType+sourceId filters out links to internal candidate targets", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-internal",
        userId: "user-1",
        targetType: "investigation",
        targetId: "inv-internal",
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "supports",
        snippet: "private snippet",
        quote: "private quote",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        id: "link-public",
        userId: "user-1",
        targetType: "investigation",
        targetId: "inv-public",
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "supports",
        snippet: null,
        quote: null,
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
      },
    ]);
    prismaMock.investigation.findMany.mockResolvedValue([{ id: "inv-public" }]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?sourceType=pattern_claim&sourceId=claim-1"
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.targetId).toBe("inv-public");
  });

  it("GET by sourceType+sourceId filters internal Fieldwork and ModelUpdate targets", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "fw-internal",
        targetType: "fieldwork_assignment",
        targetId: "fw-internal",
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        snippet: "private",
        quote: "private",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        id: "mu-internal",
        targetType: "model_update",
        targetId: "mu-internal",
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        snippet: "private",
        quote: "private",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/understanding/evidence-links?sourceType=pattern_claim&sourceId=claim-1"
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toEqual([]);
  });

  it("POST rejects evidence links for internal_only UserMap targets", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-internal",
      visibility: UserMapConclusionVisibility.internal_only,
    });

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "usermap_conclusion",
          targetId: "umc-internal",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("POST rejects proposed Investigation targets", async () => {
    prismaMock.investigation.findMany.mockResolvedValue([]);

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "investigation",
          targetId: "inv-proposed",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("POST allows public eligible UserMap targets when ownership validates", async () => {
    mockPublicEligibleTargets();
    prismaMock.userMapConclusion.findFirst.mockResolvedValue({ id: "umc-public" });
    prismaMock.understandingEvidenceLink.create.mockResolvedValueOnce({
      id: "link-created",
      targetType: "usermap_conclusion",
      targetId: "umc-public",
    });

    const route = await import("../../app/api/understanding/evidence-links/route");
    const response = await route.POST(
      new Request("http://localhost/api/understanding/evidence-links", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          targetType: "usermap_conclusion",
          targetId: "umc-public",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(prismaMock.understandingEvidenceLink.create).toHaveBeenCalled();
  });
});

describe("relatedUnderstanding public target filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNoPublicEligibleTargets();
  });

  it("omits internal candidate target IDs from relatedUnderstanding projections", async () => {
    const { buildRelatedUnderstandingBySourceId } = await import("../understanding-links");

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        sourceId: "claim-1",
        targetType: "usermap_conclusion",
        targetId: "umc-internal",
      },
      {
        sourceId: "claim-1",
        targetType: "investigation",
        targetId: "inv-internal",
      },
      {
        sourceId: "claim-1",
        targetType: "fieldwork_assignment",
        targetId: "fw-internal",
      },
      {
        sourceId: "claim-1",
        targetType: "model_update",
        targetId: "mu-internal",
      },
    ]);

    const related = await buildRelatedUnderstandingBySourceId({
      userId: "user-1",
      sourceType: "pattern_claim",
      sourceIds: ["claim-1"],
    });

    expect(related.get("claim-1")).toEqual({
      userMapConclusionIds: [],
      investigationIds: [],
      modelUpdateIds: [],
      fieldworkAssignmentIds: [],
    });
  });

  it("keeps public eligible candidate target IDs in relatedUnderstanding projections", async () => {
    const { buildRelatedUnderstandingBySourceId } = await import("../understanding-links");

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { sourceId: "claim-1", targetType: "usermap_conclusion", targetId: "umc-public" },
      { sourceId: "claim-1", targetType: "investigation", targetId: "inv-public" },
      { sourceId: "claim-1", targetType: "fieldwork_assignment", targetId: "fw-public" },
      { sourceId: "claim-1", targetType: "model_update", targetId: "mu-public" },
    ]);
    mockPublicEligibleTargets();

    const related = await buildRelatedUnderstandingBySourceId({
      userId: "user-1",
      sourceType: "pattern_claim",
      sourceIds: ["claim-1"],
    });

    expect(related.get("claim-1")).toEqual({
      userMapConclusionIds: ["umc-public"],
      investigationIds: ["inv-public"],
      modelUpdateIds: ["mu-public"],
      fieldworkAssignmentIds: ["fw-public"],
    });
  });
});
