import { describe, expect, it, vi } from "vitest";

import { hydrateTodayProductionData } from "../orvek-v0/production/today-hydration";
import type { TodayReentrySnapshot } from "../today-reentry";
import type { ModelMovementDepthRecord } from "../model-movement-report-contract";

function emptySnapshot(): TodayReentrySnapshot {
  return {
    surfacingCards: [],
    intelligenceUpdates: [],
    userMapConclusions: [],
    watchForItems: [],
    investigations: [],
    actions: [],
    timelineMovements: [],
  };
}

function populatedSnapshot(): TodayReentrySnapshot {
  return {
    ...emptySnapshot(),
    intelligenceUpdates: [
      {
        id: "mu-live-1",
        updateTypeLabel: "Link Detected",
        affectedObjectType: "pattern_claim",
        affectedObjectTypeLabel: "Related pattern",
        affectedObjectId: "claim-1",
        affectedObjectHref: "/patterns/claim-1",
        userFacingSummary: "There is early evidence that energy drops after meetings.",
        createdAt: "2026-07-17T12:47:14.306Z",
      },
    ],
  };
}

function movementDepth(): ModelMovementDepthRecord[] {
  return [
    {
      id: "mu-live-1",
      before: "Pattern treated as tentative only.",
      after: "Energy drops after meetings without a stop point.",
      movementSummary: "There is early evidence that energy drops after meetings.",
      movementRationale:
        "Connects evening overwork to the missing stop point before commitments lock.",
      affectedObjectType: "pattern_claim",
      affectedObjectId: "claim-1",
      affectedObjectTypeLabel: "Related pattern",
      affectedObjectHref: "/patterns/claim-1",
      createdAt: "2026-07-17T12:47:14.306Z",
      evidenceLinkCount: 1,
      evidenceQuotes: ["I keep working past the stop point even when I said I would not."],
    },
  ];
}

describe("hydrateTodayProductionData", () => {
  it("retries when first boot returns an empty snapshot", async () => {
    const fetchSnapshot = vi
      .fn<() => Promise<TodayReentrySnapshot>>()
      .mockResolvedValueOnce(emptySnapshot())
      .mockResolvedValueOnce(populatedSnapshot());
    const fetchMovement = vi
      .fn<() => Promise<ModelMovementDepthRecord[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(movementDepth());
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    const result = await hydrateTodayProductionData({
      fetchSnapshot,
      fetchMovementDepth: fetchMovement,
      wait,
      maxAttempts: 3,
      delayMs: 10,
    });

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchMovement).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(result.snapshot.intelligenceUpdates).toHaveLength(1);
    expect(result.movementDepthById["mu-live-1"]?.after).toBe(
      "Energy drops after meetings without a stop point.",
    );
  });

  it("retries when movement depth is missing for a non-empty snapshot", async () => {
    const snapshot = populatedSnapshot();
    const fetchSnapshot = vi
      .fn<() => Promise<TodayReentrySnapshot>>()
      .mockResolvedValue(snapshot);
    const fetchMovement = vi
      .fn<() => Promise<ModelMovementDepthRecord[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(movementDepth());
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    const result = await hydrateTodayProductionData({
      fetchSnapshot,
      fetchMovementDepth: fetchMovement,
      wait,
      maxAttempts: 3,
      delayMs: 10,
    });

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchMovement).toHaveBeenCalledTimes(2);
    expect(result.snapshot.intelligenceUpdates[0]?.id).toBe("mu-live-1");
    expect(result.movementDepthById["mu-live-1"]?.movementRationale).toContain(
      "missing stop point",
    );
  });

  it("retries when depth arrives for a different row but not the latest surfaced movement", async () => {
    const snapshot = populatedSnapshot();
    const fetchSnapshot = vi
      .fn<() => Promise<TodayReentrySnapshot>>()
      .mockResolvedValue(snapshot);
    const fetchMovement = vi
      .fn<() => Promise<ModelMovementDepthRecord[]>>()
      .mockResolvedValueOnce([
        {
          ...movementDepth()[0]!,
          id: "mu-older",
        },
      ])
      .mockResolvedValueOnce(movementDepth());
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    const result = await hydrateTodayProductionData({
      fetchSnapshot,
      fetchMovementDepth: fetchMovement,
      wait,
      maxAttempts: 3,
      delayMs: 10,
    });

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchMovement).toHaveBeenCalledTimes(2);
    expect(result.movementDepthById["mu-live-1"]?.after).toBe(
      "Energy drops after meetings without a stop point.",
    );
  });

  it("returns the last empty snapshot after retries are exhausted", async () => {
    const fetchSnapshot = vi
      .fn<() => Promise<TodayReentrySnapshot>>()
      .mockResolvedValue(emptySnapshot());
    const fetchMovement = vi
      .fn<() => Promise<ModelMovementDepthRecord[]>>()
      .mockResolvedValue([]);
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    const result = await hydrateTodayProductionData({
      fetchSnapshot,
      fetchMovementDepth: fetchMovement,
      wait,
      maxAttempts: 2,
      delayMs: 10,
    });

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchMovement).toHaveBeenCalledTimes(2);
    expect(result.snapshot.intelligenceUpdates).toHaveLength(0);
    expect(Object.keys(result.movementDepthById)).toHaveLength(0);
  });
});
