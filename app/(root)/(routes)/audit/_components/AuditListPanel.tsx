"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  createWeeklyAuditBackfill,
  createWeeklyAuditSnapshot,
  fetchWeeklyAudit,
  fetchWeeklyTrend,
  type WeeklyAudit,
} from "@/lib/audit-api";
import { postMetricEvent } from "@/lib/metrics-api";

const formatWeek = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toISOString().slice(0, 10);
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
      {/* Action bar */}
      <div className="shrink-0 space-y-1.5 border-b border-border/60 px-3 py-2">
        {isPreview && (
          <button
            type="button"
            disabled={isCreating || isBackfilling}
            onClick={() => void handleCreateSnapshot()}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isCreating ? "Saving…" : "Create snapshot"}
          </button>
        )}
        <button
          type="button"
          disabled={isCreating || isBackfilling}
          onClick={() => void handleBackfill()}
          className="w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {isBackfilling ? "Backfilling…" : "Backfill 8w"}
        </button>
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
              <li key={item.id} className={isActive ? "bg-accent/60" : ""}>
                <Link
                  href={`/audit/${item.id}`}
                  className="block p-2 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-foreground">
                      {formatWeek(item.weekStart)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        item.status === "locked"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    open={item.openContradictionCount} · stability={item.stabilityProxy.toFixed(3)}
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
