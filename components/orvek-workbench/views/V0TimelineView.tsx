"use client";

import Link from "next/link";
import { Search } from "lucide-react";

import { TimelineInspectorAction } from "../../timeline/TimelineInspectorAction";
import { PublicLinkedObjectContinuity } from "../../../lib/public-continuity-display";
import type {
  V0TimelineLaneKey,
  V0TimelineStreamRow,
  V0TimelineViewProps,
} from "../../../lib/orvek-adapters/timeline";
import type { TimelineSemanticFilter } from "../../../lib/timeline-semantic-layers";
import { cn } from "../../../lib/utils";

import { SectionLabel } from "../OrvekPrimitives";

const LANE_DOT: Record<V0TimelineLaneKey, string> = {
  evidence: "bg-primary",
  action: "bg-action",
  decision: "bg-foreground/60",
  receipt: "bg-muted-foreground",
};

const LANE_STRIPE: Record<V0TimelineLaneKey, string> = {
  evidence: "before:bg-primary",
  action: "before:bg-action",
  decision: "before:bg-foreground/50",
  receipt: "before:bg-muted-foreground/60",
};

export type V0TimelineViewHandlers = {
  onFilterChange: (filter: TimelineSemanticFilter) => void;
  onSearchChange: (query: string) => void;
  onOpenItem: (rowId: string) => void;
};

function TimelineStreamRow({
  row,
  selected,
  onOpen,
}: {
  row: V0TimelineStreamRow;
  selected: boolean;
  onOpen: () => void;
}) {
  const rowClassName = cn(
    "o-calm relative flex w-full gap-3 px-4 py-3 pl-5 text-left",
    "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r",
    LANE_STRIPE[row.laneKey],
    selected ? "bg-accent/50" : "hover:bg-accent/30"
  );

  const content = (
    <>
      <span
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", LANE_DOT[row.laneKey])}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {row.eventLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {row.time} · {row.date}
          </span>
          {row.moved ? (
            <span className="rounded-full bg-evidence-muted px-1.5 py-0.5 text-[10px] font-medium text-primary">
              moved
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[14px] font-medium leading-snug text-foreground">
          {row.title}
        </span>
        {row.summary ? (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
            {row.summary}
          </span>
        ) : null}
        {row.isModelChange && row.affectedObjectType ? (
          <div className="mt-2">
            <PublicLinkedObjectContinuity
              objectType={row.affectedObjectType}
              objectId={row.affectedObjectId ?? null}
              href={row.affectedObjectHref ?? null}
              context="model_update"
            />
          </div>
        ) : null}
        {row.inspectorTarget ? (
          <TimelineInspectorAction
            objectType={row.inspectorTarget.objectType}
            objectId={row.inspectorTarget.objectId}
            modelUpdateId={row.inspectorTarget.modelUpdateId}
            title={row.inspectorTarget.title}
            tab={row.inspectorTarget.tab}
          />
        ) : null}
      </span>
    </>
  );

  if (row.href) {
    return (
      <Link href={row.href} className={rowClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={rowClassName}>
      {content}
    </button>
  );
}

export function V0TimelineView({
  data,
  handlers,
}: {
  data: V0TimelineViewProps;
  handlers: V0TimelineViewHandlers;
}) {
  const {
    pageIntro,
    filters,
    activeFilter,
    lanes,
    searchQuery,
    isLoading,
    loadingCopy,
    activityError,
    modelLayerError,
    emptyCopy,
    groups,
    selectedObjectId,
  } = data;

  function isRowSelected(row: V0TimelineStreamRow): boolean {
    if (!selectedObjectId || !row.selectableObjectId) {
      return false;
    }
    return selectedObjectId === row.selectableObjectId;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Timeline</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{pageIntro}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr]">
        <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-4 py-4 lg:mr-1.5">
          <SectionLabel>Filter</SectionLabel>
          <ul className="mt-2 space-y-0.5">
            {filters.map((filter) => (
              <li key={filter.id}>
                <button
                  type="button"
                  onClick={() => handlers.onFilterChange(filter.id)}
                  className={cn(
                    "o-calm w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-medium",
                    activeFilter === filter.id
                      ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  {filter.label}
                </button>
              </li>
            ))}
          </ul>

          <SectionLabel className="mt-5">Lanes</SectionLabel>
          <ul className="mt-2 space-y-1.5 text-[12px] text-muted-foreground">
            {lanes.map((lane) => (
              <li key={lane.label} className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", lane.dotClass)} />
                {lane.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="relative mb-5">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => handlers.onSearchChange(event.target.value)}
                placeholder="Search timeline…"
                className="w-full rounded-[10px] bg-secondary/60 py-2 pl-8 pr-3 text-sm text-foreground outline-none ring-1 ring-inset ring-transparent focus:bg-card focus:ring-primary/40"
              />
            </div>

            {isLoading ? (
              <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                {loadingCopy}
              </div>
            ) : (
              <>
                {activityError ? (
                  <div
                    className="o-material mb-4 rounded-[10px] p-4 text-[13px] text-destructive"
                    role="alert"
                  >
                    {activityError}
                  </div>
                ) : null}
                {modelLayerError ? (
                  <div
                    className="o-material mb-4 rounded-[10px] p-4 text-[13px] text-destructive"
                    role="alert"
                  >
                    {modelLayerError}
                  </div>
                ) : null}
                {groups.length > 0 ? (
                  <div className="relative pl-5">
                    <div
                      className="absolute bottom-2 left-[5px] top-2 w-px bg-border"
                      aria-hidden
                    />
                    {groups.map((group) => (
                      <div key={group.heading} className="mb-6">
                        <div className="relative mb-2.5">
                          <span className="absolute -left-[19px] top-0.5 size-3 rounded-full border-2 border-primary bg-card shadow-[0_0_0_3px_var(--card)]" />
                          <SectionLabel>{group.heading}</SectionLabel>
                        </div>
                        <div className="o-material overflow-hidden rounded-[10px]">
                          {group.rows.map((row, index) => (
                            <div
                              key={row.id}
                              className={index !== 0 ? "border-t o-hairline" : undefined}
                            >
                              <TimelineStreamRow
                                row={row}
                                selected={isRowSelected(row)}
                                onOpen={() => handlers.onOpenItem(row.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !activityError && !modelLayerError ? (
                  <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                    {emptyCopy}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
