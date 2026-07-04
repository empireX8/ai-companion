import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";

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

export function buildHybridWorkbenchDataApi(
  baseApi: OrvekDataApi,
  todayApi: OrvekDataApi,
): OrvekDataApi {
  const liveReceiptIds = normalizeIds(todayApi.todayResurfacedIds);

  if (liveReceiptIds.length === 0) {
    return baseApi;
  }

  const liveReceiptObjects = buildLiveReceiptObjectMap(todayApi, liveReceiptIds);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return liveReceiptObjects.get(id) ?? baseApi.getObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = liveReceiptObjects.get(id) ?? baseApi.getObject(id);
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
