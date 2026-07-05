"use client";

import { useEffect, useMemo, useState } from "react";

import {
  fetchInspectorEvidenceLinks,
  fetchInspectorUserMapDetail,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorEvidenceLinkItem,
} from "@/lib/inspector-object-api";
import {
  buildMindContextDisplayItems,
  fetchMindContextSnapshot,
  type MindContextDisplayItem,
} from "@/lib/mind-context-surface";
import {
  fetchActionsPageData,
  type ActionsPageData,
} from "@/lib/actions-api";
import { buildDecisionsProductionDataApi } from "@/lib/orvek-v0/production/decisions-api";
import { buildTodayProductionDataApi } from "@/lib/orvek-v0/production/today-api";
import { buildHybridWorkbenchDataApi } from "@/lib/orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "@/lib/orvek-v0/production/map-api";
import { buildTimelineProductionDataApi } from "@/lib/orvek-v0/production/timeline-api";
import { resolveMapWorkbenchSelectedId } from "@/lib/orvek-v0/production/map-selection";
import { createMockOrvekDataApi } from "@/lib/orvek-v0/mock-api";
import {
  fetchTodayReentrySnapshot,
  type TodayReentrySnapshot,
} from "@/lib/today-reentry";
import type { UserMapConclusionPublicApiDetailItem } from "@/lib/public-intelligence-safe-slice";
import type { UserMapConclusionPublicApiListItem } from "@/lib/public-intelligence-safe-slice";
import {
  buildTimelineModelLayersRequestUrl,
  type TimelineModelLayerItem,
} from "@/lib/timeline-model-layers";
import {
  enrichTimelineActivityEntry,
  fetchTimelineSemanticEntries,
} from "@/lib/timeline-semantic-layers";
import {
  buildTimelineRequestUrl,
  mapTimelineEntries,
  type TimelineEntry,
  type TimelineResponse,
} from "@/lib/timeline-surface";
import {
  fetchMapMovementPreview,
  fetchMapOpenQuestionsPreview,
  type MapMovementPreviewItem,
  type MapOpenQuestionPreviewItem,
} from "@/lib/your-map-preview-surface";
import { fetchYourMapConclusions } from "@/lib/your-map-surface";

const TIMELINE_WINDOW = "30d";

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

const DISPLAY_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
}).format(new Date());

export function useOrvekHybridWorkbenchDataApi() {
  const baseApi = useMemo(() => createMockOrvekDataApi(), []);
  const [snapshot, setSnapshot] = useState<TodayReentrySnapshot>(EMPTY_SNAPSHOT);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);

  const [mapItems, setMapItems] = useState<UserMapConclusionPublicApiListItem[]>([]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [isLoadingMapList, setIsLoadingMapList] = useState(true);
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  const [mapDetail, setMapDetail] = useState<UserMapConclusionPublicApiDetailItem | null>(null);
  const [mapEvidence, setMapEvidence] = useState<InspectorEvidenceLinkItem[]>([]);
  const [isMapDetailLoading, setIsMapDetailLoading] = useState(false);
  const [openQuestionsCount, setOpenQuestionsCount] = useState(0);
  const [mindContextItems, setMindContextItems] = useState<MindContextDisplayItem[]>([]);
  const [mindContextSummaryCounts, setMindContextSummaryCounts] = useState({
    memories: 0,
    patterns: 0,
  });
  const [isMindContextLoading, setIsMindContextLoading] = useState(true);
  const [movementItems, setMovementItems] = useState<MapMovementPreviewItem[]>([]);
  const [isMovementLoading, setIsMovementLoading] = useState(true);
  const [openQuestionItems, setOpenQuestionItems] = useState<MapOpenQuestionPreviewItem[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(true);

  const [timelinePayload, setTimelinePayload] = useState<TimelineResponse | null>(null);
  const [timelineSemanticEntries, setTimelineSemanticEntries] = useState<TimelineEntry[]>([]);
  const [timelineModelLayers, setTimelineModelLayers] = useState<TimelineModelLayerItem[]>([]);
  const [isLoadingTimelineActivity, setIsLoadingTimelineActivity] = useState(true);
  const [isLoadingTimelineSemantic, setIsLoadingTimelineSemantic] = useState(true);
  const [isLoadingTimelineModelLayers, setIsLoadingTimelineModelLayers] = useState(true);
  const [timelineActivityError, setTimelineActivityError] = useState<string | null>(null);
  const [timelineModelLayerError, setTimelineModelLayerError] = useState<string | null>(null);

  const [actionsData, setActionsData] = useState<ActionsPageData | null>(null);
  const [isLoadingActions, setIsLoadingActions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingSnapshot(true);
      try {
        const next = await fetchTodayReentrySnapshot();
        if (!cancelled) {
          setSnapshot(next);
        }
      } catch {
        if (!cancelled) {
          setSnapshot(EMPTY_SNAPSHOT);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSnapshot(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingActions(true);
      try {
        const next = await fetchActionsPageData();
        if (!cancelled) {
          setActionsData(next);
        }
      } catch {
        if (!cancelled) {
          setActionsData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingActions(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingMapList(true);
      setMapLoadError(null);
      try {
        const nextItems = await fetchYourMapConclusions();
        if (!cancelled) {
          setMapItems(nextItems);
        }
      } catch {
        if (!cancelled) {
          setMapItems([]);
          setMapLoadError("Could not load your map.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMapList(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsMindContextLoading(true);
      try {
        const snapshot = await fetchMindContextSnapshot();
        if (!cancelled) {
          setMindContextItems(buildMindContextDisplayItems(snapshot, 3));
          setMindContextSummaryCounts({
            memories: snapshot.memories.length,
            patterns: snapshot.activePatterns.length,
          });
        }
      } finally {
        if (!cancelled) {
          setIsMindContextLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsMovementLoading(true);
      try {
        const nextItems = await fetchMapMovementPreview();
        if (!cancelled) {
          setMovementItems(nextItems);
        }
      } finally {
        if (!cancelled) {
          setIsMovementLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsQuestionsLoading(true);
      try {
        const questions = await fetchMapOpenQuestionsPreview();
        if (!cancelled) {
          setOpenQuestionItems(questions);
          setOpenQuestionsCount(questions.length);
        }
      } catch {
        if (!cancelled) {
          setOpenQuestionItems([]);
          setOpenQuestionsCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsQuestionsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMapSelectedId(
      resolveMapWorkbenchSelectedId({
        items: mapItems,
        preferredSelectionId: null,
        mindContextItems,
      }),
    );
  }, [mapItems, mindContextItems]);

  useEffect(() => {
    if (!mapSelectedId) {
      setMapDetail(null);
      setMapEvidence([]);
      setIsMapDetailLoading(false);
      return;
    }

    if (!mapItems.some((item) => item.id === mapSelectedId)) {
      setMapDetail(null);
      setMapEvidence([]);
      setIsMapDetailLoading(false);
      return;
    }

    let cancelled = false;
    setIsMapDetailLoading(true);

    void (async () => {
      const [nextDetail, nextEvidence] = await Promise.all([
        fetchInspectorUserMapDetail(mapSelectedId),
        fetchInspectorEvidenceLinks(INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(mapSelectedId)),
      ]);
      if (!cancelled) {
        setMapDetail(nextDetail);
        setMapEvidence(nextEvidence);
        setIsMapDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapItems, mapSelectedId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingTimelineActivity(true);
      setTimelineActivityError(null);
      try {
        const response = await fetch(buildTimelineRequestUrl(TIMELINE_WINDOW), {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Could not load timeline.");
        }
        const next = (await response.json()) as TimelineResponse;
        if (!cancelled) {
          setTimelinePayload(next);
        }
      } catch (error) {
        if (!cancelled) {
          setTimelinePayload(null);
          setTimelineActivityError(
            error instanceof Error ? error.message : "Could not load timeline.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTimelineActivity(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingTimelineSemantic(true);
      try {
        const entries = await fetchTimelineSemanticEntries(TIMELINE_WINDOW);
        if (!cancelled) {
          setTimelineSemanticEntries(entries);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTimelineSemantic(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingTimelineModelLayers(true);
      try {
        const response = await fetch(buildTimelineModelLayersRequestUrl(TIMELINE_WINDOW), {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Could not load model layers.");
        }
        const next = (await response.json()) as { items?: TimelineModelLayerItem[] };
        if (!cancelled) {
          setTimelineModelLayers(Array.isArray(next.items) ? next.items : []);
        }
      } catch {
        if (!cancelled) {
          setTimelineModelLayers([]);
          setTimelineModelLayerError("Could not load model layers.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTimelineModelLayers(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const mapIsLoading =
    isLoadingMapList ||
    isMindContextLoading ||
    isMovementLoading ||
    isQuestionsLoading ||
    isMapDetailLoading;

  const timelineEntries = useMemo(() => {
    const activity = timelinePayload
      ? mapTimelineEntries(timelinePayload).map(enrichTimelineActivityEntry)
      : [];
    return [...activity, ...timelineSemanticEntries];
  }, [timelinePayload, timelineSemanticEntries]);

  const timelineIsLoading =
    isLoadingTimelineActivity || isLoadingTimelineSemantic || isLoadingTimelineModelLayers;

  const decisionsList = useMemo(() => {
    if (!actionsData) {
      return [];
    }

    return [...actionsData.stabilizeNow, ...actionsData.buildForward];
  }, [actionsData]);

  return useMemo(() => {
    if (isLoadingSnapshot) {
      return baseApi;
    }

    const todayApi = buildTodayProductionDataApi({
      snapshot,
      isLoading: isLoadingSnapshot,
      briefingDate: DISPLAY_DATE,
    });

    const mapApi = buildMapProductionDataApi({
      items: mapItems,
      isLoading: mapIsLoading,
      loadError: mapLoadError,
      selectedId: mapSelectedId,
      detail: mapDetail,
      isDetailLoading: isMapDetailLoading,
      evidence: mapEvidence,
      openQuestionsCount,
      mindContext: {
        isLoading: isMindContextLoading,
        items: mindContextItems,
        summaryCounts: mindContextSummaryCounts,
      },
      movementPreview: {
        isLoading: isMovementLoading,
        items: movementItems,
      },
      openQuestionsPreview: {
        isLoading: isQuestionsLoading,
        items: openQuestionItems,
      },
    });

    const timelineApi = buildTimelineProductionDataApi({
      timelineEntries,
      modelLayers: timelineModelLayers,
      semanticFilter: "all",
      searchQuery: "",
      isLoadingActivity: timelineIsLoading,
      isLoadingModelLayers: isLoadingTimelineModelLayers,
      isLoadingSemantic: isLoadingTimelineSemantic,
      activityError: timelineActivityError,
      modelLayerError: timelineModelLayerError,
      selectedObjectId: null,
    });

    const decisionsApi = {
      ...buildDecisionsProductionDataApi(decisionsList),
      decisionsIsLoading: isLoadingActions,
    };

    return buildHybridWorkbenchDataApi(
      baseApi,
      todayApi,
      mapApi,
      timelineApi,
      decisionsApi,
    );
  }, [
    baseApi,
    isLoadingSnapshot,
    snapshot,
    mapItems,
    mapIsLoading,
    mapLoadError,
    mapSelectedId,
    mapDetail,
    isMapDetailLoading,
    mapEvidence,
    openQuestionsCount,
    isMindContextLoading,
    mindContextItems,
    mindContextSummaryCounts,
    isMovementLoading,
    movementItems,
    isQuestionsLoading,
    openQuestionItems,
    timelineEntries,
    timelineModelLayers,
    timelineIsLoading,
    isLoadingTimelineModelLayers,
    isLoadingTimelineSemantic,
    timelineActivityError,
    timelineModelLayerError,
    decisionsList,
    isLoadingActions,
  ]);
}
