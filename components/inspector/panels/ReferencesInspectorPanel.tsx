"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReferenceSummary = {
  active: number;
  candidate: number;
  inactive: number;
  superseded: number;
  total: number;
};

type ReferenceDetailLite = {
  current: {
    type: string;
    confidence: string;
    statement: string;
    status: string;
    updatedAt: string;
  };
  previousVersion: { id: string } | null;
  nextVersions: Array<{ id: string }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "n/a";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600",
  candidate: "bg-blue-500/10 text-blue-600",
  inactive: "bg-muted text-muted-foreground",
  superseded: "bg-muted text-muted-foreground",
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
              ? "text-emerald-600"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ReferencesInspectorPanel() {
  const pathname = usePathname();
  const activeId = pathname.match(/^\/references\/([^/]+)$/)?.[1] ?? null;

  const [summary, setSummary] = useState<ReferenceSummary | null>(null);
  const [detail, setDetail] = useState<ReferenceDetailLite | null>(null);
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
          fetch("/api/reference/summary", { cache: "no-store" }),
        ];
        if (activeId) {
          fetches.push(
            fetch(`/api/reference/${activeId}/detail`, { cache: "no-store" })
          );
        }

        const results = await Promise.all(fetches);
        if (cancelled) return;

        if (!results[0].ok) {
          setError(true);
          return;
        }

        const sumData = (await results[0].json()) as ReferenceSummary;
        if (!cancelled) setSummary(sumData);

        if (activeId && results[1] && results[1].ok) {
          const detailData = (await results[1].json()) as ReferenceDetailLite;
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

  const ref = detail?.current;

  return (
    <div className="divide-y divide-border/60">
      {/* Detail section — only when on /references/[id] */}
      {ref && (
        <div className="space-y-2 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Current
          </p>
          <p className="text-xs leading-relaxed text-foreground">
            {ref.statement.length > 120 ? ref.statement.slice(0, 120) + "…" : ref.statement}
          </p>
          <div className="flex flex-wrap gap-1">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[ref.status] ?? "bg-muted text-muted-foreground"}`}
            >
              {ref.status}
            </span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {ref.type}
            </span>
          </div>
          <dl className="space-y-1 text-xs">
            <DetailRow label="Confidence" value={ref.confidence} />
            <DetailRow label="Updated" value={fmtDate(ref.updatedAt)} />
            {detail.nextVersions.length > 0 && (
              <DetailRow
                label="Chain"
                value={`${detail.nextVersions.length} later version${detail.nextVersions.length !== 1 ? "s" : ""}`}
              />
            )}
          </dl>
        </div>
      )}

      {/* Summary section */}
      {summary && (
        <div className="p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {detail ? "Overview" : "Status Breakdown"}
          </p>
          <div className="space-y-1.5">
            <SummaryRow label="Active" value={summary.active} highlight />
            <SummaryRow label="Candidate" value={summary.candidate} />
            <SummaryRow label="Inactive" value={summary.inactive} muted />
            <SummaryRow label="Superseded" value={summary.superseded} muted />
          </div>
        </div>
      )}
    </div>
  );
}
