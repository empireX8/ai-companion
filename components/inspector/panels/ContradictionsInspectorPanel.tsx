"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContradictionSummary = {
  open: number;
  explored: number;
  snoozed: number;
  resolved: number;
  accepted_tradeoff: number;
  archived_tension: number;
  total: number;
};

type ContradictionDetailLite = {
  title: string;
  type: string;
  status: string;
  escalationLevel: number;
  recommendedRung: string | null;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  snoozedUntil: string | null;
  sideA: string;
  sideB: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "n/a";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
};

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600",
  explored: "bg-blue-500/10 text-blue-600",
  snoozed: "bg-muted text-muted-foreground",
  resolved: "bg-emerald-500/10 text-emerald-600",
  accepted_tradeoff: "bg-emerald-500/10 text-emerald-600",
  archived_tension: "bg-muted text-muted-foreground",
};

function PanelSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-foreground">{value}</dd>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-xs font-medium ${
          muted
            ? "text-muted-foreground/50"
            : highlight && value > 0
              ? "text-amber-600"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ContradictionsInspectorPanel() {
  const pathname = usePathname();
  const activeId = pathname.match(/^\/contradictions\/([^/]+)$/)?.[1] ?? null;

  const [summary, setSummary] = useState<ContradictionSummary | null>(null);
  const [detail, setDetail] = useState<ContradictionDetailLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setSummary(null);
    setDetail(null);

    void (async () => {
      try {
        const fetches: Promise<Response>[] = [
          fetch("/api/contradiction/summary", { cache: "no-store" }),
        ];
        if (activeId) {
          fetches.push(fetch(`/api/contradiction/${activeId}`, { cache: "no-store" }));
        }

        const results = await Promise.all(fetches);
        if (cancelled) return;

        if (!results[0].ok) {
          setError(true);
          return;
        }

        const sumData = (await results[0].json()) as ContradictionSummary;
        if (!cancelled) setSummary(sumData);

        if (activeId && results[1] && results[1].ok) {
          const detailData = (await results[1].json()) as ContradictionDetailLite;
          if (!cancelled) setDetail(detailData);
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
  }, [activeId]);

  if (loading) return <PanelSkeleton />;
  if (error) return <p className="p-3 text-xs text-destructive">Failed to load.</p>;

  return (
    <div className="divide-y divide-border/60">
      {/* Detail section — only when on /contradictions/[id] */}
      {detail && (
        <div className="space-y-2 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Current
          </p>
          <p className="truncate text-xs font-medium text-foreground">{detail.title}</p>
          <div className="flex flex-wrap gap-1">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[detail.status] ?? "bg-muted text-muted-foreground"}`}
            >
              {detail.status.replace(/_/g, " ")}
            </span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {detail.type}
            </span>
          </div>
          <dl className="space-y-1 text-xs">
            <DetailRow label="Rung" value={detail.recommendedRung ?? "none"} />
            <DetailRow
              label="Evidence"
              value={`${detail.evidenceCount} · last ${fmtDate(detail.lastEvidenceAt)}`}
            />
            {detail.snoozedUntil && (
              <DetailRow label="Snoozed" value={fmtDate(detail.snoozedUntil)} />
            )}
          </dl>
          <div className="space-y-1 pt-1">
            <p className="text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground/70">A</span>{" "}
              {trunc(detail.sideA, 55)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground/70">B</span>{" "}
              {trunc(detail.sideB, 55)}
            </p>
          </div>
        </div>
      )}

      {/* Summary section */}
      {summary && (
        <div className="p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {detail ? "Overview" : "Status Breakdown"}
          </p>
          <div className="space-y-1.5">
            <SummaryRow label="Open" value={summary.open} highlight />
            <SummaryRow label="Explored" value={summary.explored} />
            <SummaryRow label="Snoozed" value={summary.snoozed} />
            <SummaryRow
              label="Terminal"
              value={
                summary.resolved + summary.accepted_tradeoff + summary.archived_tension
              }
              muted
            />
          </div>
        </div>
      )}
    </div>
  );
}
