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

  if (input.items.length === 0) {
    const firstMindContext = input.mindContextItems[0];
    return firstMindContext ? `context-${firstMindContext.id}` : null;
  }

  return pickInitialYourMapSelectionId(input.items, input.preferredSelectionId);
}
