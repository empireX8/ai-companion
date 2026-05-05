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

export type LibraryItemType = "Journal" | "Journal Chat" | "Explore" | "Check-in" | "Media" | "Receipts";

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
    }
  | {
      kind: "receipt";
      item: LibraryItemView;
      receipt: LibraryReceiptDetail;
    };

// ── Receipt types ──────────────────────────────────────────────────────────────

export type ReceiptKind = "pattern" | "tension" | "action" | "surfacing";

export type LibraryReceiptDetail = {
  receiptKind: ReceiptKind;
  /** The conclusion title or summary this receipt supports */
  conclusionTitle: string;
  /** The conclusion type label (Pattern, Tension, Action, Surfacing) */
  conclusionType: string;
  /** Evidence quotes/context items */
  evidenceItems: Array<{
    quote: string | null;
    sourceLabel: string | null;
    sourceDate: string | null;
  }>;
  /** Link back to the original object (pattern detail, tension detail, etc.) */
  linkedHref: string | null;
  /** Label for the linked object */
  linkedLabel: string | null;
};

// ── Receipt data sources ───────────────────────────────────────────────────────

type PatternReceiptSource = {
  id: string;
  source: string;
  sessionId: string | null;
  messageId: string | null;
  journalEntryId?: string | null;
  quote: string | null;
  createdAt: string;
};

type PatternClaimSource = {
  id: string;
  summary: string;
  strengthLevel: string;
  evidenceCount: number;
  receipts: PatternReceiptSource[];
};

type ContradictionEvidenceSource = {
  id: string;
  createdAt: string;
  source: string;
  quote: string | null;
  sessionId: string | null;
  messageId: string | null;
};

type ContradictionDetailSource = {
  id: string;
  title: string;
  status: string;
  evidence: ContradictionEvidenceSource[];
};

type ActionSource = {
  id: string;
  title: string;
  linkedClaimId: string | null;
  linkedClaimSummary: string | null;
  linkedSourceLabel: string;
};

// ── Fetch helpers ──────────────────────────────────────────────────────────────

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

async function fetchPatternsData(): Promise<{ sections: Array<{ claims: PatternClaimSource[] }> } | null> {
  try {
    return await getJson<{ sections: Array<{ claims: PatternClaimSource[] }> }>("/api/patterns");
  } catch {
    return null;
  }
}

async function fetchContradictionDetail(id: string): Promise<ContradictionDetailSource | null> {
  try {
    return await getJson<ContradictionDetailSource>(`/api/contradiction/${id}`);
  } catch {
    return null;
  }
}

async function fetchActionsData(): Promise<{ stabilizeNow: ActionSource[]; buildForward: ActionSource[] } | null> {
  try {
    return await getJson<{ stabilizeNow: ActionSource[]; buildForward: ActionSource[] }>("/api/actions");
  } catch {
    return null;
  }
}

// ── Receipt item builder ───────────────────────────────────────────────────────

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

/** Known multi-part prefixes that contain hyphens. */
const MULTI_PART_PREFIXES = ["receipt-pattern", "receipt-tension", "receipt-action"] as const;

function parseItemId(itemId: string): { prefix: string; sourceId: string } | null {
  // Check multi-part prefixes first (they contain hyphens)
  for (const prefix of MULTI_PART_PREFIXES) {
    const needle = `${prefix}-`;
    if (itemId.startsWith(needle)) {
      const sourceId = itemId.slice(needle.length);
      if (sourceId.length > 0) {
        return { prefix, sourceId };
      }
    }
  }

  // Fall back to single-part prefix (split on first hyphen)
  const splitIndex = itemId.indexOf("-");
  if (splitIndex <= 0 || splitIndex >= itemId.length - 1) {
    return null;
  }

  const prefix = itemId.slice(0, splitIndex);
  const sourceId = itemId.slice(splitIndex + 1);
  return { prefix, sourceId };
}



function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

// ── Receipt fetching ───────────────────────────────────────────────────────────

export async function fetchReceiptItems(): Promise<LibraryItemView[]> {
  const items: LibraryItemView[] = [];

  // 1. Pattern claim receipts
  const patternsData = await fetchPatternsData();
  if (patternsData) {
    for (const section of patternsData.sections) {
      for (const claim of section.claims) {
        if (claim.receipts.length === 0) continue;

        const receipt = claim.receipts[0];
        const createdAt = receipt.createdAt;
        const quote = trimOrNull(receipt.quote);
        const preview = quote ?? clampText(normalizeText(claim.summary), 96);

        items.push({
          id: buildItemId("receipt-pattern", claim.id),
          sourceId: claim.id,
          type: "Receipts",
          date: formatDate(createdAt),
          sortKey: parseIsoTime(createdAt),
          title: truncate(normalizeText(claim.summary), 120),
          preview,
          mood: null,
          tags: ["pattern"],
          signals: claim.evidenceCount,
          linked: [{ kind: "Pattern", label: clampText(normalizeText(claim.summary), 60) }],
          createdAt,
        });
      }
    }
  }

  // 2. Tension evidence receipts
  try {
    const tensions = await getJson<Array<{ id: string; title: string; status: string; lastTouchedAt: string }>>(
      "/api/contradiction?status=open&limit=50"
    );
    for (const tension of tensions) {
      const detail = await fetchContradictionDetail(tension.id);
      if (!detail || detail.evidence.length === 0) continue;

      const evidence = detail.evidence[0];
      const quote = trimOrNull(evidence.quote);
      const preview = quote ?? clampText(normalizeText(tension.title), 96);

      items.push({
        id: buildItemId("receipt-tension", tension.id),
        sourceId: tension.id,
        type: "Receipts",
        date: formatDate(evidence.createdAt),
        sortKey: parseIsoTime(evidence.createdAt),
        title: truncate(normalizeText(tension.title), 120),
        preview,
        mood: null,
        tags: ["tension"],
        signals: detail.evidence.length,
        linked: [{ kind: "Tension", label: clampText(normalizeText(tension.title), 60) }],
        createdAt: evidence.createdAt,
      });
    }
  } catch {
    // Tension receipts are optional
  }

  // 3. Action receipts (only when linked data exists)
  const actionsData = await fetchActionsData();
  if (actionsData) {
    const allActions = [...actionsData.stabilizeNow, ...actionsData.buildForward];
    for (const action of allActions) {
      if (!action.linkedClaimId && !action.linkedClaimSummary) continue;

      items.push({
        id: buildItemId("receipt-action", action.id),
        sourceId: action.id,
        type: "Receipts",
        date: "recent",
        sortKey: Date.now(),
        title: truncate(normalizeText(action.title), 120),
        preview: action.linkedClaimSummary ?? action.linkedSourceLabel,
        mood: null,
        tags: ["action"],
        signals: 1,
        linked: [],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return items.sort((left, right) => right.sortKey - left.sortKey);
}

export async function fetchReceiptDetail(itemId: string): Promise<LibraryReceiptDetail | null> {
  const parsedId = parseItemId(itemId);
  if (!parsedId) return null;

  const { prefix, sourceId } = parsedId;

  if (prefix === "receipt-pattern") {
    const patternsData = await fetchPatternsData();
    if (!patternsData) return null;

    for (const section of patternsData.sections) {
      for (const claim of section.claims) {
        if (claim.id !== sourceId) continue;

        return {
          receiptKind: "pattern",
          conclusionTitle: normalizeText(claim.summary),
          conclusionType: "Pattern",
          evidenceItems: claim.receipts.map((r) => ({
            quote: r.quote,
            sourceLabel: r.source?.replace(/_/g, " ") ?? null,
            sourceDate: r.createdAt,
          })),
          linkedHref: `/patterns/${claim.id}`,
          linkedLabel: "View pattern detail",
        };
      }
    }
    return null;
  }

  if (prefix === "receipt-tension") {
    const detail = await fetchContradictionDetail(sourceId);
    if (!detail) return null;

    return {
      receiptKind: "tension",
      conclusionTitle: normalizeText(detail.title),
      conclusionType: "Tension",
      evidenceItems: detail.evidence.map((e) => ({
        quote: e.quote,
        sourceLabel: e.source?.replace(/_/g, " ") ?? null,
        sourceDate: e.createdAt,
      })),
      linkedHref: `/contradictions/${detail.id}`,
      linkedLabel: "View tension detail",
    };
  }

  if (prefix === "receipt-action") {
    const actionsData = await fetchActionsData();
    if (!actionsData) return null;

    const allActions = [...actionsData.stabilizeNow, ...actionsData.buildForward];
    const action = allActions.find((a) => a.id === sourceId);
    if (!action || !action.linkedClaimSummary) return null;

    return {
      receiptKind: "action",
      conclusionTitle: normalizeText(action.title),
      conclusionType: "Action",
      evidenceItems: [
        {
          quote: action.linkedClaimSummary,
          sourceLabel: action.linkedSourceLabel,
          sourceDate: null,
        },
      ],
      linkedHref: action.linkedClaimId ? `/patterns/${action.linkedClaimId}` : null,
      linkedLabel: action.linkedClaimId ? "View source pattern" : null,
    };
  }

  return null;
}

// ── Existing Library functions ─────────────────────────────────────────────────

export async function fetchLibraryItems(): Promise<LibraryItemView[]> {
  const [entries, checkIns, journalChatSessions, exploreSessions, importedSessions, receiptItems] = await Promise.all([
    fetchJournalEntries(100),
    fetchCheckIns(),
    fetchSessions("/api/session/list?origin=app&surfaceType=journal_chat"),
    fetchSessions("/api/session/list?origin=app&surfaceType=explore_chat"),
    fetchSessions("/api/session/list?origin=imported"),
    fetchReceiptItems(),
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

  return [...journalItems, ...journalChatItems, ...exploreItems, ...checkInItems, ...importedItems, ...receiptItems].sort(
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

  // Receipt detail
  if (parsedId.prefix === "receipt-pattern" || parsedId.prefix === "receipt-tension" || parsedId.prefix === "receipt-action") {
    const receipt = await fetchReceiptDetail(itemId);
    if (!receipt) return null;

    return {
      kind: "receipt",
      item: {
        id: itemId,
        sourceId: parsedId.sourceId,
        type: "Receipts",
        date: "recent",
        sortKey: Date.now(),
        title: truncate(receipt.conclusionTitle, 120),
        preview: receipt.evidenceItems[0]?.quote ?? null,
        mood: null,
        tags: [receipt.receiptKind],
        signals: receipt.evidenceItems.length,
        linked: [],
        createdAt: new Date().toISOString(),
      },
      receipt,
    };
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
