"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type SnapshotItem = {
  id: string;
  title: string;
  computedWeight: number;
};

type AuditData = {
  id?: string;
  weekStart: string;
  status: string;
  stabilityProxy: number;
  contradictionDensity: number;
  openContradictionCount: number;
  activeReferenceCount: number;
  inputHash: string | null;
  lockedAt: string | null;
  top3Snapshot: SnapshotItem[] | null;
  preview?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "n/a";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
};

function PanelSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-2 py-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function AuditInspectorPanel() {
  const pathname = usePathname();
  const activeId = pathname.match(/^\/audit\/([^/]+)$/)?.[1] ?? null;

  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setAudit(null);

    void (async () => {
      try {
        // GET /api/audit/weekly is read-safe: returns stored audit or computes
        // an in-memory preview WITHOUT creating or modifying any record.
        const url = activeId ? `/api/audit/weekly/${activeId}` : "/api/audit/weekly";
        const res = await fetch(url, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401 || res.status === 404) return;
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = (await res.json()) as AuditData;
        if (!cancelled) setAudit(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  if (loading) return <PanelSkeleton />;
  if (error) return <p className="p-3 text-xs text-destructive">Failed to load.</p>;
  if (!audit) return <p className="p-3 text-xs text-muted-foreground">No audit data.</p>;

  const isPreview = !!audit.preview;
  const isLocked = audit.status === "locked";
  const snapshot = Array.isArray(audit.top3Snapshot) ? audit.top3Snapshot.slice(0, 3) : [];

  return (
    <div className="divide-y divide-border/60">
      {/* Header + metrics */}
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {activeId ? `Week of ${fmtDate(audit.weekStart)}` : "This Week"}
          </p>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              isLocked
                ? "bg-primary/10 text-primary"
                : isPreview
                  ? "bg-muted text-muted-foreground/60"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {isPreview ? "preview" : audit.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <MetricCell label="Stability" value={audit.stabilityProxy.toFixed(3)} />
          <MetricCell label="Density" value={audit.contradictionDensity.toFixed(3)} />
          <MetricCell label="Open" value={String(audit.openContradictionCount)} />
          <MetricCell label="Active refs" value={String(audit.activeReferenceCount)} />
        </div>

        {isLocked && audit.inputHash && (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            hash: {audit.inputHash.slice(0, 12)}…
          </p>
        )}
      </div>

      {/* Top-3 snapshot if present */}
      {snapshot.length > 0 && (
        <div className="p-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Top Snapshot
          </p>
          <ul className="space-y-1.5">
            {snapshot.map((item, i) => (
              <li key={item.id} className="flex items-center gap-1.5">
                <span className="shrink-0 text-[10px] text-muted-foreground/50">
                  #{i + 1}
                </span>
                <span className="min-w-0 truncate text-xs text-foreground">
                  {item.title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {item.computedWeight.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
