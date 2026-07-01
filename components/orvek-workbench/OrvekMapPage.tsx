"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { MapPage } from "@/components/orvek-v0/pages/map";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
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
import { buildMapProductionDataApi } from "@/lib/orvek-v0/production/map-api";
import type {
  UserMapConclusionPublicApiDetailItem,
  UserMapConclusionPublicApiListItem,
} from "@/lib/public-intelligence-safe-slice";
import {
  fetchMapMovementPreview,
  fetchMapOpenQuestionsPreview,
  type MapMovementPreviewItem,
  type MapOpenQuestionPreviewItem,
} from "@/lib/your-map-preview-surface";
import {
  fetchYourMapConclusions,
  pickInitialYourMapSelectionId,
} from "@/lib/your-map-surface";

export function OrvekMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<UserMapConclusionPublicApiListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserMapConclusionPublicApiDetailItem | null>(null);
  const [evidence, setEvidence] = useState<InspectorEvidenceLinkItem[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
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

  const preferredSelectionId =
    searchParams.get("selected") ?? searchParams.get("id");

  const openItem = useCallback(
    (id: string) => {
      setSelectedId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("selected", id);
      router.replace(`/your-map?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const nextItems = await fetchYourMapConclusions();
        if (!cancelled) setItems(nextItems);
      } catch {
        if (!cancelled) {
          setItems([]);
          setLoadError("Could not load your map.");
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
        if (!cancelled) setIsMindContextLoading(false);
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
        if (!cancelled) setMovementItems(nextItems);
      } finally {
        if (!cancelled) setIsMovementLoading(false);
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
        if (!cancelled) setIsQuestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }
    if (preferredSelectionId) {
      const preferredMindContext = mindContextItems.find(
        (item) =>
          item.id === preferredSelectionId ||
          `context-${item.id}` === preferredSelectionId
      );
      if (preferredMindContext) {
        setSelectedId(preferredSelectionId);
        return;
      }
    }
    setSelectedId(pickInitialYourMapSelectionId(items, preferredSelectionId));
  }, [items, preferredSelectionId, mindContextItems]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEvidence([]);
      setIsDetailLoading(false);
      return;
    }

    if (!items.some((item) => item.id === selectedId)) {
      setDetail(null);
      setEvidence([]);
      setIsDetailLoading(false);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);
    void (async () => {
      const [nextDetail, nextEvidence] = await Promise.all([
        fetchInspectorUserMapDetail(selectedId),
        fetchInspectorEvidenceLinks(INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(selectedId)),
      ]);
      if (!cancelled) {
        setDetail(nextDetail);
        setEvidence(nextEvidence);
        setIsDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const dataApi = useMemo(
    () =>
      buildMapProductionDataApi({
        items,
        isLoading:
          isLoading ||
          isMindContextLoading ||
          isMovementLoading ||
          isQuestionsLoading,
        loadError,
        selectedId,
        detail,
        isDetailLoading,
        evidence,
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
      }),
    [
      items,
      isLoading,
      isMindContextLoading,
      isMovementLoading,
      isQuestionsLoading,
      loadError,
      selectedId,
      detail,
      isDetailLoading,
      evidence,
      openQuestionsCount,
      isMindContextLoading,
      mindContextItems,
      mindContextSummaryCounts,
      isMovementLoading,
      movementItems,
      isQuestionsLoading,
      openQuestionItems,
    ]
  );

  const pageHandlers = useMemo(
    () => ({
      map: {
        onOpenItem: (railId: string) => {
          const api = buildMapProductionDataApi({
            items,
            isLoading,
            loadError,
            selectedId,
            detail,
            isDetailLoading,
            evidence,
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
          const obj = api.getObject(railId);
          const selectedObjectId = obj?.inspectorObjectId ?? railId;
          if (!obj) {
            return;
          }
          if (obj.type === "context") {
            openItem(selectedObjectId);
            return;
          }
          const conclusionId = selectedObjectId.replace(/^conclusion-/, "");
          if (conclusionId && items.some((item) => item.id === conclusionId)) {
            openItem(conclusionId);
          }
        },
      },
    }),
    [
      detail,
      evidence,
      isDetailLoading,
      isLoading,
      isMindContextLoading,
      isMovementLoading,
      isQuestionsLoading,
      items,
      loadError,
      mindContextItems,
      mindContextSummaryCounts,
      movementItems,
      openItem,
      openQuestionItems,
      openQuestionsCount,
      selectedId,
    ]
  );

  return (
    <OrvekV0PageShell data={dataApi} handlers={pageHandlers}>
      <MapPage />
    </OrvekV0PageShell>
  );
}
