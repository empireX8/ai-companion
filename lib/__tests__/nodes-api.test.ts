import { describe, expect, it, vi, beforeEach } from "vitest";

import { buildContradictionUrls, fetchContradictionById, fetchContradictions } from "../nodes-api";

describe("nodes-api helpers", () => {
  it("builds activeish contradiction URLs", () => {
    expect(buildContradictionUrls("activeish")).toEqual([
      "/api/contradiction?status=open",
      "/api/contradiction?status=explored",
      "/api/contradiction?status=snoozed",
    ]);
  });

  it("builds single contradiction URL for explicit status", () => {
    expect(buildContradictionUrls("open")).toEqual(["/api/contradiction?status=open"]);
  });

  it("builds terminal contradiction URLs", () => {
    expect(buildContradictionUrls("terminal")).toEqual([
      "/api/contradiction?status=resolved",
      "/api/contradiction?status=accepted_tradeoff",
      "/api/contradiction?status=archived_tension",
    ]);
  });
});

describe("fetchContradictionById", () => {
  const mockDetail = {
    id: "node_1",
    title: "Test contradiction",
    type: "value_vs_value",
    status: "open",
    sideA: "Side A text",
    sideB: "Side B text",
    escalationLevel: 1,
    recommendedRung: "rung1_gentle_mirror",
    createdAt: "2026-01-01T00:00:00Z",
    lastTouchedAt: "2026-02-01T00:00:00Z",
    lastEvidenceAt: null,
    evidenceCount: 0,
    snoozedUntil: null,
    evidence: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null on 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 401, ok: false });
    const result = await fetchContradictionById("node_1", mockFetch as unknown as typeof fetch);
    expect(result).toBeNull();
  });

  it("returns null on 403", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 403, ok: false });
    const result = await fetchContradictionById("node_1", mockFetch as unknown as typeof fetch);
    expect(result).toBeNull();
  });

  it("throws on non-OK status other than 401/403", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 500, ok: false });
    await expect(
      fetchContradictionById("node_1", mockFetch as unknown as typeof fetch)
    ).rejects.toThrow("Failed to fetch contradiction: 500");
  });

  it("returns parsed detail on 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockDetail,
    });
    const result = await fetchContradictionById("node_1", mockFetch as unknown as typeof fetch);
    expect(result).toEqual(mockDetail);
  });

  it("calls the correct URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockDetail,
    });
    await fetchContradictionById("abc123", mockFetch as unknown as typeof fetch);
    expect(mockFetch).toHaveBeenCalledWith("/api/contradiction/abc123", {
      method: "GET",
      cache: "no-store",
    });
  });
});

describe("fetchContradictions pagination", () => {
  const makeItem = (id: string, weight = 0) => ({
    id,
    title: `Contradiction ${id}`,
    sideA: "A",
    sideB: "B",
    type: "value_conflict",
    status: "open",
    weight,
    escalationLevel: 0,
    recommendedRung: null,
    lastEvidenceAt: null,
    lastTouchedAt: "2026-02-01T00:00:00Z",
    lastEscalatedAt: null,
    snoozedUntil: null,
  });

  const makePageResponse = (items: ReturnType<typeof makeItem>[], page = 1, limit = 20) => ({
    status: 200,
    ok: true,
    json: async () => ({ items, page, limit, hasMore: items.length === limit }),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("appends page and limit query params to the URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makePageResponse([]));
    await fetchContradictions("open", { page: 2, limit: 5 }, mockFetch as unknown as typeof fetch);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/contradiction?status=open&page=2&limit=5",
      { method: "GET", cache: "no-store" }
    );
  });

  it("uses defaults of page=1 and limit=20 when opts omitted", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makePageResponse([]));
    await fetchContradictions("open", {}, mockFetch as unknown as typeof fetch);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/contradiction?status=open&page=1&limit=20",
      { method: "GET", cache: "no-store" }
    );
  });

  it("unwraps items from paginated response envelope", async () => {
    const items = [makeItem("a", 5), makeItem("b", 3)];
    const mockFetch = vi.fn().mockResolvedValue(makePageResponse(items));
    const result = await fetchContradictions("open", {}, mockFetch as unknown as typeof fetch);
    expect(result).toHaveLength(2);
    expect(result![0].id).toBe("a");
    expect(result![1].id).toBe("b");
  });

  it("sorts results by weight desc then lastTouchedAt desc", async () => {
    const items = [
      { ...makeItem("low", 1), lastTouchedAt: "2026-02-01T00:00:00Z" },
      { ...makeItem("high", 10), lastTouchedAt: "2026-01-01T00:00:00Z" },
      { ...makeItem("mid", 5), lastTouchedAt: "2026-02-15T00:00:00Z" },
    ];
    const mockFetch = vi.fn().mockResolvedValue(makePageResponse(items));
    const result = await fetchContradictions("open", {}, mockFetch as unknown as typeof fetch);
    expect(result!.map((r) => r.id)).toEqual(["high", "mid", "low"]);
  });

  it("deduplicates items with same id across multiple status URLs", async () => {
    const shared = makeItem("shared", 5);
    const only_explored = makeItem("only_explored", 3);
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makePageResponse([shared])) // open
      .mockResolvedValueOnce(makePageResponse([shared, only_explored])) // explored
      .mockResolvedValueOnce(makePageResponse([])); // snoozed
    const result = await fetchContradictions(
      "activeish",
      {},
      mockFetch as unknown as typeof fetch
    );
    expect(result).toHaveLength(2);
    const ids = result!.map((r) => r.id);
    expect(ids).toContain("shared");
    expect(ids).toContain("only_explored");
  });

  it("returns null when any response returns 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 401, ok: false });
    const result = await fetchContradictions("open", {}, mockFetch as unknown as typeof fetch);
    expect(result).toBeNull();
  });

  it("throws when any response is non-OK and not 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 500, ok: false });
    await expect(
      fetchContradictions("open", {}, mockFetch as unknown as typeof fetch)
    ).rejects.toThrow("Failed to fetch contradictions");
  });
});
