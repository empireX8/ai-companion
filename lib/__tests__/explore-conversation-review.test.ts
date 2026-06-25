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
  referenceItem: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
  contradictionNode: {
    findMany: vi.fn(),
  },
  patternClaimEvidence: {
    findMany: vi.fn(),
  },
  userMapConclusion: {
    findMany: vi.fn(),
  },
  investigation: {
    findMany: vi.fn(),
  },
  fieldworkAssignment: {
    findMany: vi.fn(),
  },
  modelUpdate: {
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

describe("/api/explore/sessions/[id]/review-items", () => {
  const sessionId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.session.findFirst.mockResolvedValue({ id: sessionId });
    prismaMock.message.findMany.mockResolvedValue([{ id: "msg-1" }]);
    prismaMock.referenceItem.findMany.mockResolvedValue([]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.patternClaimEvidence.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.investigation.findMany.mockResolvedValue([]);
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/explore/sessions/[id]/review-items/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });

    expect(response.status).toBe(401);
  });

  it("returns empty items when no session-linked review sources exist", async () => {
    const route = await import("../../app/api/explore/sessions/[id]/review-items/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ items: [] });
  });

  it("projects reference candidates with safe fields and governance actions only", async () => {
    prismaMock.referenceItem.findMany.mockResolvedValueOnce([
      {
        id: "ref-1",
        type: "preference",
        confidence: "medium",
        statement: "I need more recovery time after intense weeks.",
        updatedAt: new Date("2026-06-20T10:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/explore/sessions/[id]/review-items/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: "reference:ref-1",
      kind: "context_profile_update",
      status: "needs_review",
      statusLabel: "Needs review",
      referenceAction: { referenceId: "ref-1" },
      actions: {
        canConfirm: true,
        canEdit: false,
        canReject: true,
      },
      selectableObject: null,
    });
    expect(JSON.stringify(payload)).not.toContain("internalNotes");
    expect(JSON.stringify(payload)).not.toContain("sourceRunId");
    expect(JSON.stringify(payload)).not.toContain("candidateLifecycleStatus");
    expect(JSON.stringify(payload)).not.toContain("evidencePacket");
  });

  it("projects internal model update candidates without inspector model_update selection", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { targetType: "model_update", targetId: "mu-internal" },
    ]);
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-internal",
        updateType: "link_detected",
        userFacingSummary: "Possible link between two patterns.",
        affectedObjectType: "pattern_claim",
        createdAt: new Date("2026-06-20T10:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/explore/sessions/[id]/review-items/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });
    const payload = await response.json();

    expect(payload.items[0]?.kind).toBe("model_update_candidate");
    expect(payload.items[0]?.statusLabel).toContain("not published");
    expect(payload.items[0]?.selectableObject).toBeNull();
  });

  it("excludes internal-only lifecycle names from user-facing labels", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { targetType: "usermap_conclusion", targetId: "map-1" },
    ]);
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "map-1",
        title: "Recovery needs more space",
        summary: "Recent material suggests rest is underweighted.",
        area: "state_ecology",
        confidenceLevel: "medium",
        candidateLifecycleStatus: "proposed",
        updatedAt: new Date("2026-06-20T10:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/explore/sessions/[id]/review-items/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: sessionId }),
    });
    const payload = await response.json();

    expect(payload.items[0]?.statusLabel).toBe("Draft");
    expect(JSON.stringify(payload)).not.toContain("proposed");
    expect(JSON.stringify(payload)).not.toContain("promoted");
  });
});

describe("explore conversation review UI separation", () => {
  it("keeps published movement and conversation review separate in Explore UI", () => {
    const explorePage = readSource("app/(root)/(routes)/explore/page.tsx");
    const orvekExplore = readSource("components/orvek-workbench/OrvekExplorePage.tsx");
    const movementStrip = readSource("components/explore/ExploreModelMovementStrip.tsx");
    const reviewStrip = readSource("components/explore/ExploreConversationReviewStrip.tsx");
    const movementPanel = readSource("components/inspector/panels/ModelMovementInspectorPanel.tsx");
    const chatPanel = readSource("components/inspector/panels/ChatInspectorPanel.tsx");

    expect(explorePage).toContain("OrvekExplorePage");
    expect(orvekExplore).toContain("ExploreModelMovementStrip");
    expect(orvekExplore).toContain("ExploreConversationReviewStrip");
    expect(orvekExplore).toContain("onConversationUpdated");

    expect(movementStrip).toContain("ExploreInspectorAction");
    expect(movementStrip).toContain("EXPLORE_MOVEMENT_PUBLISHED_BADGE");
    expect(movementStrip).not.toContain("model_update_candidate");

    expect(reviewStrip).toContain("EXPLORE_REVIEW_HAS_ITEMS_HEADLINE");
    expect(reviewStrip).toContain("EXPLORE_REVIEW_HAS_ITEMS_SUBCOPY");
    expect(reviewStrip).not.toContain('objectType: "model_update"');
    expect(reviewStrip).not.toContain("This may update your model");
    expect(reviewStrip).not.toContain("We extracted these");

    expect(movementPanel).toContain("ExploreSessionMovementInspectorList");
    expect(chatPanel).toContain("ExploreConversationReviewInspectorList");
    expect(chatPanel).toContain("EXPLORE_REVIEW_INSPECTOR_SECTION_LABEL");
  });

  it("does not expose internal review routes in Explore surfaces", () => {
    const sources = [
      readSource("app/(root)/(routes)/explore/page.tsx"),
      readSource("components/orvek-workbench/OrvekExplorePage.tsx"),
      readSource("components/explore/ExploreConversationReviewStrip.tsx"),
      readSource("lib/explore-session-review-items-server.ts"),
    ].join("\n");

    expect(sources).not.toContain("/api/internal/");
    expect(sources).not.toContain("review-candidates");
    expect(sources).not.toContain("beforeSummary");
    expect(sources).not.toContain("afterSummary");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}
