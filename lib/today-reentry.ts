import type { SurfacedActionView } from "./actions-api";
import type { ActiveQuestionItem } from "./active-questions";
import type { InspectorSelectableObjectType } from "./inspector-selection";
import { parseSelectableObjectFromHref } from "./inspector-selection";
import type { UserMapConclusionPublicApiListItem } from "./public-intelligence-safe-slice";
import {
  TODAY_INTELLIGENCE_EMPTY_COPY,
  TODAY_INTELLIGENCE_LOADING_COPY,
  buildTodaySurfacingCards,
  type TodayJournalEntry,
  type TodayPatternsResponse,
  type TodaySurfacingCard,
  type TodayTopContradiction,
} from "./today-surface";
import {
  TODAY_INTELLIGENCE_UPDATES_ENDPOINT,
  type TodayIntelligenceUpdateItem,
} from "./today-intelligence-updates";
import { TIMELINE_SEMANTIC_ENDPOINTS } from "./timeline-semantic-layers";
import { buildTimelineModelLayersRequestUrl } from "./timeline-model-layers";
import type { TimelineModelLayerItem } from "./timeline-model-layers";
import type { WatchForItem } from "./watch-for";
import { YOUR_MAP_CONCLUSIONS_ENDPOINT } from "./your-map-surface";

export const TODAY_ATTENTION_SECTION_LABEL = "Needs attention now";
export const TODAY_ATTENTION_EMPTY_COPY =
  "Nothing needs attention right now. Capture or check in to build more signal.";
export const TODAY_OPEN_LOOPS_LABEL = "Open loops";
export const TODAY_TIMELINE_MOVEMENT_LABEL = "Recent timeline movement";
export const TODAY_REPORT_READY_LABEL = "Report ready";

export const TODAY_REENTRY_ENDPOINTS = {
  ...TIMELINE_SEMANTIC_ENDPOINTS,
  journal: "/api/journal/entries?limit=1",
  contradiction: "/api/contradiction?top=3&mode=read_only",
  patterns: "/api/patterns",
  intelligenceUpdates: TODAY_INTELLIGENCE_UPDATES_ENDPOINT,
  userMapConclusions: YOUR_MAP_CONCLUSIONS_ENDPOINT,
  timelineModelLayers: buildTimelineModelLayersRequestUrl("7d"),
} as const;

export type TodaySelectableTarget = {
  objectType: InspectorSelectableObjectType;
  objectId: string;
  modelUpdateId?: string | null;
  title: string;
  tab: "evidence" | "movement";
};

export type TodayHeroItem = {
  id: string;
  laneLabel: string;
  typeLabel: string;
  title: string;
  summary: string;
  meta: string | null;
  whyItMatters: string | null;
  occurredAt: string | null;
  href: string | null;
  selection: TodaySelectableTarget | null;
  movement: TodayIntelligenceUpdateItem | null;
  affectedObjectHref: string | null;
  affectedObjectType: TodayIntelligenceUpdateItem["affectedObjectType"] | null;
  affectedObjectId: string | null;
};

export type TodayAttentionRow = {
  id: string;
  laneLabel: string;
  typeLabel: string;
  title: string;
  reason: string;
  meta: string | null;
  occurredAt: string;
  href: string | null;
  selection: TodaySelectableTarget | null;
};

export type TodayReentrySnapshot = {
  surfacingCards: TodaySurfacingCard[];
  intelligenceUpdates: TodayIntelligenceUpdateItem[];
  userMapConclusions: UserMapConclusionPublicApiListItem[];
  watchForItems: WatchForItem[];
  investigations: ActiveQuestionItem[];
  actions: SurfacedActionView[];
  timelineMovements: TimelineModelLayerItem[];
};

function selectionFromHref(
  href: string | null | undefined,
  title: string
): TodaySelectableTarget | null {
  const parsed = parseSelectableObjectFromHref(href);
  if (!parsed) {
    return null;
  }
  return {
    ...parsed,
    title,
    tab: "evidence",
  };
}

function movementSelection(item: TodayIntelligenceUpdateItem): TodaySelectableTarget {
  return {
    objectType: "model_update",
    objectId: item.id,
    modelUpdateId: item.id,
    title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
    tab: "movement",
  };
}

function mapConclusionSelection(
  item: UserMapConclusionPublicApiListItem
): TodaySelectableTarget {
  return {
    objectType: "usermap_conclusion",
    objectId: item.id,
    title: item.title,
    tab: "evidence",
  };
}

function heroFromMovement(item: TodayIntelligenceUpdateItem): TodayHeroItem {
  return {
    id: `hero-movement-${item.id}`,
    laneLabel: "Model movement",
    typeLabel: item.updateTypeLabel,
    title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
    summary: item.userFacingSummary,
    meta: null,
    whyItMatters: "Your model shifted based on recent evidence.",
    occurredAt: item.createdAt,
    href: null,
    selection: movementSelection(item),
    movement: item,
    affectedObjectHref: item.affectedObjectHref,
    affectedObjectType: item.affectedObjectType,
    affectedObjectId: item.affectedObjectId,
  };
}

function heroFromMapConclusion(item: UserMapConclusionPublicApiListItem): TodayHeroItem {
  return {
    id: `hero-map-${item.id}`,
    laneLabel: "Your Map",
    typeLabel: "Map conclusion",
    title: item.title,
    summary: item.summary,
    meta: `${item.evidenceCount} linked evidence source${item.evidenceCount === 1 ? "" : "s"}`,
    whyItMatters: "A supported conclusion on your current understanding map.",
    occurredAt: item.updatedAt,
    href: `/your-map/${item.id}`,
    selection: mapConclusionSelection(item),
    movement: null,
    affectedObjectHref: `/your-map/${item.id}`,
    affectedObjectType: "usermap_conclusion",
    affectedObjectId: item.id,
  };
}

function heroFromSurfacingCard(card: TodaySurfacingCard): TodayHeroItem {
  const selection = selectionFromHref(card.detailHref, card.title);
  return {
    id: `hero-card-${card.kind}-${card.title}`,
    laneLabel: card.kind === "Active Tension" ? "Tension" : "Pattern",
    typeLabel: card.kind,
    title: card.title,
    summary: card.body,
    meta: card.meta,
    whyItMatters: "Surfaced from your recent material.",
    occurredAt: null,
    href: card.detailHref,
    selection,
    movement: null,
    affectedObjectHref: card.detailHref,
    affectedObjectType: selection?.objectType ?? null,
    affectedObjectId: selection?.objectId ?? null,
  };
}

function heroFromFieldwork(item: WatchForItem): TodayHeroItem {
  return {
    id: `hero-fieldwork-${item.id}`,
    laneLabel: "Fieldwork",
    typeLabel: "Watch for",
    title: item.prompt,
    summary: item.reason,
    meta: item.statusLabel,
    whyItMatters: "An active observation prompt from your evidence.",
    occurredAt: item.updatedAt,
    href: `/watch-for/${item.id}`,
    selection: null,
    movement: null,
    affectedObjectHref: item.linkedObjectHref,
    affectedObjectType: null,
    affectedObjectId: item.linkedObjectId,
  };
}

function heroFromAction(action: SurfacedActionView): TodayHeroItem {
  const selection = action.linkedClaimId
    ? {
        objectType: "pattern_claim" as const,
        objectId: action.linkedClaimId,
        title: action.linkedClaimSummary ?? action.title,
        tab: "evidence" as const,
      }
    : null;

  return {
    id: `hero-action-${action.id}`,
    laneLabel: "Decisions",
    typeLabel: "Suggested action",
    title: action.title,
    summary: action.whySuggested,
    meta: action.linkedSourceLabel,
    whyItMatters: "An invitation connected to recent patterns or goals.",
    occurredAt: action.updatedAt,
    href: "/actions",
    selection,
    movement: null,
    affectedObjectHref: null,
    affectedObjectType: selection?.objectType ?? null,
    affectedObjectId: selection?.objectId ?? null,
  };
}

function heroFromInvestigation(item: ActiveQuestionItem): TodayHeroItem {
  return {
    id: `hero-investigation-${item.id}`,
    laneLabel: "Fieldwork",
    typeLabel: "Active question",
    title: item.title,
    summary: item.organizingQuestion,
    meta: item.statusLabel,
    whyItMatters: "An open investigation that may reshape your map.",
    occurredAt: item.updatedAt,
    href: `/active-questions/${item.id}`,
    selection: null,
    movement: null,
    affectedObjectHref: null,
    affectedObjectType: null,
    affectedObjectId: null,
  };
}

export function pickTodayHeroItem(snapshot: TodayReentrySnapshot): TodayHeroItem | null {
  const movement = snapshot.intelligenceUpdates[0];
  if (movement) {
    return heroFromMovement(movement);
  }

  const conclusion = snapshot.userMapConclusions[0];
  if (conclusion) {
    return heroFromMapConclusion(conclusion);
  }

  const signalCard = snapshot.surfacingCards.find(
    (card) => card.kind === "Active Tension" || card.kind === "Recent Pattern"
  );
  if (signalCard) {
    return heroFromSurfacingCard(signalCard);
  }

  const fieldwork = snapshot.watchForItems.find(
    (item) => item.status === "active" || item.status === "assigned"
  );
  if (fieldwork) {
    return heroFromFieldwork(fieldwork);
  }

  const action = snapshot.actions.find((item) => item.status === "not_started");
  if (action) {
    return heroFromAction(action);
  }

  const investigation = snapshot.investigations[0];
  if (investigation) {
    return heroFromInvestigation(investigation);
  }

  const fallbackCard = snapshot.surfacingCards[0];
  if (fallbackCard) {
    return heroFromSurfacingCard(fallbackCard);
  }

  return null;
}

function rowFromMovement(item: TodayIntelligenceUpdateItem): TodayAttentionRow {
  return {
    id: `attention-movement-${item.id}`,
    laneLabel: "Model movement",
    typeLabel: "Model change",
    title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
    reason: item.userFacingSummary,
    meta: null,
    occurredAt: item.createdAt,
    href: null,
    selection: movementSelection(item),
  };
}

function rowFromFieldwork(item: WatchForItem): TodayAttentionRow {
  const selection = selectionFromHref(item.linkedObjectHref, item.prompt);
  return {
    id: `attention-fieldwork-${item.id}`,
    laneLabel: "Fieldwork",
    typeLabel: "Watch for",
    title: item.prompt,
    reason: item.reason,
    meta: item.statusLabel,
    occurredAt: item.updatedAt,
    href: `/watch-for/${item.id}`,
    selection,
  };
}

function rowFromAction(action: SurfacedActionView): TodayAttentionRow {
  const selection = action.linkedClaimId
    ? {
        objectType: "pattern_claim" as const,
        objectId: action.linkedClaimId,
        title: action.linkedClaimSummary ?? action.title,
        tab: "evidence" as const,
      }
    : null;

  return {
    id: `attention-action-${action.id}`,
    laneLabel: "Decisions",
    typeLabel: "Action",
    title: action.title,
    reason: action.whySuggested,
    meta: action.status === "not_started" ? "Not started" : action.status.replace(/_/g, " "),
    occurredAt: action.updatedAt,
    href: "/actions",
    selection,
  };
}

function rowFromInvestigation(item: ActiveQuestionItem): TodayAttentionRow {
  return {
    id: `attention-investigation-${item.id}`,
    laneLabel: "Fieldwork",
    typeLabel: "Active question",
    title: item.title,
    reason: item.organizingQuestion,
    meta: item.statusLabel,
    occurredAt: item.updatedAt,
    href: `/active-questions/${item.id}`,
    selection: null,
  };
}

function rowFromTimelineMovement(item: TimelineModelLayerItem): TodayAttentionRow {
  return {
    id: `attention-timeline-${item.id}`,
    laneLabel: "Timeline",
    typeLabel: "Recent movement",
    title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
    reason: item.userFacingSummary,
    meta: null,
    occurredAt: item.createdAt,
    href: "/timeline",
    selection: {
      objectType: "model_update",
      objectId: item.id,
      modelUpdateId: item.id,
      title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
      tab: "movement",
    },
  };
}

function rowFromSurfacingCard(card: TodaySurfacingCard): TodayAttentionRow {
  return {
    id: `attention-card-${card.kind}-${card.title}`,
    laneLabel: card.kind === "Recent Journal" ? "Receipts" : "Evidence",
    typeLabel: card.kind,
    title: card.title,
    reason: card.body,
    meta: card.meta,
    occurredAt: new Date(0).toISOString(),
    href: card.detailHref,
    selection: selectionFromHref(card.detailHref, card.title),
  };
}

export function buildTodayAttentionRows(
  snapshot: TodayReentrySnapshot,
  hero: TodayHeroItem | null
): TodayAttentionRow[] {
  const heroId = hero?.id ?? null;
  const usedMovementIds = new Set(
    snapshot.intelligenceUpdates.slice(0, 1).map((item) => item.id)
  );

  const candidates: TodayAttentionRow[] = [];

  for (const item of snapshot.intelligenceUpdates.slice(1)) {
    candidates.push(rowFromMovement(item));
  }

  for (const item of snapshot.watchForItems) {
    if (item.status === "active" || item.status === "assigned") {
      candidates.push(rowFromFieldwork(item));
    }
  }

  for (const action of snapshot.actions) {
    if (action.status === "not_started") {
      candidates.push(rowFromAction(action));
    }
  }

  for (const investigation of snapshot.investigations) {
    candidates.push(rowFromInvestigation(investigation));
  }

  for (const item of snapshot.timelineMovements) {
    if (!usedMovementIds.has(item.id)) {
      candidates.push(rowFromTimelineMovement(item));
    }
  }

  for (const card of snapshot.surfacingCards) {
    if (card.receiptHref || card.kind !== "Recent Journal") {
      candidates.push(rowFromSurfacingCard(card));
    }
  }

  const deduped = new Map<string, TodayAttentionRow>();
  for (const row of candidates) {
    if (row.id === heroId) {
      continue;
    }
    if (!deduped.has(row.id)) {
      deduped.set(row.id, row);
    }
  }

  return [...deduped.values()]
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
    )
    .slice(0, 8);
}

export function buildTodayBriefingTitle(snapshot: TodayReentrySnapshot): string {
  if (snapshot.intelligenceUpdates.length > 0) {
    const count = snapshot.intelligenceUpdates.length;
    return `Your model moved in ${count} place${count === 1 ? "" : "s"}.`;
  }
  if (
    snapshot.userMapConclusions.length > 0 ||
    snapshot.surfacingCards.length > 0 ||
    snapshot.watchForItems.length > 0 ||
    snapshot.actions.length > 0 ||
    snapshot.investigations.length > 0
  ) {
    return "What matters now";
  }
  return "Today";
}

export function buildTodayBriefingMeta(
  snapshot: TodayReentrySnapshot,
  isLoading: boolean
): string {
  if (isLoading) {
    return TODAY_INTELLIGENCE_LOADING_COPY;
  }

  const surfacedCount =
    snapshot.surfacingCards.length +
    snapshot.watchForItems.length +
    snapshot.investigations.length;
  const hasContent =
    snapshot.intelligenceUpdates.length > 0 ||
    surfacedCount > 0 ||
    snapshot.userMapConclusions.length > 0 ||
    snapshot.actions.length > 0;

  if (!hasContent) {
    return TODAY_INTELLIGENCE_EMPTY_COPY;
  }

  if (snapshot.intelligenceUpdates.length > 0) {
    const parts = [`${snapshot.intelligenceUpdates.length} meaningful change${snapshot.intelligenceUpdates.length === 1 ? "" : "s"}`];
    if (surfacedCount > 0) {
      parts.push(`${surfacedCount} surfaced item${surfacedCount === 1 ? "" : "s"}`);
    }
    return `${parts.join(" · ")} · composed from your existing records.`;
  }

  return "Surfaced material and meaningful changes, composed from your existing records.";
}

export function hasTodayReentryContent(snapshot: TodayReentrySnapshot): boolean {
  return (
    snapshot.intelligenceUpdates.length > 0 ||
    snapshot.surfacingCards.length > 0 ||
    snapshot.userMapConclusions.length > 0 ||
    snapshot.watchForItems.length > 0 ||
    snapshot.actions.length > 0 ||
    snapshot.investigations.length > 0 ||
    snapshot.timelineMovements.length > 0
  );
}

export async function fetchTodayReentrySnapshot(): Promise<TodayReentrySnapshot> {
  const [
    journalResult,
    contradictionResult,
    patternsResult,
    intelligenceResult,
    userMapResult,
    watchForResult,
    investigationsResult,
    actionsResult,
    timelineResult,
  ] = await Promise.allSettled([
    fetch(TODAY_REENTRY_ENDPOINTS.journal, { method: "GET", cache: "no-store" }),
    fetch(TODAY_REENTRY_ENDPOINTS.contradiction, { method: "GET", cache: "no-store" }),
    fetch(TODAY_REENTRY_ENDPOINTS.patterns, { method: "GET", cache: "no-store" }),
    fetch(TODAY_REENTRY_ENDPOINTS.intelligenceUpdates, {
      method: "GET",
      cache: "no-store",
    }),
    fetch(TODAY_REENTRY_ENDPOINTS.userMapConclusions, {
      method: "GET",
      cache: "no-store",
    }),
    fetch(TODAY_REENTRY_ENDPOINTS.watchFor, { method: "GET", cache: "no-store" }),
    fetch(TODAY_REENTRY_ENDPOINTS.activeQuestions, {
      method: "GET",
      cache: "no-store",
    }),
    fetch(TODAY_REENTRY_ENDPOINTS.actions, { method: "GET", cache: "no-store" }),
    fetch(TODAY_REENTRY_ENDPOINTS.timelineModelLayers, {
      method: "GET",
      cache: "no-store",
    }),
  ]);

  let journalEntries: TodayJournalEntry[] = [];
  let contradictions: TodayTopContradiction[] = [];
  let patterns: TodayPatternsResponse | null = null;

  if (journalResult.status === "fulfilled" && journalResult.value.ok) {
    try {
      journalEntries = (await journalResult.value.json()) as TodayJournalEntry[];
    } catch {
      journalEntries = [];
    }
  }

  if (contradictionResult.status === "fulfilled" && contradictionResult.value.ok) {
    try {
      contradictions = (await contradictionResult.value.json()) as TodayTopContradiction[];
    } catch {
      contradictions = [];
    }
  }

  if (patternsResult.status === "fulfilled" && patternsResult.value.ok) {
    try {
      patterns = (await patternsResult.value.json()) as TodayPatternsResponse;
    } catch {
      patterns = null;
    }
  }

  let intelligenceUpdates: TodayIntelligenceUpdateItem[] = [];
  if (intelligenceResult.status === "fulfilled" && intelligenceResult.value.ok) {
    try {
      const payload = (await intelligenceResult.value.json()) as {
        items?: TodayIntelligenceUpdateItem[];
      };
      intelligenceUpdates = Array.isArray(payload.items) ? payload.items : [];
    } catch {
      intelligenceUpdates = [];
    }
  }

  let userMapConclusions: UserMapConclusionPublicApiListItem[] = [];
  if (userMapResult.status === "fulfilled" && userMapResult.value.ok) {
    try {
      const payload = (await userMapResult.value.json()) as {
        items?: UserMapConclusionPublicApiListItem[];
      };
      userMapConclusions = Array.isArray(payload.items) ? payload.items : [];
    } catch {
      userMapConclusions = [];
    }
  }

  let watchForItems: WatchForItem[] = [];
  if (watchForResult.status === "fulfilled" && watchForResult.value.ok) {
    try {
      const payload = (await watchForResult.value.json()) as { items?: WatchForItem[] };
      watchForItems = Array.isArray(payload.items) ? payload.items : [];
    } catch {
      watchForItems = [];
    }
  }

  let investigations: ActiveQuestionItem[] = [];
  if (investigationsResult.status === "fulfilled" && investigationsResult.value.ok) {
    try {
      const payload = (await investigationsResult.value.json()) as {
        items?: ActiveQuestionItem[];
      };
      investigations = Array.isArray(payload.items) ? payload.items : [];
    } catch {
      investigations = [];
    }
  }

  let actions: SurfacedActionView[] = [];
  if (actionsResult.status === "fulfilled" && actionsResult.value.ok) {
    try {
      const payload = (await actionsResult.value.json()) as {
        stabilizeNow?: SurfacedActionView[];
        buildForward?: SurfacedActionView[];
      };
      actions = [...(payload.stabilizeNow ?? []), ...(payload.buildForward ?? [])];
    } catch {
      actions = [];
    }
  }

  let timelineMovements: TimelineModelLayerItem[] = [];
  if (timelineResult.status === "fulfilled" && timelineResult.value.ok) {
    try {
      const payload = (await timelineResult.value.json()) as {
        items?: TimelineModelLayerItem[];
      };
      timelineMovements = Array.isArray(payload.items) ? payload.items.slice(0, 3) : [];
    } catch {
      timelineMovements = [];
    }
  }

  return {
    surfacingCards: buildTodaySurfacingCards({
      journalEntries,
      contradictions,
      patterns,
    }),
    intelligenceUpdates,
    userMapConclusions,
    watchForItems,
    investigations,
    actions,
    timelineMovements,
  };
}
