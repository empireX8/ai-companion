"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { useInspector } from "@/components/inspector/InspectorContext";
import {
  fetchYourMapConclusions,
  groupUserMapConclusionsByStatus,
  pickInitialYourMapSelectionId,
  YOUR_MAP_EMPTY_PRIMARY,
  YOUR_MAP_EMPTY_SECONDARY,
  YOUR_MAP_PAGE_INTRO,
  YOUR_MAP_PAGE_META,
  YOUR_MAP_PAGE_TITLE,
  YOUR_MAP_UNDERSTANDINGS_SECTION_LABEL,
} from "@/lib/your-map-surface";
import type { UserMapConclusionPublicApiListItem } from "@/lib/public-intelligence-safe-slice";

import { YourMapDetailPane } from "./YourMapDetailPane";
import { YourMapListRail } from "./YourMapListRail";
import { YourMapMindContextPanel } from "./YourMapMindContextPanel";
import { YourMapPreviewBands } from "./YourMapPreviewBands";

export function YourMapWorkbench() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectObject } = useInspector();

  const [items, setItems] = useState<UserMapConclusionPublicApiListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => groupUserMapConclusionsByStatus(items), [items]);
  const preferredSelectionId =
    searchParams.get("selected") ?? searchParams.get("id");

  const syncSelectionToInspector = useCallback(
    (item: UserMapConclusionPublicApiListItem | undefined) => {
      if (!item) {
        return;
      }
      selectObject({
        objectType: "usermap_conclusion",
        objectId: item.id,
        title: item.title,
        sourceSurface: "map",
        tab: "evidence",
      });
    },
    [selectObject]
  );

  const handleSelect = useCallback(
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
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }

    const initialId = pickInitialYourMapSelectionId(items, preferredSelectionId);
    setSelectedId(initialId);
    const initialItem = items.find((entry) => entry.id === initialId);
    syncSelectionToInspector(initialItem);
  }, [items, preferredSelectionId, syncSelectionToInspector]);

  return (
    <div className="animate-fade-in flex h-full min-h-0 flex-col px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col">
        <PageHeader title={YOUR_MAP_PAGE_TITLE} meta={YOUR_MAP_PAGE_META} compact />
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{YOUR_MAP_PAGE_INTRO}</p>

        <YourMapMindContextPanel className="mb-5" />
        <YourMapPreviewBands />

        {isLoading ? (
          <div className="ml-material rounded-2xl p-5 text-[13px] text-muted-foreground">
            Loading your map…
          </div>
        ) : loadError ? (
          <div className="ml-material rounded-2xl p-5 text-[13px] text-[hsl(12_80%_64%)]">
            {loadError}
          </div>
        ) : items.length === 0 ? (
          <div className="ml-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <SectionLabel>{YOUR_MAP_UNDERSTANDINGS_SECTION_LABEL}</SectionLabel>
            <p className="mt-3">{YOUR_MAP_EMPTY_PRIMARY}</p>
            <p className="text-muted-foreground/80">{YOUR_MAP_EMPTY_SECONDARY}</p>
          </div>
        ) : (
          <div
            className="ml-float grid min-h-0 flex-1 overflow-hidden rounded-2xl lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]"
            data-testid="your-map-workbench"
          >
            <aside className="min-h-0 border-b ml-hairline lg:border-b-0 lg:border-r">
              <div className="px-3 py-3">
                <SectionLabel>{YOUR_MAP_UNDERSTANDINGS_SECTION_LABEL}</SectionLabel>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Conclusions from your evidence — grouped by status.
                </p>
              </div>
              <div className="max-h-[42vh] overflow-y-auto px-3 pb-4 lg:max-h-none lg:flex-1">
                <YourMapListRail
                  groups={groups}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              </div>
            </aside>

            <main className="min-h-0 overflow-y-auto" data-testid="your-map-detail-pane">
              <YourMapDetailPane selectedId={selectedId} />
            </main>
          </div>
        )}

        <p className="label-meta text-meta mt-6">
          Explore related surfaces:{" "}
          <span className="text-muted-foreground/60" title="Unavailable in v0">
            Active Questions
          </span>{" "}
          ·{" "}
          <Link href="/watch-for" className="hover:text-cyan transition-colors">
            Watch For
          </Link>
        </p>
      </div>
    </div>
  );
}
