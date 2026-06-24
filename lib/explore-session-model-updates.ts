import type { WhatChangedListItem } from "./public-intelligence-safe-slice";
import { ORVEK_COPY } from "./trust-language";

export const EXPLORE_SESSION_MODEL_UPDATES_LIMIT = 3;

export type ExploreSessionModelUpdateItem = WhatChangedListItem;

export const EXPLORE_SESSION_MODEL_UPDATES_ENDPOINT = (
  sessionId: string
): string =>
  `/api/explore/sessions/${encodeURIComponent(sessionId)}/model-updates`;

export const EXPLORE_MOVEMENT_LOADING_COPY = "Checking for published movement…";
export const EXPLORE_MOVEMENT_EMPTY_COPY =
  `No published ${ORVEK_COPY.mindModelMovement} from this conversation yet.`;
export const EXPLORE_MOVEMENT_EMPTY_SUBCOPY =
  "When evidence is reviewed and published, meaningful changes appear here.";
export const EXPLORE_MOVEMENT_HAS_UPDATES_HEADLINE =
  `This conversation has published ${ORVEK_COPY.mindModelMovement}`;

export function buildExploreMovementHasUpdatesMeta(count: number): string {
  return `${count} published update${count === 1 ? "" : "s"} from this session`;
}

export async function fetchExploreSessionModelUpdates(
  sessionId: string
): Promise<ExploreSessionModelUpdateItem[]> {
  const response = await fetch(EXPLORE_SESSION_MODEL_UPDATES_ENDPOINT(sessionId), {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Could not load session ${ORVEK_COPY.mindModelMovement}.`);
  }

  const payload = (await response.json()) as { items?: ExploreSessionModelUpdateItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}
