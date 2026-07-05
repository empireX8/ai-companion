import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";
import {
  shouldMergeDecisionsProductionApi,
  normalizeDecisionsProductionDataApi,
} from "./decisions-presentation";
import {
  shouldMergeExperimentProductionApi,
  normalizeExperimentProductionDataApi,
} from "./experiment-presentation";
import { shouldMergeMapProductionApi, normalizeMapProductionDataApi } from "./map-presentation";
import {
  shouldMergeTimelineProductionApi,
  normalizeTimelineProductionDataApi,
} from "./timeline-presentation";

function normalizeIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of ids ?? []) {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function buildLiveReceiptObjectMap(
  todayApi: OrvekDataApi,
  receiptIds: string[],
): Map<string, OrvekObject> {
  const liveObjects = new Map<string, OrvekObject>();

  for (const object of todayApi.getObjects(receiptIds)) {
    liveObjects.set(object.id, object);
  }

  for (const id of receiptIds) {
    if (liveObjects.has(id)) {
      continue;
    }
    const object = todayApi.getObject(id);
    if (object) {
      liveObjects.set(id, object);
    }
  }

  return liveObjects;
}

function mergeTodayOverlay(baseApi: OrvekDataApi, todayApi: OrvekDataApi): OrvekDataApi {
  const liveReceiptIds = normalizeIds(todayApi.todayResurfacedIds);
  if (liveReceiptIds.length === 0) {
    return baseApi;
  }

  const liveReceiptObjects = buildLiveReceiptObjectMap(todayApi, liveReceiptIds);
  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return liveReceiptObjects.get(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = liveReceiptObjects.get(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
    today: todayApi.today ?? baseApi.today,
    todayIsLoading: todayApi.todayIsLoading ?? baseApi.todayIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...todayApi.emptyCopyBySlot,
    },
  };
}

function mergeMapOverlay(baseApi: OrvekDataApi, mapApi: OrvekDataApi): OrvekDataApi {
  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return mapApi.getObject(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = mapApi.getObject(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
    mapCategories: mapApi.mapCategories,
    mapSelectedId: mapApi.mapSelectedId,
    mapHeader: mapApi.mapHeader,
    mapIsLoading: mapApi.mapIsLoading,
    mapLoadError: mapApi.mapLoadError,
    mapHasContent: mapApi.mapHasContent,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...mapApi.emptyCopyBySlot,
    },
  };
}

function mergeDecisionsOverlay(baseApi: OrvekDataApi, decisionsApi: OrvekDataApi): OrvekDataApi {
  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return decisionsApi.getObject(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = decisionsApi.getObject(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
    decisionListGroups: decisionsApi.decisionListGroups,
    decisionsSelectedId: decisionsApi.decisionsSelectedId,
    decisionsHeaderStats: decisionsApi.decisionsHeaderStats,
    decisionsIsLoading: decisionsApi.decisionsIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...decisionsApi.emptyCopyBySlot,
    },
  };
}

function mergeExperimentOverlay(baseApi: OrvekDataApi, experimentApi: OrvekDataApi): OrvekDataApi {
  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return experimentApi.getObject(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = experimentApi.getObject(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
    exploreFieldworkIds: experimentApi.exploreFieldworkIds,
    exploreFieldworkSelectedId: experimentApi.exploreFieldworkSelectedId,
    experimentIsLoading: experimentApi.experimentIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...experimentApi.emptyCopyBySlot,
    },
  };
}

function mergeTimelineOverlay(baseApi: OrvekDataApi, timelineApi: OrvekDataApi): OrvekDataApi {
  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return timelineApi.getObject(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = timelineApi.getObject(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
    timelineGroups: timelineApi.timelineGroups,
    timelineFilters: timelineApi.timelineFilters,
    timelineIsLoading: timelineApi.timelineIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...timelineApi.emptyCopyBySlot,
    },
  };
}

export function buildHybridWorkbenchDataApi(
  baseApi: OrvekDataApi,
  todayApi?: OrvekDataApi,
  mapApi?: OrvekDataApi,
  timelineApi?: OrvekDataApi,
  decisionsApi?: OrvekDataApi,
  experimentApi?: OrvekDataApi,
): OrvekDataApi {
  const mergeToday = !!todayApi && normalizeIds(todayApi.todayResurfacedIds).length > 0;
  const mergeMap = shouldMergeMapProductionApi(mapApi);
  const mergeTimeline = shouldMergeTimelineProductionApi(timelineApi);
  const mergeDecisions = shouldMergeDecisionsProductionApi(decisionsApi);
  const mergeExperiment = shouldMergeExperimentProductionApi(experimentApi);

  if (!mergeToday && !mergeMap && !mergeTimeline && !mergeDecisions && !mergeExperiment) {
    return baseApi;
  }

  let api = baseApi;

  if (mergeToday && todayApi) {
    api = mergeTodayOverlay(api, todayApi);
  }

  if (mergeMap && mapApi) {
    api = mergeMapOverlay(api, normalizeMapProductionDataApi(mapApi));
  }

  if (mergeTimeline && timelineApi) {
    api = mergeTimelineOverlay(api, normalizeTimelineProductionDataApi(timelineApi));
  }

  if (mergeDecisions && decisionsApi) {
    api = mergeDecisionsOverlay(api, normalizeDecisionsProductionDataApi(decisionsApi));
  }

  if (mergeExperiment && experimentApi) {
    api = mergeExperimentOverlay(api, normalizeExperimentProductionDataApi(experimentApi));
  }

  return api;
}
