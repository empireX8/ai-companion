import type { FieldworkStatus } from "@prisma/client";

import type { WatchForListItem } from "./public-intelligence-safe-slice";
import {
  isInspectorSelectableObjectType,
  parseSelectableObjectFromHref,
  type InspectorSelectableObjectType,
} from "./inspector-selection";
import { ORVEK_COPY, PRODUCT_NAME } from "./trust-language";

export const WATCH_FOR_PAGE_TITLE = "Fieldwork";
export const WATCH_FOR_PAGE_EYEBROW = "Watch For";
export const WATCH_FOR_PAGE_META = "Evidence to notice, try, and bring back";

export const WATCH_FOR_PAGE_INTRO =
  `This is where ${PRODUCT_NAME} turns ${ORVEK_COPY.orveksRead.toLowerCase()} into things to notice or test in real life — so your ${ORVEK_COPY.mindModel.toLowerCase()} can improve from evidence, not guesses.`;

export const WATCH_FOR_ACTIVE_SECTION_LABEL = "Active in the field";
export const WATCH_FOR_ACTIVE_SECTION_INTRO =
  "Prompts you are already watching — notice what shows up and bring back signal.";

export const WATCH_FOR_ASSIGNED_SECTION_LABEL = "Ready to try";
export const WATCH_FOR_ASSIGNED_SECTION_INTRO =
  "Assigned prompts waiting for you to start noticing or testing in real life.";

export const WATCH_FOR_LIST_SECTION_LABEL = "Watch prompts";

export const WATCH_FOR_EMPTY_PRIMARY =
  "No fieldwork prompts are active right now.";
export const WATCH_FOR_EMPTY_SECONDARY =
  `When ${PRODUCT_NAME} has enough evidence, observation prompts may appear here. Capture in journal or check-ins to build signal.`;

export const WATCH_FOR_DETAIL_BACK_LABEL = "← Back to Fieldwork";
export const WATCH_FOR_DETAIL_WHAT_TO_NOTICE_LABEL = "What to notice";
export const WATCH_FOR_DETAIL_TESTING_LABEL = "What this is testing";
export const WATCH_FOR_DETAIL_LINKED_CONTEXT_LABEL = "Linked Mind Model context";
export const WATCH_FOR_DETAIL_LINKED_CONTEXT_INTRO =
  "Verified link to the pattern, tension, question, or map item this prompt is watching.";
export const WATCH_FOR_DETAIL_EVIDENCE_LABEL = "Evidence brought back";
export const WATCH_FOR_DETAIL_EVIDENCE_INTRO =
  "Linked receipts and sources already attached to this prompt — summary only.";
export const WATCH_FOR_DETAIL_EVIDENCE_EMPTY =
  "No evidence linked to this prompt yet. Notice, try, or test in real life, then capture what you find.";
export const WATCH_FOR_DETAIL_OBSERVATION_LABEL = "Your observation notes";
export const WATCH_FOR_DETAIL_OBSERVATION_INTRO =
  "Summary fields only — not raw private evidence.";
export const WATCH_FOR_DETAIL_TIMING_LABEL = "Timing";

export type WatchForListGroupKey = "active" | "assigned";

export type WatchForListGroup = {
  key: WatchForListGroupKey;
  label: string;
  intro: string;
  items: WatchForListItem[];
};

const GROUP_META: Record<
  WatchForListGroupKey,
  { label: string; intro: string; statuses: FieldworkStatus[] }
> = {
  active: {
    label: WATCH_FOR_ACTIVE_SECTION_LABEL,
    intro: WATCH_FOR_ACTIVE_SECTION_INTRO,
    statuses: ["active"],
  },
  assigned: {
    label: WATCH_FOR_ASSIGNED_SECTION_LABEL,
    intro: WATCH_FOR_ASSIGNED_SECTION_INTRO,
    statuses: ["assigned"],
  },
};

const GROUP_ORDER: WatchForListGroupKey[] = ["active", "assigned"];

export function toWatchForFieldActionHint(status: FieldworkStatus): string | null {
  if (status === "active") {
    return "Notice and bring back evidence";
  }
  if (status === "assigned") {
    return "Try this in real life";
  }
  return null;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export function formatWatchForListDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}

export function groupWatchForListItems(
  items: WatchForListItem[],
  statusById: ReadonlyMap<string, FieldworkStatus>
): WatchForListGroup[] {
  return GROUP_ORDER.flatMap((key) => {
    const meta = GROUP_META[key];
    const groupItems = items.filter((item) => {
      const status = statusById.get(item.id);
      return status ? meta.statuses.includes(status) : false;
    });

    if (groupItems.length === 0) {
      return [];
    }

    return [
      {
        key,
        label: meta.label,
        intro: meta.intro,
        items: groupItems,
      },
    ];
  });
}

export function getWatchForInspectorSelection(input: {
  linkedObjectHref: string | null;
  title: string;
}):
  | {
      objectType: InspectorSelectableObjectType;
      objectId: string;
      title: string;
    }
  | null {
  if (!input.linkedObjectHref) {
    return null;
  }

  const parsed = parseSelectableObjectFromHref(input.linkedObjectHref);
  if (!parsed || !isInspectorSelectableObjectType(parsed.objectType)) {
    return null;
  }

  return {
    objectType: parsed.objectType,
    objectId: parsed.objectId,
    title: input.title,
  };
}
