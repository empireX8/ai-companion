import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  session: {
    findFirst: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
  modelUpdate: {
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
  investigation: {
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

describe("/api/explore/sessions/[id]/model-updates", () => {
  const sessionId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.session.findFirst.mockResolvedValue({ id: sessionId });
    prismaMock.message.findMany.mockResolvedValue([{ id: "msg-1" }]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.investigation.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/explore/sessions/[id]/model-updates/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });

    expect(response.status).toBe(401);
  });

  it("returns empty items when no published session-linked movement exists", async () => {
    const route = await import("../../app/api/explore/sessions/[id]/model-updates/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ items: [] });
    expect(prismaMock.modelUpdate.findMany).not.toHaveBeenCalled();
  });

  it("returns only user-visible meaningful updates linked to the session or its messages", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { targetId: "mu-published" },
      { targetId: "mu-internal" },
    ]);
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-published",
        updateType: "link_detected",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pattern-1",
        userFacingSummary: "A published pattern strengthened.",
        createdAt: new Date("2026-06-20T10:00:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pattern-1" }]);

    const route = await import("../../app/api/explore/sessions/[id]/model-updates/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.session.findFirst).toHaveBeenCalledWith({
      where: {
        id: sessionId,
        userId: "user-1",
        surfaceType: "explore_chat",
      },
      select: { id: true },
    });
    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        targetType: "model_update",
        OR: [
          { sourceType: "session", sourceId: sessionId },
          { sourceType: "message", sourceId: { in: ["msg-1"] } },
        ],
      },
      select: { targetId: true },
    });
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          id: { in: ["mu-published", "mu-internal"] },
          visibility: "user_visible",
          isMeaningful: true,
        }),
      })
    );
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.id).toBe("mu-published");
    expect(payload.items[0]?.userFacingSummary).toBe("A published pattern strengthened.");
    expect(JSON.stringify(payload)).not.toContain("beforeSummary");
    expect(JSON.stringify(payload)).not.toContain("afterSummary");
    expect(JSON.stringify(payload)).not.toContain("internalNotes");
    expect(JSON.stringify(payload)).not.toContain("sourceRunId");
  });

  it("does not return internal candidate updates even when evidence links exist", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { targetId: "mu-internal" },
    ]);
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/explore/sessions/[id]/model-updates/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ items: [] });
  });

  it("returns 404 for unknown or non-explore sessions", async () => {
    prismaMock.session.findFirst.mockResolvedValueOnce(null);

    const route = await import("../../app/api/explore/sessions/[id]/model-updates/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });

    expect(response.status).toBe(404);
  });
});

describe("explore movement UI wiring", () => {
  it("wires Explore strip and inspector selection to published movement", () => {
    const explorePage = readSource("app/(root)/(routes)/explore/page.tsx");
    const movementStripSource = readSource("components/explore/ExploreModelMovementStrip.tsx");
    const reviewStripSource = readSource("components/explore/ExploreConversationReviewStrip.tsx");
    const shellSource = readSource("app/(root)/(routes)/chat/_components/SurfaceChatShell.tsx");

    expect(explorePage).toContain("ExploreModelMovementStrip");
    expect(explorePage).toContain("ExploreConversationReviewStrip");
    expect(explorePage).toContain("onConversationUpdated");
    expect(explorePage).toContain("refreshExploreSessionMovement");
    expect(explorePage).not.toContain("This will update your model");
    expect(explorePage).not.toContain("We extracted these");

    expect(movementStripSource).toContain('objectType: "model_update"');
    expect(movementStripSource).toContain('sourceSurface: "explore"');
    expect(movementStripSource).toContain('tab: "movement"');
    expect(movementStripSource).toContain("EXPLORE_MOVEMENT_EMPTY_COPY");
    expect(movementStripSource).not.toContain("may update");

    expect(reviewStripSource).toContain("EXPLORE_REVIEW_EMPTY_COPY");
    expect(reviewStripSource).not.toContain('objectType: "model_update"');

    expect(shellSource).toContain("onConversationUpdated");
    expect(shellSource).toContain("sessionAccessory");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}
