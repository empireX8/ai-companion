/**
 * Timeline links unit tests
 *
 * Tests the two deterministic rules:
 *   Rule A — event → state proximity (24h window)
 *   Rule B — state transitions between adjacent state check-ins (48h window)
 */

import { describe, expect, it } from "vitest";
import type { QuickCheckInView } from "../quick-check-ins";
import {
  computeTimelineLinks,
  MAX_LINKS,
  MIN_LINK_COUNT,
} from "../timeline-links";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCI(
  id: string,
  createdAt: string,
  stateTag: QuickCheckInView["stateTag"] = null,
  eventTags: QuickCheckInView["eventTags"] = []
): QuickCheckInView {
  return { id, stateTag, eventTags, note: null, createdAt, updatedAt: createdAt };
}

// Fixed base time and offsets
const BASE = new Date("2024-04-10T09:00:00.000Z");

function at(offsetMs: number): string {
  return new Date(BASE.getTime() + offsetMs).toISOString();
}

const T0 = at(0);
const T1h = at(1 * 60 * 60 * 1000);
const T6h = at(6 * 60 * 60 * 1000);
const T23h = at(23 * 60 * 60 * 1000);
const T25h = at(25 * 60 * 60 * 1000); // just outside 24h
const T47h = at(47 * 60 * 60 * 1000);
const T49h = at(49 * 60 * 60 * 1000); // just outside 48h
const T72h = at(72 * 60 * 60 * 1000);
const T120h = at(120 * 60 * 60 * 1000);

// ── Minimum threshold ─────────────────────────────────────────────────────────

describe("computeTimelineLinks — minimum threshold", () => {
  it("returns empty links for 0 check-ins", () => {
    expect(computeTimelineLinks([])).toEqual({ links: [] });
  });

  it("returns empty links for 1 check-in", () => {
    const items = [makeCI("1", T0, "stressed", ["pressure"])];
    expect(computeTimelineLinks(items)).toEqual({ links: [] });
  });

  it("returns empty links for 2 check-ins", () => {
    const items = [
      makeCI("1", T0, "stressed", ["pressure"]),
      makeCI("2", T1h, "overloaded"),
    ];
    expect(computeTimelineLinks(items)).toEqual({ links: [] });
  });

  it("processes with 3+ check-ins", () => {
    const items = [
      makeCI("1", T0, "stressed", ["pressure"]),
      makeCI("2", T1h, "stressed", ["pressure"]),
      makeCI("3", T6h, "stressed", ["pressure"]),
    ];
    const { links } = computeTimelineLinks(items);
    // has enough check-ins to compute — may or may not produce links
    expect(Array.isArray(links)).toBe(true);
  });
});

// ── Rule A: event → state proximity ──────────────────────────────────────────

describe("computeTimelineLinks — Rule A: event → state proximity", () => {
  it("counts same-check-in event+state co-occurrence", () => {
    const items = [
      makeCI("1", T0, "overloaded", ["pressure"]),
      makeCI("2", T1h, "overloaded", ["pressure"]),
      makeCI("3", T6h),
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "pressure" && l.stateTag === "overloaded"
    );
    expect(link).toBeDefined();
    expect(link!.count).toBeGreaterThanOrEqual(MIN_LINK_COUNT);
  });

  it("counts cross-entry event → state within 24h window", () => {
    const items = [
      makeCI("1", T0, null, ["pressure"]),  // event only
      makeCI("2", T1h, "overloaded"),       // state nearby
      makeCI("3", T6h, null, ["pressure"]), // event only
      makeCI("4", T23h, "overloaded"),      // state within 24h of T6h
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "pressure" && l.stateTag === "overloaded"
    );
    expect(link).toBeDefined();
    expect(link!.count).toBeGreaterThanOrEqual(MIN_LINK_COUNT);
  });

  it("does not count event → state beyond 24h window", () => {
    const items = [
      makeCI("1", T0, null, ["pressure"]),
      makeCI("2", T25h, "overloaded"), // just outside 24h
      makeCI("3", T72h, null, ["pressure"]),
      makeCI("4", at(T25h.length + 1), "overloaded"),
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "pressure" && l.stateTag === "overloaded"
    );
    expect(link).toBeUndefined();
  });

  it("requires at least MIN_LINK_COUNT occurrences", () => {
    // Only one source check-in with pressure near stable — should not surface
    const items = [
      makeCI("1", T0, null, ["pressure"]),
      makeCI("2", T1h, "stable"),
      makeCI("3", T72h), // filler to pass threshold
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "pressure" && l.stateTag === "stable"
    );
    expect(link).toBeUndefined();
  });

  it("counts each (event, state) pair at most once per source check-in", () => {
    // source has pressure; two nearby check-ins both show overloaded within 24h
    // → should count the pair only once for source check-in "1"
    const items = [
      makeCI("1", T0, null, ["pressure"]),
      makeCI("2", T1h, "overloaded"),
      makeCI("3", T6h, "overloaded"), // same state, same source window
      makeCI("4", T25h, null, ["pressure"]), // second source → total count = 2
      makeCI("5", at(25 * 60 * 60 * 1000 + 30 * 60 * 1000), "overloaded"),
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "pressure" && l.stateTag === "overloaded"
    );
    // count should be 2 (once for source 1, once for source 4), not 3
    expect(link?.count).toBe(2);
  });

  it("counts multiple event tags on the same source check-in independently", () => {
    const items = [
      makeCI("1", T0, null, ["pressure", "conflict"]),
      makeCI("2", T1h, "stressed"),
      makeCI("3", T6h, null, ["pressure", "conflict"]),
      makeCI("4", T23h, "stressed"),
      makeCI("5", T72h),
    ];
    const { links } = computeTimelineLinks(items);
    const pressureLink = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "pressure" && l.stateTag === "stressed"
    );
    const conflictLink = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "conflict" && l.stateTag === "stressed"
    );
    expect(pressureLink).toBeDefined();
    expect(conflictLink).toBeDefined();
  });
});

// ── Rule B: state transitions ─────────────────────────────────────────────────

describe("computeTimelineLinks — Rule B: state transitions", () => {
  it("counts adjacent state transitions within 48h", () => {
    // Repeated overloaded → flat transition
    const items = [
      makeCI("1", T0, "overloaded"),
      makeCI("2", T1h, "flat"),
      makeCI("3", T47h, "overloaded"),
      makeCI("4", at(47 * 60 * 60 * 1000 + 30 * 60 * 1000), "flat"),
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "state_transition" && l.fromState === "overloaded" && l.toState === "flat"
    );
    expect(link).toBeDefined();
    expect(link!.count).toBeGreaterThanOrEqual(MIN_LINK_COUNT);
  });

  it("does not count transitions beyond 48h", () => {
    const items = [
      makeCI("1", T0, "overloaded"),
      makeCI("2", T49h, "flat"), // just outside 48h
      makeCI("3", T72h, "overloaded"),
      makeCI("4", T120h, "flat"), // also outside 48h
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "state_transition" && l.fromState === "overloaded" && l.toState === "flat"
    );
    expect(link).toBeUndefined();
  });

  it("does not count transition when state stays the same", () => {
    const items = [
      makeCI("1", T0, "stable"),
      makeCI("2", T1h, "stable"),
      makeCI("3", T6h, "stable"),
      makeCI("4", T72h),
    ];
    const { links } = computeTimelineLinks(items);
    const selfTransition = links.find(
      (l) => l.kind === "state_transition" && l.fromState === "stable" && l.toState === "stable"
    );
    expect(selfTransition).toBeUndefined();
  });

  it("requires at least MIN_LINK_COUNT occurrences for transitions", () => {
    // Only one stressed → stable transition
    const items = [
      makeCI("1", T0, "stressed"),
      makeCI("2", T1h, "stable"),
      makeCI("3", T72h),
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "state_transition" && l.fromState === "stressed" && l.toState === "stable"
    );
    expect(link).toBeUndefined();
  });

  it("skips check-ins without state tags in the state sub-sequence", () => {
    // check-in without state between two state check-ins should be transparent
    const items = [
      makeCI("1", T0, "stressed"),
      makeCI("2", T1h),              // no state — invisible in sub-sequence
      makeCI("3", T6h, "stable"),    // adjacent to "1" in state sub-sequence
      makeCI("4", T47h, "stressed"),
      makeCI("5", T72h),             // no state
      makeCI("6", at(73 * 60 * 60 * 1000), "stable"),
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "state_transition" && l.fromState === "stressed" && l.toState === "stable"
    );
    expect(link).toBeDefined();
    expect(link!.count).toBeGreaterThanOrEqual(MIN_LINK_COUNT);
  });
});

// ── Caps, sorting, deduplication ─────────────────────────────────────────────

describe("computeTimelineLinks — caps and sorting", () => {
  it("caps results at MAX_LINKS", () => {
    // Create many distinct event → state pairs, each with count >= 2
    const items: QuickCheckInView[] = [];
    const eventTags = ["pressure", "conflict", "sleep_disrupted", "isolated"] as const;
    const stateTags = ["overloaded", "stressed", "flat", "stable", "energized"] as const;

    // Emit multiple pairs by spreading check-ins across many hours
    for (let i = 0; i < 4; i++) {
      items.push(makeCI(`e${i}a`, at(i * 5 * 60 * 60 * 1000), stateTags[i % 5], [eventTags[i % 4]]));
      items.push(makeCI(`e${i}b`, at(i * 5 * 60 * 60 * 1000 + 30 * 60 * 1000), stateTags[i % 5], [eventTags[i % 4]]));
      items.push(makeCI(`e${i}c`, at(i * 5 * 60 * 60 * 1000 + 60 * 60 * 1000), stateTags[i % 5], [eventTags[i % 4]]));
    }

    const { links } = computeTimelineLinks(items);
    expect(links.length).toBeLessThanOrEqual(MAX_LINKS);
  });

  it("sorts links by count descending", () => {
    // pressure → overloaded × 3, conflict → stressed × 2
    const items = [
      makeCI("1", T0, "overloaded", ["pressure"]),
      makeCI("2", T1h, "overloaded", ["pressure"]),
      makeCI("3", T6h, "overloaded", ["pressure"]),
      makeCI("4", T47h, "stressed", ["conflict"]),
      makeCI("5", T72h, "stressed", ["conflict"]),
    ];
    const { links } = computeTimelineLinks(items);
    for (let i = 0; i < links.length - 1; i++) {
      expect(links[i]!.count).toBeGreaterThanOrEqual(links[i + 1]!.count);
    }
  });

  it("breaks count ties by recency (newer first)", () => {
    const items = [
      makeCI("1", T0, "flat", ["conflict"]),
      makeCI("2", T1h, "flat", ["conflict"]),
      makeCI("3", T72h, "stressed", ["pressure"]),
      makeCI("4", at(73 * 60 * 60 * 1000), "stressed", ["pressure"]),
    ];

    const { links } = computeTimelineLinks(items);
    const eventStateLinks = links.filter((link) => link.kind === "event_state");

    const recentIdx = eventStateLinks.findIndex(
      (link) =>
        link.kind === "event_state" &&
        link.eventTag === "pressure" &&
        link.stateTag === "stressed"
    );
    const olderIdx = eventStateLinks.findIndex(
      (link) =>
        link.kind === "event_state" &&
        link.eventTag === "conflict" &&
        link.stateTag === "flat"
    );
    expect(recentIdx).toBeGreaterThanOrEqual(0);
    expect(olderIdx).toBeGreaterThanOrEqual(0);
    expect(recentIdx).toBeLessThan(olderIdx);
  });

  it("breaks remaining ties by readability", () => {
    const items = [
      makeCI("1", T0, "overloaded", ["pressure"]),
      makeCI("2", T1h, "overloaded", ["pressure"]),
      makeCI("3", T0, "stressed", ["conflict"]),
      makeCI("4", T1h, "stressed", ["conflict"]),
    ];

    const { links } = computeTimelineLinks(items);
    const eventStateLinks = links.filter((link) => link.kind === "event_state");

    const shorterIdx = eventStateLinks.findIndex(
      (link) =>
        link.kind === "event_state" &&
        link.eventTag === "conflict" &&
        link.stateTag === "stressed"
    );
    const longerIdx = eventStateLinks.findIndex(
      (link) =>
        link.kind === "event_state" &&
        link.eventTag === "pressure" &&
        link.stateTag === "overloaded"
    );
    expect(shorterIdx).toBeGreaterThanOrEqual(0);
    expect(longerIdx).toBeGreaterThanOrEqual(0);
    expect(shorterIdx).toBeLessThan(longerIdx);
  });

  it("handles input in any order (not required to be pre-sorted)", () => {
    // Pass check-ins in reverse chronological order — the function should sort internally
    const items = [
      makeCI("3", T6h, "overloaded", ["pressure"]),
      makeCI("2", T1h, "overloaded", ["pressure"]),
      makeCI("1", T0, null, ["pressure"]),
    ];
    const { links } = computeTimelineLinks(items);
    const link = links.find(
      (l) => l.kind === "event_state" && l.eventTag === "pressure" && l.stateTag === "overloaded"
    );
    // T0 (pressure only) → T1h (overloaded, pressure) within 24h → count ≥ 1
    // T1h (pressure + overloaded) → T6h (overloaded, pressure) within 24h → count ≥ 1
    // net: count should reach 2 across the source check-ins
    expect(link).toBeDefined();
  });

  it("returns empty links when no pair meets MIN_LINK_COUNT", () => {
    // Each pair appears exactly once
    const items = [
      makeCI("1", T0, null, ["pressure"]),
      makeCI("2", T1h, "stable"),
      makeCI("3", T6h, null, ["conflict"]),
      makeCI("4", T23h, "energized"),
    ];
    const { links } = computeTimelineLinks(items);
    expect(links).toHaveLength(0);
  });
});
