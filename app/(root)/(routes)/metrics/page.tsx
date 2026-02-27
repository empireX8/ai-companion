"use client";

import { Fragment, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type MetricRow = {
  id: string;
  createdAt: string;
  name: string;
  level: string;
  source: string;
  route: string | null;
  sessionId: string | null;
  meta: Record<string, unknown> | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_CLASSES: Record<string, string> = {
  debug: "text-muted-foreground/60",
  info: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
};

const LEVELS = ["", "debug", "info", "warn", "error"] as const;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MetricsPage() {
  const [events, setEvents] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the name query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(nameQuery), 300);
    return () => clearTimeout(timer);
  }, [nameQuery]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "200" });
        if (debouncedQuery) params.set("query", debouncedQuery);
        if (levelFilter) params.set("level", levelFilter);
        const res = await fetch(`/api/metrics?${params.toString()}`, { cache: "no-store" });
        if (!mounted) return;
        if (res.status === 401) {
          setError("Unauthorized");
          return;
        }
        if (!res.ok) {
          setError("Failed to load metrics");
          return;
        }
        setEvents((await res.json()) as MetricRow[]);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [debouncedQuery, levelFilter]);

  return (
    <div className="h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Metrics Inspector</h1>
        <span className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${events.length} events`}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="Filter by name…"
          className="h-8 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-56"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l === "" ? "All levels" : l}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      {/* Table */}
      {!loading && events.length === 0 && !error && (
        <div className="text-sm text-muted-foreground">No events found.</div>
      )}

      {events.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left whitespace-nowrap">Time</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Level</th>
                <th className="p-2 text-left">Source</th>
                <th className="p-2 text-left">Route</th>
                <th className="p-2 text-left">Session</th>
                <th className="p-2 text-left">Meta</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <Fragment key={ev.id}>
                  <tr
                    className="border-t border-border hover:bg-muted/20 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                  >
                    <td className="p-2 whitespace-nowrap text-muted-foreground">
                      {formatTime(ev.createdAt)}
                    </td>
                    <td className="p-2 font-mono text-foreground">{ev.name}</td>
                    <td className={`p-2 font-medium ${LEVEL_CLASSES[ev.level] ?? "text-foreground"}`}>
                      {ev.level}
                    </td>
                    <td className="p-2 text-muted-foreground">{ev.source}</td>
                    <td className="p-2 text-muted-foreground">{ev.route ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">
                      {ev.sessionId ? ev.sessionId.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {ev.meta ? (
                        <span className="text-primary hover:underline">
                          {expandedId === ev.id ? "▲ hide" : "▼ show"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  {expandedId === ev.id && ev.meta && (
                    <tr key={`${ev.id}-meta`} className="border-t border-border bg-muted/10">
                      <td colSpan={7} className="p-3">
                        <pre className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
                          {JSON.stringify(ev.meta, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
