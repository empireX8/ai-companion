import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const loadProductionInvestigationDetailMock = vi.fn();
const listAvailableEvidenceSpansForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/investigation-production-detail", () => ({
  loadProductionInvestigationDetail: loadProductionInvestigationDetailMock,
  listAvailableEvidenceSpansForUser: listAvailableEvidenceSpansForUserMock,
}));

describe("/api/inspector/investigations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    loadProductionInvestigationDetailMock.mockResolvedValue(null);
    listAvailableEvidenceSpansForUserMock.mockResolvedValue([]);
  });

  it("requires auth", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/inspector/investigations/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/inspector/investigations/inv-1"),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(401);
    expect(loadProductionInvestigationDetailMock).not.toHaveBeenCalled();
    expect(listAvailableEvidenceSpansForUserMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the durable investigation detail is unavailable", async () => {
    const route = await import("../../app/api/inspector/investigations/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/inspector/investigations/inv-missing"),
      { params: Promise.resolve({ id: "inv-missing" }) }
    );

    expect(response.status).toBe(404);
    expect(loadProductionInvestigationDetailMock).toHaveBeenCalledWith({
      userId: "user-1",
      id: "inv-missing",
    });
    expect(listAvailableEvidenceSpansForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      investigationId: "inv-missing",
    });
  });

  it("returns the durable investigation identity, evidence, and fieldwork depth for Inspector", async () => {
    listAvailableEvidenceSpansForUserMock.mockResolvedValueOnce([
      {
        id: "es-available-1",
        excerpt: "Available evidence excerpt",
        messageId: "msg-available-1",
        sessionId: "sess-available-1",
        sessionLabel: "Available evidence session",
        origin: "APP",
      },
    ]);
    loadProductionInvestigationDetailMock.mockResolvedValueOnce({
      id: "inv-1",
      detailHref: "/active-questions/inv-1",
      title: "Observe shutdown patterns",
      organizingQuestion: "What precedes shutdown mode?",
      status: "resolved",
      statusLabel: "Resolved",
      seedType: "pattern",
      seedTypeLabel: "Pattern",
      priority: 2,
      createdAt: "2026-05-17T07:00:00.000Z",
      updatedAt: "2026-05-17T09:00:00.000Z",
      resolutionSummary: "Likely routes through recovery architecture.",
      resolvedAt: "2026-05-18T09:00:00.000Z",
      reopenReason: null,
      resolvedConclusionId: "umc-1",
      resolvedConclusionHref: "/your-map/umc-1",
      competingTheories: ["Theory one"],
      evidenceNeeded: ["Need one more receipt"],
      linkedEvidence: [
        {
          linkId: "link-1",
          evidenceId: "es-1",
          messageId: "msg-1",
          excerpt: "Direct evidence excerpt",
          sessionId: "sess-1",
          sessionLabel: "Evidence session",
          origin: "APP",
          role: "supports",
          createdAt: "2026-05-17T09:30:00.000Z",
          evidenceHref: "/evidence/es-1",
        },
      ],
      linkedFieldwork: [
        {
          id: "fw-1",
          prompt: "Watch the shutdown pattern",
          reason: "Check whether the stop point arrives first",
          status: "active",
          statusLabel: "Active",
          linkedObjectType: "investigation",
          linkedObjectId: "inv-1",
          observationNote: "Observed one clean stop point.",
          observationOutcome: "Supports the current investigation.",
          completedAt: null,
          createdAt: "2026-05-17T09:15:00.000Z",
          updatedAt: "2026-05-17T09:45:00.000Z",
          detailHref: "/watch-for/fw-1",
        },
      ],
      isClosed: true,
      closureStateLabel: "Closed as resolved",
    });

    const route = await import("../../app/api/inspector/investigations/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/inspector/investigations/inv-1"),
      { params: Promise.resolve({ id: "inv-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.item.id).toBe("inv-1");
    expect(payload.item.linkedEvidence[0].evidenceId).toBe("es-1");
    expect(payload.item.linkedFieldwork[0].id).toBe("fw-1");
    expect(payload.item.closureStateLabel).toBe("Closed as resolved");
    expect(payload.item.availableEvidence[0].id).toBe("es-available-1");
  });
});
