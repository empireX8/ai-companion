"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { SectionLabel } from "@/components/AppShell";
import { useInspector } from "@/components/inspector/InspectorContext";
import {
  fetchMapMovementPreview,
  fetchMapOpenQuestionsPreview,
  formatMapPreviewDateTime,
  MAP_MOVEMENT_EMPTY_COPY,
  MAP_MOVEMENT_SECTION_INTRO,
  MAP_MOVEMENT_SECTION_LABEL,
  MAP_MOVEMENT_VIEW_ALL_HREF,
  MAP_OPEN_QUESTIONS_EMPTY_COPY,
  MAP_OPEN_QUESTIONS_SECTION_INTRO,
  MAP_OPEN_QUESTIONS_SECTION_LABEL,
  MAP_OPEN_QUESTIONS_VIEW_ALL_HREF,
  toMapMovementRowTitle,
  type MapMovementPreviewItem,
  type MapOpenQuestionPreviewItem,
} from "@/lib/your-map-preview-surface";
import { cn } from "@/lib/utils";

function PreviewSectionShell({
  label,
  intro,
  viewAllHref,
  isLoading,
  isEmpty,
  emptyCopy,
  children,
  testId,
  className,
}: {
  label: string;
  intro: string;
  viewAllHref: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyCopy: string;
  children: ReactNode;
  testId: string;
  className?: string;
}) {
  return (
    <section
      className={cn("ml-material rounded-2xl p-5", className)}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <SectionLabel>{label}</SectionLabel>
          <p className="mt-1 text-[12px] text-muted-foreground">{intro}</p>
        </div>
        {!isLoading && !isEmpty ? (
          <Link
            href={viewAllHref}
            className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-cyan"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="mt-3">
        {isLoading ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : isEmpty ? (
          <p className="text-[13px] text-muted-foreground">{emptyCopy}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function MapMovementRow({ item }: { item: MapMovementPreviewItem }) {
  const { selectObject } = useInspector();

  return (
    <button
      type="button"
      onClick={() => {
        selectObject({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title: toMapMovementRowTitle(item),
          sourceSurface: "map",
          tab: "movement",
        });
      }}
      className="ml-calm ml-material w-full rounded-xl px-4 py-3 text-left hover:bg-white/[0.02]"
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-cyan/70">
        {item.updateTypeLabel}
      </div>
      <p className="mt-1 text-[14px] font-medium leading-snug text-foreground line-clamp-2">
        {toMapMovementRowTitle(item)}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
        {item.userFacingSummary}
      </p>
      <div className="label-meta mt-2">
        {item.affectedObjectTypeLabel} · Recorded {formatMapPreviewDateTime(item.createdAt)}
      </div>
    </button>
  );
}

function MapOpenQuestionRow({ item }: { item: MapOpenQuestionPreviewItem }) {
  return (
    <Link
      href={`/active-questions/${item.id}`}
      className="ml-calm ml-material block rounded-xl px-4 py-3 hover:bg-white/[0.02]"
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-cyan/70">
        Open question
      </div>
      <p className="mt-1 text-[14px] font-medium leading-snug text-foreground line-clamp-2">
        {item.title}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
        {item.organizingQuestion}
      </p>
      <div className="label-meta mt-2">
        {item.statusLabel} · Updated {formatMapPreviewDateTime(item.updatedAt)}
      </div>
    </Link>
  );
}

export function YourMapPreviewBands({ className }: { className?: string }) {
  const [movementItems, setMovementItems] = useState<MapMovementPreviewItem[]>([]);
  const [openQuestionItems, setOpenQuestionItems] = useState<MapOpenQuestionPreviewItem[]>([]);
  const [isLoadingMovement, setIsLoadingMovement] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingMovement(true);
      try {
        const items = await fetchMapMovementPreview();
        if (!cancelled) {
          setMovementItems(items);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMovement(false);
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
      setIsLoadingQuestions(true);
      try {
        const items = await fetchMapOpenQuestionsPreview();
        if (!cancelled) {
          setOpenQuestionItems(items);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQuestions(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={cn("mb-5 grid gap-4 lg:grid-cols-2", className)} data-testid="your-map-preview-bands">
      <PreviewSectionShell
        label={MAP_MOVEMENT_SECTION_LABEL}
        intro={MAP_MOVEMENT_SECTION_INTRO}
        viewAllHref={MAP_MOVEMENT_VIEW_ALL_HREF}
        isLoading={isLoadingMovement}
        isEmpty={movementItems.length === 0}
        emptyCopy={MAP_MOVEMENT_EMPTY_COPY}
        testId="your-map-movement-preview"
      >
        <div className="space-y-2">
          {movementItems.map((item) => (
            <MapMovementRow key={item.id} item={item} />
          ))}
        </div>
      </PreviewSectionShell>

      <PreviewSectionShell
        label={MAP_OPEN_QUESTIONS_SECTION_LABEL}
        intro={MAP_OPEN_QUESTIONS_SECTION_INTRO}
        viewAllHref={MAP_OPEN_QUESTIONS_VIEW_ALL_HREF}
        isLoading={isLoadingQuestions}
        isEmpty={openQuestionItems.length === 0}
        emptyCopy={MAP_OPEN_QUESTIONS_EMPTY_COPY}
        testId="your-map-open-questions-preview"
      >
        <div className="space-y-2">
          {openQuestionItems.map((item) => (
            <MapOpenQuestionRow key={item.id} item={item} />
          ))}
        </div>
      </PreviewSectionShell>
    </div>
  );
}
