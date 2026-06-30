"use client";

import { SectionLabel } from "@/components/AppShell";
import { useInspector } from "@/components/inspector/InspectorContext";
import {
  buildMindContextDisplayItems,
  fetchMindContextSnapshot,
  formatMindContextDateTime,
  MIND_CONTEXT_EMPTY_PRIMARY,
  MIND_CONTEXT_EMPTY_SECONDARY,
  MIND_CONTEXT_SECTION_INTRO,
  MIND_CONTEXT_SECTION_LABEL,
  type MindContextDisplayItem,
} from "@/lib/mind-context-surface";
import { ORVEK_DEFERRED_ACTION_CLASS } from "@/lib/orvek-v0/display-contract";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

function MindContextRow({ item }: { item: MindContextDisplayItem }) {
  const { selectObject } = useInspector();
  const updatedLabel = formatMindContextDateTime(item.updatedAt);
  const metaParts = [
    item.categoryLabel,
    item.statusLabel,
    item.evidenceCount != null
      ? `${item.evidenceCount} evidence source${item.evidenceCount === 1 ? "" : "s"}`
      : null,
    `Updated ${updatedLabel}`,
  ].filter(Boolean);

  const inner = (
    <>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-cyan/70">
        {item.kind === "memory" ? "Memory" : "Pattern"}
      </div>
      <p className="text-[14px] font-medium leading-snug text-foreground line-clamp-3">
        {item.title}
      </p>
      <div className="label-meta mt-2">{metaParts.join(" · ")}</div>
    </>
  );

  if (item.inspectorObjectId) {
    return (
      <button
        type="button"
        onClick={() => {
          selectObject({
            objectType: "pattern_claim",
            objectId: item.inspectorObjectId!,
            title: item.title,
            sourceSurface: "map",
            tab: "evidence",
          });
        }}
        className="ml-calm ml-material w-full rounded-xl px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className="ml-calm ml-material block rounded-xl px-4 py-3 opacity-75"
      title="Unavailable in v0"
      aria-disabled="true"
    >
      {inner}
    </div>
  );
}

export function YourMapMindContextPanel({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<MindContextDisplayItem[]>([]);
  const [summaryCounts, setSummaryCounts] = useState({ memories: 0, patterns: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const snapshot = await fetchMindContextSnapshot();
        if (cancelled) {
          return;
        }
        setItems(buildMindContextDisplayItems(snapshot));
        setSummaryCounts({
          memories: snapshot.memories.length,
          patterns: snapshot.activePatterns.length,
        });
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

  const summaryLine = useMemo(() => {
    if (summaryCounts.memories === 0 && summaryCounts.patterns === 0) {
      return null;
    }
    const parts: string[] = [];
    if (summaryCounts.memories > 0) {
      parts.push(
        `${summaryCounts.memories} active memor${summaryCounts.memories === 1 ? "y" : "ies"}`
      );
    }
    if (summaryCounts.patterns > 0) {
      parts.push(
        `${summaryCounts.patterns} active pattern${summaryCounts.patterns === 1 ? "" : "s"}`
      );
    }
    return parts.join(" · ");
  }, [summaryCounts]);

  return (
    <section
      className={cn("ml-material rounded-2xl p-5", className)}
      data-testid="your-map-mind-context-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>{MIND_CONTEXT_SECTION_LABEL}</SectionLabel>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
            {MIND_CONTEXT_SECTION_INTRO}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <button
            type="button"
            disabled
            title="Context is unavailable in v0"
            className={`rounded-md px-2 py-1 text-muted-foreground hover:bg-white/[0.04] hover:text-cyan ${ORVEK_DEFERRED_ACTION_CLASS}`}
          >
            Open Context
          </button>
          <button
            type="button"
            disabled
            title="Memories management is unavailable in v0"
            className={`rounded-md px-2 py-1 text-muted-foreground hover:bg-white/[0.04] hover:text-cyan ${ORVEK_DEFERRED_ACTION_CLASS}`}
          >
            Manage Memories
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Loading mind context…</p>
      ) : items.length === 0 ? (
        <div className="mt-4 space-y-1 text-[13px] text-muted-foreground">
          <p>{MIND_CONTEXT_EMPTY_PRIMARY}</p>
          <p className="text-muted-foreground/80">{MIND_CONTEXT_EMPTY_SECONDARY}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {summaryLine ? <p className="text-[12px] text-muted-foreground">{summaryLine}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <MindContextRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
