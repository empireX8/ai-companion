import {
  TODAY_CHANGES_VIEW_ALL_HREF,
  TODAY_REPORT_FULL_DEFERRED_COPY,
  TODAY_REPORT_FULL_LABEL,
  TODAY_REPORT_OUTPUT_TITLE,
} from "../today-intelligence-updates";
import type { InspectorSelectableObjectType } from "../inspector-selection";
import { isTodayReentryHref } from "../orvek-v0/today-workbench-routes";
import {
  buildTodayAttentionRows,
  buildTodayBriefingMeta,
  buildTodayBriefingTitle,
  buildTodayChangeRows,
  buildTodayFieldworkRows,
  buildTodayOpenLoopRows,
  buildTodayReceiptCards,
  pickTodayHeroItem,
  TODAY_ATTENTION_EMPTY_COPY,
  TODAY_PRIMARY_EMPTY_COPY,
  type TodayAttentionRow,
  type TodayHeroItem,
  type TodayReentrySnapshot,
} from "../today-reentry";
import { TODAY_INTELLIGENCE_LOADING_COPY } from "../today-surface";

import type {
  V0CheckInOption,
  V0NowRowIcon,
  V0PrimaryAction,
  V0TodayHeroSlot,
  V0TodayMovementRow,
  V0TodayNowRow,
  V0TodayReceiptRow,
  V0TodayReportSlot,
  V0TodayViewProps,
  V0TodayIntentMetadata,
  V0TodayInspectorTab,
  V0TodayPageId,
} from "./types";

const PRIOR_READ_EMPTY =
  "Prior read is not shown in this feed — open movement in the inspector.";

const PRIMARY_ACTIONS: V0PrimaryAction[] = [
  { label: "Continue from what changed", href: "/what-changed", primary: true },
  { label: "Add what happened", href: "/journal-chat" },
  { label: "Review outcome", href: "/actions" },
  { label: "Check in on fieldwork", href: "/watch-for" },
  { label: "Capture new signal", href: "/journal-chat" },
];

function routeIntentForHref(
  href: string
): Pick<V0TodayIntentMetadata, "reportId" | "pageId" | "overlayId"> {
  if (href === "/what-changed") {
    return { reportId: "rep-weekly" };
  }
  if (href === "/journal-chat") {
    return { overlayId: "capture" };
  }
  if (href.startsWith("/your-map")) {
    return { pageId: "map" };
  }
  if (href.startsWith("/actions")) {
    return { pageId: "decisions" };
  }
  if (href.startsWith("/timeline")) {
    return { pageId: "timeline" };
  }
  if (href.startsWith("/explore")) {
    return { pageId: "explore" };
  }
  if (href.startsWith("/active-questions")) {
    return { pageId: "explore" };
  }

  return {};
}

function pageIdForSelectableType(
  type: InspectorSelectableObjectType | null | undefined
): V0TodayPageId | null {
  switch (type) {
    case "usermap_conclusion":
    case "pattern_claim":
    case "contradiction_node":
    case "context_profile":
    case "model_goal":
      return "map";
    case "model_update":
      return "timeline";
    default:
      return null;
  }
}

function extractRouteTargetId(
  href: string | null | undefined,
  prefix: string
): string | null {
  if (!href || !href.startsWith(prefix)) {
    return null;
  }

  const tail = href.slice(prefix.length).split("/")[0]?.trim();
  return tail ? tail : null;
}

function selectionIntent(
  selectionId: string | null,
  inspectSelectId: string | null = selectionId,
  movementId: string | null = null,
  inspectorTab: V0TodayInspectorTab | null = null
): Pick<
  V0TodayIntentMetadata,
  "selectionId" | "inspectSelectId" | "movementId" | "inspectorTab"
> {
  return {
    selectionId,
    inspectSelectId,
    movementId,
    inspectorTab,
  };
}

function applyPrimaryActionRouting(actions: V0PrimaryAction[]): V0PrimaryAction[] {
  return actions.map((action) => {
    const intent = routeIntentForHref(action.href);
    if (!isTodayReentryHref(action.href)) {
      return { ...action, ...intent, disabled: true };
    }
    return { ...action, ...intent };
  });
}

const CHECK_INS: V0CheckInOption[] = [
  { id: "calm", label: "Calm", color: "oklch(0.72 0.05 220)", href: "#", disabled: true },
  { id: "anxious", label: "Anxious", color: "oklch(0.78 0.12 72)", href: "#", disabled: true },
  { id: "tense", label: "Tense", color: "oklch(0.62 0.16 25)", href: "#", disabled: true },
  {
    id: "overwhelmed",
    label: "Overwhelmed",
    color: "oklch(0.55 0.03 250)",
    href: "#",
    disabled: true,
  },
  { id: "numb", label: "Numb", color: "oklch(0.66 0.006 250)", href: "#", disabled: true },
];

function formatRelativeTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function rowIcon(row: TodayAttentionRow): V0NowRowIcon {
  const lane = row.laneLabel.toLowerCase();
  if (lane.includes("watch") || lane.includes("fieldwork")) return "fieldwork";
  if (lane.includes("decision")) return "decision";
  if (lane.includes("question") || lane.includes("investigation")) return "question";
  if (lane.includes("movement") || lane.includes("model")) return "movement";
  return "watch";
}

function mapHero(hero: TodayHeroItem): V0TodayViewProps["hero"] {
  let primaryAction: V0TodayHeroSlot["primaryAction"] = null;
  const routeIntent = hero.href ? routeIntentForHref(hero.href) : {};
  const inferredTargetId = extractRouteTargetId(hero.href, "/active-questions/");
  const selectionId = hero.selection?.objectId ?? inferredTargetId ?? null;
  const inspectSelectId = hero.selection
    ? hero.selection.modelUpdateId ?? hero.selection.objectId
    : hero.movement?.id ?? inferredTargetId ?? null;
  const movementId = hero.movement?.id ?? null;
  const pageId = routeIntent.pageId ?? pageIdForSelectableType(hero.selection?.objectType);
  const inspectorTab = hero.selection?.tab ?? (movementId ? "movement" : null);
  const selectionMetadata = selectionIntent(
    selectionId,
    inspectSelectId,
    movementId,
    inspectorTab
  );

  if (hero.href && isTodayReentryHref(hero.href)) {
    primaryAction = {
      kind: "link",
      href: hero.href,
      label: "Open",
      ...routeIntent,
      ...selectionMetadata,
    };
  } else if (hero.selection) {
    primaryAction = {
      kind: "inspect",
      ...routeIntent,
      ...selectionMetadata,
    };
  }

  return {
    kicker: hero.laneLabel,
    title: hero.title,
    summary: hero.summary || hero.whyItMatters || "",
    whyItMatters: hero.whyItMatters ?? null,
    whatChanged: hero.typeLabel,
    linkedReceipts: hero.meta ?? "—",
    lastEvidence: formatRelativeTime(hero.occurredAt),
    primaryAction,
    showSeeWhyMoved: Boolean(hero.movement),
    inspectSelectId,
    movementId,
    selectionId,
    pageId,
    inspectorTab,
  };
}

function mapNowRow(row: TodayAttentionRow): V0TodayNowRow {
  const inferredTargetId = extractRouteTargetId(row.href, "/active-questions/");
  const selectionId = row.selection?.objectId ?? inferredTargetId ?? null;
  const inspectSelectId = row.selection
    ? row.selection.modelUpdateId ?? row.selection.objectId
    : inferredTargetId;
  const movementId = row.selection?.modelUpdateId ?? null;
  const pageId =
    row.href && routeIntentForHref(row.href).pageId
      ? routeIntentForHref(row.href).pageId
      : pageIdForSelectableType(row.selection?.objectType);
  const inspectorTab = row.selection?.tab ?? (movementId ? "movement" : null);

  return {
    id: row.id,
    kicker: row.laneLabel,
    icon: rowIcon(row),
    title: row.title,
    status: row.meta ?? row.typeLabel,
    href: row.href,
    hasSelection: Boolean(row.selection),
    inspectorTab,
    selectionId,
    inspectSelectId,
    movementId,
    pageId,
  };
}

export function filterDefined<T>(items: (T | null | undefined)[]): T[] {
  return items.filter((item): item is T => item != null);
}

function normalizeReceiptRow(row: V0TodayReceiptRow): V0TodayReceiptRow {
  const quote = row.quote?.trim() || "Receipt";
  const meta = row.meta?.trim() || "Receipt";
  return {
    id: row.id || `receipt-${quote.slice(0, 24)}`,
    quote,
    meta,
    href: row.href || "#",
  };
}

export function normalizeV0TodayViewProps(props: V0TodayViewProps): V0TodayViewProps {
  return {
    ...props,
    primaryActions: filterDefined(props.primaryActions),
    nowRows: filterDefined(props.nowRows).filter((row) => Boolean(row.id && row.title)),
    movements: filterDefined(props.movements).filter((row) => Boolean(row.id && row.updated)),
    receipts: filterDefined(props.receipts).map(normalizeReceiptRow),
    checkIns: filterDefined(props.checkIns),
  };
}

/** Flatten v0 Today array slots for adapter regression checks. */
export function listV0TodayArrayEntries(props: V0TodayViewProps): unknown[] {
  return [
    ...props.primaryActions,
    ...props.nowRows,
    ...props.movements,
    ...props.receipts,
    ...props.checkIns,
  ];
}

export type MapTodayDataInput = {
  snapshot: TodayReentrySnapshot;
  isLoading: boolean;
  briefingDate: string;
};

export function mapTodayDataToV0Props(input: MapTodayDataInput): V0TodayViewProps {
  const { snapshot, isLoading, briefingDate } = input;
  const hero = pickTodayHeroItem(snapshot);
  const attentionRows = buildTodayAttentionRows(snapshot, hero);
  const fieldworkRows = buildTodayFieldworkRows(snapshot, hero);
  const openLoopRows = buildTodayOpenLoopRows(snapshot);
  const changeRows = buildTodayChangeRows(snapshot, hero);
  const receiptCards = buildTodayReceiptCards(snapshot);
  const nowRows = filterDefined(
    [...attentionRows, ...fieldworkRows, ...openLoopRows].slice(0, 6).map(mapNowRow)
  );
  const movementSource = hero?.movement ? [hero.movement, ...changeRows] : changeRows;
  const movements: V0TodayMovementRow[] = filterDefined(
    movementSource.slice(0, 3).map((m) => ({
      id: m.id,
      previous: null,
      updated: m.userFacingSummary,
      evidence: `${m.updateTypeLabel} · ${m.affectedObjectTypeLabel}`,
    }))
  );

  let report: V0TodayReportSlot | null = null;
  if (snapshot.intelligenceUpdates.length > 0) {
    const latest = snapshot.intelligenceUpdates[0]!;
    const count = snapshot.intelligenceUpdates.length;
    report = {
      title: TODAY_REPORT_OUTPUT_TITLE,
      meta: `${count} published movement${count === 1 ? "" : "s"} in this window`,
      href: TODAY_CHANGES_VIEW_ALL_HREF,
      reportId: "rep-weekly",
      fullReportLabel: TODAY_REPORT_FULL_LABEL,
      fullReportAvailable: isTodayReentryHref(TODAY_CHANGES_VIEW_ALL_HREF),
      fullReportDeferredCopy: TODAY_REPORT_FULL_DEFERRED_COPY,
      primaryMovement: {
        id: latest.id,
        inspectSelectId: latest.id,
        summary: latest.userFacingSummary,
        evidence: `${latest.updateTypeLabel} · ${latest.affectedObjectTypeLabel}`,
        selectionId: latest.id,
        movementId: latest.id,
        inspectorTab: "movement",
      },
    };
  }

  const receipts: V0TodayReceiptRow[] = filterDefined(receiptCards).map((card, index) => ({
    id: `receipt-${index}-${card.title?.trim() || "item"}`,
    quote: card.body?.trim() || card.title?.trim() || "Receipt",
    meta: `${card.kind ?? "Receipt"} · ${card.meta?.trim() || "Receipt"}`,
    href: card.receiptHref ?? card.detailHref ?? "#",
  }));

  return normalizeV0TodayViewProps({
    briefingDate,
    briefingTitle: isLoading ? TODAY_INTELLIGENCE_LOADING_COPY : buildTodayBriefingTitle(snapshot),
    briefingMeta: buildTodayBriefingMeta(snapshot, isLoading),
    isLoading,
    loadingCopy: TODAY_INTELLIGENCE_LOADING_COPY,
    heroEmptyCopy: TODAY_PRIMARY_EMPTY_COPY,
    hero: hero ? mapHero(hero) : null,
    primaryActions: applyPrimaryActionRouting(PRIMARY_ACTIONS),
    nowRows,
    nowEmptyCopy: TODAY_ATTENTION_EMPTY_COPY,
    movements,
    movementEmptyCopy: "No delta log is available in this window.",
    report,
    receipts,
    checkIns: CHECK_INS,
    priorReadEmptyCopy: PRIOR_READ_EMPTY,
  });
}
