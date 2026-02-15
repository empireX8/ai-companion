"use client";

import { useEffect, useMemo, useState } from "react";

import {
  fetchWeeklyAudit,
  fetchWeeklyTrend,
  type Top3SnapshotItem,
  type WeeklyAudit,
  type WeeklyAuditPreview,
  type WeeklyTrendResponse,
} from "@/lib/audit-api";

type AuditState = {
  audit: WeeklyAudit | WeeklyAuditPreview | null;
  trend: WeeklyTrendResponse | null;
  unauthorized: boolean;
  loading: boolean;
  error: string | null;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "n/a";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }

  return parsed.toISOString().slice(0, 10);
};

const metricCardClass =
  "rounded-md border border-border bg-card p-4 text-sm text-muted-foreground";

export default function AuditPage() {
  const [state, setState] = useState<AuditState>({
    audit: null,
    trend: null,
    unauthorized: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [audit, trend] = await Promise.all([fetchWeeklyAudit(), fetchWeeklyTrend(8)]);

        if (!mounted) {
          return;
        }

        if (!audit || !trend) {
          setState({
            audit: null,
            trend: null,
            unauthorized: true,
            loading: false,
            error: null,
          });
          return;
        }

        setState({
          audit,
          trend,
          unauthorized: false,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load audit";
        setState({
          audit: null,
          trend: null,
          unauthorized: false,
          loading: false,
          error: message,
        });
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const snapshotRows = useMemo(() => {
    if (!state.audit) {
      return [];
    }

    const snapshot = state.audit.top3Snapshot;
    if (!Array.isArray(snapshot)) {
      return [];
    }

    return snapshot as Top3SnapshotItem[];
  }, [state.audit]);

  if (state.loading) {
    return <div className="h-full p-4 text-sm text-muted-foreground">Loading audit...</div>;
  }

  if (state.unauthorized) {
    return <div className="h-full p-4 text-sm text-muted-foreground">Sign in to view audit.</div>;
  }

  if (state.error || !state.audit || !state.trend) {
    return (
      <div className="h-full p-4 text-sm text-destructive">
        {state.error ?? "Failed to load audit."}
      </div>
    );
  }

  const isPreview = "preview" in state.audit && state.audit.preview;
  const deltasByWeek = new Map(state.trend.deltas.map((delta) => [delta.weekStart, delta]));

  return (
    <div className="h-full p-4 space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">This Week</h2>
          <span className="text-xs text-muted-foreground">
            weekStart {formatDate(state.audit.weekStart)} {isPreview ? "(preview)" : ""}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className={metricCardClass}>
            <div>Active References</div>
            <div className="mt-1 text-xl text-foreground">{state.audit.activeReferenceCount}</div>
          </div>
          <div className={metricCardClass}>
            <div>Open Contradictions</div>
            <div className="mt-1 text-xl text-foreground">
              {state.audit.openContradictionCount}
            </div>
          </div>
          <div className={metricCardClass}>
            <div>Total Contradictions</div>
            <div className="mt-1 text-xl text-foreground">
              {state.audit.totalContradictionCount}
            </div>
          </div>
          <div className={metricCardClass}>
            <div>Top3 Avg Weight</div>
            <div className="mt-1 text-xl text-foreground">
              {state.audit.top3AvgComputedWeight.toFixed(2)}
            </div>
          </div>
          <div className={metricCardClass}>
            <div>Contradiction Density</div>
            <div className="mt-1 text-xl text-foreground">
              {state.audit.contradictionDensity.toFixed(3)}
            </div>
          </div>
          <div className={metricCardClass}>
            <div>Stability Proxy</div>
            <div className="mt-1 text-xl text-foreground">
              {state.audit.stabilityProxy.toFixed(3)}
            </div>
          </div>
          <div className={metricCardClass}>
            <div>Total Avoidance</div>
            <div className="mt-1 text-xl text-foreground">{state.audit.totalAvoidanceCount}</div>
          </div>
          <div className={metricCardClass}>
            <div>Total Snooze</div>
            <div className="mt-1 text-xl text-foreground">{state.audit.totalSnoozeCount}</div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Top 3 Snapshot</h2>
        {snapshotRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No snapshot data.</div>
        ) : (
          <div className="space-y-2">
            {snapshotRows.map((row) => (
              <div key={row.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="font-medium text-foreground">
                  [{row.type}] {row.title}
                </div>
                <div className="text-muted-foreground">status: {row.status}</div>
                <div className="text-muted-foreground">
                  recommendedRung: {row.recommendedRung ?? "n/a"}
                </div>
                <div className="text-muted-foreground">
                  lastEvidenceAt: {formatDate(row.lastEvidenceAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Trend (Last 8 Weeks)</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Week</th>
                <th className="p-2 text-left">Open Contradictions</th>
                <th className="p-2 text-left">Δ Open</th>
                <th className="p-2 text-left">Density</th>
                <th className="p-2 text-left">Δ Density</th>
                <th className="p-2 text-left">Stability</th>
                <th className="p-2 text-left">Δ Stability</th>
                <th className="p-2 text-left">Avoid/Snooze</th>
              </tr>
            </thead>
            <tbody>
              {state.trend.items.map((item) => {
                const key = new Date(item.weekStart).toISOString();
                const delta = deltasByWeek.get(key);

                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="p-2">{formatDate(item.weekStart)}</td>
                    <td className="p-2">{item.openContradictionCount}</td>
                    <td className="p-2">{delta ? delta.deltaOpenContradictionCount : "n/a"}</td>
                    <td className="p-2">{item.contradictionDensity.toFixed(3)}</td>
                    <td className="p-2">
                      {delta ? delta.deltaContradictionDensity.toFixed(3) : "n/a"}
                    </td>
                    <td className="p-2">{item.stabilityProxy.toFixed(3)}</td>
                    <td className="p-2">
                      {delta ? delta.deltaStabilityProxy.toFixed(3) : "n/a"}
                    </td>
                    <td className="p-2">
                      {item.totalAvoidanceCount}/{item.totalSnoozeCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
