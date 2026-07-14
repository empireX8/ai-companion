import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyUserMapCorrection,
  isDurableWriteError,
  resolveCorrectionWriteTarget,
  submitDecisionOutcome,
  submitFieldworkCheckIn,
} from "../durable-user-actions-contract";
import type { OrvekObject } from "../orvek-v0/orvek-types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("durable user actions contract", () => {
  it("resolves usermap conclusion correction targets from map objects", () => {
    const object: OrvekObject = {
      id: "conclusion-dev-durable-actions-assault-conclusion",
      type: "map-object",
      title: "Correctable conclusion",
      summary: "Original assertion",
      inspectorObjectType: "usermap_conclusion",
      inspectorObjectId: "dev-durable-actions-assault-conclusion",
      correctionCount: 0,
    };

    expect(resolveCorrectionWriteTarget(object)).toEqual({
      kind: "usermap_conclusion",
      conclusionId: "dev-durable-actions-assault-conclusion",
      originalSummary: "Original assertion",
      correctionCount: 0,
    });
  });

  it("persists user-map corrections without rewriting summary", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        item: {
          id: "dev-durable-actions-assault-conclusion",
          summary: "Original assertion",
          lastUserCorrectionLabel: "This is wrong",
          lastUserCorrectionAt: "2026-07-14T12:00:00.000Z",
          correctionCount: 1,
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await applyUserMapCorrection({
      conclusionId: "dev-durable-actions-assault-conclusion",
      label: "This is wrong",
      originalSummary: "Original assertion",
      correctionCount: 0,
    });

    expect(isDurableWriteError(result)).toBe(false);
    if (!isDurableWriteError(result)) {
      expect(result.summary).toBe("Original assertion");
      expect(result.lastUserCorrectionLabel).toBe("This is wrong");
      expect(result.correctionCount).toBe(1);
    }
  });

  it("returns durable write errors for failed decision outcomes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "Not found" }, 404));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await submitDecisionOutcome({
      actionId: "missing-action",
      note: "Outcome text",
    });

    expect(isDurableWriteError(result)).toBe(true);
    if (isDurableWriteError(result)) {
      expect(result.status).toBe(404);
    }
  });

  it("persists fieldwork check-ins with parent id", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        item: {
          id: "dev-durable-actions-assault-fieldwork",
          observationNote: "Observed stop point after meeting",
          observationOutcome: null,
          status: "active",
          completedAt: null,
          updatedAt: "2026-07-14T12:05:00.000Z",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await submitFieldworkCheckIn({
      fieldworkId: "dev-durable-actions-assault-fieldwork",
      observationNote: "Observed stop point after meeting",
    });

    expect(isDurableWriteError(result)).toBe(false);
    if (!isDurableWriteError(result)) {
      expect(result.id).toBe("dev-durable-actions-assault-fieldwork");
      expect(result.observationNote).toContain("Observed stop point");
      expect(result.status).toBe("active");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/fieldwork/dev-durable-actions-assault-fieldwork",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"status":"active"'),
      })
    );
  });
});
