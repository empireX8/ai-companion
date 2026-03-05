"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, MoreHorizontal, Plus, RefreshCw } from "lucide-react";

import {
  createWeeklyAuditBackfill,
  createWeeklyAuditSnapshot,
  fetchWeeklyAudit,
  fetchWeeklyTrend,
  type WeeklyAudit,
} from "@/lib/audit-api";
import { postMetricEvent } from "@/lib/metrics-api";

const formatWeek = (value: string) => {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return "n/a";
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const now = new Date();
  const sameYear = start.getFullYear() === now.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, {
    day: "numeric",
    ...(end.getMonth() !== start.getMonth() ? { month: "short" } : {}),
  });
  const yearSuffix = sameYear ? "" : `, ${start.getFullYear()}`;
  return `${startLabel} – ${endLabel}${yearSuffix}`;
};

export function AuditListPanel() {
  const pathname = usePathname();

  // Derive active ID from pathname (e.g. /audit/abc123)
  const activeId = pathname.startsWith("/audit/")
    ? pathname.slice("/audit/".length).split("/")[0]
    : null;

  const [items, setItems] = useState<WeeklyAudit[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [current, trend] = await Promise.all([
        fetchWeeklyAudit(),
        fetchWeeklyTrend(52),
      ]);

      if (!current || !trend) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      setUnauthorized(false);
      setIsPreview("preview" in current && !!current.preview);

      // Sort newest → oldest for display
      const sorted = [...trend.items].sort(
        (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
      );
      setItems(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateSnapshot = async () => {
    setActionError(null);
    setIsCreating(true);
    try {
      await createWeeklyAuditSnapshot();
      void postMetricEvent({ name: "audit.snapshot.created", route: "/audit" });
      await load({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Snapshot failed");
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackfill = async () => {
    setActionError(null);
    setIsBackfilling(true);
    try {
      const result = await createWeeklyAuditBackfill(8);
      void postMetricEvent({
        name: "audit.backfill.executed",
        meta: {
          weeks: 8,
          createdCount: result.createdCount,
          skippedExistingCount: result.skippedExistingCount,
          skippedLockedCount: result.skippedLockedCount,
        },
        route: "/audit",
      });
      await load({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setIsBackfilling(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar — compound action button */}
      <div className="shrink-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 overflow-hidden rounded-md shadow-glow-sm">
            {isPreview ? (
              <button
                type="button"
                onClick={() => void handleCreateSnapshot()}
                disabled={isCreating || isBackfilling}
                className="flex flex-1 items-center gap-2 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>{isCreating ? "Saving…" : "New snapshot"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleBackfill()}
                disabled={isCreating || isBackfilling}
                className="flex flex-1 items-center gap-2 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4 shrink-0" />
                <span>{isBackfilling ? "Backfilling…" : "Backfill 8w"}</span>
              </button>
            )}
            <div className="w-px shrink-0 bg-primary-foreground/20" />
            <button
              type="button"
              className="flex shrink-0 items-center justify-center bg-primary px-2.5 text-primary-foreground transition-opacity hover:opacity-90"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        {isPreview && (
          <button
            type="button"
            disabled={isCreating || isBackfilling}
            onClick={() => void handleBackfill()}
            className="mt-2 w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {isBackfilling ? "Backfilling…" : "Backfill 8w"}
          </button>
        )}
      </div>

      {/* Section header */}
      <div className="flex shrink-0 items-center justify-between border-t border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Weekly Audits</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            aria-label="More options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {actionError}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex-1 space-y-2 p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : unauthorized ? (
        <p className="flex-1 p-3 text-xs text-muted-foreground">Sign in to view audits.</p>
      ) : error ? (
        <p className="flex-1 p-3 text-xs text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <div className="flex-1 p-4 text-center">
          <p className="text-xs font-medium text-foreground">No audits yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a snapshot or run backfill to populate.
          </p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border/60 overflow-y-auto">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id} className={isActive ? "bg-primary/10" : ""}>
                <Link
                  href={`/audit/${item.id}`}
                  className="block px-3 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {formatWeek(item.weekStart)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
                        item.status === "locked"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.openContradictionCount} open · {item.stabilityProxy.toFixed(3)} stability
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
