import { CandidateLifecycleStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  postInternalCandidateLifecycle,
  postInternalCandidatePublish,
} from "../internal-user-map-review-operator-client";

describe("internal user-map review operator client", () => {
  it("posts lifecycle transitions to the internal route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "c-1",
          previousStatus: "proposed",
          newStatus: "rejected",
          updatedAt: "2026-05-29T12:00:00.000Z",
        }),
        { status: 200 }
      )
    );

    const result = await postInternalCandidateLifecycle(
      "c-1",
      CandidateLifecycleStatus.rejected,
      fetchMock
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/user-map/candidates/c-1/lifecycle",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ newStatus: "rejected" }),
      })
    );
    expect(result).toEqual({
      ok: true,
      data: {
        kind: "lifecycle",
        id: "c-1",
        previousStatus: "proposed",
        newStatus: "rejected",
        updatedAt: "2026-05-29T12:00:00.000Z",
      },
    });
  });

  it("returns safe error messages for lifecycle failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Transition not allowed",
          code: "FORBIDDEN_TRANSITION",
        }),
        { status: 422 }
      )
    );

    const result = await postInternalCandidateLifecycle(
      "c-1",
      CandidateLifecycleStatus.promoted,
      fetchMock
    );

    expect(result).toEqual({
      ok: false,
      status: 422,
      message: "Transition not allowed",
      code: "FORBIDDEN_TRANSITION",
    });
  });

  it("posts publish to the internal route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "c-1",
          previousVisibility: "internal_only",
          newVisibility: "user_visible",
          updatedAt: "2026-05-29T12:00:00.000Z",
        }),
        { status: 200 }
      )
    );

    const result = await postInternalCandidatePublish("c-1", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/user-map/candidates/c-1/publish",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.data.kind === "publish") {
      expect(result.data.newVisibility).toBe("user_visible");
    }
  });
});
