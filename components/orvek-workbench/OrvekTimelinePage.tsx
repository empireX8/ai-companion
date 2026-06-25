"use client";

import { useEffect, useMemo, useState } from "react";

import { TimelinePage } from "@/components/orvek-v0/pages/timeline";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import {
  mapTimelineDataToV0Props,
  resolveTimelineOpenTarget,
} from "@/lib/orvek-adapters/timeline";
import { EMPTY_ORVEK_DATA_API } from "@/lib/orvek-v0/empty-api";
import { OrvekDataProvider } from "@/lib/orvek-v0/data-provider";
import { OrvekPageHandlersProvider } from "@/lib/orvek-v0/page-handlers";
import {
  buildTimelineModelLayersRequestUrl,
  TIMELINE_MODEL_LAYERS_ERROR_COPY,
  type TimelineModelLayerItem,
} from "@/lib/timeline-model-layers";
import {
  enrichTimelineActivityEntry,
  fetchTimelineSemanticEntries,
  type TimelineSemanticFilter,
} from "@/lib/timeline-semantic-layers";
import {
  buildTimelineRequestUrl,
  mapTimelineEntries,
  type TimelineEntry,
  type TimelineResponse,
} from "@/lib/timeline-surface";

import { useOrvekInspector } from "./useOrvekInspector";

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
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch(buildTimelineRequestUrl(TIMELINE_WINDOW), {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load timeline.");
        const nextPayload = (await response.json()) as TimelineResponse;
        if (!cancelled) setPayload(nextPayload);
      } catch (error) {
        if (!cancelled) {
          setPayload(null);
          setErrorMessage(
            error instanceof Error && error.message ? error.message : "Could not load timeline."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoadingSemantic(true);
      try {
        const entries = await fetchTimelineSemanticEntries(TIMELINE_WINDOW);
        if (!cancelled) setSemanticEntries(entries);
      } catch {
        if (!cancelled) setSemanticEntries([]);
      } finally {
        if (!cancelled) setIsLoadingSemantic(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoadingModelLayers(true);
      setModelLayerError(null);
      try {
        const response = await fetch(buildTimelineModelLayersRequestUrl(TIMELINE_WINDOW), {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(TIMELINE_MODEL_LAYERS_ERROR_COPY);
        const nextPayload = (await response.json()) as { items?: TimelineModelLayerItem[] };
        if (!cancelled) {
          setModelLayers(Array.isArray(nextPayload.items) ? nextPayload.items : []);
        }
      } catch {
        if (!cancelled) {
          setModelLayers([]);
          setModelLayerError(TIMELINE_MODEL_LAYERS_ERROR_COPY);
        }
      } finally {
        if (!cancelled) setIsLoadingModelLayers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const timelineEntries = useMemo(() => {
    const activity = payload ? mapTimelineEntries(payload).map(enrichTimelineActivityEntry) : [];
    return [...activity, ...semanticEntries];
  }, [payload, semanticEntries]);

  const selectedObjectId = selection?.selectedObjectId ?? null;

  const timeline = useMemo(
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

  const dataApi = useMemo(
    () => ({
      ...EMPTY_ORVEK_DATA_API,
      timeline,
    }),
    [timeline]
  );

  const allRows = useMemo(
    () => timeline.groups.flatMap((group) => group.rows),
    [timeline.groups]
  );

  const pageHandlers = useMemo(
    () => ({
      timeline: {
        onFilterChange: setSemanticFilter,
        onSearchChange: setQuery,
        onOpenItem: (rowId: string) => {
          const target = resolveTimelineOpenTarget(allRows, rowId);
          if (!target) return;
          select({
            objectType: target.objectType,
            objectId: target.objectId,
            modelUpdateId: target.modelUpdateId ?? null,
            title: target.title,
            tab: target.tab,
          });
          setInspectorTab(target.tab);
        },
      },
    }),
    [allRows, select, setInspectorTab]
  );

  return (
    <OrvekV0PageShell>
      <OrvekDataProvider value={dataApi}>
        <OrvekPageHandlersProvider value={pageHandlers}>
          <TimelinePage />
        </OrvekPageHandlersProvider>
      </OrvekDataProvider>
    </OrvekV0PageShell>
  );
}
