import type { OrvekDataApi, OrvekTimelineGroup } from "../data-provider";
import type { OrvekObject } from "../orvek-types";
import { TIMELINE_SEMANTIC_FILTERS } from "../../timeline-semantic-layers";
import {
  shouldMergeDecisionsProductionApi,
  normalizeDecisionsProductionDataApi,
} from "./decisions-presentation";
import {
  shouldMergeActiveQuestionsProductionApi,
  normalizeActiveQuestionsProductionDataApi,
} from "./active-questions-presentation";
import {
  shouldMergeInvestigationsProductionApi,
  normalizeInvestigationsProductionDataApi,
} from "./investigations-presentation";
import {
  shouldMergeExperimentProductionApi,
  normalizeExperimentProductionDataApi,
} from "./experiment-presentation";
import { shouldMergeMapProductionApi, normalizeMapProductionDataApi } from "./map-presentation";
import {
  shouldMergeTimelineProductionApi,
  normalizeTimelineProductionDataApi,
} from "./timeline-presentation";
import {
  shouldMergeFreeExploreChatProductionApi,
  looksLikeAuthOrSessionBootError,
  normalizeFreeExploreChatProductionDataApi,
} from "./free-explore-chat-presentation";
import {
  assessLiveTodayObjectGraphParity,
  buildParitySafeTodayObjectMap,
  withTodayObjectGraphParity,
  type LiveTodayGraphParity,
} from "./today-object-graph-parity";

const TIMELINE_SHELL_GROUP_HEADINGS = [
  "Today",
  "This week",
  "Last week",
  "Earlier",
  "Imported history",
] as const;

/**
 * When full Timeline overlay is not merged yet, still surface depth-ready
 * ModelUpdate ids in the Today lane so Timeline shares Today report identity.
 */
export function injectLiveMovementIdsIntoTimelineGroups(
  parity: LiveTodayGraphParity,
): OrvekTimelineGroup[] {
  const ids = Array.from(
    new Set(
      [
        ...parity.readyMovementRowIds,
        parity.seeWhyMovementId,
        parity.reportId,
        parity.paritySafeReportTarget?.reportId,
      ].filter((id): id is string => Boolean(id?.trim())),
    ),
  );

  return TIMELINE_SHELL_GROUP_HEADINGS.map((heading) => ({
    heading,
    ids: heading === "Today" ? ids : [],
  }));
}

function mergeTodayOverlay(baseApi: OrvekDataApi, todayApi: OrvekDataApi): OrvekDataApi {
  const paritySafeObjects = buildParitySafeTodayObjectMap(todayApi);
  const parity = assessLiveTodayObjectGraphParity(todayApi);
  const liveTodayReady =
    parity.movementRowsReady ||
    parity.reportReady ||
    parity.readyMovementRowIds.length > 0 ||
    parity.seeWhyMovedReady ||
    Boolean(parity.paritySafeReportTarget);
  const shellApi: OrvekDataApi = {
    ...baseApi,
    today: todayApi.today,
    todayCopy: todayApi.todayCopy,
    todayIsLoading: todayApi.todayIsLoading,
    todayResurfacedIds: todayApi.todayResurfacedIds,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...todayApi.emptyCopyBySlot,
    },
  };

  if (paritySafeObjects.size === 0) {
    return withTodayObjectGraphParity(shellApi, parity);
  }

  const baseGetObject = baseApi.getObject.bind(baseApi);

  return withTodayObjectGraphParity(
    {
      ...shellApi,
      // Never leak standalone production displayContract onto the hybrid root.
      displayContract: undefined,
      getObject: (id) => {
        if (!id) {
          return undefined;
        }
        return paritySafeObjects.get(id) ?? baseGetObject(id);
      },
      getObjects: (ids) => {
        const resolved: OrvekObject[] = [];

        for (const id of ids ?? []) {
          if (!id) {
            continue;
          }
          const object = paritySafeObjects.get(id) ?? baseGetObject(id);
          if (object) {
            resolved.push(object);
          }
        }

        return resolved;
      },
      // When movement/report depth is ready, surface live Today view props so the
      // production Today branch can render without a global displayContract flip.
      // Also bootstrap Timeline Today-lane ids so hybrid does not keep showing
      // reference t1…t14 while waiting on full Timeline readiness merge.
      ...(liveTodayReady
        ? {
            timelineGroups: injectLiveMovementIdsIntoTimelineGroups(parity),
            timelineFilters: TIMELINE_SEMANTIC_FILTERS.map((entry) => entry.label),
          }
        : {}),
    },
    parity,
  );
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

function mergeMapShellState(baseApi: OrvekDataApi, mapApi: OrvekDataApi): OrvekDataApi {
  return {
    ...baseApi,
    mapHeader: mapApi.mapHeader ?? baseApi.mapHeader ?? null,
    mapSelectedId: mapApi.mapSelectedId ?? baseApi.mapSelectedId ?? null,
    mapIsLoading: mapApi.mapIsLoading,
    mapLoadError: mapApi.mapLoadError ?? null,
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

function mergeDecisionsShellState(
  baseApi: OrvekDataApi,
  decisionsApi: OrvekDataApi,
): OrvekDataApi {
  return {
    ...baseApi,
    decisionsHeaderStats: decisionsApi.decisionsHeaderStats,
    decisionsIsLoading: decisionsApi.decisionsIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...decisionsApi.emptyCopyBySlot,
    },
  };
}

function mergeActiveQuestionsOverlay(
  baseApi: OrvekDataApi,
  activeQuestionsApi: OrvekDataApi,
): OrvekDataApi {
  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return activeQuestionsApi.getObject(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = activeQuestionsApi.getObject(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
    exploreQuestionIds: activeQuestionsApi.exploreQuestionIds,
    exploreQuestionSelectedId: activeQuestionsApi.exploreQuestionSelectedId,
    activeQuestionsIsLoading: activeQuestionsApi.activeQuestionsIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...activeQuestionsApi.emptyCopyBySlot,
    },
  };
}

function mergeActiveQuestionsShellState(
  baseApi: OrvekDataApi,
  activeQuestionsApi: OrvekDataApi,
): OrvekDataApi {
  return {
    ...baseApi,
    activeQuestionsIsLoading: activeQuestionsApi.activeQuestionsIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...activeQuestionsApi.emptyCopyBySlot,
    },
  };
}

function mergeInvestigationsOverlay(
  baseApi: OrvekDataApi,
  investigationsApi: OrvekDataApi,
): OrvekDataApi {
  const baseGetObject = baseApi.getObject.bind(baseApi);

  return {
    ...baseApi,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return investigationsApi.getObject(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = investigationsApi.getObject(id) ?? baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
    exploreInvestigationIds: investigationsApi.exploreInvestigationIds,
    exploreInvestigationSelectedId: investigationsApi.exploreInvestigationSelectedId,
    investigationsIsLoading: investigationsApi.investigationsIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...investigationsApi.emptyCopyBySlot,
    },
  };
}

function mergeInvestigationsShellState(
  baseApi: OrvekDataApi,
  investigationsApi: OrvekDataApi,
): OrvekDataApi {
  return {
    ...baseApi,
    investigationsIsLoading: investigationsApi.investigationsIsLoading,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...investigationsApi.emptyCopyBySlot,
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

function mergeExperimentShellState(
  baseApi: OrvekDataApi,
  experimentApi: OrvekDataApi,
): OrvekDataApi {
  return {
    ...baseApi,
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

function mergeTimelineShellState(
  baseApi: OrvekDataApi,
  timelineApi: OrvekDataApi,
): OrvekDataApi {
  return {
    ...baseApi,
    timelineIsLoading: timelineApi.timelineIsLoading,
    timelineFilters: timelineApi.timelineFilters,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...timelineApi.emptyCopyBySlot,
    },
  };
}

function mergeFreeExploreChatOverlay(
  baseApi: OrvekDataApi,
  freeExploreChatApi: OrvekDataApi,
): OrvekDataApi {
  const chatEmptyCopy = freeExploreChatApi.emptyCopyBySlot ?? {};

  return {
    ...baseApi,
    exploreMessages: freeExploreChatApi.exploreMessages,
    exploreGrounding: freeExploreChatApi.exploreGrounding,
    exploreMovement: freeExploreChatApi.exploreMovement,
    exploreLiveDetectionCopy: freeExploreChatApi.exploreLiveDetectionCopy,
    exploreIsLoading: freeExploreChatApi.exploreIsLoading,
    freeExploreChatSessionId: freeExploreChatApi.freeExploreChatSessionId,
    freeExploreSendHandlerAvailable:
      freeExploreChatApi.freeExploreSendHandlerAvailable === true,
    exploreLatestGrounding: freeExploreChatApi.exploreLatestGrounding ?? null,
    explore: freeExploreChatApi.explore,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...(chatEmptyCopy.exploreChatEmpty
        ? { exploreChatEmpty: chatEmptyCopy.exploreChatEmpty }
        : {}),
      ...(chatEmptyCopy.exploreGroundingEmpty
        ? { exploreGroundingEmpty: chatEmptyCopy.exploreGroundingEmpty }
        : {}),
    },
  };
}

function mergeFreeExploreChatShellState(
  baseApi: OrvekDataApi,
  freeExploreChatApi: OrvekDataApi,
): OrvekDataApi {
  const chatEmptyCopy = freeExploreChatApi.emptyCopyBySlot ?? {};
  const shouldClearSessionIdentity =
    freeExploreChatApi.exploreIsLoading ||
    looksLikeAuthOrSessionBootError(freeExploreChatApi.explore?.errorMessage);

  return {
    ...baseApi,
    exploreMessages: undefined,
    exploreGrounding: [],
    exploreMovement: [],
    exploreLiveDetectionCopy: undefined,
    exploreLatestGrounding: null,
    exploreIsLoading: freeExploreChatApi.exploreIsLoading,
    freeExploreChatSessionId: shouldClearSessionIdentity
      ? undefined
      : freeExploreChatApi.freeExploreChatSessionId,
    freeExploreSendHandlerAvailable:
      freeExploreChatApi.freeExploreSendHandlerAvailable === true,
    explore: freeExploreChatApi.explore,
    emptyCopyBySlot: {
      ...baseApi.emptyCopyBySlot,
      ...(chatEmptyCopy.exploreChatEmpty
        ? { exploreChatEmpty: chatEmptyCopy.exploreChatEmpty }
        : {}),
      ...(chatEmptyCopy.exploreGroundingEmpty
        ? { exploreGroundingEmpty: chatEmptyCopy.exploreGroundingEmpty }
        : {}),
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
  activeQuestionsApi?: OrvekDataApi,
  investigationsApi?: OrvekDataApi,
  freeExploreChatApi?: OrvekDataApi,
): OrvekDataApi {
  const mergeMap = shouldMergeMapProductionApi(mapApi);
  const mergeTimeline = shouldMergeTimelineProductionApi(timelineApi);
  const mergeDecisions = shouldMergeDecisionsProductionApi(decisionsApi);
  const mergeExperiment = shouldMergeExperimentProductionApi(experimentApi);
  const mergeActiveQuestions = shouldMergeActiveQuestionsProductionApi(activeQuestionsApi);
  const mergeInvestigations = shouldMergeInvestigationsProductionApi(investigationsApi);
  const mergeFreeExploreChat = shouldMergeFreeExploreChatProductionApi(freeExploreChatApi);
  let api = baseApi;

  if (todayApi) {
    api = mergeTodayOverlay(api, todayApi);
  }

  if (mapApi) {
    const normalizedMapApi = normalizeMapProductionDataApi(mapApi);
    api = mergeMap ? mergeMapOverlay(api, normalizedMapApi) : mergeMapShellState(api, normalizedMapApi);
  }

  if (timelineApi) {
    const normalizedTimelineApi = normalizeTimelineProductionDataApi(timelineApi);
    api = mergeTimeline
      ? mergeTimelineOverlay(api, normalizedTimelineApi)
      : mergeTimelineShellState(api, normalizedTimelineApi);
  }

  if (decisionsApi) {
    const normalizedDecisionsApi = normalizeDecisionsProductionDataApi(decisionsApi);
    api = mergeDecisions
      ? mergeDecisionsOverlay(api, normalizedDecisionsApi)
      : mergeDecisionsShellState(api, normalizedDecisionsApi);
  }

  if (experimentApi) {
    const normalizedExperimentApi = normalizeExperimentProductionDataApi(experimentApi);
    api = mergeExperiment
      ? mergeExperimentOverlay(api, normalizedExperimentApi)
      : mergeExperimentShellState(api, normalizedExperimentApi);
  }

  if (activeQuestionsApi) {
    const normalizedActiveQuestionsApi =
      normalizeActiveQuestionsProductionDataApi(activeQuestionsApi);
    api = mergeActiveQuestions
      ? mergeActiveQuestionsOverlay(api, normalizedActiveQuestionsApi)
      : mergeActiveQuestionsShellState(api, normalizedActiveQuestionsApi);
  }

  if (investigationsApi) {
    const normalizedInvestigationsApi =
      normalizeInvestigationsProductionDataApi(investigationsApi);
    api = mergeInvestigations
      ? mergeInvestigationsOverlay(api, normalizedInvestigationsApi)
      : mergeInvestigationsShellState(api, normalizedInvestigationsApi);
  }

  if (freeExploreChatApi) {
    const normalizedFreeExploreChatApi =
      normalizeFreeExploreChatProductionDataApi(freeExploreChatApi);
    api = mergeFreeExploreChat
      ? mergeFreeExploreChatOverlay(api, normalizedFreeExploreChatApi)
      : mergeFreeExploreChatShellState(api, normalizedFreeExploreChatApi);
  }

  return api;
}
