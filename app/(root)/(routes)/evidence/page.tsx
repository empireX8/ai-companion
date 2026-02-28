"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Database } from "lucide-react";

import {
  type EvidenceListItem,
  type EvidenceListResponse,
  fetchEvidenceList,
} from "@/lib/nodes-api";

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  BELIEF: "Belief",
  VALUE: "Value",
  GOAL: "Goal",
  FEAR: "Fear",
  IDENTITY: "Identity",
  TRAIT: "Trait",
  HABIT: "Habit",
  TOPIC: "Topic",
  RELATIONSHIP_PATTERN: "Relationship",
  EMOTIONAL_PATTERN: "Emotional",
  COGNITIVE_PATTERN: "Cognitive",
};

type OriginFilter = "all" | "app" | "imported";
type ArtifactFilter = "all" | "has" | "none";

export default function EvidencePage() {
  const [items, setItems] = useState<EvidenceListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [artifactFilter, setArtifactFilter] = useState<ArtifactFilter>("all");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (opts: { q: string; origin: OriginFilter; artifacts: ArtifactFilter; cursor?: string }) => {
      const hasArtifacts =
        opts.artifacts === "has" ? true : opts.artifacts === "none" ? false : undefined;

      try {
        const res: EvidenceListResponse | null = await fetchEvidenceList({
          q: opts.q || undefined,
          origin: opts.origin === "all" ? "all" : opts.origin,
          hasArtifacts,
          limit: 30,
          cursor: opts.cursor,
        });

        if (!res) {
          setError(true);
          return;
        }

        if (opts.cursor) {
          setItems((prev) => [...prev, ...res.items]);
        } else {
          setItems(res.items);
        }
        setNextCursor(res.nextCursor);
        setError(false);
      } catch {
        setError(true);
      }
    },
    []
  );

  // Initial + filter-change load
  useEffect(() => {
    setLoading(true);
    void load({ q: query, origin: originFilter, artifacts: artifactFilter }).finally(() =>
      setLoading(false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originFilter, artifactFilter]);

  // Debounced search
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      void load({ q: val, origin: originFilter, artifacts: artifactFilter }).finally(() =>
        setLoading(false)
      );
    }, 300);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await load({ q: query, origin: originFilter, artifacts: artifactFilter, cursor: nextCursor });
    setLoadingMore(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Evidence Library</h1>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Every message segment captured as evidence — linked to the cognitive profile claims it
          supports.
        </p>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search evidence text..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as OriginFilter)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All origins</option>
            <option value="app">Native sessions</option>
            <option value="imported">Imported</option>
          </select>

          <select
            value={artifactFilter}
            onChange={(e) => setArtifactFilter(e.target.value as ArtifactFilter)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All spans</option>
            <option value="has">Has profile claims</option>
            <option value="none">No claims</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-destructive">
            Failed to load evidence. Please try again.
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No evidence spans found.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/evidence/${item.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm text-foreground">{item.excerpt}</p>
                  {item.artifactCount > 0 && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {item.artifactCount} claim{item.artifactCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {item.sessionLabel ? (
                    <span className="truncate max-w-[200px]">{item.sessionLabel}</span>
                  ) : (
                    <span className="italic">Unnamed session</span>
                  )}
                  <span>·</span>
                  <span>{item.origin === "IMPORTED_ARCHIVE" ? "Imported" : "Native"}</span>
                  <span>·</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </Link>
            ))}

            {nextCursor && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/30 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
