"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  fetchWeeklyAuditById,
  fetchWeeklyAuditExplain,
  lockWeeklyAudit,
  type ExplainPayload,
  type WeeklyAudit,
} from "@/lib/audit-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (value: string | null | undefined) => {
  if (!value) return "n/a";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toISOString().slice(0, 10);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().replace("T", " ").slice(0, 19) + " UTC";
};

// ── MetricRow ─────────────────────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
      <div>{label}</div>
      <div className="mt-1 text-xl text-foreground">{value}</div>
    </div>
  );
}

// ── Top3Card ──────────────────────────────────────────────────────────────────

type SnapshotItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  recommendedRung: string | null;
  lastEvidenceAt: string | null;
  computedWeight: number;
  sideA: string;
  sideB: string;
};

function Top3Card({ item, rank }: { item: SnapshotItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border bg-card p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 font-medium text-foreground">
          <span className="mr-1 text-xs text-muted-foreground">#{rank}</span>
          <Link href={`/contradictions/${item.id}`} className="hover:underline">
            [{item.type}] {item.title}
          </Link>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          weight {item.computedWeight.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>status: {item.status}</span>
        <span>rung: {item.recommendedRung ?? "n/a"}</span>
        <span>lastEvidence: {formatDate(item.lastEvidenceAt)}</span>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Side A:</span> {item.sideA}
          </div>
          <div>
            <span className="font-medium text-foreground">Side B:</span> {item.sideB}
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
          >
            collapse ↑
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-muted-foreground/60 hover:text-muted-foreground"
        >
          show sides ↓
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageState = {
  audit: WeeklyAudit | null;
  explain: ExplainPayload | null;
  loading: boolean;
  notFound: boolean;
  unauthorized: boolean;
  error: string | null;
};

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [state, setState] = useState<PageState>({
    audit: null,
    explain: null,
    loading: true,
    notFound: false,
    unauthorized: false,
    error: null,
  });
  const [isLocking, setIsLocking] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [audit, explain] = await Promise.all([
          fetchWeeklyAuditById(id),
          fetchWeeklyAuditExplain(id),
        ]);

        if (audit === null) {
          setState((s) => ({
            ...s,
            audit: null,
            explain: null,
            loading: false,
            notFound: true,
          }));
          return;
        }

        setState({
          audit,
          explain,
          loading: false,
          notFound: false,
          unauthorized: false,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load audit";
        setState((s) => ({ ...s, loading: false, error: message }));
      }
    },
    [id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // ── Early returns ──────────────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div className="h-full space-y-6 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border bg-card p-4">
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-7 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.notFound) {
    return (
      <div className="h-full p-4">
        <Link href="/audit" className="text-xs text-muted-foreground hover:underline">
          ← Audit overview
        </Link>
        <div className="mt-6 text-sm text-muted-foreground">Audit snapshot not found.</div>
      </div>
    );
  }

  if (state.unauthorized) {
    return (
      <div className="h-full p-4">
        <Link href="/audit" className="text-xs text-muted-foreground hover:underline">
          ← Audit overview
        </Link>
        <div className="mt-6 text-sm text-muted-foreground">Sign in to view audit.</div>
      </div>
    );
  }

  if (state.error || !state.audit) {
    return (
      <div className="h-full p-4">
        <Link href="/audit" className="text-xs text-muted-foreground hover:underline">
          ← Audit overview
        </Link>
        <div className="mt-6 text-sm text-destructive">
          {state.error ?? "Failed to load audit."}
        </div>
      </div>
    );
  }

  const { audit, explain } = state;
  const isLocked = audit.status === "locked";
  const lockedAt = formatDateTime(audit.lockedAt);
  const snapshotItems: SnapshotItem[] = Array.isArray(audit.top3Snapshot)
    ? (audit.top3Snapshot as SnapshotItem[])
    : [];

  const handleCopyHash = async () => {
    if (!audit.inputHash) return;
    try {
      await navigator.clipboard.writeText(audit.inputHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="h-full space-y-6 p-4">
      {/* Back link */}
      <Link href="/audit" className="text-xs text-muted-foreground hover:underline">
        ← Audit overview
      </Link>

      {/* Header */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              Week of {formatDate(audit.weekStart)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {isLocked ? (
                <>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Locked
                  </span>
                  {lockedAt && <span>locked {lockedAt}</span>}
                </>
              ) : (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  Draft
                </span>
              )}
            </div>
            {audit.inputHash && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">
                  hash: {audit.inputHash.slice(0, 16)}…
                </span>
                <button
                  onClick={() => void handleCopyHash()}
                  className="rounded px-1.5 py-0.5 text-xs hover:bg-muted"
                >
                  {copied ? "copied!" : "copy"}
                </button>
              </div>
            )}
          </div>
          {!isLocked && (
            <button
              disabled={isLocking}
              onClick={async () => {
                setIsLocking(true);
                try {
                  await lockWeeklyAudit(audit.id);
                  await load({ silent: true });
                } finally {
                  setIsLocking(false);
                }
              }}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground disabled:opacity-50"
            >
              {isLocking ? "Locking…" : "Lock week"}
            </button>
          )}
        </div>
      </section>

      {/* Core metrics */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Core Metrics</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricRow label="Active References" value={audit.activeReferenceCount} />
          <MetricRow label="Open Contradictions" value={audit.openContradictionCount} />
          <MetricRow label="Total Contradictions" value={audit.totalContradictionCount} />
          <MetricRow
            label="Top3 Avg Weight"
            value={audit.top3AvgComputedWeight.toFixed(2)}
          />
          <MetricRow
            label="Contradiction Density"
            value={audit.contradictionDensity.toFixed(3)}
          />
          <MetricRow
            label="Stability Proxy"
            value={audit.stabilityProxy.toFixed(3)}
          />
          <MetricRow label="Total Avoidance" value={audit.totalAvoidanceCount} />
          <MetricRow label="Total Snooze" value={audit.totalSnoozeCount} />
        </div>
      </section>

      {/* Top-3 Snapshot */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Top-3 Snapshot</h2>
        {snapshotItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No snapshot data.</p>
        ) : (
          <div className="space-y-2">
            {snapshotItems.map((item, idx) => (
              <Top3Card key={item.id} item={item} rank={idx + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Explain panel */}
      {explain && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Explain</h2>
          <div className="rounded-md border border-border bg-card p-4 text-sm">
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div className="text-muted-foreground">
                Density
                <span className="ml-2 font-medium text-foreground">
                  {explain.densityCategory}
                </span>
              </div>
              <div className="text-muted-foreground">
                Stability
                <span className="ml-2 font-medium text-foreground">
                  {explain.stabilityCategory}
                </span>
              </div>
              <div className="text-muted-foreground">
                Top weight concentration
                <span className="ml-2 font-medium text-foreground">
                  {explain.topWeightConcentration ? "yes" : "no"}
                </span>
              </div>
              <div className="text-muted-foreground">
                Integrity
                <span
                  className={`ml-2 font-medium ${explain.integrity === "immutable" ? "text-primary" : "text-amber-600"}`}
                >
                  {explain.integrity === "immutable"
                    ? "immutable — hash sealed"
                    : "mutable — not locked"}
                </span>
              </div>
            </div>
            {explain.drivers.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Drivers
                </div>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {explain.drivers.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
              </div>
            )}
            {explain.drivers.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                No significant drivers identified.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
