import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";
import { shouldMergeMapProductionApi, normalizeMapProductionDataApi } from "./map-presentation";

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

export function buildHybridWorkbenchDataApi(
  baseApi: OrvekDataApi,
  todayApi?: OrvekDataApi,
  mapApi?: OrvekDataApi,
): OrvekDataApi {
  const mergeToday = !!todayApi && normalizeIds(todayApi.todayResurfacedIds).length > 0;
  const mergeMap = shouldMergeMapProductionApi(mapApi);

  if (!mergeToday && !mergeMap) {
    return baseApi;
  }

  let api = baseApi;

  if (mergeToday && todayApi) {
    api = mergeTodayOverlay(api, todayApi);
  }

  if (mergeMap && mapApi) {
    api = mergeMapOverlay(api, normalizeMapProductionDataApi(mapApi));
  }

  return api;
}
