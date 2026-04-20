/**
 * Timeline aggregation unit tests
 */

import { describe, expect, it } from "vitest";
import type { QuickCheckInView } from "../quick-check-ins";
import {
  computeImportedConversationSummary,
  getWindowStartDate,
  computeRhythms,
  computeRepeatedSignals,
  groupCheckInsByDate,
  groupImportedConversationActivityByDate,
  resolveTimelineWindow,
  resolveTimelineWindowSearchParam,
  MAX_RANKED_REPEATED_ITEMS,
  type ImportedConversationActivityItem,
} from "../timeline-aggregation";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCheckIn(
  overrides: Partial<QuickCheckInView> & { createdAt: string }
): QuickCheckInView {
  return {
    id: overrides.id ?? "id-1",
    stateTag: overrides.stateTag ?? null,
    eventTags: overrides.eventTags ?? [],
    note: overrides.note ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
  };
}

function makeImportedActivity(
  overrides: Partial<ImportedConversationActivityItem> & { startedAt: string }
): ImportedConversationActivityItem {
  return {
    id: overrides.id ?? "session-1",
    startedAt: overrides.startedAt,
    label: overrides.label ?? null,
    preview: overrides.preview ?? null,
    messageCount: overrides.messageCount ?? 0,
  };
}

// ── getWindowStartDate ─────────────────────────────────────────────────────────

describe("getWindowStartDate", () => {
  const now = new Date("2024-04-17T15:30:00.000Z");

  it("returns UTC midnight 14 days back for 14d window", () => {
    const result = getWindowStartDate("14d", now);
    expect(result.toISOString()).toBe("2024-04-03T00:00:00.000Z");
  });

  it("returns UTC midnight 30 days back for 30d window", () => {
    const result = getWindowStartDate("30d", now);
    expect(result.toISOString()).toBe("2024-03-18T00:00:00.000Z");
  });

  it("returns UTC midnight 90 days back for 90d window", () => {
    const result = getWindowStartDate("90d", now);
    expect(result.toISOString()).toBe("2024-01-18T00:00:00.000Z");
  });

  it("truncates time to midnight UTC", () => {
    const result = getWindowStartDate("30d", now);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("does not mutate the input date", () => {
    const nowCopy = new Date(now.getTime());
    getWindowStartDate("30d", now);
    expect(now.getTime()).toBe(nowCopy.getTime());
  });
});

describe("resolveTimelineWindow", () => {
  it("returns a valid timeline window as-is", () => {
    expect(resolveTimelineWindow("90d")).toBe("90d");
  });

  it("falls back to the default window for invalid input", () => {
    expect(resolveTimelineWindow("365d")).toBe("30d");
  });

  it("falls back to the default window when input is missing", () => {
    expect(resolveTimelineWindow(undefined)).toBe("30d");
  });
});

describe("resolveTimelineWindowSearchParam", () => {
  it("accepts a string search param value", () => {
    expect(resolveTimelineWindowSearchParam("90d")).toBe("90d");
  });

  it("falls back to the default window for repeated query values", () => {
    expect(resolveTimelineWindowSearchParam(["90d", "30d"])).toBe("30d");
  });
});

// ── computeRhythms ─────────────────────────────────────────────────────────────

describe("computeRhythms", () => {
  it("returns empty rhythms for empty input", () => {
    const result = computeRhythms([]);
    expect(result).toEqual({
      totalCount: 0,
      topStateTags: [],
      topEventTags: [],
      lastCheckInAt: null,
    });
  });

  it("counts totalCount correctly", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stable" }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed" }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z" }),
    ];
    expect(computeRhythms(items).totalCount).toBe(3);
  });

  it("returns top state tags sorted by count descending", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed" }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stable" }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "stressed" }),
      makeCheckIn({ id: "4", createdAt: "2024-04-14T10:00:00Z", stateTag: "stable" }),
      makeCheckIn({ id: "5", createdAt: "2024-04-13T10:00:00Z", stateTag: "stable" }),
    ];
    const { topStateTags } = computeRhythms(items);
    expect(topStateTags[0]).toEqual({ tag: "stable", count: 3 });
    expect(topStateTags[1]).toEqual({ tag: "stressed", count: 2 });
  });

  it("caps top state tags at 3", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "energized" }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stable" }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "flat" }),
      makeCheckIn({ id: "4", createdAt: "2024-04-14T10:00:00Z", stateTag: "stressed" }),
      makeCheckIn({ id: "5", createdAt: "2024-04-13T10:00:00Z", stateTag: "overloaded" }),
    ];
    expect(computeRhythms(items).topStateTags).toHaveLength(3);
  });

  it("counts event tags across multiple per check-in", () => {
    const items = [
      makeCheckIn({
        id: "1",
        createdAt: "2024-04-17T10:00:00Z",
        eventTags: ["sleep_disrupted", "pressure"],
      }),
      makeCheckIn({
        id: "2",
        createdAt: "2024-04-16T10:00:00Z",
        eventTags: ["pressure", "conflict"],
      }),
    ];
    const { topEventTags } = computeRhythms(items);
    expect(topEventTags[0]).toEqual({ tag: "pressure", count: 2 });
    expect(topEventTags).toHaveLength(3); // sleep_disrupted, pressure, conflict
  });

  it("caps top event tags at 3", () => {
    const items = [
      makeCheckIn({
        id: "1",
        createdAt: "2024-04-17T10:00:00Z",
        eventTags: ["sleep_disrupted", "pressure", "conflict", "isolated"],
      }),
    ];
    expect(computeRhythms(items).topEventTags).toHaveLength(3);
  });

  it("sets lastCheckInAt to the first item's createdAt", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z" }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z" }),
    ];
    expect(computeRhythms(items).lastCheckInAt).toBe("2024-04-17T10:00:00Z");
  });

  it("skips null stateTags in count", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: null }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stable" }),
    ];
    const { topStateTags } = computeRhythms(items);
    expect(topStateTags).toHaveLength(1);
    expect(topStateTags[0]).toEqual({ tag: "stable", count: 1 });
  });
});

// ── computeRepeatedSignals ─────────────────────────────────────────────────────

describe("computeRepeatedSignals", () => {
  it("returns empty for empty input", () => {
    const result = computeRepeatedSignals([]);
    expect(result.repeatedStateTags).toEqual([]);
    expect(result.repeatedEventTags).toEqual([]);
    expect(result.rankedItems).toEqual([]);
  });

  it("excludes tags that appear only once", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stable", eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["conflict"] }),
    ];
    const result = computeRepeatedSignals(items);
    expect(result.repeatedStateTags).toHaveLength(0);
    expect(result.repeatedEventTags).toHaveLength(0);
  });

  it("includes tags that appear at least twice", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
    ];
    const result = computeRepeatedSignals(items);
    expect(result.repeatedStateTags).toEqual([{ tag: "stressed", count: 2 }]);
    expect(result.repeatedEventTags).toEqual([{ tag: "pressure", count: 2 }]);
  });

  it("excludes count=1 even when other tags repeat", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stable", eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stable", eventTags: ["conflict"] }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
    ];
    const result = computeRepeatedSignals(items);
    expect(result.repeatedStateTags).toEqual([{ tag: "stable", count: 2 }]);
    expect(result.repeatedEventTags).toEqual([{ tag: "pressure", count: 2 }]);
  });

  it("returns empty repeatedPairs for empty input", () => {
    expect(computeRepeatedSignals([]).repeatedPairs).toEqual([]);
  });

  it("counts state+event pairs", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
    ];
    const { repeatedPairs } = computeRepeatedSignals(items);
    expect(repeatedPairs).toHaveLength(1);
    expect(repeatedPairs[0]).toEqual({ stateTag: "stressed", eventTag: "pressure", count: 2 });
  });

  it("excludes pairs with count < 2", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stable", eventTags: ["social"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stable", eventTags: ["productive"] }),
    ];
    expect(computeRepeatedSignals(items).repeatedPairs).toHaveLength(0);
  });

  it("skips check-ins with no stateTag for pair counting", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: null, eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: null, eventTags: ["pressure"] }),
    ];
    expect(computeRepeatedSignals(items).repeatedPairs).toHaveLength(0);
  });

  it("skips check-ins with no eventTags for pair counting", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: [] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: [] }),
    ];
    expect(computeRepeatedSignals(items).repeatedPairs).toHaveLength(0);
  });

  it("caps pairs at 5", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: ["pressure", "conflict", "sleep_disrupted", "isolated"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["pressure", "conflict", "sleep_disrupted", "isolated"] }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "overloaded", eventTags: ["pressure"] }),
      makeCheckIn({ id: "4", createdAt: "2024-04-14T10:00:00Z", stateTag: "overloaded", eventTags: ["pressure"] }),
    ];
    expect(computeRepeatedSignals(items).repeatedPairs.length).toBeLessThanOrEqual(5);
  });

  it("sorts pairs by count descending", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "4", createdAt: "2024-04-14T10:00:00Z", stateTag: "stable", eventTags: ["recovery"] }),
      makeCheckIn({ id: "5", createdAt: "2024-04-13T10:00:00Z", stateTag: "stable", eventTags: ["recovery"] }),
    ];
    const { repeatedPairs } = computeRepeatedSignals(items);
    expect(repeatedPairs[0]!.count).toBeGreaterThanOrEqual(repeatedPairs[1]!.count);
  });
});

// ── computeRepeatedSignals — rankedItems ─────────────────────────────────────

describe("computeRepeatedSignals — rankedItems", () => {
  it("is sorted by count descending across all kinds", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "4", createdAt: "2024-04-14T10:00:00Z", stateTag: "flat" }),
      makeCheckIn({ id: "5", createdAt: "2024-04-13T10:00:00Z", stateTag: "flat" }),
    ];
    const { rankedItems } = computeRepeatedSignals(items);
    for (let i = 0; i < rankedItems.length - 1; i++) {
      expect(rankedItems[i]!.count).toBeGreaterThanOrEqual(rankedItems[i + 1]!.count);
    }
  });

  it("a pair with higher count ranks before a single-kind item with lower count", () => {
    const items = [
      // pair(stressed+pressure) × 3
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "stressed", eventTags: ["pressure"] }),
      // state(flat) × 2 only, older
      makeCheckIn({ id: "4", createdAt: "2024-04-12T10:00:00Z", stateTag: "flat" }),
      makeCheckIn({ id: "5", createdAt: "2024-04-11T10:00:00Z", stateTag: "flat" }),
    ];
    const { rankedItems } = computeRepeatedSignals(items);
    const pairIdx = rankedItems.findIndex((item) => item.kind === "pair");
    const flatIdx = rankedItems.findIndex((item) => item.kind === "state" && item.tag === "flat");
    expect(pairIdx).toBeGreaterThanOrEqual(0);
    expect(flatIdx).toBeGreaterThanOrEqual(0);
    expect(pairIdx).toBeLessThan(flatIdx);
  });

  it("caps rankedItems at MAX_RANKED_REPEATED_ITEMS", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: "2024-04-17T10:00:00Z", stateTag: "stressed", eventTags: ["pressure", "conflict", "sleep_disrupted", "isolated"] }),
      makeCheckIn({ id: "2", createdAt: "2024-04-16T10:00:00Z", stateTag: "stressed", eventTags: ["pressure", "conflict", "sleep_disrupted", "isolated"] }),
      makeCheckIn({ id: "3", createdAt: "2024-04-15T10:00:00Z", stateTag: "overloaded", eventTags: ["pressure", "conflict"] }),
      makeCheckIn({ id: "4", createdAt: "2024-04-14T10:00:00Z", stateTag: "overloaded", eventTags: ["pressure", "conflict"] }),
    ];
    const { rankedItems } = computeRepeatedSignals(items);
    expect(rankedItems.length).toBeLessThanOrEqual(MAX_RANKED_REPEATED_ITEMS);
  });

  it("prefers simple repeated tags over pair rows on equal count/recency ties", () => {
    const items = [
      makeCheckIn({
        id: "1",
        createdAt: "2024-04-17T10:00:00Z",
        stateTag: "stressed",
        eventTags: ["pressure"],
      }),
      makeCheckIn({
        id: "2",
        createdAt: "2024-04-16T10:00:00Z",
        stateTag: "stressed",
        eventTags: ["pressure"],
      }),
    ];

    const { rankedItems } = computeRepeatedSignals(items);
    const pairIdx = rankedItems.findIndex((item) => item.kind === "pair");
    const stateIdx = rankedItems.findIndex(
      (item) => item.kind === "state" && item.tag === "stressed"
    );
    const eventIdx = rankedItems.findIndex(
      (item) => item.kind === "event" && item.tag === "pressure"
    );

    expect(pairIdx).toBeGreaterThan(stateIdx);
    expect(pairIdx).toBeGreaterThan(eventIdx);
  });
});

// ── computeImportedConversationSummary ────────────────────────────────────────

describe("computeImportedConversationSummary", () => {
  it("returns empty summary for empty input", () => {
    expect(computeImportedConversationSummary([])).toEqual({
      activeDayCount: 0,
      sessionCount: 0,
      messageCount: 0,
      lastActivityAt: null,
    });
  });

  it("counts active days, sessions, and messages", () => {
    const items = [
      makeImportedActivity({
        id: "s1",
        startedAt: new Date("2024-04-17T10:00:00").toISOString(),
        messageCount: 4,
      }),
      makeImportedActivity({
        id: "s2",
        startedAt: new Date("2024-04-17T18:00:00").toISOString(),
        messageCount: 6,
      }),
      makeImportedActivity({
        id: "s3",
        startedAt: new Date("2024-04-16T09:00:00").toISOString(),
        messageCount: 3,
      }),
    ];

    expect(computeImportedConversationSummary(items)).toEqual({
      activeDayCount: 2,
      sessionCount: 3,
      messageCount: 13,
      lastActivityAt: new Date("2024-04-17T18:00:00").toISOString(),
    });
  });
});

// ── groupCheckInsByDate ────────────────────────────────────────────────────────

describe("groupCheckInsByDate", () => {
  const now = new Date("2024-04-17T15:00:00"); // local interpretation

  it("returns empty array for empty input", () => {
    expect(groupCheckInsByDate([], now)).toEqual([]);
  });

  it("groups check-ins by local date", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: new Date("2024-04-17T10:00:00").toISOString() }),
      makeCheckIn({ id: "2", createdAt: new Date("2024-04-17T08:00:00").toISOString() }),
      makeCheckIn({ id: "3", createdAt: new Date("2024-04-16T20:00:00").toISOString() }),
    ];
    const groups = groupCheckInsByDate(items, now);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.items).toHaveLength(2);
    expect(groups[1]!.items).toHaveLength(1);
  });

  it("returns newest group first", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: new Date("2024-04-15T10:00:00").toISOString() }),
      makeCheckIn({ id: "2", createdAt: new Date("2024-04-17T10:00:00").toISOString() }),
      makeCheckIn({ id: "3", createdAt: new Date("2024-04-16T10:00:00").toISOString() }),
    ];
    const groups = groupCheckInsByDate(items, now);
    expect(groups[0]!.dateKey > groups[1]!.dateKey).toBe(true);
    expect(groups[1]!.dateKey > groups[2]!.dateKey).toBe(true);
  });

  it("labels today's group as 'Today'", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: new Date("2024-04-17T10:00:00").toISOString() }),
    ];
    const groups = groupCheckInsByDate(items, now);
    const todayGroup = groups.find((g) => g.label === "Today");
    expect(todayGroup).toBeDefined();
  });

  it("labels yesterday's group as 'Yesterday'", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: new Date("2024-04-16T10:00:00").toISOString() }),
    ];
    const groups = groupCheckInsByDate(items, now);
    const yesterdayGroup = groups.find((g) => g.label === "Yesterday");
    expect(yesterdayGroup).toBeDefined();
  });

  it("labels older dates with month+day format", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: new Date("2024-04-10T10:00:00").toISOString() }),
    ];
    const groups = groupCheckInsByDate(items, now);
    expect(groups[0]!.label).not.toBe("Today");
    expect(groups[0]!.label).not.toBe("Yesterday");
    expect(groups[0]!.label.length).toBeGreaterThan(0);
  });

  it("preserves original item order within a group", () => {
    const items = [
      makeCheckIn({ id: "a", createdAt: new Date("2024-04-17T14:00:00").toISOString() }),
      makeCheckIn({ id: "b", createdAt: new Date("2024-04-17T10:00:00").toISOString() }),
    ];
    const groups = groupCheckInsByDate(items, now);
    expect(groups[0]!.items[0]!.id).toBe("a");
    expect(groups[0]!.items[1]!.id).toBe("b");
  });

  it("includes dateKey in YYYY-MM-DD format", () => {
    const items = [
      makeCheckIn({ id: "1", createdAt: new Date("2024-04-17T10:00:00").toISOString() }),
    ];
    const groups = groupCheckInsByDate(items, now);
    expect(groups[0]!.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── groupImportedConversationActivityByDate ──────────────────────────────────

describe("groupImportedConversationActivityByDate", () => {
  const now = new Date("2024-04-17T15:00:00");

  it("returns empty array for empty input", () => {
    expect(groupImportedConversationActivityByDate([], now)).toEqual([]);
  });

  it("groups imported sessions by local date", () => {
    const items = [
      makeImportedActivity({
        id: "s1",
        startedAt: new Date("2024-04-17T10:00:00").toISOString(),
        messageCount: 4,
      }),
      makeImportedActivity({
        id: "s2",
        startedAt: new Date("2024-04-17T08:00:00").toISOString(),
        messageCount: 3,
      }),
      makeImportedActivity({
        id: "s3",
        startedAt: new Date("2024-04-16T20:00:00").toISOString(),
        messageCount: 5,
      }),
    ];

    const groups = groupImportedConversationActivityByDate(items, now);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.sessionCount).toBe(2);
    expect(groups[0]!.messageCount).toBe(7);
    expect(groups[1]!.sessionCount).toBe(1);
    expect(groups[1]!.messageCount).toBe(5);
  });

  it("labels today and yesterday correctly", () => {
    const items = [
      makeImportedActivity({
        id: "today",
        startedAt: new Date("2024-04-17T10:00:00").toISOString(),
      }),
      makeImportedActivity({
        id: "yesterday",
        startedAt: new Date("2024-04-16T10:00:00").toISOString(),
      }),
    ];

    const groups = groupImportedConversationActivityByDate(items, now);
    expect(groups[0]!.label).toBe("Today");
    expect(groups[1]!.label).toBe("Yesterday");
  });

  it("preserves item order within a day group", () => {
    const items = [
      makeImportedActivity({
        id: "a",
        startedAt: new Date("2024-04-17T14:00:00").toISOString(),
      }),
      makeImportedActivity({
        id: "b",
        startedAt: new Date("2024-04-17T10:00:00").toISOString(),
      }),
    ];

    const groups = groupImportedConversationActivityByDate(items, now);
    expect(groups[0]!.items.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
