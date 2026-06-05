import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const publishFieldworkCandidateMock = vi.fn();

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("../../lib/fieldwork-publish-helper", () => ({
  publishFieldworkCandidate: publishFieldworkCandidateMock,
  PublishFieldworkCandidateError: class PublishFieldworkCandidateError extends Error {
    constructor(
      message: string,
      public readonly code: string
    ) {
      super(message);
      this.name = "PublishFieldworkCandidateError";
    }
  },
}));

describe("internal Fieldwork candidate publish route", () => {
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
      "../../app/api/internal/fieldwork/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/fieldwork/candidates/fw-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "fw-1" }) }
    );

    expect(response.status).toBe(401);
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-reviewer", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/fieldwork/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/fieldwork/candidates/fw-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "fw-1" }) }
    );

    expect(response.status).toBe(403);
    expect(publishFieldworkCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 404 for missing row", async () => {
    const { PublishFieldworkCandidateError } = await import("../../lib/fieldwork-publish-helper");
    publishFieldworkCandidateMock.mockRejectedValueOnce(
      new PublishFieldworkCandidateError("missing", "FIELDWORK_NOT_FOUND")
    );

    const route = await import(
      "../../app/api/internal/fieldwork/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/fieldwork/candidates/missing-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "missing-id" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for null lifecycle row", async () => {
    const { PublishFieldworkCandidateError } = await import("../../lib/fieldwork-publish-helper");
    publishFieldworkCandidateMock.mockRejectedValueOnce(
      new PublishFieldworkCandidateError("legacy", "NULL_LIFECYCLE_STATUS")
    );

    const route = await import(
      "../../app/api/internal/fieldwork/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/fieldwork/candidates/legacy-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "legacy-id" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 422 for proposed row", async () => {
    const { PublishFieldworkCandidateError } = await import("../../lib/fieldwork-publish-helper");
    publishFieldworkCandidateMock.mockRejectedValueOnce(
      new PublishFieldworkCandidateError("not promoted", "NOT_PROMOTED")
    );

    const route = await import(
      "../../app/api/internal/fieldwork/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/fieldwork/candidates/proposed-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "proposed-id" }) }
    );

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("NOT_PROMOTED");
  });

  it("returns 422 for already user_visible row", async () => {
    const { PublishFieldworkCandidateError } = await import("../../lib/fieldwork-publish-helper");
    publishFieldworkCandidateMock.mockRejectedValueOnce(
      new PublishFieldworkCandidateError("already visible", "ALREADY_VISIBLE")
    );

    const route = await import(
      "../../app/api/internal/fieldwork/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/fieldwork/candidates/visible-id/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "visible-id" }) }
    );

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("ALREADY_VISIBLE");
  });

  it("returns 200 for successful publish", async () => {
    publishFieldworkCandidateMock.mockResolvedValueOnce({
      id: "fw-1",
      userId: "reviewer-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      updatedAt: new Date("2026-06-05T12:00:00.000Z"),
    });

    const route = await import(
      "../../app/api/internal/fieldwork/candidates/[id]/publish/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/fieldwork/candidates/fw-1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "fw-1" }) }
    );

    expect(response.status).toBe(200);
    expect(publishFieldworkCandidateMock).toHaveBeenCalledWith("reviewer-1", "fw-1");
    expect(await response.json()).toEqual({
      id: "fw-1",
      previousVisibility: "internal_only",
      newVisibility: "user_visible",
      updatedAt: "2026-06-05T12:00:00.000Z",
    });
  });
});
