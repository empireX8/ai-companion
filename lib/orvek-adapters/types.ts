/** Serializable v0 Today view props — UI layer only, no callbacks. */

export type V0NowRowIcon = "watch" | "fieldwork" | "decision" | "question" | "movement";

export type V0PrimaryAction = {
  label: string;
  href: string;
  primary?: boolean;
  /** When true, action is shown but not routed (legacy/deferred surface). */
  disabled?: boolean;
};

export type V0TodayHeroSlot = {
  kicker: string;
  title: string;
  summary: string;
  whatChanged: string;
  linkedReceipts: string;
  lastEvidence: string;
  primaryAction:
    | { kind: "link"; href: string; label: string }
    | { kind: "inspect" }
    | null;
  showSeeWhyMoved: boolean;
  /** Registered workbench object id for inspect selection (hero card). */
  inspectSelectId: string | null;
  /** Model update id for movement inspector tab when hero is movement-driven. */
  movementId: string | null;
};

export type V0TodayNowRow = {
  id: string;
  kicker: string;
  icon: V0NowRowIcon;
  title: string;
  status: string;
  href: string | null;
  hasSelection: boolean;
  inspectorTab: "evidence" | "movement" | null;
};

export type V0TodayMovementRow = {
  id: string;
  /** When null, view keeps v0 Previously slot with honest empty copy. */
  previous: string | null;
  updated: string;
  evidence: string;
};

export type V0TodayReportMovementPreview = {
  id: string;
  /** Registered workbench object id for Inspector selection (model_update id). */
  inspectSelectId: string;
  summary: string;
  evidence: string;
};

export type V0TodayReportSlot = {
  title: string;
  meta: string;
  href: string;
  fullReportLabel: string;
  /** When false, Today must not link to the full report route. */
  fullReportAvailable: boolean;
  fullReportDeferredCopy: string;
  primaryMovement: V0TodayReportMovementPreview | null;
};

export type V0TodayReceiptRow = {
  id: string;
  quote: string;
  meta: string;
  href: string;
};

export type V0CheckInOption = {
  id: string;
  label: string;
  color: string;
  href: string;
};

export type V0TodayViewProps = {
  briefingDate: string;
  briefingTitle: string;
  briefingMeta: string;
  isLoading: boolean;
  loadingCopy: string;
  heroEmptyCopy: string;
  hero: V0TodayHeroSlot | null;
  primaryActions: V0PrimaryAction[];
  nowRows: V0TodayNowRow[];
  nowEmptyCopy: string;
  movements: V0TodayMovementRow[];
  movementEmptyCopy: string;
  priorReadEmptyCopy: string;
  report: V0TodayReportSlot | null;
  receipts: V0TodayReceiptRow[];
  checkIns: V0CheckInOption[];
};
