"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { GitCompareArrows, HelpCircle } from "lucide-react";

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

import { SectionLabel } from "./OrvekPrimitives";
import { useOrvekInspector } from "./useOrvekInspector";

function PreviewSectionShell({
  label,
  intro,
  viewAllHref,
  isLoading,
  isEmpty,
  emptyCopy,
  icon: Icon,
  children,
  testId,
}: {
  label: string;
  intro: string;
  viewAllHref: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyCopy: string;
  icon: typeof GitCompareArrows;
  children: ReactNode;
  testId: string;
}) {
  return (
    <section className="o-material rounded-2xl p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Icon className="size-3.5 text-primary" aria-hidden />
            <SectionLabel>{label}</SectionLabel>
          </div>
          <p className="text-[12px] text-muted-foreground">{intro}</p>
        </div>
        {!isLoading && !isEmpty ? (
          <Link
            href={viewAllHref}
            className="shrink-0 text-[11px] font-medium text-primary hover:underline"
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
  const { select, setInspectorTab } = useOrvekInspector();

  return (
    <button
      type="button"
      onClick={() => {
        select({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title: toMapMovementRowTitle(item),
          sourceSurface: "map",
          tab: "movement",
        });
        setInspectorTab("movement");
      }}
      className="o-calm o-material w-full rounded-[10px] px-3 py-2.5 text-left hover:bg-accent/40"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
        {item.updateTypeLabel}
      </div>
      <p className="mt-1 text-[13px] font-medium leading-snug text-foreground line-clamp-2">
        {toMapMovementRowTitle(item)}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
        {item.userFacingSummary}
      </p>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {item.affectedObjectTypeLabel} · Recorded {formatMapPreviewDateTime(item.createdAt)}
      </div>
    </button>
  );
}

function MapOpenQuestionRow({ item }: { item: MapOpenQuestionPreviewItem }) {
  return (
    <Link
      href={`/active-questions/${item.id}`}
      className="o-calm o-material block rounded-[10px] px-3 py-2.5 hover:bg-accent/40"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-action-foreground">
        Open question
      </div>
      <p className="mt-1 text-[13px] font-medium leading-snug text-foreground line-clamp-2">
        {item.title}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
        {item.organizingQuestion}
      </p>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {item.statusLabel} · Updated {formatMapPreviewDateTime(item.updatedAt)}
      </div>
    </Link>
  );
}

export function OrvekMapPreviewBands() {
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
    <div
      className="mb-4 grid gap-4 px-6 lg:grid-cols-2 lg:px-8"
      data-testid="orvek-map-preview-bands"
    >
      <PreviewSectionShell
        label={MAP_MOVEMENT_SECTION_LABEL}
        intro={MAP_MOVEMENT_SECTION_INTRO}
        viewAllHref={MAP_MOVEMENT_VIEW_ALL_HREF}
        isLoading={isLoadingMovement}
        isEmpty={movementItems.length === 0}
        emptyCopy={MAP_MOVEMENT_EMPTY_COPY}
        icon={GitCompareArrows}
        testId="orvek-map-movement-preview"
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
        icon={HelpCircle}
        testId="orvek-map-open-questions-preview"
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
