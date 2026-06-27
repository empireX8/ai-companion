import {
  TODAY_CHANGES_VIEW_ALL_HREF,
  TODAY_REPORT_FULL_DEFERRED_COPY,
  TODAY_REPORT_FULL_LABEL,
  TODAY_REPORT_OUTPUT_TITLE,
} from "../today-intelligence-updates";
import { isIntegratedOrvekWorkbenchHref } from "../orvek-v0/today-workbench-routes";
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

function applyPrimaryActionRouting(
  actions: V0PrimaryAction[],
  hasReportOutput: boolean
): V0PrimaryAction[] {
  return actions.map((action) => {
    if (!isIntegratedOrvekWorkbenchHref(action.href)) {
      return { ...action, disabled: true };
    }
    if (hasReportOutput && action.href === TODAY_CHANGES_VIEW_ALL_HREF) {
      return { ...action, disabled: true };
    }
    return action;
  });
}

const CHECK_INS: V0CheckInOption[] = [
  { id: "calm", label: "Calm", color: "oklch(0.72 0.05 220)", href: "/check-ins?state=stable" },
  { id: "anxious", label: "Anxious", color: "oklch(0.78 0.12 72)", href: "/check-ins?state=stressed" },
  { id: "tense", label: "Tense", color: "oklch(0.62 0.16 25)", href: "/check-ins?state=overloaded" },
  {
    id: "overwhelmed",
    label: "Overwhelmed",
    color: "oklch(0.55 0.03 250)",
    href: "/check-ins?state=overloaded",
  },
  { id: "numb", label: "Numb", color: "oklch(0.66 0.006 250)", href: "/check-ins?state=flat" },
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

  if (hero.href && isIntegratedOrvekWorkbenchHref(hero.href)) {
    primaryAction = { kind: "link", href: hero.href, label: "Open" };
  } else if (hero.selection) {
    primaryAction = { kind: "inspect" };
  }

  const inspectSelectId = hero.selection
    ? hero.movement
      ? hero.movement.id
      : hero.id
    : null;

  return {
    kicker: hero.laneLabel,
    title: hero.title,
    summary: hero.summary || hero.whyItMatters || "",
    whatChanged: hero.typeLabel,
    linkedReceipts: hero.meta ?? "—",
    lastEvidence: formatRelativeTime(hero.occurredAt),
    primaryAction,
    showSeeWhyMoved: Boolean(hero.movement),
    inspectSelectId,
    movementId: hero.movement?.id ?? null,
  };
}

function mapNowRow(row: TodayAttentionRow): V0TodayNowRow {
  return {
    id: row.id,
    kicker: row.laneLabel,
    icon: rowIcon(row),
    title: row.title,
    status: row.meta ?? row.typeLabel,
    href: row.href,
    hasSelection: Boolean(row.selection),
    inspectorTab: row.selection?.tab ?? null,
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
      fullReportLabel: TODAY_REPORT_FULL_LABEL,
      fullReportAvailable: isIntegratedOrvekWorkbenchHref(TODAY_CHANGES_VIEW_ALL_HREF),
      fullReportDeferredCopy: TODAY_REPORT_FULL_DEFERRED_COPY,
      primaryMovement: {
        id: latest.id,
        inspectSelectId: latest.id,
        summary: latest.userFacingSummary,
        evidence: `${latest.updateTypeLabel} · ${latest.affectedObjectTypeLabel}`,
      },
    };
  }

  const hasReportOutput = report !== null;

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
    primaryActions: applyPrimaryActionRouting(PRIMARY_ACTIONS, hasReportOutput),
    nowRows,
    nowEmptyCopy: TODAY_ATTENTION_EMPTY_COPY,
    movements,
    movementEmptyCopy: "No recent movement in this window.",
    report,
    receipts,
    checkIns: CHECK_INS,
    priorReadEmptyCopy: PRIOR_READ_EMPTY,
  });
}
