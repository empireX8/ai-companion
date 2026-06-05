import { CandidateLifecycleStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  postInternalCandidateLifecycle,
  postInternalCandidatePublish,
  postInternalInvestigationCandidateLifecycle,
  postInternalInvestigationCandidatePublish,
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

  it("posts Investigation lifecycle transitions to the Investigation route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "inv-1",
          previousStatus: "proposed",
          newStatus: "held_for_more_evidence",
          updatedAt: "2026-05-29T12:00:00.000Z",
        }),
        { status: 200 }
      )
    );

    const result = await postInternalInvestigationCandidateLifecycle(
      "inv-1",
      CandidateLifecycleStatus.held_for_more_evidence,
      fetchMock
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/investigations/candidates/inv-1/lifecycle",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ newStatus: "held_for_more_evidence" }),
      })
    );
    expect(result.ok).toBe(true);
  });

  it("posts Investigation publish to the Investigation route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "inv-1",
          previousVisibility: "internal_only",
          newVisibility: "user_visible",
          updatedAt: "2026-05-29T12:00:00.000Z",
        }),
        { status: 200 }
      )
    );

    const result = await postInternalInvestigationCandidatePublish("inv-1", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/investigations/candidates/inv-1/publish",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.ok).toBe(true);
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
