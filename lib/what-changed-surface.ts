import type { WhatChangedListItem } from "./public-intelligence-safe-slice";
import { ORVEK_COPY, PRODUCT_NAME } from "./trust-language";

export const WHAT_CHANGED_PAGE_TITLE = "What Changed";
export const WHAT_CHANGED_PAGE_META = `${ORVEK_COPY.mindModel} briefing`;

export const WHAT_CHANGED_PAGE_INTRO =
  `This is ${PRODUCT_NAME}'s briefing layer — published ${ORVEK_COPY.mindModelMovement.toLowerCase()} from your evidence. It shows the fact packet, the current read, what weakens it, and what would change the conclusion.`;

export const WHAT_CHANGED_PRIMARY_SECTION_LABEL = "Scope / Evidence Packet";
export const WHAT_CHANGED_PRIMARY_SECTION_INTRO =
  "Briefing grammar: facts → model movement → supported read → disconfirming evidence → uncertainty → impact → reality gate → fieldwork / watch for → re-entry → what would change this conclusion.";

export const WHAT_CHANGED_EARLIER_SECTION_LABEL = "Earlier movement";
export const WHAT_CHANGED_EARLIER_SECTION_INTRO =
  "Previously published shifts in the same window — compact cards only.";

export const WHAT_CHANGED_LIST_SECTION_LABEL = "Recent changes";

export const WHAT_CHANGED_EMPTY_PRIMARY =
  `No published ${ORVEK_COPY.mindModel.toLowerCase()} movement is ready to brief yet.`;

export const WHAT_CHANGED_EMPTY_SECONDARY =
  `When ${PRODUCT_NAME} publishes a supported shift from your evidence, the briefing will appear here. Keep capturing signal in journal, Explore, or Fieldwork.`;

export const WHAT_CHANGED_WHAT_CHANGED_LABEL = "What changed";
export const WHAT_CHANGED_WHY_LABEL = "Current read";
export const WHAT_CHANGED_EVIDENCE_LABEL = "Evidence";
export const WHAT_CHANGED_EVIDENCE_INTRO =
  "Linked receipts and sources attached to this briefing — summary only.";
export const WHAT_CHANGED_EVIDENCE_EMPTY =
  "No linked evidence is available for this movement yet.";
export const WHAT_CHANGED_DISCONFIRMING_LABEL = "What weakens this";
export const WHAT_CHANGED_DISCONFIRMING_EMPTY =
  "No disconfirming evidence is surfaced in this briefing yet.";
export const WHAT_CHANGED_UNCERTAINTY_LABEL = "What is not known yet";
export const WHAT_CHANGED_UNCERTAINTY_EMPTY =
  "No explicit uncertainty is surfaced yet.";
export const WHAT_CHANGED_IMPACT_LABEL = "What this affects";
export const WHAT_CHANGED_IMPACT_EMPTY =
  "Impact is not surfaced in this summary yet.";
export const WHAT_CHANGED_REALITY_GATE_LABEL = "What would test this";
export const WHAT_CHANGED_REALITY_GATE_EMPTY =
  "No reality gate is surfaced yet.";
export const WHAT_CHANGED_FIELDWORK_LABEL = "Evidence to generate next";
export const WHAT_CHANGED_FIELDWORK_EMPTY =
  "No fieldwork or watch-for next step is surfaced yet.";
export const WHAT_CHANGED_REENTRY_LABEL = "Re-entry";
export const WHAT_CHANGED_REENTRY_INTRO =
  "Related surfaces to continue from this movement — not automated next steps.";
export const WHAT_CHANGED_CONCLUSION_LABEL = "What would change this conclusion";
export const WHAT_CHANGED_CONCLUSION_EMPTY =
  "No explicit change condition is surfaced yet.";

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
