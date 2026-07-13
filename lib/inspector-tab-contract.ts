import type { InspectorSelectionObjectType } from "./inspector-selection";

export type InspectorTab = "evidence" | "movement";

/** Default Inspector tab when a new object is selected without an explicit tab. */
export function resolveDefaultInspectorTabForObjectType(
  objectType: InspectorSelectionObjectType,
): InspectorTab {
  return objectType === "model_update" ? "movement" : "evidence";
}

/**
 * Tab applied when the production bridge dispatches a new workbench selection.
 * Workbench `select(id, tab?)` may supply an explicit tab; otherwise object defaults apply.
 */
export function resolveBridgedInspectorTab(input: {
  objectType: InspectorSelectionObjectType;
  workbenchTab: InspectorTab;
  explicitWorkbenchTab?: boolean;
}): InspectorTab {
  if (input.explicitWorkbenchTab) {
    return input.workbenchTab;
  }
  return resolveDefaultInspectorTabForObjectType(input.objectType);
}

/** Whether a workbench tab change should sync into InspectorContext without re-dispatching selection. */
export function shouldSyncWorkbenchTabToInspector(input: {
  previousSelectedId: string | null;
  nextSelectedId: string | null;
}): boolean {
  return input.previousSelectedId === input.nextSelectedId && input.nextSelectedId !== null;
}
