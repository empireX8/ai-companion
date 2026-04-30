import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { resolveApiUserId } from "../../../lib/api-user-auth";
import { type SessionSurfaceTypeValue } from "../../../lib/session-surface-type";
import { toQuickCheckInView } from "../../../lib/quick-check-ins";
import {
  getWindowStartDate,
  resolveTimelineWindow,
  type ImportedConversationActivityItem,
} from "../../../lib/timeline-aggregation";

export const dynamic = "force-dynamic";

const TIMELINE_MAX_RESULTS = 200;

type TimelineSessionActivityRow = {
  id: string;
  label: string | null;
  startedAt: Date;
  messages: { content: string }[];
  _count: { messages: number };
};

type TimelineAppActivityRow = TimelineSessionActivityRow & {
  surfaceType: SessionSurfaceTypeValue | null;
};

type TimelineAppActivityItem = ImportedConversationActivityItem & {
  surfaceType: SessionSurfaceTypeValue;
};

type TimelineJournalEntryRow = {
  id: string;
  title: string | null;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TimelineJournalEntryItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  authoredAt: string | null;
  title: string | null;
  preview: string;
  bodyLength: number;
};

const JOURNAL_PREVIEW_MAX_LENGTH = 180;

function toTimelineSessionActivity(
  sessions: TimelineSessionActivityRow[]
): ImportedConversationActivityItem[] {
  return sessions.map((session) => ({
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    label: session.label,
    preview: session.messages[0]?.content ?? null,
    messageCount: session._count.messages,
  }));
}

function toTimelineAppActivity(
  sessions: TimelineAppActivityRow[]
): TimelineAppActivityItem[] {
  return sessions.map((session) => ({
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    label: session.label,
    preview: session.messages[0]?.content ?? null,
    messageCount: session._count.messages,
    surfaceType: session.surfaceType ?? "journal_chat",
  }));
}

function toJournalPreview(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= JOURNAL_PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, JOURNAL_PREVIEW_MAX_LENGTH - 3)}...`;
}

function getJournalTimelineSortTimestamp(entry: TimelineJournalEntryRow): number {
  return (entry.authoredAt ?? entry.createdAt).getTime();
}

function toTimelineJournalEntries(
  entries: TimelineJournalEntryRow[]
): TimelineJournalEntryItem[] {
  return [...entries]
    .sort((left, right) => {
      const sortDiff =
        getJournalTimelineSortTimestamp(right) -
        getJournalTimelineSortTimestamp(left);
      if (sortDiff !== 0) {
        return sortDiff;
      }

      const createdDiff = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }

      return right.id.localeCompare(left.id);
    })
    .slice(0, TIMELINE_MAX_RESULTS)
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      authoredAt: entry.authoredAt ? entry.authoredAt.toISOString() : null,
      title: entry.title,
      preview: toJournalPreview(entry.body),
      bodyLength: entry.body.length,
    }));
}

function shouldIncludeTimelineOptionalField(value: string | null): boolean {
  if (value === null) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export async function GET(req: Request) {
  const userId = await resolveApiUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const window = resolveTimelineWindow(searchParams.get("window"));
  const includeAppActivity = shouldIncludeTimelineOptionalField(
    searchParams.get("includeAppActivity")
  );
  const includeJournalEntries = shouldIncludeTimelineOptionalField(
    searchParams.get("includeJournalEntries")
  );

  const windowStart = getWindowStartDate(window, new Date());

  try {
    const [
      checkIns,
      importedSessions,
      appSessions,
      journalEntriesWithAuthoredAt,
      journalEntriesWithoutAuthoredAt,
    ] = await Promise.all([
      prismadb.quickCheckIn.findMany({
        where: {
          userId,
          createdAt: { gte: windowStart },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: TIMELINE_MAX_RESULTS,
        select: {
          id: true,
          stateTag: true,
          eventTags: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prismadb.session.findMany({
        where: {
          userId,
          origin: "IMPORTED_ARCHIVE",
          startedAt: { gte: windowStart },
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          label: true,
          startedAt: true,
          messages: {
            where: { role: "user" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { content: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      includeAppActivity
        ? prismadb.session.findMany({
            where: {
              userId,
              origin: "APP",
              startedAt: { gte: windowStart },
            },
            orderBy: [{ startedAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              label: true,
              startedAt: true,
              surfaceType: true,
              messages: {
                where: { role: "user" },
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { content: true },
              },
              _count: {
                select: { messages: true },
              },
            },
          })
        : Promise.resolve<TimelineAppActivityRow[]>([]),
      includeJournalEntries
        ? prismadb.journalEntry.findMany({
            where: {
              userId,
              authoredAt: { gte: windowStart },
            },
            orderBy: [{ authoredAt: "desc" }, { id: "desc" }],
            take: TIMELINE_MAX_RESULTS,
            select: {
              id: true,
              title: true,
              body: true,
              authoredAt: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve<TimelineJournalEntryRow[]>([]),
      includeJournalEntries
        ? prismadb.journalEntry.findMany({
            where: {
              userId,
              authoredAt: null,
              createdAt: { gte: windowStart },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: TIMELINE_MAX_RESULTS,
            select: {
              id: true,
              title: true,
              body: true,
              authoredAt: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve<TimelineJournalEntryRow[]>([]),
    ]);

    const importedActivity = toTimelineSessionActivity(importedSessions);
    const appActivity = includeAppActivity
      ? toTimelineAppActivity(appSessions)
      : undefined;
    const journalEntries = includeJournalEntries
      ? toTimelineJournalEntries([
          ...journalEntriesWithAuthoredAt,
          ...journalEntriesWithoutAuthoredAt,
        ])
      : undefined;

    return NextResponse.json({
      checkIns: checkIns.map(toQuickCheckInView),
      importedActivity,
      ...(includeAppActivity ? { appActivity } : {}),
      ...(includeJournalEntries ? { journalEntries } : {}),
    });
  } catch (error) {
    console.log("[TIMELINE_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
