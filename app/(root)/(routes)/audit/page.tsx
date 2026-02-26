"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchWeeklyAudit,
  fetchWeeklyTrend,
  type Top3SnapshotItem,
  type WeeklyAudit,
  type WeeklyAuditDelta,
  type WeeklyAuditPreview,
  type WeeklyTrendResponse,
} from "@/lib/audit-api";

// ── Sparkline ─────────────────────────────────────────────────────────────────

function sparkPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y =
        range === 0
          ? height / 2
          : height - 1 - ((v - min) / range) * (height - 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function Sparkline({
  values,
  width = 72,
  height = 22,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const path = sparkPath(values, width, height);
  if (!path) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 text-muted-foreground/50"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Delta ─────────────────────────────────────────────────────────────────────

type DeltaDir = "up" | "down" | "flat" | "na";
type DeltaResult = { delta: number | null; dir: DeltaDir };

function fromAuditDelta(d?: number | null): DeltaResult {
  if (d === null || d === undefined) return { delta: null, dir: "na" };
  if (d > 0) return { delta: d, dir: "up" };
  if (d < 0) return { delta: d, dir: "down" };
  return { delta: 0, dir: "flat" };
}

function fmtDelta(d: number): string {
  const sign = d >= 0 ? "+" : "";
  return Number.isInteger(d) ? `${sign}${d}` : `${sign}${d.toFixed(3)}`;
}

function DeltaBadge({ result }: { result: DeltaResult }) {
  if (result.dir === "na" || result.delta === null) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }
  if (result.dir === "flat") {
    return <span className="text-xs text-muted-foreground">0</span>;
  }
  const arrow = result.dir === "up" ? "↑" : "↓";
  return (
    <span className="text-xs text-muted-foreground">
      {arrow} {fmtDelta(result.delta)}
    </span>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  delta,
  sparkValues,
}: {
  label: string;
  value: string | number;
  delta?: DeltaResult;
  sparkValues?: number[];
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div>{label}</div>
          <div className="mt-1 text-xl text-foreground">{value}</div>
          {delta && (
            <div className="mt-0.5">
              <DeltaBadge result={delta} />
            </div>
          )}
        </div>
        {sparkValues && sparkValues.length >= 2 && (
          <Sparkline values={sparkValues} width={72} height={22} />
        )}
      </div>
    </div>
  );
}

// ── Epistemic state classification (Ticket 20) ────────────────────────────────

type EpistemicTier = "high" | "moderate" | "insufficient";

type EpistemicState = {
  tier: EpistemicTier;
  state: string;
  drivers: string[];
};

function classifyEpistemicState(audit: WeeklyAudit | WeeklyAuditPreview): EpistemicState {
  const {
    stabilityProxy,
    contradictionDensity,
    openContradictionCount,
    totalAvoidanceCount,
    totalSnoozeCount,
  } = audit;

  if (stabilityProxy < 0.5) {
    return { tier: "insufficient", state: "", drivers: [] };
  }

  const drivers: string[] = [
    `Contradiction density ${contradictionDensity.toFixed(3)}`,
  ];
  if (openContradictionCount > 0) {
    drivers.push(
      `${openContradictionCount} open contradiction${openContradictionCount !== 1 ? "s" : ""}`
    );
  }
  if (totalAvoidanceCount > 0) {
    drivers.push(
      `${totalAvoidanceCount} avoidance event${totalAvoidanceCount !== 1 ? "s" : ""}`
    );
  }
  if (totalSnoozeCount > 0) {
    drivers.push(
      `${totalSnoozeCount} snooze event${totalSnoozeCount !== 1 ? "s" : ""}`
    );
  }

  if (stabilityProxy >= 0.75) {
    return { tier: "high", state: "Stable", drivers };
  }
  return { tier: "moderate", state: "Stressed", drivers };
}

// ── Page ──────────────────────────────────────────────────────────────────────

type AuditState = {
  audit: WeeklyAudit | WeeklyAuditPreview | null;
  trend: WeeklyTrendResponse | null;
  unauthorized: boolean;
  loading: boolean;
  error: string | null;
};

const formatDate = (value: string | null) => {
  if (!value) return "n/a";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toISOString().slice(0, 10);
};

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
        const [audit, trend] = await Promise.all([
          fetchWeeklyAudit(),
          fetchWeeklyTrend(8),
        ]);

        if (!mounted) return;

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

        setState({ audit, trend, unauthorized: false, loading: false, error: null });
      } catch (error) {
        if (!mounted) return;
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
    if (!state.audit) return [];
    const snapshot = state.audit.top3Snapshot;
    if (!Array.isArray(snapshot)) return [];
    return snapshot as Top3SnapshotItem[];
  }, [state.audit]);

  // Sort trend items oldest → newest for sparkline series
  const sortedTrendItems = useMemo(
    () =>
      state.trend
        ? [...state.trend.items].sort(
            (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
          )
        : [],
    [state.trend]
  );

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

  // Delta lookup: keyed by weekStart raw string (fallback to ISO-converted key)
  const deltasByWeek = new Map<string, WeeklyAuditDelta>(
    state.trend.deltas.map((d) => [d.weekStart, d])
  );
  const currentWeekKey = new Date(state.audit.weekStart).toISOString();
  const currentDelta: WeeklyAuditDelta | undefined =
    deltasByWeek.get(currentWeekKey) ?? deltasByWeek.get(state.audit.weekStart);

  const epistemic = classifyEpistemicState(state.audit);

  // Sparkline series (oldest → newest)
  const sparkOpen = sortedTrendItems.map((i) => i.openContradictionCount);
  const sparkDensity = sortedTrendItems.map((i) => i.contradictionDensity);
  const sparkStability = sortedTrendItems.map((i) => i.stabilityProxy);
  const sparkAvoidance = sortedTrendItems.map((i) => i.totalAvoidanceCount);

  return (
    <div className="h-full space-y-6 p-4">
      {/* Epistemic State (T20 + T23 augmentation) */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Epistemic State</h2>
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          {epistemic.tier === "insufficient" ? (
            <p className="text-muted-foreground">
              Insufficient signal for structural state classification.
            </p>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-medium text-foreground">{epistemic.state}</span>
                  <span className="text-xs text-muted-foreground">
                    {epistemic.tier === "high" ? "High confidence" : "Moderate"}
                  </span>
                  {currentDelta && (
                    <DeltaBadge result={fromAuditDelta(currentDelta.deltaStabilityProxy)} />
                  )}
                </div>
                {epistemic.drivers.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {epistemic.drivers.map((d) => (
                      <li key={d}>· {d}</li>
                    ))}
                  </ul>
                )}
              </div>
              {sparkStability.length >= 2 && (
                <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground/60">
                  <Sparkline values={sparkStability} width={80} height={28} />
                  <span>stability</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* This Week */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">This Week</h2>
          <span className="text-xs text-muted-foreground">
            weekStart {formatDate(state.audit.weekStart)} {isPreview ? "(preview)" : ""}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            label="Active References"
            value={state.audit.activeReferenceCount}
            delta={fromAuditDelta(currentDelta?.deltaActiveReferenceCount)}
          />
          <MetricCard
            label="Open Contradictions"
            value={state.audit.openContradictionCount}
            delta={fromAuditDelta(currentDelta?.deltaOpenContradictionCount)}
            sparkValues={sparkOpen}
          />
          <MetricCard
            label="Total Contradictions"
            value={state.audit.totalContradictionCount}
            delta={fromAuditDelta(currentDelta?.deltaTotalContradictionCount)}
          />
          <MetricCard
            label="Top3 Avg Weight"
            value={state.audit.top3AvgComputedWeight.toFixed(2)}
            delta={fromAuditDelta(currentDelta?.deltaTop3AvgComputedWeight)}
          />
          <MetricCard
            label="Contradiction Density"
            value={state.audit.contradictionDensity.toFixed(3)}
            delta={fromAuditDelta(currentDelta?.deltaContradictionDensity)}
            sparkValues={sparkDensity}
          />
          <MetricCard
            label="Stability Proxy"
            value={state.audit.stabilityProxy.toFixed(3)}
            delta={fromAuditDelta(currentDelta?.deltaStabilityProxy)}
            sparkValues={sparkStability}
          />
          <MetricCard
            label="Total Avoidance"
            value={state.audit.totalAvoidanceCount}
            delta={fromAuditDelta(currentDelta?.deltaTotalAvoidanceCount)}
            sparkValues={sparkAvoidance}
          />
          <MetricCard
            label="Total Snooze"
            value={state.audit.totalSnoozeCount}
            delta={fromAuditDelta(currentDelta?.deltaTotalSnoozeCount)}
          />
        </div>
      </section>

      {/* Top 3 Snapshot */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Top 3 Snapshot</h2>
        {snapshotRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No snapshot data.</div>
        ) : (
          <div className="space-y-2">
            {snapshotRows.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-md border border-border bg-card p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-foreground">
                    <span className="mr-1 text-xs text-muted-foreground">#{idx + 1}</span>
                    <Link
                      href={`/contradictions/${row.id}`}
                      className="hover:underline"
                    >
                      [{row.type}] {row.title}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    weight {row.computedWeight.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>status: {row.status}</span>
                  <span>rung: {row.recommendedRung ?? "n/a"}</span>
                  <span>lastEvidence: {formatDate(row.lastEvidenceAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trend table */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Trend (Last 8 Weeks)</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Week</th>
                <th className="p-2 text-left">Open</th>
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
                    <td className="p-2">
                      <DeltaBadge result={fromAuditDelta(delta?.deltaOpenContradictionCount)} />
                    </td>
                    <td className="p-2">{item.contradictionDensity.toFixed(3)}</td>
                    <td className="p-2">
                      <DeltaBadge result={fromAuditDelta(delta?.deltaContradictionDensity)} />
                    </td>
                    <td className="p-2">{item.stabilityProxy.toFixed(3)}</td>
                    <td className="p-2">
                      <DeltaBadge result={fromAuditDelta(delta?.deltaStabilityProxy)} />
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
