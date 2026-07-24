import type { InspectorContradictionProjection } from "./inspector-object-api";

export type ContradictionInspectorDetailState = {
  requestedContradictionId: string | null;
  loadedContradictionId: string | null;
  detail: InspectorContradictionProjection | null;
};

export function createEmptyContradictionInspectorDetailState(): ContradictionInspectorDetailState {
  return {
    requestedContradictionId: null,
    loadedContradictionId: null,
    detail: null,
  };
}

export function beginContradictionInspectorDetailLoad(
  contradictionId: string | null,
): ContradictionInspectorDetailState {
  return {
    requestedContradictionId: contradictionId,
    loadedContradictionId: null,
    detail: null,
  };
}

export function resolveContradictionInspectorDetailLoad(
  state: ContradictionInspectorDetailState,
  contradictionId: string,
  detail: InspectorContradictionProjection | null,
): ContradictionInspectorDetailState {
  if (state.requestedContradictionId !== contradictionId) {
    return state;
  }

  if (!detail) {
    return beginContradictionInspectorDetailLoad(contradictionId);
  }

  return {
    requestedContradictionId: contradictionId,
    loadedContradictionId: contradictionId,
    detail,
  };
}

export function failContradictionInspectorDetailLoad(
  state: ContradictionInspectorDetailState,
  contradictionId: string,
): ContradictionInspectorDetailState {
  if (state.requestedContradictionId !== contradictionId) {
    return state;
  }

  return beginContradictionInspectorDetailLoad(contradictionId);
}

export function selectRenderableContradictionInspectorDetail(
  state: ContradictionInspectorDetailState,
  contradictionId: string | null,
): InspectorContradictionProjection | null {
  if (!contradictionId) {
    return null;
  }

  return state.loadedContradictionId === contradictionId ? state.detail : null;
}
