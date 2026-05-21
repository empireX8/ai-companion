import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchLibraryDetail,
  fetchLibraryItems,
  fetchReceiptItems,
} from "../library-surface";
import { DEFERRED_RECEIPT_NAMESPACE_PREFIXES } from "../public-continuity-registry";

type MockRoute = {
  body: unknown;
  status?: number;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setupFetchMock(routes: Record<string, MockRoute>) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as { url?: string })?.url;

    if (!url || !(url in routes)) {
      throw new Error(`Unexpected fetch URL: ${String(url)}`);
    }

    const route = routes[url];
    return jsonResponse(route.body, route.status ?? 200);
  });

  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("library-surface receipt alignment", () => {
  it("does not derive Library detail linked-object hrefs from display labels", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(root)/(routes)/library/[id]/page.tsx"),
      "utf8"
    );

    expect(source).not.toContain('href={path}');
    expect(source).not.toContain('linked.kind === "Pattern"');
    expect(source).not.toContain('linked.kind === "Tension"');
    expect(source).toContain("receipt.linkedHref");
  });

  it("does not fabricate action receipts or call actions route for receipt rows", async () => {
    const fetchMock = setupFetchMock({
      "/api/patterns": {
        body: { sections: [] },
      },
      "/api/contradiction?status=open&limit=50": {
        body: { items: [] },
      },
      "/api/actions": {
        body: {
          stabilizeNow: [
            {
              id: "action-1",
              title: "Take a walk",
              linkedClaimId: "claim-1",
              linkedClaimSummary: "summary",
              linkedSourceLabel: "linked source",
            },
          ],
          buildForward: [],
        },
      },
    });

    const items = await fetchReceiptItems();

    expect(items).toEqual([]);
    expect(items.some((item) => item.id.startsWith("receipt-action-"))).toBe(
      false
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/actions",
      expect.anything()
    );
  });

  it("preserves backend-backed pattern/tension receipts and derives timestamps from evidence data", async () => {
    setupFetchMock({
      "/api/patterns": {
        body: {
          sections: [
            {
              claims: [
                {
                  id: "pattern-1",
                  summary: "I shut down after conflict",
                  strengthLevel: "developing",
                  evidenceCount: 7,
                  receipts: [
                    {
                      id: "p-r-old",
                      source: "message",
                      sessionId: "s-1",
                      messageId: "m-1",
                      quote: "older pattern quote",
                      createdAt: "2026-05-01T10:00:00.000Z",
                    },
                    {
                      id: "p-r-new",
                      source: "journal_entry",
                      sessionId: null,
                      messageId: null,
                      quote: "newer pattern quote",
                      createdAt: "2026-05-03T10:00:00.000Z",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      "/api/contradiction?status=open&limit=50": {
        body: {
          items: [
            {
              id: "tension-1",
              title: "Conflict between rest and achievement",
              status: "open",
              lastTouchedAt: "2026-05-05T10:00:00.000Z",
            },
          ],
        },
      },
      "/api/contradiction/tension-1": {
        body: {
          id: "tension-1",
          title: "Conflict between rest and achievement",
          status: "open",
          evidence: [
            {
              id: "t-e-old",
              createdAt: "2026-05-02T12:00:00.000Z",
              source: "reflection",
              quote: "older tension quote",
              sessionId: "s-9",
              messageId: "m-9",
            },
            {
              id: "t-e-new",
              createdAt: "2026-05-06T08:00:00.000Z",
              source: "session",
              quote: "newer tension quote",
              sessionId: "s-10",
              messageId: "m-10",
            },
          ],
        },
      },
    });

    const items = await fetchReceiptItems();
    const pattern = items.find((item) => item.id === "receipt-pattern-pattern-1");
    const tension = items.find((item) => item.id === "receipt-tension-tension-1");

    expect(pattern).toBeDefined();
    expect(pattern?.createdAt).toBe("2026-05-03T10:00:00.000Z");
    expect(pattern?.preview).toBe("newer pattern quote");
    expect(pattern?.signals).toBe(7);

    expect(tension).toBeDefined();
    expect(tension?.createdAt).toBe("2026-05-06T08:00:00.000Z");
    expect(tension?.preview).toBe("newer tension quote");
    expect(tension?.signals).toBe(2);

    expect(items.some((item) => item.date === "recent")).toBe(false);
  });

  it("handles contradiction list payload as either array or envelope", async () => {
    setupFetchMock({
      "/api/patterns": { body: { sections: [] } },
      "/api/contradiction?status=open&limit=50": {
        body: [
          {
            id: "tension-2",
            title: "Push-pull",
            status: "open",
            lastTouchedAt: "2026-05-05T10:00:00.000Z",
          },
        ],
      },
      "/api/contradiction/tension-2": {
        body: {
          id: "tension-2",
          title: "Push-pull",
          status: "open",
          evidence: [
            {
              id: "te-1",
              createdAt: "2026-05-04T00:00:00.000Z",
              source: "session",
              quote: "receipt quote",
              sessionId: "s-1",
              messageId: "m-1",
            },
          ],
        },
      },
    });

    const items = await fetchReceiptItems();

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("receipt-tension-tension-2");
  });

  it("returns honest empty receipt detail when linked evidence is absent", async () => {
    setupFetchMock({
      "/api/patterns": {
        body: {
          sections: [
            {
              claims: [
                {
                  id: "pattern-empty",
                  summary: "Low signal claim",
                  strengthLevel: "tentative",
                  evidenceCount: 0,
                  receipts: [],
                },
              ],
            },
          ],
        },
      },
    });

    const detail = await fetchLibraryDetail("receipt-pattern-pattern-empty");

    expect(detail).not.toBeNull();
    expect(detail?.kind).toBe("receipt");
    if (!detail || detail.kind !== "receipt") {
      throw new Error("Expected receipt detail");
    }
    expect(detail.receipt.evidenceItems).toEqual([]);
    expect(detail.item.preview).toBeNull();
    expect(detail.item.date).toBe("Unknown");
    expect(detail.item.createdAt).toBe("");
  });

  it("returns null for deferred receipt namespaces without fetching evidence APIs", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      throw new Error(`Unexpected fetch URL: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    for (const namespace of DEFERRED_RECEIPT_NAMESPACE_PREFIXES) {
      const detail = await fetchLibraryDetail(`${namespace}-test-id`);
      expect(detail).toBeNull();
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not access internal user-map endpoints from public library receipt helpers", async () => {
    const fetchMock = setupFetchMock({
      "/api/patterns": { body: { sections: [] } },
      "/api/contradiction?status=open&limit=50": { body: { items: [] } },
    });

    await fetchReceiptItems();

    const requestedUrls = fetchMock.mock.calls.map((call) =>
      typeof call[0] === "string"
        ? call[0]
        : call[0] instanceof URL
          ? call[0].toString()
          : (call[0] as { url?: string })?.url
    );

    expect(
      requestedUrls.some((url) =>
        String(url).includes("/api/internal/user-map/review-candidates")
      )
    ).toBe(false);
    expect(
      requestedUrls.some((url) => String(url).startsWith("/api/user-map"))
    ).toBe(false);
  });

  it("keeps non-receipt library sources loading with live data", async () => {
    setupFetchMock({
      "/api/journal/entries?limit=100": {
        body: [
          {
            id: "journal-1",
            title: "Journal",
            body: "Body",
            createdAt: "2026-05-10T10:00:00.000Z",
            updatedAt: "2026-05-10T10:00:00.000Z",
            authoredAt: null,
          },
        ],
      },
      "/api/check-ins": {
        body: [
          {
            id: "checkin-1",
            stateTag: "stressed",
            eventTags: ["pressure"],
            note: "note",
            createdAt: "2026-05-11T10:00:00.000Z",
            updatedAt: "2026-05-11T10:00:00.000Z",
          },
        ],
      },
      "/api/session/list?origin=app&surfaceType=journal_chat": { body: [] },
      "/api/session/list?origin=app&surfaceType=explore_chat": { body: [] },
      "/api/session/list?origin=imported": { body: [] },
      "/api/patterns": {
        body: {
          sections: [
            {
              claims: [
                {
                  id: "pattern-9",
                  summary: "Pattern summary",
                  strengthLevel: "developing",
                  evidenceCount: 1,
                  receipts: [
                    {
                      id: "receipt-9",
                      source: "message",
                      sessionId: "s-1",
                      messageId: "m-1",
                      quote: "Pattern evidence",
                      createdAt: "2026-05-12T12:00:00.000Z",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      "/api/contradiction?status=open&limit=50": { body: { items: [] } },
    });

    const items = await fetchLibraryItems();

    expect(items.some((item) => item.type === "Journal")).toBe(true);
    expect(items.some((item) => item.type === "Check-in")).toBe(true);
    expect(items.some((item) => item.type === "Receipts")).toBe(true);
    expect(items.some((item) => item.id.startsWith("receipt-action-"))).toBe(
      false
    );
  });
});
