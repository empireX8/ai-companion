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
import {
  isCompositionWorkbenchApi,
  type HybridWorkbenchAuthorityOptions,
} from "./workbench-authority";

export type { HybridWorkbenchAuthorityOptions } from "./workbench-authority";
export {
  allowsCompositionWorkbenchAuthority,
  isCompositionWorkbenchApi,
  isVisualReferencePath,
} from "./workbench-authority";

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

function isReferenceCompositionTodayApi(api: OrvekDataApi): boolean {
  if (isCompositionWorkbenchApi(api)) {
    return true;
  }
  const reportId = api.today?.report?.reportId ?? null;
  if (!reportId) {
    return false;
  }
  const report = api.getObject(reportId);
  return report?.type === "report" && report.reportProvenance === "reference_sample";
}

function mergeTodayOverlay(
  baseApi: OrvekDataApi,
  todayApi: OrvekDataApi,
  allowCompositionWorkbenchAuthority: boolean,
): OrvekDataApi {
  const reportId = todayApi.today?.report?.reportId ?? null;
  const reportObject = reportId ? todayApi.getObject(reportId) : undefined;
  const reportDensograph =
    Boolean(reportId) && reportObject?.type === "report";
  const referenceComposition = isReferenceCompositionTodayApi(todayApi);

  // Persisted reference/composition densographs are not production authority.
  if (referenceComposition && !allowCompositionWorkbenchAuthority) {
    return baseApi;
  }

  // Explicit densograph path: composition (when allowed) or live MU report objects.
  // Prefer todayApi.getObject over MU-report parity filtering (which would drop
  // decision/report/receipt projections).
  if (reportDensograph) {
    const baseGetObject = baseApi.getObject.bind(baseApi);
    const hasWorkbench =
      allowCompositionWorkbenchAuthority && isCompositionWorkbenchApi(todayApi);
    return {
      ...baseApi,
      today: todayApi.today,
      todayCopy: todayApi.todayCopy,
      todayIsLoading: todayApi.todayIsLoading,
      todayResurfacedIds: todayApi.todayResurfacedIds,
      emptyCopyBySlot: {
        ...baseApi.emptyCopyBySlot,
        ...todayApi.emptyCopyBySlot,
      },
      displayContract: undefined,
      getObject: (id) => {
        if (!id) return undefined;
        return todayApi.getObject(id) ?? baseGetObject(id);
      },
      getObjects: (ids) => {
        const resolved: OrvekObject[] = [];
        for (const id of ids ?? []) {
          if (!id) continue;
          const object = todayApi.getObject(id) ?? baseGetObject(id);
          if (object) resolved.push(object);
        }
        return resolved;
      },
      ...(hasWorkbench
        ? {
            mapCategories: todayApi.mapCategories,
            mapSelectedId: todayApi.mapSelectedId,
            mapHasContent: todayApi.mapHasContent,
            timelineGroups: todayApi.timelineGroups,
            timelineFilters: todayApi.timelineFilters,
            decisionListGroups: todayApi.decisionListGroups,
            decisionsSelectedId: todayApi.decisionsSelectedId,
            exploreGrounding: todayApi.exploreGrounding,
            exploreMovement: todayApi.exploreMovement,
            exploreQuestionIds: todayApi.exploreQuestionIds,
            exploreInvestigationIds: todayApi.exploreInvestigationIds,
            exploreFieldworkIds: todayApi.exploreFieldworkIds,
            exploreLiveDetectionCopy: todayApi.exploreLiveDetectionCopy,
            mapHeader: todayApi.mapHeader ?? null,
            modelStatusCard: todayApi.modelStatusCard ?? null,
            importReview: todayApi.importReview ?? null,
          }
        : {}),
    };
  }

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

function applyCompositionWorkbenchRails(
  baseApi: OrvekDataApi,
  compositionApi: OrvekDataApi,
): OrvekDataApi {
  if ((compositionApi.mapCategories?.length ?? 0) === 0) {
    return baseApi;
  }
  const baseGetObject = baseApi.getObject.bind(baseApi);
  return {
    ...baseApi,
    mapCategories: compositionApi.mapCategories,
    mapSelectedId: compositionApi.mapSelectedId,
    mapHasContent: compositionApi.mapHasContent ?? true,
    mapIsLoading: false,
    mapLoadError: null,
    timelineGroups: compositionApi.timelineGroups,
    timelineFilters: compositionApi.timelineFilters,
    decisionListGroups: compositionApi.decisionListGroups,
    decisionsSelectedId: compositionApi.decisionsSelectedId,
    decisionsIsLoading: false,
    exploreGrounding: compositionApi.exploreGrounding,
    exploreMovement: compositionApi.exploreMovement,
    exploreQuestionIds: compositionApi.exploreQuestionIds,
    exploreInvestigationIds: compositionApi.exploreInvestigationIds,
    exploreFieldworkIds: compositionApi.exploreFieldworkIds,
    exploreLiveDetectionCopy: compositionApi.exploreLiveDetectionCopy,
    mapHeader: compositionApi.mapHeader ?? null,
    modelStatusCard: compositionApi.modelStatusCard ?? null,
    importReview: compositionApi.importReview ?? null,
    activeQuestionsIsLoading: false,
    investigationsIsLoading: false,
    experimentIsLoading: false,
    getObject: (id) => {
      if (!id) return undefined;
      return compositionApi.getObject(id) ?? baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];
      for (const id of ids ?? []) {
        if (!id) continue;
        const object = compositionApi.getObject(id) ?? baseGetObject(id);
        if (object) resolved.push(object);
      }
      return resolved;
    },
  };
}

/**
 * Composition-safe Active-conflicts exception.
 * Retains composition ownership of unrelated Map rails; overlays live
 * ContradictionNode objects into the conflicts category only.
 * Never replaces m-conflict-* seed rows with live ids; never global Map merge.
 */
export function mergeLiveContradictionConflicts(
  baseApi: OrvekDataApi,
  liveMapApi: OrvekDataApi,
): OrvekDataApi {
  const liveConflictEntries: Array<{ id: string; object: OrvekObject }> = [];
  const seen = new Set<string>();

  for (const category of liveMapApi.mapCategories ?? []) {
    if (category.id !== "conflicts") {
      continue;
    }
    for (const id of category.ids) {
      if (!id || seen.has(id)) {
        continue;
      }
      const object = liveMapApi.getObject(id);
      if (!object || object.inspectorObjectType !== "contradiction_node") {
        continue;
      }
      // Never treat seed densograph conflict ids as live CN projections.
      if (id.startsWith("m-conflict-")) {
        continue;
      }
      seen.add(id);
      liveConflictEntries.push({ id, object });
    }
  }

  if (liveConflictEntries.length === 0) {
    return baseApi;
  }

  const liveById = new Map(liveConflictEntries.map((entry) => [entry.id, entry.object]));
  for (const entry of liveConflictEntries) {
    const rawId = entry.object.inspectorObjectId?.trim();
    if (rawId && !liveById.has(rawId)) {
      liveById.set(rawId, { ...entry.object, id: rawId });
    }
  }

  const baseCategories = baseApi.mapCategories ?? [];
  const conflictsIndex = baseCategories.findIndex((category) => category.id === "conflicts");
  let nextCategories = baseCategories;

  if (conflictsIndex >= 0) {
    const existing = baseCategories[conflictsIndex]!;
    const mergedIds = [...existing.ids];
    const idSet = new Set(mergedIds);
    for (const entry of liveConflictEntries) {
      if (!idSet.has(entry.id)) {
        idSet.add(entry.id);
        mergedIds.push(entry.id);
      }
    }
    nextCategories = baseCategories.map((category, index) =>
      index === conflictsIndex ? { ...category, ids: mergedIds } : category,
    );
  } else {
    nextCategories = [
      ...baseCategories,
      {
        id: "conflicts",
        label: "Active conflicts",
        ids: liveConflictEntries.map((entry) => entry.id),
      },
    ];
  }

  const baseGetObject = baseApi.getObject.bind(baseApi);
  const resolveLive = (id: string) => liveById.get(id) ?? baseGetObject(id);

  const selectedLive =
    baseApi.mapSelectedId && liveById.has(baseApi.mapSelectedId)
      ? baseApi.mapSelectedId
      : liveMapApi.mapSelectedId && liveById.has(liveMapApi.mapSelectedId)
        ? liveMapApi.mapSelectedId
        : baseApi.mapSelectedId;

  return {
    ...baseApi,
    mapCategories: nextCategories,
    mapSelectedId: selectedLive ?? baseApi.mapSelectedId,
    mapHasContent: true,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      return resolveLive(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];
      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = resolveLive(id);
        if (object) {
          resolved.push(object);
        }
      }
      return resolved;
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
  options?: HybridWorkbenchAuthorityOptions,
): OrvekDataApi {
  // Production default: live providers win. Composition may own rails only when
  // explicitly opted in (dev live-candidate / deterministic reference tests).
  const allowCompositionWorkbenchAuthority =
    options?.allowCompositionWorkbenchAuthority === true;
  const compositionWorkbench =
    allowCompositionWorkbenchAuthority &&
    Boolean(todayApi) &&
    isCompositionWorkbenchApi(todayApi);
  const mergeMap =
    !compositionWorkbench && shouldMergeMapProductionApi(mapApi);
  const mergeTimeline =
    !compositionWorkbench && shouldMergeTimelineProductionApi(timelineApi);
  const mergeDecisions =
    !compositionWorkbench && shouldMergeDecisionsProductionApi(decisionsApi);
  const mergeExperiment =
    !compositionWorkbench && shouldMergeExperimentProductionApi(experimentApi);
  const mergeActiveQuestions =
    !compositionWorkbench &&
    shouldMergeActiveQuestionsProductionApi(activeQuestionsApi);
  const mergeInvestigations =
    !compositionWorkbench &&
    shouldMergeInvestigationsProductionApi(investigationsApi);
  // Free Explore chat stays live unless composition also supplies explore rails
  // (grounding/movement). Chat transcript may still differ from frozen hardcoded bubbles.
  const mergeFreeExploreChat = shouldMergeFreeExploreChatProductionApi(
    freeExploreChatApi,
  );
  let api = baseApi;
  let normalizedMapApi: OrvekDataApi | undefined;

  if (todayApi) {
    api = mergeTodayOverlay(api, todayApi, allowCompositionWorkbenchAuthority);
  }

  if (mapApi) {
    normalizedMapApi = normalizeMapProductionDataApi(mapApi);
    api = mergeMap
      ? mergeMapOverlay(api, normalizedMapApi)
      : mergeMapShellState(api, normalizedMapApi);
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

  if (todayApi && compositionWorkbench) {
    api = applyCompositionWorkbenchRails(api, todayApi);
  }

  // Narrow conflicts overlay after composition ownership — does not global-merge Map.
  if (normalizedMapApi) {
    api = mergeLiveContradictionConflicts(api, normalizedMapApi);
  }

  return api;
}
