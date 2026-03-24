"use client";

/**
 * Patterns Page — unified destination with five-section dashboard (P2-02)
 *
 * One top-level destination. Five locked family sections.
 * Scope + qualitative uncertainty header (P2-06).
 * Low-data banner shown below 20 messages (P2-09).
 * Resolved/archived secondary surface at bottom (P2-10).
 * No ProfileArtifact data. No numeric scores.
 */

import { useEffect, useState } from "react";
import { Brain, AlertCircle, RefreshCw } from "lucide-react";
import { fetchPatterns, type PatternsResponse } from "@/lib/patterns-api";
import {
  LOW_DATA_BANNER,
  NO_CLAIMS_YET_HEADING,
  NO_CLAIMS_YET_BODY,
  RERUN_LABEL,
  RERUN_RUNNING_LABEL,
  SCOPE_EMPTY,
  scopeLabel,
} from "@/lib/trust-copy";
import { PatternSection } from "./_components/PatternSection";
import { ResolvedClaimsSection } from "./_components/ResolvedClaimsSection";
import { ActiveStepsSection } from "./_components/ActiveStepsSection";

// P2-09 — threshold below which a low-data banner is shown
const LOW_DATA_MESSAGE_THRESHOLD = 20;

export default function PatternsPage() {
  const [data, setData] = useState<PatternsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchPatterns().then((result) => {
      setData(result);
      setLoading(false);
    });
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerRerun = async () => {
    setRerunning(true);
    try {
      await fetch("/api/patterns", { method: "POST" });
      reload();
    } finally {
      setRerunning(false);
    }
  };

  const isLowData =
    !loading &&
    data !== null &&
    data.scopeMessageCount > 0 &&
    data.scopeMessageCount < LOW_DATA_MESSAGE_THRESHOLD;

  // True when history exists but no candidate or active claims have been found yet
  const hasAnyClaims =
    data !== null &&
    data.sections.some((s) =>
      s.claims.some((c) => c.status === "candidate" || c.status === "active")
    );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-8">

        {/* Page header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h1 className="text-base font-semibold text-foreground">Patterns</h1>
            </div>
            <button
              type="button"
              onClick={() => void triggerRerun()}
              disabled={rerunning || loading}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${rerunning ? "animate-spin" : ""}`} />
              {rerunning ? RERUN_RUNNING_LABEL : RERUN_LABEL}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Recurring behavioural and cognitive patterns detected across your conversations.
          </p>

          {/* P2-06 — scope / sample-size — only shown when claims exist */}
          {!loading && data && (
            <p className="text-[11px] text-muted-foreground/70 pt-0.5">
              {data.scopeMessageCount === 0
                ? SCOPE_EMPTY
                : hasAnyClaims
                ? scopeLabel(data.scopeMessageCount, data.scopeSessionCount)
                : null}
            </p>
          )}
        </div>

        {/* P2-09 — low-data banner */}
        {isLowData && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/70" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">
                {LOW_DATA_BANNER.heading}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {LOW_DATA_BANNER.body}
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Error / no data */}
        {!loading && !data && (
          <div className="rounded-lg border border-dashed border-border/40 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load patterns. Please try again.
            </p>
          </div>
        )}

        {/* No-claims state — data exists but nothing confirmed yet */}
        {!loading && data && !hasAnyClaims && data.scopeMessageCount > 0 && (
          <div className="rounded-lg border border-dashed border-border/40 px-5 py-6 space-y-3">
            <p className="text-sm font-medium text-foreground">{NO_CLAIMS_YET_HEADING}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{NO_CLAIMS_YET_BODY}</p>
            <button
              type="button"
              onClick={() => void triggerRerun()}
              disabled={rerunning || loading}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${rerunning ? "animate-spin" : ""}`} />
              {rerunning ? RERUN_RUNNING_LABEL : RERUN_LABEL}
            </button>
          </div>
        )}

        {/* P2.5-08 — cross-claim active steps (inline, not a separate destination) */}
        {!loading && data && hasAnyClaims && <ActiveStepsSection sections={data.sections} />}

        {/* Five locked family sections — P2-02 — only when claims exist */}
        {!loading && data && hasAnyClaims && (
          <div className="space-y-8">
            {data.sections.map((section) => (
              <PatternSection key={section.familyKey} section={section} />
            ))}
          </div>
        )}

        {/* Secondary resolved/archived surface — P2-10 */}
        {!loading && data && (
          <ResolvedClaimsSection sections={data.sections} />
        )}

      </div>
    </div>
  );
}
