import { afterEach, describe, expect, it, vi } from "vitest";

import { createFieldworkFromAction } from "../actions-api";

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

describe("actions-api createFieldworkFromAction", () => {
  it("posts only allowlisted fieldwork draft fields from action context", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ item: { id: "fw-1" } }, 201)
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await createFieldworkFromAction({
      id: " action-1 ",
      title: " Track transition window ",
      whySuggested: " Validate the trigger before it escalates. ",
      note: "private note",
      linkedClaimSummary: "raw summary",
    } as unknown as {
      id: string;
      title: string;
      whySuggested: string;
    });

    expect(result).toEqual({ id: "fw-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/fieldwork",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Track transition window",
          reason: "Validate the trigger before it escalates.",
          status: "assigned",
          linkedObjectType: "surfaced_action",
          linkedObjectId: "action-1",
        }),
      })
    );
    const firstCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const requestOptions = firstCall?.[1] as { body?: string } | undefined;
    expect(requestOptions?.body).not.toContain("note");
    expect(requestOptions?.body).not.toContain("linkedClaimSummary");
  });

  it("returns null and avoids fetch when action data is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await createFieldworkFromAction({
      id: "action-1",
      title: "Valid title",
      whySuggested: "   ",
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when fieldwork create fails", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: "Validation failed" }, 400)
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await createFieldworkFromAction({
      id: "action-1",
      title: "Track transition window",
      whySuggested: "Validate the trigger before it escalates.",
    });

    expect(result).toBeNull();
  });
});
