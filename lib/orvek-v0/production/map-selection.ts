import { isModelGoalConclusion } from "../../orvek-adapters/map";
import type { MindContextDisplayItem } from "../../mind-context-surface";
import type { UserMapConclusionPublicApiListItem } from "../../public-intelligence-safe-slice";
import { pickInitialYourMapSelectionId } from "../../your-map-surface";

export type MapWorkbenchSelectionInput = {
  items: UserMapConclusionPublicApiListItem[];
  preferredSelectionId: string | null;
  mindContextItems: MindContextDisplayItem[];
};

export function resolveMapWorkbenchSelectedId(
  input: MapWorkbenchSelectionInput
): string | null {
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
