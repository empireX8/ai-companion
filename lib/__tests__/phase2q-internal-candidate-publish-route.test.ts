import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const publishCandidateMock = vi.fn();

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("../../lib/candidate-publish-helper", () => ({
  publishCandidate: publishCandidateMock,
  PublishCandidateError: class PublishCandidateError extends Error {
    constructor(
      message: string,
      public readonly code: string
    ) {
      super(message);
      this.name = "PublishCandidateError";
    }
  },
}));

describe("Phase 2Q internal candidate publish route", () => {
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
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("UNAUTHORIZED");
    expect(publishCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-allowlisted users", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(publishCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 403 when allowlist is empty", async () => {
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "",
    };

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(publishCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 200 and safe response for promoted + internal_only candidate", async () => {
    publishCandidateMock.mockResolvedValueOnce({
      id: "candidate-1",
      userId: "reviewer-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      updatedAt: new Date("2026-05-29T12:00:00.000Z"),
    });

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: "candidate-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      updatedAt: "2026-05-29T12:00:00.000Z",
    });

    expect(publishCandidateMock).toHaveBeenCalledWith(
      "reviewer-1",
      "candidate-1"
    );
  });

  it("returns 404 for missing conclusion (CONCLUSION_NOT_FOUND)", async () => {
    const { PublishCandidateError } = await import(
      "../../lib/candidate-publish-helper"
    );
    publishCandidateMock.mockRejectedValueOnce(
      new PublishCandidateError(
        "UserMapConclusion not found for id=missing-id and userId=reviewer-1",
        "CONCLUSION_NOT_FOUND"
      )
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/missing-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "missing-id" }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("CONCLUSION_NOT_FOUND");
  });

  it("returns 404 for null legacy lifecycle status (NULL_LIFECYCLE_STATUS)", async () => {
    const { PublishCandidateError } = await import(
      "../../lib/candidate-publish-helper"
    );
    publishCandidateMock.mockRejectedValueOnce(
      new PublishCandidateError(
        "Cannot publish UserMapConclusion id=legacy-id: candidateLifecycleStatus is null",
        "NULL_LIFECYCLE_STATUS"
      )
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/legacy-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "legacy-id" }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("NULL_LIFECYCLE_STATUS");
  });

  it("returns 422 for non-promoted candidate (NOT_PROMOTED)", async () => {
    const { PublishCandidateError } = await import(
      "../../lib/candidate-publish-helper"
    );
    publishCandidateMock.mockRejectedValueOnce(
      new PublishCandidateError(
        "Cannot publish UserMapConclusion id=rejected-id: candidateLifecycleStatus is 'rejected', expected 'promoted'.",
        "NOT_PROMOTED"
      )
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/rejected-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "rejected-id" }) }
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("NOT_PROMOTED");
  });

  it("returns 422 for already user_visible candidate (ALREADY_VISIBLE)", async () => {
    const { PublishCandidateError } = await import(
      "../../lib/candidate-publish-helper"
    );
    publishCandidateMock.mockRejectedValueOnce(
      new PublishCandidateError(
        "Cannot publish UserMapConclusion id=visible-id: visibility is 'user_visible', expected 'internal_only'.",
        "ALREADY_VISIBLE"
      )
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/visible-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "visible-id" }) }
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("ALREADY_VISIBLE");
  });

  it("returns 500 for unexpected errors", async () => {
    publishCandidateMock.mockRejectedValueOnce(
      new Error("Database connection failed")
    );

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("does not expose candidateLifecycleStatus, status, or evidence in response", async () => {
    publishCandidateMock.mockResolvedValueOnce({
      id: "candidate-1",
      userId: "reviewer-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      updatedAt: new Date("2026-05-29T12:00:00.000Z"),
    });

    const route = await import(
      "../../app/api/internal/user-map/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/user-map/candidates/candidate-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    // Response should only contain visibility fields, not lifecycle/status/evidence
    expect(body).not.toHaveProperty("candidateLifecycleStatus");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("evidence");
    expect(body).not.toHaveProperty("evidenceLinks");
    expect(body).not.toHaveProperty("userId");

    // Response should contain only the safe fields
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("previousVisibility");
    expect(body).toHaveProperty("newVisibility");
    expect(body).toHaveProperty("updatedAt");
  });
});
