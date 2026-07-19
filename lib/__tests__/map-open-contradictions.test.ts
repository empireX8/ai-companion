import { describe, expect, it, vi } from "vitest";

import {
  fetchMapOpenContradictions,
  mapContradictionObjectId,
  toMapOpenContradictionItem,
} from "../map-open-contradictions";

describe("map open contradictions read contract", () => {
  it("maps only open rows and preserves raw id / evidence count", () => {
    expect(
      toMapOpenContradictionItem({
        id: "cn-1",
        title: "Tension",
        sideA: "Ship fast",
        sideB: "Stay careful",
        status: "open",
        confidence: "medium",
        evidenceCount: 2,
        lastTouchedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).toEqual({
      id: "cn-1",
      title: "Tension",
      sideA: "Ship fast",
      sideB: "Stay careful",
      status: "open",
      confidence: "medium",
      evidenceCount: 2,
      lastTouchedAt: "2026-07-01T00:00:00.000Z",
      sessionOrigin: null,
    });

    expect(
      toMapOpenContradictionItem({
        id: "cn-cand",
        title: "Candidate",
        sideA: "A",
        sideB: "B",
        status: "candidate",
        confidence: "low",
        evidenceCount: 0,
        lastTouchedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("fetches authenticated open list only and performs no mutation", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/contradiction?status=open&limit=50&page=1");
      expect(init?.method).toBe("GET");
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "cn-open",
              title: "Open tension",
              sideA: "A",
              sideB: "B",
              status: "open",
              confidence: "high",
              evidenceCount: 3,
              lastTouchedAt: "2026-07-01T00:00:00.000Z",
              sessionOrigin: "IMPORTED_ARCHIVE",
            },
            {
              id: "cn-skip",
              title: "Should never arrive",
              sideA: "A",
              sideB: "B",
              status: "candidate",
              confidence: "low",
              evidenceCount: 0,
              lastTouchedAt: "2026-07-01T00:00:00.000Z",
            },
          ],
          page: 1,
          limit: 50,
          hasMore: false,
        }),
        { status: 200 },
      );
    });

    const items = await fetchMapOpenContradictions(fetchImpl);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("cn-open");
    expect(mapContradictionObjectId(items[0]!.id)).toBe("contradiction-cn-open");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns empty on unauthorized without inventing rows", async () => {
    const fetchImpl = vi.fn(async () => new Response("Unauthorized", { status: 401 }));
    await expect(fetchMapOpenContradictions(fetchImpl)).resolves.toEqual([]);
  });
});
