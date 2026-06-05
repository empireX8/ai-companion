import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const updateInvestigationCandidateLifecycleStatusMock = vi.fn();

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("../../lib/investigation-candidate-lifecycle-persistence", () => ({
  updateInvestigationCandidateLifecycleStatus:
    updateInvestigationCandidateLifecycleStatusMock,
  InvestigationLifecyclePersistenceError: class InvestigationLifecyclePersistenceError extends Error {
    constructor(
      message: string,
      public readonly code: string
    ) {
      super(message);
      this.name = "InvestigationLifecyclePersistenceError";
    }
  },
}));

describe("internal Investigation candidate lifecycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };
    authMock.mockResolvedValue({ userId: "reviewer-1" });
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/internal/investigations/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/investigations/candidates/inv-1/lifecycle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus: "promoted" }),
        }
      ),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(401);
    expect(updateInvestigationCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-reviewer", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/investigations/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/investigations/candidates/inv-1/lifecycle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus: "promoted" }),
        }
      ),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(403);
    expect(updateInvestigationCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid lifecycle target", async () => {
    const route = await import(
      "../../app/api/internal/investigations/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/investigations/candidates/inv-1/lifecycle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus: "invalid_status" }),
        }
      ),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(400);
    expect(updateInvestigationCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 404 for missing row", async () => {
    const { InvestigationLifecyclePersistenceError } = await import(
      "../../lib/investigation-candidate-lifecycle-persistence"
    );
    updateInvestigationCandidateLifecycleStatusMock.mockRejectedValueOnce(
      new InvestigationLifecyclePersistenceError("missing", "INVESTIGATION_NOT_FOUND")
    );

    const route = await import(
      "../../app/api/internal/investigations/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/investigations/candidates/missing-id/lifecycle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus: "promoted" }),
        }
      ),
      { params: Promise.resolve({ id: "missing-id" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for null lifecycle row", async () => {
    const { InvestigationLifecyclePersistenceError } = await import(
      "../../lib/investigation-candidate-lifecycle-persistence"
    );
    updateInvestigationCandidateLifecycleStatusMock.mockRejectedValueOnce(
      new InvestigationLifecyclePersistenceError("legacy", "NULL_LIFECYCLE_STATUS")
    );

    const route = await import(
      "../../app/api/internal/investigations/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/investigations/candidates/legacy-id/lifecycle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus: "promoted" }),
        }
      ),
      { params: Promise.resolve({ id: "legacy-id" }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("NULL_LIFECYCLE_STATUS");
  });

  it("returns 422 for forbidden transition", async () => {
    const { InvestigationLifecyclePersistenceError } = await import(
      "../../lib/investigation-candidate-lifecycle-persistence"
    );
    updateInvestigationCandidateLifecycleStatusMock.mockRejectedValueOnce(
      new InvestigationLifecyclePersistenceError("forbidden", "FORBIDDEN_TRANSITION")
    );

    const route = await import(
      "../../app/api/internal/investigations/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/investigations/candidates/inv-1/lifecycle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus: "promoted" }),
        }
      ),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("FORBIDDEN_TRANSITION");
  });

  it("returns 200 for valid held_for_more_evidence → promoted transition", async () => {
    updateInvestigationCandidateLifecycleStatusMock.mockResolvedValueOnce({
      id: "inv-1",
      userId: "reviewer-1",
      previousStatus: "held_for_more_evidence",
      newStatus: "promoted",
      updatedAt: new Date("2026-06-05T12:00:00.000Z"),
    });

    const route = await import(
      "../../app/api/internal/investigations/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/investigations/candidates/inv-1/lifecycle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus: "promoted" }),
        }
      ),
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: "inv-1",
      previousStatus: "held_for_more_evidence",
      newStatus: "promoted",
      updatedAt: "2026-06-05T12:00:00.000Z",
    });
    expect(body).not.toHaveProperty("visibility");
    expect(body).not.toHaveProperty("status");
  });
});
