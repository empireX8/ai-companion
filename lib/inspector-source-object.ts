import type { InspectorSelection } from "./inspector-selection";
import type { OrvekObject } from "./orvek-v0/orvek-types";

export function resolveInspectorSourceObject(input: {
  selection: InspectorSelection;
  selectedWorkbenchId: string | null;
  getObject: (id: string) => OrvekObject | undefined;
}): OrvekObject | undefined {
  const directIds = [
    input.selection.selectedObjectId,
    input.selection.selectedModelUpdateId,
  ].filter((id): id is string => typeof id === "string" && id.trim().length > 0);

  for (const id of directIds) {
    const object = input.getObject(id);
    if (object) {
      return object;
    }
  }

  if (!input.selectedWorkbenchId) {
    return undefined;
  }

  const workbenchObject = input.getObject(input.selectedWorkbenchId);
  if (!workbenchObject) {
    return undefined;
  }

  const resolvedWorkbenchId = workbenchObject.inspectorObjectId ?? workbenchObject.id;
  if (
    resolvedWorkbenchId === input.selection.selectedObjectId ||
    resolvedWorkbenchId === input.selection.selectedModelUpdateId
  ) {
    return workbenchObject;
  }

  return undefined;
}
