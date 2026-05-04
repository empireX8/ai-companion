import { QUICK_CHECK_IN_EVENT_LABELS, QUICK_CHECK_IN_STATE_LABELS, type QuickCheckInView } from "@/lib/quick-check-ins";
import { toJournalPreview, type JournalEntryView } from "@/lib/journal-ui";

type SessionOrigin = "APP" | "IMPORTED_ARCHIVE";

type SessionListItem = {
  id: string;
  label: string | null;
  preview: string | null;
  startedAt: string;
  endedAt: string | null;
  origin: SessionOrigin;
  importedSource?: string | null;
  importedAt?: string | null;
};

type SessionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type LibraryItemType = "Journal" | "Journal Chat" | "Explore" | "Check-in" | "Media";

export type LibraryItemView = {
  id: string;
  sourceId: string;
  type: LibraryItemType;
  date: string;
  sortKey: number;
  title: string;
  preview: string | null;
  mood: string | null;
  tags: string[];
  signals: number;
  linked: Array<{ kind: "Pattern" | "Tension" | "Thread"; label: string }>;
  createdAt: string;
};

export type LibraryDetailView =
  | {
      kind: "journal";
      item: LibraryItemView;
      entry: JournalEntryView;
    }
  | {
      kind: "checkin";
      item: LibraryItemView;
      checkIn: QuickCheckInView;
    }
  | {
      kind: "session";
      item: LibraryItemView;
      session: SessionListItem;
      messages: SessionMessage[];
      mode: "journal_chat" | "explore_chat" | "imported";
    };

const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  timeZone: "Europe/London",
});

const DATE_TIME_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/London",
});

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncate(value: string, max = 96): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1)}…`;
}

function parseIsoTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return DATE_LABEL.format(parsed);
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return DATE_TIME_LABEL.format(parsed);
}

function buildItemId(prefix: string, sourceId: string): string {
  return `${prefix}-${sourceId}`;
}

function parseItemId(itemId: string): { prefix: string; sourceId: string } | null {
  const splitIndex = itemId.indexOf("-");
  if (splitIndex <= 0 || splitIndex >= itemId.length - 1) {
    return null;
  }

  const prefix = itemId.slice(0, splitIndex);
  const sourceId = itemId.slice(splitIndex + 1);
  return { prefix, sourceId };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchJournalEntries(limit = 100): Promise<JournalEntryView[]> {
  return getJson<JournalEntryView[]>(`/api/journal/entries?limit=${limit}`);
}

async function fetchCheckIns(): Promise<QuickCheckInView[]> {
  return getJson<QuickCheckInView[]>("/api/check-ins");
}

async function fetchSessions(url: string): Promise<SessionListItem[]> {
  return getJson<SessionListItem[]>(url);
}

export async function fetchLibraryItems(): Promise<LibraryItemView[]> {
  const [entries, checkIns, journalChatSessions, exploreSessions, importedSessions] = await Promise.all([
    fetchJournalEntries(100),
    fetchCheckIns(),
    fetchSessions("/api/session/list?origin=app&surfaceType=journal_chat"),
    fetchSessions("/api/session/list?origin=app&surfaceType=explore_chat"),
    fetchSessions("/api/session/list?origin=imported"),
  ]);

  const journalItems: LibraryItemView[] = entries.map((entry) => {
    const createdAt = entry.authoredAt ?? entry.createdAt;
    const title = trimOrNull(entry.title) ?? truncate(toJournalPreview(entry.body, 72));
    return {
      id: buildItemId("journal", entry.id),
      sourceId: entry.id,
      type: "Journal",
      date: formatDate(createdAt),
      sortKey: parseIsoTime(createdAt),
      title,
      preview: toJournalPreview(entry.body),
      mood: null,
      tags: [],
      signals: 0,
      linked: [],
      createdAt,
    };
  });

  const checkInItems: LibraryItemView[] = checkIns.map((checkIn) => {
    const mood = checkIn.stateTag ? QUICK_CHECK_IN_STATE_LABELS[checkIn.stateTag] : null;
    const eventLabels = checkIn.eventTags.map((tag) => QUICK_CHECK_IN_EVENT_LABELS[tag]);
    const title = mood ? `${mood} check-in` : "Check-in";

    return {
      id: buildItemId("checkin", checkIn.id),
      sourceId: checkIn.id,
      type: "Check-in",
      date: formatDate(checkIn.createdAt),
      sortKey: parseIsoTime(checkIn.createdAt),
      title,
      preview: checkIn.note,
      mood,
      tags: eventLabels,
      signals: eventLabels.length,
      linked: [],
      createdAt: checkIn.createdAt,
    };
  });

  const journalChatItems: LibraryItemView[] = journalChatSessions.map((session) => {
    const title = trimOrNull(session.label) ?? trimOrNull(session.preview) ?? "Journal chat";
    return {
      id: buildItemId("jchat", session.id),
      sourceId: session.id,
      type: "Journal Chat",
      date: formatDate(session.startedAt),
      sortKey: parseIsoTime(session.startedAt),
      title: truncate(title),
      preview: trimOrNull(session.preview),
      mood: null,
      tags: [],
      signals: 0,
      linked: [],
      createdAt: session.startedAt,
    };
  });

  const exploreItems: LibraryItemView[] = exploreSessions.map((session) => {
    const title = trimOrNull(session.label) ?? trimOrNull(session.preview) ?? "Explore session";
    return {
      id: buildItemId("explore", session.id),
      sourceId: session.id,
      type: "Explore",
      date: formatDate(session.startedAt),
      sortKey: parseIsoTime(session.startedAt),
      title: truncate(title),
      preview: trimOrNull(session.preview),
      mood: null,
      tags: [],
      signals: 0,
      linked: [],
      createdAt: session.startedAt,
    };
  });

  const importedItems: LibraryItemView[] = importedSessions.map((session) => {
    const title =
      trimOrNull(session.label) ??
      trimOrNull(session.preview) ??
      trimOrNull(session.importedSource ?? undefined) ??
      "Imported archive";

    return {
      id: buildItemId("media", session.id),
      sourceId: session.id,
      type: "Media",
      date: formatDate(session.startedAt),
      sortKey: parseIsoTime(session.startedAt),
      title: truncate(title),
      preview: trimOrNull(session.preview),
      mood: null,
      tags: ["imported"],
      signals: 0,
      linked: [],
      createdAt: session.startedAt,
    };
  });

  return [...journalItems, ...journalChatItems, ...exploreItems, ...checkInItems, ...importedItems].sort(
    (left, right) => right.sortKey - left.sortKey
  );
}

async function fetchSessionById(sessionId: string): Promise<SessionListItem | null> {
  const [journalChatSessions, exploreSessions, importedSessions] = await Promise.all([
    fetchSessions("/api/session/list?origin=app&surfaceType=journal_chat"),
    fetchSessions("/api/session/list?origin=app&surfaceType=explore_chat"),
    fetchSessions("/api/session/list?origin=imported"),
  ]);

  const all = [...journalChatSessions, ...exploreSessions, ...importedSessions];
  return all.find((session) => session.id === sessionId) ?? null;
}

async function fetchSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  return getJson<SessionMessage[]>(`/api/message/list?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function fetchLibraryDetail(itemId: string): Promise<LibraryDetailView | null> {
  const parsedId = parseItemId(itemId);
  if (!parsedId) {
    return null;
  }

  if (parsedId.prefix === "journal") {
    const entries = await fetchJournalEntries(100);
    const entry = entries.find((candidate) => candidate.id === parsedId.sourceId);
    if (!entry) {
      return null;
    }

    const createdAt = entry.authoredAt ?? entry.createdAt;
    return {
      kind: "journal",
      item: {
        id: itemId,
        sourceId: entry.id,
        type: "Journal",
        date: formatDate(createdAt),
        sortKey: parseIsoTime(createdAt),
        title: trimOrNull(entry.title) ?? truncate(toJournalPreview(entry.body, 72)),
        preview: toJournalPreview(entry.body),
        mood: null,
        tags: [],
        signals: 0,
        linked: [],
        createdAt,
      },
      entry,
    };
  }

  if (parsedId.prefix === "checkin") {
    const checkIns = await fetchCheckIns();
    const checkIn = checkIns.find((candidate) => candidate.id === parsedId.sourceId);
    if (!checkIn) {
      return null;
    }

    const mood = checkIn.stateTag ? QUICK_CHECK_IN_STATE_LABELS[checkIn.stateTag] : null;
    return {
      kind: "checkin",
      item: {
        id: itemId,
        sourceId: checkIn.id,
        type: "Check-in",
        date: formatDate(checkIn.createdAt),
        sortKey: parseIsoTime(checkIn.createdAt),
        title: mood ? `${mood} check-in` : "Check-in",
        preview: checkIn.note,
        mood,
        tags: checkIn.eventTags.map((tag) => QUICK_CHECK_IN_EVENT_LABELS[tag]),
        signals: checkIn.eventTags.length,
        linked: [],
        createdAt: checkIn.createdAt,
      },
      checkIn,
    };
  }

  if (parsedId.prefix === "jchat" || parsedId.prefix === "explore" || parsedId.prefix === "media") {
    const mode =
      parsedId.prefix === "jchat"
        ? "journal_chat"
        : parsedId.prefix === "explore"
          ? "explore_chat"
          : "imported";

    const session = await fetchSessionById(parsedId.sourceId);
    if (!session) {
      return null;
    }

    const messages = await fetchSessionMessages(session.id);
    const title =
      trimOrNull(session.label) ?? trimOrNull(session.preview) ?? (mode === "journal_chat" ? "Journal chat" : mode === "explore_chat" ? "Explore session" : "Imported archive");

    const itemType: LibraryItemType =
      mode === "journal_chat" ? "Journal Chat" : mode === "explore_chat" ? "Explore" : "Media";

    return {
      kind: "session",
      mode,
      session,
      messages,
      item: {
        id: itemId,
        sourceId: session.id,
        type: itemType,
        date: formatDate(session.startedAt),
        sortKey: parseIsoTime(session.startedAt),
        title: truncate(title),
        preview: trimOrNull(session.preview),
        mood: null,
        tags: mode === "imported" ? ["imported"] : [],
        signals: 0,
        linked: [],
        createdAt: session.startedAt,
      },
    };
  }

  return null;
}

export function toLibraryDateTimeLabel(iso: string): string {
  return formatDateTime(iso);
}

export function toLibraryBodyPreview(body: string): string {
  return toJournalPreview(body, 320);
}
