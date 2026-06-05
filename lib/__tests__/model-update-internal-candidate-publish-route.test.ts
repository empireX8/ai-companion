import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const publishModelUpdateCandidateMock = vi.fn();

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("../../lib/model-update-candidate-publish-helper", () => ({
  publishModelUpdateCandidate: publishModelUpdateCandidateMock,
  PublishModelUpdateCandidateError: class PublishModelUpdateCandidateError extends Error {
    constructor(
      message: string,
      public readonly code: string
    ) {
      super(message);
      this.name = "PublishModelUpdateCandidateError";
    }
  },
}));

describe("internal ModelUpdate candidate publish route", () => {
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
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/mu-1/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "mu-1" }) }
    );

    expect(response.status).toBe(401);
    expect(publishModelUpdateCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-reviewer", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/mu-1/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "mu-1" }) }
    );

    expect(response.status).toBe(403);
    expect(publishModelUpdateCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid id", async () => {
    const route = await import(
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/%20/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "   " }) }
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_ID");
    expect(publishModelUpdateCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 404 for missing row", async () => {
    const { PublishModelUpdateCandidateError } = await import(
      "../../lib/model-update-candidate-publish-helper"
    );
    publishModelUpdateCandidateMock.mockRejectedValueOnce(
      new PublishModelUpdateCandidateError("missing", "MODEL_UPDATE_NOT_FOUND")
    );

    const route = await import(
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/missing-id/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "missing-id" }) }
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("MODEL_UPDATE_NOT_FOUND");
  });

  it("returns 422 for already user_visible row", async () => {
    const { PublishModelUpdateCandidateError } = await import(
      "../../lib/model-update-candidate-publish-helper"
    );
    publishModelUpdateCandidateMock.mockRejectedValueOnce(
      new PublishModelUpdateCandidateError("already visible", "ALREADY_VISIBLE")
    );

    const route = await import(
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/visible-id/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "visible-id" }) }
    );

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("ALREADY_VISIBLE");
  });

  it("returns 422 for isMeaningful true row", async () => {
    const { PublishModelUpdateCandidateError } = await import(
      "../../lib/model-update-candidate-publish-helper"
    );
    publishModelUpdateCandidateMock.mockRejectedValueOnce(
      new PublishModelUpdateCandidateError("already meaningful", "ALREADY_MEANINGFUL")
    );

    const route = await import(
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/meaningful-id/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "meaningful-id" }) }
    );

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("ALREADY_MEANINGFUL");
  });

  it("returns 200 for successful publish with safe response", async () => {
    publishModelUpdateCandidateMock.mockResolvedValueOnce({
      id: "mu-1",
      userId: "reviewer-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      previousIsMeaningful: false,
      newIsMeaningful: true,
    });

    const route = await import(
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/mu-1/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "mu-1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "mu-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      previousIsMeaningful: false,
      newIsMeaningful: true,
    });
    expect(publishModelUpdateCandidateMock).toHaveBeenCalledWith(
      "reviewer-1",
      "mu-1"
    );
  });

  it("does not expose internal notes or evidence in response", async () => {
    publishModelUpdateCandidateMock.mockResolvedValueOnce({
      id: "mu-1",
      userId: "reviewer-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      previousIsMeaningful: false,
      newIsMeaningful: true,
    });

    const route = await import(
      "../../app/api/internal/model-updates/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request(
        "http://localhost/api/internal/model-updates/candidates/mu-1/publish",
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: "mu-1" }) }
    );

    const body = await response.json();
    expect(body).not.toHaveProperty("internalNotes");
    expect(body).not.toHaveProperty("evidence");
    expect(body).not.toHaveProperty("evidenceLinks");
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("userFacingSummary");
    expect(body).not.toHaveProperty("updateType");
  });
});
