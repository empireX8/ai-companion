"use client";

import { useEffect, useMemo, useState } from "react";

import { TimelinePage } from "@/components/orvek-v0/pages/timeline";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { buildTimelineProductionDataApi } from "@/lib/orvek-v0/production/timeline-api";
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

const TIMELINE_WINDOW = "30d";

export function OrvekTimelinePage() {
  const [payload, setPayload] = useState<TimelineResponse | null>(null);
  const [semanticEntries, setSemanticEntries] = useState<TimelineEntry[]>([]);
  const [modelLayers, setModelLayers] = useState<TimelineModelLayerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSemantic, setIsLoadingSemantic] = useState(true);
  const [isLoadingModelLayers, setIsLoadingModelLayers] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelLayerError, setModelLayerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const response = await fetch(buildTimelineRequestUrl(TIMELINE_WINDOW), {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load timeline.");
        const next = (await response.json()) as TimelineResponse;
        if (!cancelled) setPayload(next);
      } catch (error) {
        if (!cancelled) {
          setPayload(null);
          setErrorMessage(error instanceof Error ? error.message : "Could not load timeline.");
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
      try {
        const response = await fetch(buildTimelineModelLayersRequestUrl(TIMELINE_WINDOW), {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load model layers.");
        const next = (await response.json()) as { items?: TimelineModelLayerItem[] };
        if (!cancelled) setModelLayers(Array.isArray(next.items) ? next.items : []);
      } catch {
        if (!cancelled) {
          setModelLayers([]);
          setModelLayerError("Could not load model layers.");
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

  const dataApi = useMemo(
    () =>
      buildTimelineProductionDataApi({
        timelineEntries,
        modelLayers,
        semanticFilter: "all",
        searchQuery: "",
        isLoadingActivity: isLoading,
        isLoadingModelLayers,
        isLoadingSemantic,
        activityError: errorMessage,
        modelLayerError,
        selectedObjectId: null,
      }),
    [
      timelineEntries,
      modelLayers,
      isLoading,
      isLoadingModelLayers,
      isLoadingSemantic,
      errorMessage,
      modelLayerError,
    ]
  );

  return (
    <OrvekV0PageShell data={dataApi}>
      <TimelinePage />
    </OrvekV0PageShell>
  );
}
