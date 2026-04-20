/**
 * Timeline event/state link detection — deterministic, count-based only.
 *
 * Two rules only. No forecasts. No cycle claims. No confidence scores.
 * Every output is a direct summary of what the data shows.
 *
 * Rule A — Event → state proximity:
 *   For each check-in carrying event tags, scan forward up to 24 hours.
 *   Any state tag found in that window (including same check-in) counts as a
 *   proximity observation. Each (event, state) pair is counted at most once
 *   per source check-in to avoid inflation.
 *
 * Rule B — State transitions:
 *   Build a sub-sequence of check-ins that carry a state tag, ordered by time.
 *   For each adjacent pair in that sub-sequence within 48 hours, if the state
 *   changed, count the (from → to) transition.
 */

import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_STATE_LABELS,
  type QuickCheckInEventTag,
  type QuickCheckInStateTag,
  type QuickCheckInView,
} from "./quick-check-ins";

// ── Constants ─────────────────────────────────────────────────────────────────

export const EVENT_STATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
export const STATE_TRANSITION_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
export const MIN_LINK_COUNT = 2;
export const MAX_LINKS = 6;

// Require at least this many check-ins before attempting link detection.
// Below this, the window is too sparse to surface useful signals.
const MIN_CHECK_INS = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

export type EventStateLink = {
  kind: "event_state";
  eventTag: QuickCheckInEventTag;
  stateTag: QuickCheckInStateTag;
  count: number;
  lastSeenAt: string;
};

export type StateTransitionLink = {
  kind: "state_transition";
  fromState: QuickCheckInStateTag;
  toState: QuickCheckInStateTag;
  count: number;
  lastSeenAt: string;
};

export type TimelineLink = EventStateLink | StateTransitionLink;

export type TimelineLinksResult = {
  links: TimelineLink[];
};

// ── Rule A: event → state proximity ──────────────────────────────────────────

type LinkStat = {
  count: number;
  lastSeenAt: string;
};

function compareIsoDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function eventStateReadability(link: EventStateLink): number {
  return (
    QUICK_CHECK_IN_EVENT_LABELS[link.eventTag].length +
    QUICK_CHECK_IN_STATE_LABELS[link.stateTag].length
  );
}

function transitionReadability(link: StateTransitionLink): number {
  return (
    QUICK_CHECK_IN_STATE_LABELS[link.fromState].length +
    QUICK_CHECK_IN_STATE_LABELS[link.toState].length
  );
}

function linkStableKey(link: TimelineLink): string {
  return link.kind === "event_state"
    ? `event:${link.eventTag}:${link.stateTag}`
    : `transition:${link.fromState}:${link.toState}`;
}

function compareLinks(left: TimelineLink, right: TimelineLink): number {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  const recencyCompare = compareIsoDesc(left.lastSeenAt, right.lastSeenAt);
  if (recencyCompare !== 0) {
    return recencyCompare;
  }

  const readabilityCompare =
    (left.kind === "event_state"
      ? eventStateReadability(left)
      : transitionReadability(left)) -
    (right.kind === "event_state"
      ? eventStateReadability(right)
      : transitionReadability(right));
  if (readabilityCompare !== 0) {
    return readabilityCompare;
  }

  return linkStableKey(left).localeCompare(linkStableKey(right));
}

function computeEventStateLinks(
  sorted: QuickCheckInView[]
): EventStateLink[] {
  const stats = new Map<string, LinkStat>();

  for (let i = 0; i < sorted.length; i++) {
    const source = sorted[i]!;
    if (source.eventTags.length === 0) continue;

    const sourceMs = new Date(source.createdAt).getTime();
    const seenThisSource = new Map<string, string>();

    for (let j = i; j < sorted.length; j++) {
      const target = sorted[j]!;
      const targetMs = new Date(target.createdAt).getTime();
      if (targetMs - sourceMs > EVENT_STATE_WINDOW_MS) break;
      if (!target.stateTag) continue;

      for (const eventTag of source.eventTags) {
        const key = `${eventTag}:${target.stateTag}`;
        const seenAt = seenThisSource.get(key);
        if (!seenAt || target.createdAt > seenAt) {
          seenThisSource.set(key, target.createdAt);
        }
      }
    }

    for (const [key, lastSeenAt] of seenThisSource.entries()) {
      const current = stats.get(key);
      stats.set(key, {
        count: (current?.count ?? 0) + 1,
        lastSeenAt:
          current && compareIsoDesc(current.lastSeenAt, lastSeenAt) < 0
            ? current.lastSeenAt
            : lastSeenAt,
      });
    }
  }

  return [...stats.entries()]
    .filter(([, stat]) => stat.count >= MIN_LINK_COUNT)
    .map(([key, stat]) => {
      const colonIdx = key.indexOf(":");
      const eventTag = key.slice(0, colonIdx) as QuickCheckInEventTag;
      const stateTag = key.slice(colonIdx + 1) as QuickCheckInStateTag;
      return {
        kind: "event_state" as const,
        eventTag,
        stateTag,
        count: stat.count,
        lastSeenAt: stat.lastSeenAt,
      };
    })
    .sort(compareLinks);
}

// ── Rule B: state transitions ─────────────────────────────────────────────────

function computeStateTransitionLinks(
  sorted: QuickCheckInView[]
): StateTransitionLink[] {
  const withState = sorted.filter((ci) => ci.stateTag !== null);
  const stats = new Map<string, LinkStat>();

  for (let i = 0; i < withState.length - 1; i++) {
    const a = withState[i]!;
    const b = withState[i + 1]!;

    const aMs = new Date(a.createdAt).getTime();
    const bMs = new Date(b.createdAt).getTime();

    if (bMs - aMs > STATE_TRANSITION_WINDOW_MS) continue;
    if (a.stateTag === b.stateTag) continue;

    const key = `${a.stateTag}→${b.stateTag}`;
    const current = stats.get(key);
    stats.set(key, {
      count: (current?.count ?? 0) + 1,
      lastSeenAt:
        current && compareIsoDesc(current.lastSeenAt, b.createdAt) < 0
          ? current.lastSeenAt
          : b.createdAt,
    });
  }

  return [...stats.entries()]
    .filter(([, stat]) => stat.count >= MIN_LINK_COUNT)
    .map(([key, stat]) => {
      const arrowIdx = key.indexOf("→");
      const fromState = key.slice(0, arrowIdx) as QuickCheckInStateTag;
      const toState = key.slice(arrowIdx + 1) as QuickCheckInStateTag;
      return {
        kind: "state_transition" as const,
        fromState,
        toState,
        count: stat.count,
        lastSeenAt: stat.lastSeenAt,
      };
    })
    .sort(compareLinks);
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Compute event/state links from a set of check-ins.
 *
 * - Returns empty when the window has fewer than MIN_CHECK_INS entries.
 * - Results are sorted by count, then recency, then readability.
 * - Input order does not matter; the function sorts internally by time.
 */
export function computeTimelineLinks(
  checkIns: QuickCheckInView[]
): TimelineLinksResult {
  if (checkIns.length < MIN_CHECK_INS) {
    return { links: [] };
  }

  const sorted = [...checkIns].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const eventStateLinks = computeEventStateLinks(sorted);
  const transitionLinks = computeStateTransitionLinks(sorted);

  const links: TimelineLink[] = [...eventStateLinks, ...transitionLinks]
    .sort(compareLinks)
    .slice(0, MAX_LINKS);

  return { links };
}
