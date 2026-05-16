import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_STATE_LABELS,
  type QuickCheckInStateTag,
  type QuickCheckInView,
} from "./quick-check-ins";
import { type TimelineStateSummary } from "./timeline-aggregation";

export type TimelineImportedActivityItem = {
  id: string;
  startedAt: string;
  label: string | null;
  preview: string | null;
  messageCount: number;
};

export type TimelineAppActivityItem = TimelineImportedActivityItem & {
  surfaceType?: string | null;
};

export type TimelineJournalEntryItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  authoredAt: string | null;
  title: string | null;
  preview: string;
  bodyLength: number;
};

export type TimelineResponse = {
  checkIns: QuickCheckInView[];
  importedActivity: TimelineImportedActivityItem[];
  stateSummary: TimelineStateSummary;
  appActivity?: TimelineAppActivityItem[];
  journalEntries?: TimelineJournalEntryItem[];
};

export type TimelineEntry = {
  id: string;
  occurredAt: string;
  chip: "Check-in" | "Journal" | "Journal Chat" | "Explore" | "Imported";
  title: string;
  body: string | null;
  href: string | null;
  weight?: "low";
};

const STATE_DISPLAY_LABELS: Record<QuickCheckInStateTag, string> = {
  stable: "Calm",
  stressed: "Anxious",
  overloaded: "Overwhelmed",
  flat: "Numb",
  energized: "Energized",
};

export const MIN_CHECK_INS_FOR_RHYTHM = 3;

function stateLabel(stateTag: QuickCheckInStateTag | null): string {
  if (!stateTag) {
    return "Check-in";
  }

  return STATE_DISPLAY_LABELS[stateTag] ?? QUICK_CHECK_IN_STATE_LABELS[stateTag];
}

function toLibraryHref(prefix: string, sourceId: string | null | undefined): string | null {
  const normalizedId = typeof sourceId === "string" ? sourceId.trim() : "";
  if (!normalizedId) {
    return null;
  }

  return `/library/${prefix}-${normalizedId}`;
}

export function mapTimelineEntries(payload: TimelineResponse): TimelineEntry[] {
  const checkInEntries: TimelineEntry[] = payload.checkIns.map((checkIn) => {
    const eventLabel =
      checkIn.eventTags.length > 0
        ? checkIn.eventTags
            .map((eventTag) => QUICK_CHECK_IN_EVENT_LABELS[eventTag])
            .join(", ")
        : null;

    return {
      id: checkIn.id,
      occurredAt: checkIn.createdAt,
      chip: "Check-in",
      title: `Check-in · ${stateLabel(checkIn.stateTag)}`,
      body: checkIn.note ?? eventLabel,
      href: toLibraryHref("checkin", checkIn.id),
      weight: checkIn.note ? undefined : "low",
    };
  });

  const journalEntries: TimelineEntry[] = (payload.journalEntries ?? []).map(
    (entry) => ({
      id: entry.id,
      occurredAt: entry.authoredAt ?? entry.createdAt,
      chip: "Journal",
      title: entry.title ?? "Journal entry",
      body: entry.preview,
      href: toLibraryHref("journal", entry.id),
    })
  );

  const appEntries: TimelineEntry[] = (payload.appActivity ?? []).map((entry) => ({
    id: entry.id,
    occurredAt: entry.startedAt,
    chip: entry.surfaceType === "explore_chat" ? "Explore" : "Journal Chat",
    title:
      entry.label ??
      (entry.surfaceType === "explore_chat"
        ? "Explore session"
        : "Journal chat"),
    body: entry.preview,
    href:
      entry.surfaceType === "explore_chat"
        ? toLibraryHref("explore", entry.id)
        : toLibraryHref("jchat", entry.id),
  }));

  const importedEntries: TimelineEntry[] = payload.importedActivity.map((entry) => ({
    id: entry.id,
    occurredAt: entry.startedAt,
    chip: "Imported",
    title: entry.label ?? "Imported conversation",
    body: entry.preview,
    href: toLibraryHref("media", entry.id),
    weight: "low",
  }));

  return [...checkInEntries, ...journalEntries, ...appEntries, ...importedEntries].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  );
}

export function hasEnoughCheckInsForRhythm(totalCheckIns: number): boolean {
  return totalCheckIns >= MIN_CHECK_INS_FOR_RHYTHM;
}

export function buildTimelineRequestUrl(windowValue: string): string {
  const windowParam = encodeURIComponent(windowValue);
  return `/api/timeline?window=${windowParam}&includeAppActivity=true&includeJournalEntries=true`;
}
