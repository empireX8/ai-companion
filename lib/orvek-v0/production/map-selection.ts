import { isModelGoalConclusion } from "../../orvek-adapters/map";
import type { MindContextDisplayItem } from "../../mind-context-surface";
import {
  mapContradictionObjectId,
  resolveMapContradictionSelectionId,
  type MapOpenContradictionItem,
} from "../../map-open-contradictions";
import type { UserMapConclusionPublicApiListItem } from "../../public-intelligence-safe-slice";
import { pickInitialYourMapSelectionId } from "../../your-map-surface";

export type MapWorkbenchSelectionInput = {
  items: UserMapConclusionPublicApiListItem[];
  preferredSelectionId: string | null;
  mindContextItems: MindContextDisplayItem[];
  openContradictions?: MapOpenContradictionItem[];
};

export function normalizeMapConclusionSelectionId(
  selectionId: string | null | undefined
): string | null {
  const normalized = selectionId?.trim();
  if (!normalized) {
    return null;
  }

  // Contradiction rail/raw ids are not UserMapConclusion ids.
  if (
    normalized.startsWith("contradiction-") ||
    normalized.startsWith("context-") ||
    normalized.startsWith("question-") ||
    normalized.startsWith("movement-")
  ) {
    return null;
  }

  if (normalized.startsWith("conclusion-")) {
    return normalized.slice("conclusion-".length);
  }

  if (normalized.startsWith("goal-")) {
    return normalized.slice("goal-".length);
  }

  return normalized;
}

export function resolveMapWorkbenchSelectedId(
  input: MapWorkbenchSelectionInput
): string | null {
  const openContradictions = input.openContradictions ?? [];
  const preferredContradiction = resolveMapContradictionSelectionId(
    input.preferredSelectionId,
    openContradictions,
  );
  if (preferredContradiction) {
    return preferredContradiction;
  }

  const preferredMindContext = input.preferredSelectionId
    ? input.mindContextItems.find(
        (item) =>
          item.id === input.preferredSelectionId ||
          `context-${item.id}` === input.preferredSelectionId
      )
    : undefined;

  if (preferredMindContext) {
    return input.preferredSelectionId;
  }

  const preferredGoal = resolveGoalSelectionId(
    input.items,
    input.preferredSelectionId
  );
  if (preferredGoal) {
    return preferredGoal;
  }

  if (input.items.length === 0) {
    if (openContradictions[0]) {
      return mapContradictionObjectId(openContradictions[0].id);
    }
    const firstMindContext = input.mindContextItems[0];
    return firstMindContext ? `context-${firstMindContext.id}` : null;
  }

  const picked = pickInitialYourMapSelectionId(input.items, input.preferredSelectionId);
  const initialGoal = resolveGoalSelectionId(input.items, picked);
  return initialGoal ?? picked;
}

function resolveGoalSelectionId(
  items: UserMapConclusionPublicApiListItem[],
  selectionId: string | null | undefined
): string | null {
  const normalized = selectionId?.trim();
  if (!normalized) {
    return null;
  }

  const goalItem = items.find(
    (item) =>
      isModelGoalConclusion(item) &&
      (item.id === normalized || `goal-${item.id}` === normalized)
  );

  return goalItem ? `goal-${goalItem.id}` : null;
}
