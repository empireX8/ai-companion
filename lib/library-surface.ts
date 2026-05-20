import { QUICK_CHECK_IN_EVENT_LABELS, QUICK_CHECK_IN_STATE_LABELS, type QuickCheckInView } from "./quick-check-ins";
import { toJournalPreview, type JournalEntryView } from "./journal-ui";
import { computeContradictionTitle } from "./contradiction-title-adapter";
import { PUBLIC_RECEIPT_NAMESPACE_PREFIXES } from "./public-continuity-registry";

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

export type ReceiptKind = "pattern" | "tension";

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
  journalEntryId: string | null;
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

type ContradictionListItemSource = {
  id: string;
  title: string;
  status: string;
  lastTouchedAt: string;
};

type ContradictionListPayload =
  | ContradictionListItemSource[]
  | {
      items?: ContradictionListItemSource[];
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

async function fetchPatternsData(): Promise<unknown | null> {
  try {
    return await getJson<unknown>("/api/patterns");
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
const MULTI_PART_PREFIXES = PUBLIC_RECEIPT_NAMESPACE_PREFIXES;

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

function readContradictionItems(
  payload: ContradictionListPayload | null | undefined
): ContradictionListItemSource[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

function readPatternClaims(payload: unknown): PatternClaimSource[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const sections = (payload as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) {
    return [];
  }

  const claims: PatternClaimSource[] = [];
  for (const section of sections) {
    const sectionClaims = (section as { claims?: unknown })?.claims;
    if (!Array.isArray(sectionClaims)) {
      continue;
    }

    for (const claim of sectionClaims) {
      if (!claim || typeof claim !== "object") {
        continue;
      }

      const raw = claim as {
        id?: unknown;
        summary?: unknown;
        strengthLevel?: unknown;
        evidenceCount?: unknown;
        receipts?: unknown;
      };

      if (typeof raw.id !== "string" || typeof raw.summary !== "string") {
        continue;
      }

      const receipts = Array.isArray(raw.receipts)
        ? raw.receipts
            .map((receipt) => {
              if (!receipt || typeof receipt !== "object") {
                return null;
              }

              const maybe = receipt as {
                id?: unknown;
                source?: unknown;
                sessionId?: unknown;
                messageId?: unknown;
                journalEntryId?: unknown;
                quote?: unknown;
                createdAt?: unknown;
              };

              if (
                typeof maybe.id !== "string" ||
                typeof maybe.source !== "string" ||
                typeof maybe.createdAt !== "string"
              ) {
                return null;
              }

              return {
                id: maybe.id,
                source: maybe.source,
                sessionId:
                  typeof maybe.sessionId === "string" ? maybe.sessionId : null,
                messageId:
                  typeof maybe.messageId === "string" ? maybe.messageId : null,
                journalEntryId:
                  typeof maybe.journalEntryId === "string"
                    ? maybe.journalEntryId
                    : null,
                quote: typeof maybe.quote === "string" ? maybe.quote : null,
                createdAt: maybe.createdAt,
              } satisfies PatternReceiptSource;
            })
            .filter((receipt): receipt is PatternReceiptSource =>
              Boolean(receipt)
            )
        : [];

      claims.push({
        id: raw.id,
        summary: raw.summary,
        strengthLevel:
          typeof raw.strengthLevel === "string"
            ? raw.strengthLevel
            : "tentative",
        evidenceCount:
          typeof raw.evidenceCount === "number" &&
          Number.isFinite(raw.evidenceCount)
            ? raw.evidenceCount
            : receipts.length,
        receipts,
      });
    }
  }

  return claims;
}

function readContradictionEvidence(
  detail: ContradictionDetailSource | null
): ContradictionEvidenceSource[] {
  const rawEvidence = detail?.evidence;
  if (!Array.isArray(rawEvidence)) {
    return [];
  }

  return rawEvidence
    .map((evidence) => {
      if (!evidence || typeof evidence !== "object") {
        return null;
      }

      const maybe = evidence as {
        id?: unknown;
        createdAt?: unknown;
        source?: unknown;
        quote?: unknown;
        sessionId?: unknown;
        messageId?: unknown;
      };

      if (
        typeof maybe.id !== "string" ||
        typeof maybe.createdAt !== "string" ||
        typeof maybe.source !== "string"
      ) {
        return null;
      }

      return {
        id: maybe.id,
        createdAt: maybe.createdAt,
        source: maybe.source,
        quote: typeof maybe.quote === "string" ? maybe.quote : null,
        sessionId: typeof maybe.sessionId === "string" ? maybe.sessionId : null,
        messageId: typeof maybe.messageId === "string" ? maybe.messageId : null,
      } satisfies ContradictionEvidenceSource;
    })
    .filter((item): item is ContradictionEvidenceSource => Boolean(item));
}

type EvidenceSummarySource = {
  createdAt: string | null;
  quote: string | null;
};

function summarizeEvidenceSources(items: EvidenceSummarySource[]): {
  latestSourceDate: string | null;
  previewQuote: string | null;
} {
  const normalized = items.map((item) => ({
    createdAt: item.createdAt,
    time: parseIsoTime(item.createdAt),
    quote: trimOrNull(item.quote),
  }));

  const sortedByNewest = [...normalized].sort((left, right) => {
    if (right.time !== left.time) {
      return right.time - left.time;
    }
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });

  const latestWithDate = sortedByNewest.find((item) => item.time > 0) ?? null;
  const previewQuote =
    sortedByNewest.find((item) => item.quote !== null)?.quote ?? null;

  return {
    latestSourceDate: latestWithDate?.createdAt ?? null,
    previewQuote,
  };
}

function toReceiptDateLabel(createdAt: string | null): string {
  return createdAt ? formatDate(createdAt) : "Unknown";
}

function toReceiptCreatedAt(createdAt: string | null): string {
  return createdAt ?? "";
}

// ── Receipt fetching ───────────────────────────────────────────────────────────

export async function fetchReceiptItems(): Promise<LibraryItemView[]> {
  const items: LibraryItemView[] = [];

  // 1. Pattern claim receipts
  const patternsData = await fetchPatternsData();
  for (const claim of readPatternClaims(patternsData)) {
    const signals = Math.max(claim.evidenceCount, claim.receipts.length);
    if (signals <= 0) {
      continue;
    }

    const evidenceSummary = summarizeEvidenceSources(
      claim.receipts.map((receipt) => ({
        createdAt: receipt.createdAt,
        quote: receipt.quote,
      }))
    );

    items.push({
      id: buildItemId("receipt-pattern", claim.id),
      sourceId: claim.id,
      type: "Receipts",
      date: toReceiptDateLabel(evidenceSummary.latestSourceDate),
      sortKey: parseIsoTime(evidenceSummary.latestSourceDate),
      title: truncate(normalizeText(claim.summary), 120),
      preview: evidenceSummary.previewQuote,
      mood: null,
      tags: ["pattern"],
      signals,
      linked: [
        {
          kind: "Pattern",
          label: clampText(normalizeText(claim.summary), 60),
        },
      ],
      createdAt: toReceiptCreatedAt(evidenceSummary.latestSourceDate),
    });
  }

  // 2. Tension evidence receipts
  try {
    const tensionPayload = await getJson<ContradictionListPayload>(
      "/api/contradiction?status=open&limit=50"
    );
    const tensions = readContradictionItems(tensionPayload);
    for (const tension of tensions) {
      const detail = await fetchContradictionDetail(tension.id);
      const evidence = readContradictionEvidence(detail);
      if (evidence.length === 0) continue;

      const evidenceSummary = summarizeEvidenceSources(
        evidence.map((item) => ({
          createdAt: item.createdAt,
          quote: item.quote,
        }))
      );

      items.push({
        id: buildItemId("receipt-tension", tension.id),
        sourceId: tension.id,
        type: "Receipts",
        date: toReceiptDateLabel(evidenceSummary.latestSourceDate),
        sortKey: parseIsoTime(evidenceSummary.latestSourceDate),
        title: truncate(normalizeText(computeContradictionTitle(tension)), 120),
        preview: evidenceSummary.previewQuote,
        mood: null,
        tags: ["tension"],
        signals: evidence.length,
        linked: [{ kind: "Tension", label: clampText(normalizeText(computeContradictionTitle(tension)), 60) }],
        createdAt: toReceiptCreatedAt(evidenceSummary.latestSourceDate),
      });
    }
  } catch {
    // Tension receipts are optional
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

    for (const claim of readPatternClaims(patternsData)) {
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
    return null;
  }

  if (prefix === "receipt-tension") {
    const detail = await fetchContradictionDetail(sourceId);
    if (!detail) return null;

    const evidence = readContradictionEvidence(detail);

    return {
      receiptKind: "tension",
      conclusionTitle: normalizeText(computeContradictionTitle(detail)),
      conclusionType: "Tension",
      evidenceItems: evidence.map((e) => ({
        quote: e.quote,
        sourceLabel: e.source?.replace(/_/g, " ") ?? null,
        sourceDate: e.createdAt,
      })),
      linkedHref: `/contradictions/${detail.id}`,
      linkedLabel: "View tension detail",
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
  if (
    parsedId.prefix === "receipt-pattern" ||
    parsedId.prefix === "receipt-tension"
  ) {
    const receipt = await fetchReceiptDetail(itemId);
    if (!receipt) return null;

    const evidenceSummary = summarizeEvidenceSources(
      receipt.evidenceItems.map((item) => ({
        createdAt: item.sourceDate,
        quote: item.quote,
      }))
    );

    return {
      kind: "receipt",
      item: {
        id: itemId,
        sourceId: parsedId.sourceId,
        type: "Receipts",
        date: toReceiptDateLabel(evidenceSummary.latestSourceDate),
        sortKey: parseIsoTime(evidenceSummary.latestSourceDate),
        title: truncate(receipt.conclusionTitle, 120),
        preview: evidenceSummary.previewQuote,
        mood: null,
        tags: [receipt.receiptKind],
        signals: receipt.evidenceItems.length,
        linked: [],
        createdAt: toReceiptCreatedAt(evidenceSummary.latestSourceDate),
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
