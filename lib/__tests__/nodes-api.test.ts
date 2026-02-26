import { describe, expect, it, vi, beforeEach } from "vitest";

import { buildContradictionUrls, fetchContradictionById } from "../nodes-api";

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
