import { ORVEK_COPY, PRODUCT_NAME } from "./trust-language";

export const EXPLORE_PAGE_TITLE = "Explore";
export const EXPLORE_PAGE_SUBTITLE = `Think with your ${ORVEK_COPY.mindModel}`;
export const EXPLORE_PAGE_META = "Grounded conversation with your Mind Model";

export const EXPLORE_PAGE_INTRO =
  `Explore is where you think with your ${ORVEK_COPY.mindModel.toLowerCase()} — grounded in receipts, linked objects, and published movement, not a generic chat surface.`;

export const EXPLORE_CHAT_PLACEHOLDER = "Ask your Mind Model…";
export const EXPLORE_CHAT_EMPTY_PROMPT =
  "What do you want to understand or test against your current Mind Model?";
export const EXPLORE_CHAT_FOOTER_NOTE = "Conversation saves automatically";

export const EXPLORE_GROUNDING_SECTION_LABEL = "Grounding";
export const EXPLORE_GROUNDING_SECTION_INTRO =
  `Orvek draws on your receipts, map context, patterns, and prior movement when this conversation runs. That grounding stays separate from draft proposals.`;

export const EXPLORE_PUBLISHED_MOVEMENT_SECTION_LABEL = `Published ${ORVEK_COPY.mindModelMovement}`;
export const EXPLORE_PUBLISHED_MOVEMENT_SECTION_INTRO =
  `Shown only after review and publish — never mixed with draft or proposed updates. Open in Inspector → ${ORVEK_COPY.mindModelMovementTab}.`;

export const EXPLORE_DRAFT_REVIEW_SECTION_LABEL = "Proposed updates";
export const EXPLORE_DRAFT_REVIEW_SECTION_INTRO =
  `Draft or proposed items from this conversation — confirm or dismiss before they affect your ${ORVEK_COPY.mindModel.toLowerCase()}. Not published movement.`;

export const EXPLORE_HANDOFF_SECTION_LABEL = "Decision handoff";
export const EXPLORE_HANDOFF_LOADING_COPY = "Loading decision handoff…";
export const EXPLORE_HANDOFF_UNAVAILABLE_COPY = "Decision handoff is unavailable.";
export const EXPLORE_HANDOFF_BANNER_LABEL = "Opened from Decisions";
export const EXPLORE_HANDOFF_VIEW_DECISION_LABEL = "View decision";
export const EXPLORE_HANDOFF_WHY_LABEL = "Why this was suggested";
export const EXPLORE_HANDOFF_LINKED_SOURCE_LABEL = "Linked Mind Model context";
export const EXPLORE_HANDOFF_OPEN_PATTERN_LABEL = "Open linked pattern in Inspector";

export const EXPLORE_MOVEMENT_INSPECTOR_LABEL = "Open movement in Inspector";
export const EXPLORE_EVIDENCE_INSPECTOR_LABEL = "Open in Inspector";

export const EXPLORE_MOVEMENT_ERROR_COPY =
  `Could not check for published ${ORVEK_COPY.mindModelMovement.toLowerCase()} right now.`;
export const EXPLORE_REVIEW_ERROR_COPY = "Could not check proposed updates right now.";

export const EXPLORE_REENTRY_LINKS = [
  { href: "/", label: "Today" },
  { href: "/your-map", label: "Your Map" },
  { href: "/what-changed", label: "What Changed" },
  { href: "/timeline", label: "Timeline" },
  { href: "/watch-for", label: "Fieldwork" },
] as const;
