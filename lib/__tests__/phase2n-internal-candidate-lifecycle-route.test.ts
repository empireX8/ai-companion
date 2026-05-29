import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const updateCandidateLifecycleStatusMock = vi.fn();

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("../../lib/candidate-lifecycle-persistence", () => ({
  updateCandidateLifecycleStatus: updateCandidateLifecycleStatusMock,
  LifecyclePersistenceError: class LifecyclePersistenceError extends Error {
    constructor(
      message: string,
      public readonly code: string
    ) {
      super(message);
      this.name = "LifecyclePersistenceError";
    }
  },
}));

describe("Phase 2N internal candidate lifecycle route", () => {
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
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("UNAUTHORIZED");
    expect(updateCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-allowlisted users", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(updateCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 403 when allowlist is empty", async () => {
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "",
    };

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(updateCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(updateCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid newStatus value", async () => {
    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "invalid_status" }),
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(updateCandidateLifecycleStatusMock).not.toHaveBeenCalled();
  });

  it("returns 200 and safe response for valid transition", async () => {
    updateCandidateLifecycleStatusMock.mockResolvedValueOnce({
      id: "candidate-1",
      userId: "reviewer-1",
      previousStatus: "proposed",
      newStatus: "rejected",
      updatedAt: new Date("2026-05-29T12:00:00.000Z"),
    });

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: "candidate-1",
      previousStatus: "proposed",
      newStatus: "rejected",
      updatedAt: "2026-05-29T12:00:00.000Z",
    });

    expect(updateCandidateLifecycleStatusMock).toHaveBeenCalledWith(
      "reviewer-1",
      "candidate-1",
      "rejected"
    );
  });

  it("returns 200 for held_for_more_evidence → promoted transition", async () => {
    updateCandidateLifecycleStatusMock.mockResolvedValueOnce({
      id: "candidate-2",
      userId: "reviewer-1",
      previousStatus: "held_for_more_evidence",
      newStatus: "promoted",
      updatedAt: new Date("2026-05-29T12:00:00.000Z"),
    });

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-2/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "promoted" }),
      }),
      { params: Promise.resolve({ id: "candidate-2" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.previousStatus).toBe("held_for_more_evidence");
    expect(body.newStatus).toBe("promoted");
  });

  it("returns 404 for missing conclusion (CONCLUSION_NOT_FOUND)", async () => {
    const { LifecyclePersistenceError } = await import(
      "../../lib/candidate-lifecycle-persistence"
    );
    updateCandidateLifecycleStatusMock.mockRejectedValueOnce(
      new LifecyclePersistenceError(
        "UserMapConclusion not found for id=missing-id and userId=reviewer-1",
        "CONCLUSION_NOT_FOUND"
      )
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/missing-id/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "missing-id" }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("CONCLUSION_NOT_FOUND");
  });

  it("returns 404 for null legacy lifecycle status (NULL_LIFECYCLE_STATUS)", async () => {
    const { LifecyclePersistenceError } = await import(
      "../../lib/candidate-lifecycle-persistence"
    );
    updateCandidateLifecycleStatusMock.mockRejectedValueOnce(
      new LifecyclePersistenceError(
        "Cannot transition UserMapConclusion id=legacy-id: candidateLifecycleStatus is null",
        "NULL_LIFECYCLE_STATUS"
      )
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/legacy-id/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "legacy-id" }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("NULL_LIFECYCLE_STATUS");
  });

  it("returns 422 for forbidden transition (FORBIDDEN_TRANSITION)", async () => {
    const { LifecyclePersistenceError } = await import(
      "../../lib/candidate-lifecycle-persistence"
    );
    updateCandidateLifecycleStatusMock.mockRejectedValueOnce(
      new LifecyclePersistenceError(
        "Transition from 'promoted' to 'proposed' is not allowed.",
        "FORBIDDEN_TRANSITION"
      )
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/promoted-id/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "proposed" }),
      }),
      { params: Promise.resolve({ id: "promoted-id" }) }
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN_TRANSITION");
  });

  it("returns 500 for unexpected errors", async () => {
    updateCandidateLifecycleStatusMock.mockRejectedValueOnce(
      new Error("Database connection failed")
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("does not mutate visibility, status, or evidence links", async () => {
    updateCandidateLifecycleStatusMock.mockResolvedValueOnce({
      id: "candidate-1",
      userId: "reviewer-1",
      previousStatus: "proposed",
      newStatus: "rejected",
      updatedAt: new Date("2026-05-29T12:00:00.000Z"),
    });

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/lifecycle/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "rejected" }),
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    // Response should only contain lifecycle fields, not visibility/status/evidence
    expect(body).not.toHaveProperty("visibility");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("evidence");
    expect(body).not.toHaveProperty("evidenceLinks");

    // The mock was called with only lifecycle-relevant args
    expect(updateCandidateLifecycleStatusMock).toHaveBeenCalledWith(
      "reviewer-1",
      "candidate-1",
      "rejected"
    );
  });
});
