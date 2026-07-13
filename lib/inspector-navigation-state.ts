import {
  buildInspectorSelection,
  resolveActiveModelUpdateId,
  type InspectorSelection,
  type SelectObjectInput,
} from "./inspector-selection";
import {
  resolveDefaultInspectorTabForObjectType,
  type InspectorTab,
} from "./inspector-tab-contract";

export type InspectorHistoryEntry = {
  selection: InspectorSelection;
  tab: InspectorTab;
  trailLabel: string | null;
};

export type InspectorNavigationState = {
  selection: InspectorSelection | null;
  tab: InspectorTab;
  history: InspectorHistoryEntry[];
};

export function resolveInspectorTabForInput(
  input: SelectObjectInput & { tab?: InspectorTab },
): InspectorTab {
  return input.tab ?? resolveDefaultInspectorTabForObjectType(input.objectType);
}

export function selectInspectorObject(
  state: InspectorNavigationState,
  input: SelectObjectInput & { tab?: InspectorTab },
): InspectorNavigationState {
  const nextSelection = buildInspectorSelection(input);
  if (!nextSelection) {
    return state;
  }

  return {
    selection: nextSelection,
    tab: resolveInspectorTabForInput(input),
    history: [],
  };
}

export function pushInspectorObject(
  state: InspectorNavigationState,
  input: SelectObjectInput & { tab?: InspectorTab; trailLabel?: string | null },
): InspectorNavigationState {
  const nextSelection = buildInspectorSelection(input);
  if (!nextSelection || !state.selection) {
    return state;
  }

  return {
    selection: nextSelection,
    tab: resolveInspectorTabForInput(input),
    history: [
      ...state.history,
      {
        selection: state.selection,
        tab: state.tab,
        trailLabel: input.trailLabel?.trim() || null,
      },
    ],
  };
}

export function goBackInspectorObject(
  state: InspectorNavigationState,
): InspectorNavigationState {
  const nextEntry = state.history[state.history.length - 1] ?? null;
  if (!nextEntry) {
    return state;
  }

  return {
    selection: nextEntry.selection,
    tab: nextEntry.tab,
    history: state.history.slice(0, -1),
  };
}

export function inspectorNavigationCanGoBack(state: InspectorNavigationState): boolean {
  return state.history.length > 0;
}

export function activeModelUpdateIdFromNavigation(
  state: InspectorNavigationState,
): string | null {
  return resolveActiveModelUpdateId(state.selection);
}
