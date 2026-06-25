"use client";

import { useEffect, useMemo, useState } from "react";

import {
  mapTimelineDataToV0Props,
  resolveTimelineOpenTarget,
} from "../../lib/orvek-adapters/timeline";
import {
  buildTimelineModelLayersRequestUrl,
  TIMELINE_MODEL_LAYERS_ERROR_COPY,
  type TimelineModelLayerItem,
} from "../../lib/timeline-model-layers";
import {
  enrichTimelineActivityEntry,
  fetchTimelineSemanticEntries,
  type TimelineSemanticFilter,
} from "../../lib/timeline-semantic-layers";
import {
  buildTimelineRequestUrl,
  mapTimelineEntries,
  type TimelineEntry,
  type TimelineResponse,
} from "../../lib/timeline-surface";

import { useOrvekInspector } from "./useOrvekInspector";
import { V0TimelineView } from "./views/V0TimelineView";

const TIMELINE_WINDOW = "30d";

export function OrvekTimelinePage() {
  const { select, setInspectorTab, selection } = useOrvekInspector();
  const [semanticFilter, setSemanticFilter] = useState<TimelineSemanticFilter>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<TimelineResponse | null>(null);
  const [semanticEntries, setSemanticEntries] = useState<TimelineEntry[]>([]);
  const [isLoadingSemantic, setIsLoadingSemantic] = useState(true);
  const [modelLayers, setModelLayers] = useState<TimelineModelLayerItem[]>([]);
  const [isLoadingModelLayers, setIsLoadingModelLayers] = useState(true);
  const [modelLayerError, setModelLayerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTimeline = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(buildTimelineRequestUrl(TIMELINE_WINDOW), {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load timeline.");
        }

        const nextPayload = (await response.json()) as TimelineResponse;
        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setPayload(null);
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : "Could not load timeline."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSemantic = async () => {
      setIsLoadingSemantic(true);
      try {
        const entries = await fetchTimelineSemanticEntries(TIMELINE_WINDOW);
        if (!cancelled) {
          setSemanticEntries(entries);
        }
      } catch {
        if (!cancelled) {
          setSemanticEntries([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSemantic(false);
        }
      }
    };

    void loadSemantic();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadModelLayers = async () => {
      setIsLoadingModelLayers(true);
      setModelLayerError(null);

      try {
        const response = await fetch(buildTimelineModelLayersRequestUrl(TIMELINE_WINDOW), {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(TIMELINE_MODEL_LAYERS_ERROR_COPY);
        }

        const nextPayload = (await response.json()) as {
          items?: TimelineModelLayerItem[];
        };
        if (!cancelled) {
          setModelLayers(Array.isArray(nextPayload.items) ? nextPayload.items : []);
        }
      } catch {
        if (!cancelled) {
          setModelLayers([]);
          setModelLayerError(TIMELINE_MODEL_LAYERS_ERROR_COPY);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModelLayers(false);
        }
      }
    };

    void loadModelLayers();

    return () => {
      cancelled = true;
    };
  }, []);

  const timelineEntries = useMemo(() => {
    const activity = payload ? mapTimelineEntries(payload).map(enrichTimelineActivityEntry) : [];
    return [...activity, ...semanticEntries];
  }, [payload, semanticEntries]);

  const selectedObjectId = selection?.selectedObjectId ?? null;

  const viewData = useMemo(
    () =>
      mapTimelineDataToV0Props({
        timelineEntries,
        modelLayers,
        semanticFilter,
        searchQuery: query,
        isLoadingActivity: isLoading,
        isLoadingModelLayers,
        isLoadingSemantic,
        activityError: errorMessage,
        modelLayerError,
        selectedObjectId,
      }),
    [
      timelineEntries,
      modelLayers,
      semanticFilter,
      query,
      isLoading,
      isLoadingModelLayers,
      isLoadingSemantic,
      errorMessage,
      modelLayerError,
      selectedObjectId,
    ]
  );

  const allRows = useMemo(
    () => viewData.groups.flatMap((group) => group.rows),
    [viewData.groups]
  );

  return (
    <V0TimelineView
      data={viewData}
      handlers={{
        onFilterChange: setSemanticFilter,
        onSearchChange: setQuery,
        onOpenItem: (rowId) => {
          const target = resolveTimelineOpenTarget(allRows, rowId);
          if (!target) {
            return;
          }
          select({
            objectType: target.objectType,
            objectId: target.objectId,
            modelUpdateId: target.modelUpdateId ?? null,
            title: target.title,
            tab: target.tab,
          });
          setInspectorTab(target.tab);
        },
      }}
    />
  );
}
