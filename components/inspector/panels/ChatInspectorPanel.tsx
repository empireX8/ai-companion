"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TopItem = {
  id: string;
  title: string;
  status: string;
  escalationLevel: number;
  recommendedRung: string | null;
};

type ContradictionSummary = {
  open: number;
  explored: number;
  snoozed: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600",
  explored: "bg-blue-500/10 text-blue-600",
  snoozed: "bg-muted text-muted-foreground",
};

function PanelSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-2 py-1.5 text-center">
      <div className="text-sm font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ChatInspectorPanel() {
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [summary, setSummary] = useState<ContradictionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    void (async () => {
      try {
        const [topRes, sumRes] = await Promise.all([
          fetch("/api/contradiction?top=3&mode=read_only", { cache: "no-store" }),
          fetch("/api/contradiction/summary", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (!topRes.ok || !sumRes.ok) {
          setError(true);
          return;
        }
        const [top, sum] = (await Promise.all([
          topRes.json(),
          sumRes.json(),
        ])) as [TopItem[], ContradictionSummary];
        if (!cancelled) {
          setTopItems(top);
          setSummary(sum);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <PanelSkeleton />;
  if (error) return <p className="p-3 text-xs text-destructive">Failed to load.</p>;

  return (
    <div className="divide-y divide-border/60">
      {/* Surfaced contradictions */}
      <div className="p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Surfaced Contradictions
        </p>
        {topItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active contradictions.</p>
        ) : (
          <ul className="space-y-2.5">
            {topItems.map((item) => (
              <li key={item.id}>
                <p className="truncate text-xs font-medium text-foreground">
                  {item.title}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {item.status}
                  </span>
                  {item.recommendedRung && item.recommendedRung !== "none" && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      rung: {item.recommendedRung}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pressure overview */}
      {summary && (
        <div className="p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Pressure Overview
          </p>
          <div className="grid grid-cols-3 gap-1">
            <CountCell label="open" value={summary.open} />
            <CountCell label="explored" value={summary.explored} />
            <CountCell label="snoozed" value={summary.snoozed} />
          </div>
        </div>
      )}
    </div>
  );
}
