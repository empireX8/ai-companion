import type { ActionBucket, ActionStatus, SurfacedActionView } from "./actions-api";
import { ACTION_TERMS, ORVEK_COPY, PRODUCT_NAME } from "./trust-language";

export const DECISIONS_PAGE_TITLE = "Decisions";
export const DECISIONS_PAGE_META = "Choices tracked as evidence";

export const DECISIONS_PAGE_INTRO =
  `Choices ${PRODUCT_NAME} tracks because real decisions reveal how your ${ORVEK_COPY.mindModel.toLowerCase()} works under pressure — not a task list. Each item links to pattern context when available. Outcomes become learning signal when you record them.`;

export const DECISIONS_STABILIZE_TAB_LABEL = "Stabilize now";
export const DECISIONS_BUILD_TAB_LABEL = "Build forward";

export const DECISIONS_STABILIZE_TAB_INTRO =
  "Choices that may steady a pattern or tension before it escalates.";
export const DECISIONS_BUILD_TAB_INTRO =
  "Choices that test a direction forward from your current understanding.";

export const DECISIONS_PRIORITY_SECTION_LABEL = "Linked Mind Model context";
export const DECISIONS_PRIORITY_SECTION_INTRO =
  "Active patterns shaping these invitations — not a certainty score.";

export const DECISIONS_OPEN_SECTION_LABEL = "Unresolved choices";
export const DECISIONS_OPEN_SECTION_INTRO =
  "Still open — worth noticing, trying, or reflecting on before you record an outcome.";

export const DECISIONS_OUTCOMES_SECTION_LABEL = "Outcome learning";
export const DECISIONS_OUTCOMES_SECTION_INTRO =
  "Choices where you recorded what happened. This is evidence, not a performance score.";

export const DECISIONS_EMPTY_COPY =
  `No decision invitations yet. When ${PRODUCT_NAME} has enough pattern signal, choices may appear here.`;
export const DECISIONS_LOADING_COPY = "Loading decisions…";
export const DECISIONS_ERROR_COPY = "Could not load decisions.";

export const DECISIONS_FOOTER_STABILIZE_COPY =
  "These are tracked choices and invitations — not chores to complete.";
export const DECISIONS_FOOTER_BUILD_COPY =
  `These are ${ACTION_TERMS.smallExperiment}s to learn from — not commitments.`;

export const DECISIONS_SEND_TO_FIELDWORK_LABEL = "Send to Fieldwork";
export const DECISIONS_SEND_TO_FIELDWORK_LOADING_LABEL = "Sending to Fieldwork…";
export const DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY = "Could not create fieldwork prompt.";
export const DECISIONS_REFLECT_IN_EXPLORE_LABEL = "Reflect in Explore";
export const DECISIONS_RECEIPTS_LABEL = "Receipts";
export const DECISIONS_LINKED_CONTEXT_PREFIX = "Shaped by";

export type DecisionListGroupKey = "open" | "outcomes";

export type DecisionListGroup = {
  key: DecisionListGroupKey;
  label: string;
  intro: string;
  items: SurfacedActionView[];
};

const OPEN_STATUSES: ActionStatus[] = ["not_started"];
const OUTCOME_STATUSES: ActionStatus[] = ["done", "helped", "didnt_help"];

const GROUP_META: Record<
  DecisionListGroupKey,
  { label: string; intro: string; statuses: ActionStatus[] }
> = {
  open: {
    label: DECISIONS_OPEN_SECTION_LABEL,
    intro: DECISIONS_OPEN_SECTION_INTRO,
    statuses: OPEN_STATUSES,
  },
  outcomes: {
    label: DECISIONS_OUTCOMES_SECTION_LABEL,
    intro: DECISIONS_OUTCOMES_SECTION_INTRO,
    statuses: OUTCOME_STATUSES,
  },
};

const GROUP_ORDER: DecisionListGroupKey[] = ["open", "outcomes"];

export function toDecisionStatusLabel(status: ActionStatus): string {
  if (status === "not_started") return "Unresolved";
  if (status === "done") return "Recorded";
  if (status === "helped") return "Helped";
  if (status === "didnt_help") return "Didn't help";
  return status;
}

export function getDecisionTabIntro(bucket: ActionBucket): string {
  return bucket === "stabilize"
    ? DECISIONS_STABILIZE_TAB_INTRO
    : DECISIONS_BUILD_TAB_INTRO;
}

export function groupDecisionsByResolution(
  items: SurfacedActionView[]
): DecisionListGroup[] {
  return GROUP_ORDER.flatMap((key) => {
    const meta = GROUP_META[key];
    const groupItems = items.filter((item) => meta.statuses.includes(item.status));
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

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export function formatDecisionDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}
