import { ACTIVE_QUESTIONS_ENDPOINT, type ActiveQuestionItem } from "./active-questions";
import {
  TODAY_CHANGES_VIEW_ALL_HREF,
  TODAY_INTELLIGENCE_UPDATES_ENDPOINT,
  type TodayIntelligenceUpdateItem,
} from "./today-intelligence-updates";
import { ORVEK_COPY } from "./trust-language";

export const MAP_MOVEMENT_PREVIEW_LIMIT = 3;
export const MAP_OPEN_QUESTIONS_PREVIEW_LIMIT = 4;

export const MAP_MOVEMENT_SECTION_LABEL = `Recent ${ORVEK_COPY.mindModelMovement}`;
export const MAP_MOVEMENT_SECTION_INTRO =
  `Published shifts in ${ORVEK_COPY.orveksRead.toLowerCase()} from your evidence — compact preview only.`;
export const MAP_MOVEMENT_EMPTY_COPY =
  `No recent ${ORVEK_COPY.mindModel.toLowerCase()} movement is ready to show here yet.`;
export const MAP_MOVEMENT_VIEW_ALL_HREF = TODAY_CHANGES_VIEW_ALL_HREF;

export const MAP_OPEN_QUESTIONS_SECTION_LABEL = "Needs more evidence / open questions";
export const MAP_OPEN_QUESTIONS_SECTION_INTRO =
  "Open investigations still gathering evidence — not confirmed conclusions.";
export const MAP_OPEN_QUESTIONS_EMPTY_COPY = "No active questions need review right now.";
export const MAP_OPEN_QUESTIONS_VIEW_ALL_HREF = "/active-questions";

export type MapMovementPreviewItem = TodayIntelligenceUpdateItem;

export type MapOpenQuestionPreviewItem = ActiveQuestionItem;

export async function fetchMapMovementPreview(): Promise<MapMovementPreviewItem[]> {
  try {
    const response = await fetch(TODAY_INTELLIGENCE_UPDATES_ENDPOINT, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { items?: MapMovementPreviewItem[] };
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items.slice(0, MAP_MOVEMENT_PREVIEW_LIMIT);
  } catch {
    return [];
  }
}

export async function fetchMapOpenQuestionsPreview(): Promise<MapOpenQuestionPreviewItem[]> {
  try {
    const response = await fetch(ACTIVE_QUESTIONS_ENDPOINT, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { items?: MapOpenQuestionPreviewItem[] };
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items.slice(0, MAP_OPEN_QUESTIONS_PREVIEW_LIMIT);
  } catch {
    return [];
  }
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export function formatMapPreviewDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}

export function toMapMovementRowTitle(item: MapMovementPreviewItem): string {
  return `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`;
}
