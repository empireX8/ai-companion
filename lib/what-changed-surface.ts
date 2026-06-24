import type { WhatChangedListItem } from "./public-intelligence-safe-slice";
import { ORVEK_COPY, PRODUCT_NAME } from "./trust-language";

export const WHAT_CHANGED_PAGE_TITLE = "What Changed";
export const WHAT_CHANGED_PAGE_META = `${ORVEK_COPY.mindModel} movement explained`;

export const WHAT_CHANGED_PAGE_INTRO =
  `This is ${PRODUCT_NAME}'s explanation layer — published ${ORVEK_COPY.mindModelMovement.toLowerCase()} from your evidence. It shows what shifted, what supported the shift, and where to re-enter.`;

export const WHAT_CHANGED_PRIMARY_SECTION_LABEL = `Latest ${ORVEK_COPY.mindModelMovement}`;
export const WHAT_CHANGED_PRIMARY_SECTION_INTRO =
  `The most recent published shift in ${ORVEK_COPY.orveksRead.toLowerCase()}.`;

export const WHAT_CHANGED_EARLIER_SECTION_LABEL = "Earlier movement";
export const WHAT_CHANGED_EARLIER_SECTION_INTRO =
  "Previously published shifts in the same window — compact cards only.";

export const WHAT_CHANGED_LIST_SECTION_LABEL = "Recent changes";

export const WHAT_CHANGED_EMPTY_PRIMARY =
  `No published ${ORVEK_COPY.mindModel.toLowerCase()} movement is ready to show here yet.`;

export const WHAT_CHANGED_EMPTY_SECONDARY =
  `When ${PRODUCT_NAME} publishes a meaningful shift from your evidence, it will appear here. Keep capturing signal in journal, Explore, or Fieldwork.`;

export const WHAT_CHANGED_WHAT_CHANGED_LABEL = "What changed";
export const WHAT_CHANGED_WHY_LABEL = `Why ${PRODUCT_NAME} thinks this`;
export const WHAT_CHANGED_EVIDENCE_LABEL = "Evidence behind it";
export const WHAT_CHANGED_EVIDENCE_INTRO =
  "Linked receipts and sources attached to this movement — summary only.";
export const WHAT_CHANGED_EVIDENCE_EMPTY =
  "No linked evidence is available for this movement yet.";
export const WHAT_CHANGED_REENTRY_LABEL = "Where to re-enter";
export const WHAT_CHANGED_REENTRY_INTRO =
  "Related surfaces to continue from this movement — not automated next steps.";

export const WHAT_CHANGED_INSPECTOR_LABEL = "Open movement in Inspector";

export const WHAT_CHANGED_REENTRY_LINKS = [
  { href: "/", label: "Today" },
  { href: "/your-map", label: "Your Map" },
  { href: "/timeline", label: "Timeline" },
  { href: "/watch-for", label: "Fieldwork" },
] as const;

export type WhatChangedMovementGroup = {
  primary: WhatChangedListItem | null;
  earlier: WhatChangedListItem[];
};

export function splitWhatChangedMovements(
  items: WhatChangedListItem[]
): WhatChangedMovementGroup {
  if (items.length === 0) {
    return { primary: null, earlier: [] };
  }

  return {
    primary: items[0] ?? null,
    earlier: items.slice(1),
  };
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export function formatWhatChangedDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}

export function toWhatChangedMovementTitle(item: WhatChangedListItem): string {
  return `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`;
}
