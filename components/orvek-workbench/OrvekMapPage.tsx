"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
import { mapMapDataToV0Props } from "@/lib/orvek-adapters/map";
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

import { useOrvekInspector } from "./useOrvekInspector";
import { V0MapView } from "./views/V0MapView";

export function OrvekMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { select, setInspectorTab } = useOrvekInspector();

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

  const syncSelectionToInspector = useCallback(
    (item: UserMapConclusionPublicApiListItem | undefined) => {
      if (!item) {
        return;
      }
      select({
        objectType: "usermap_conclusion",
        objectId: item.id,
        title: item.title,
        sourceSurface: "map",
        tab: "evidence",
      });
    },
    [select]
  );

  const openItem = useCallback(
    (id: string) => {
      setSelectedId(id);
      const item = items.find((entry) => entry.id === id);
      syncSelectionToInspector(item);

      const params = new URLSearchParams(searchParams.toString());
      params.set("selected", id);
      router.replace(`/your-map?${params.toString()}`, { scroll: false });
    },
    [items, router, searchParams, syncSelectionToInspector]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const nextItems = await fetchYourMapConclusions();
        if (cancelled) {
          return;
        }
        setItems(nextItems);
      } catch {
        if (!cancelled) {
          setItems([]);
          setLoadError("Could not load your map.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsMindContextLoading(true);
      try {
        const snapshot = await fetchMindContextSnapshot();
        if (cancelled) {
          return;
        }
        setMindContextItems(buildMindContextDisplayItems(snapshot, 3));
        setMindContextSummaryCounts({
          memories: snapshot.memories.length,
          patterns: snapshot.activePatterns.length,
        });
      } finally {
        if (!cancelled) {
          setIsMindContextLoading(false);
        }
      }
    };

    void load();

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
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }

    const initialId = pickInitialYourMapSelectionId(items, preferredSelectionId);
    setSelectedId(initialId);
    const initialItem = items.find((entry) => entry.id === initialId);
    syncSelectionToInspector(initialItem);
  }, [items, preferredSelectionId, syncSelectionToInspector]);

  useEffect(() => {
    if (!selectedId) {
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

      if (cancelled) {
        return;
      }

      setDetail(nextDetail);
      setEvidence(nextEvidence);
      setIsDetailLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const viewData = useMemo(
    () =>
      mapMapDataToV0Props({
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
      }),
    [
      items,
      isLoading,
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

  const movementById = useMemo(
    () => new Map(movementItems.map((item) => [item.id, item])),
    [movementItems]
  );

  return (
    <V0MapView
      data={viewData}
      handlers={{
        onSelectItem: openItem,
        onOpenInspector: () => {
          if (!detail) {
            return;
          }
          select({
            objectType: "usermap_conclusion",
            objectId: detail.id,
            title: detail.title,
            sourceSurface: "map",
            tab: "evidence",
          });
          setInspectorTab("evidence");
        },
        onMindContextChip: (inspectorObjectId, title) => {
          select({
            objectType: "pattern_claim",
            objectId: inspectorObjectId,
            title,
            sourceSurface: "map",
            tab: "evidence",
          });
          setInspectorTab("evidence");
        },
        onMovementRow: (id) => {
          const item = movementById.get(id);
          if (!item) {
            return;
          }
          select({
            objectType: "model_update",
            objectId: item.id,
            modelUpdateId: item.id,
            title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
            sourceSurface: "map",
            tab: "movement",
          });
          setInspectorTab("movement");
        },
        onOpenQuestionRow: (id) => {
          router.push(`/active-questions/${id}`);
        },
      }}
    />
  );
}
