"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TrendingUp, Archive, Trash2, CheckCircle2, ChevronDown } from "lucide-react";

import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { ProjectionListPanel } from "../_components/ProjectionListPanel";

type ResolutionVerdict = "correct" | "incorrect" | "mixed";

type Projection = {
  id: string;
  premise: string;
  drivers: string[];
  outcomes: string[];
  confidence: number;
  status: "active" | "archived" | "resolved";
  resolutionVerdict: ResolutionVerdict | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  createdAt: string;
};

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const confidenceBadge = (c: number) => {
  if (c >= 0.7) return "bg-emerald-500/15 text-emerald-400";
  if (c >= 0.4) return "bg-amber-500/15 text-amber-400";
  return "bg-muted text-muted-foreground";
};

const VERDICT_LABELS: Record<ResolutionVerdict, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  mixed: "Mixed",
};

const verdictBadgeColor = (v: ResolutionVerdict) => {
  if (v === "correct") return "bg-emerald-500/15 text-emerald-400";
  if (v === "incorrect") return "bg-destructive/15 text-destructive";
  return "bg-amber-500/15 text-amber-400";
};

export default function ProjectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [projection, setProjection] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveVerdict, setResolveVerdict] = useState<ResolutionVerdict>("correct");
  const [resolveNote, setResolveNote] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/projection/${params.id}`);
        if (r.status === 404) { setError("Forecast not found"); return; }
        if (!r.ok) throw new Error("Failed to load forecast");
        setProjection((await r.json()) as Projection);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  const handleArchive = async () => {
    if (!projection || actionBusy) return;
    setActionBusy(true);
    try {
      const r = await fetch(`/api/projection/${projection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!r.ok) throw new Error("Failed to archive");
      setProjection((await r.json()) as Projection);
    } catch {
      // silent — user stays on page
    } finally {
      setActionBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!projection || actionBusy) return;
    setActionBusy(true);
    try {
      const r = await fetch(`/api/projection/${projection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", verdict: resolveVerdict, note: resolveNote }),
      });
      if (!r.ok) throw new Error("Failed to resolve");
      setProjection((await r.json()) as Projection);
      setResolveOpen(false);
    } catch {
      // silent — user stays on page
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!projection || actionBusy) return;
    if (!confirm("Delete this forecast permanently?")) return;
    setActionBusy(true);
    try {
      const r = await fetch(`/api/projection/${projection.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
      router.push("/projections");
    } catch {
      setActionBusy(false);
    }
  };

  return (
    <>
      <DomainListSlot>
        <ProjectionListPanel />
      </DomainListSlot>

      <div className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
          {/* Back */}
          <Link
            href="/projections"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            ← All forecasts
          </Link>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-2/3 rounded bg-muted" />
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-24 rounded bg-muted" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : projection ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Forecast</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{formatDate(projection.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${confidenceBadge(projection.confidence)}`}>
                    {Math.round(projection.confidence * 100)}% confidence
                  </span>
                  {projection.status === "active" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setResolveOpen((v) => !v)}
                        disabled={actionBusy}
                        title="Mark as resolved"
                        className="flex h-7 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolve
                        <ChevronDown className={`h-3 w-3 transition-transform ${resolveOpen ? "rotate-180" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={handleArchive}
                        disabled={actionBusy}
                        title="Archive forecast"
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={actionBusy}
                    title="Delete forecast"
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {/* Resolve form — only shown when active + resolveOpen */}
              {projection.status === "active" && resolveOpen && (
                <div className="rounded-md border border-border bg-card px-4 py-3 space-y-3">
                  <p className="text-xs font-medium text-foreground">Mark as resolved</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["correct", "incorrect", "mixed"] as ResolutionVerdict[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setResolveVerdict(v)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          resolveVerdict === v
                            ? verdictBadgeColor(v) + " ring-1 ring-current"
                            : "bg-muted text-muted-foreground hover:bg-accent/60"
                        }`}
                      >
                        {VERDICT_LABELS[v]}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Optional note (what happened?)"
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleResolve()}
                      disabled={actionBusy}
                      className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      Confirm resolution
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolveOpen(false)}
                      className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Verdict block — shown after resolution */}
              {projection.status === "resolved" && projection.resolutionVerdict && (
                <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                  <p className={`text-sm font-semibold ${verdictBadgeColor(projection.resolutionVerdict)}`}>
                    Resolved · {VERDICT_LABELS[projection.resolutionVerdict]}
                  </p>
                  {projection.resolutionNote && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{projection.resolutionNote}</p>
                  )}
                  {projection.resolvedAt && (
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      {formatDate(projection.resolvedAt)}
                    </p>
                  )}
                </div>
              )}

              {projection.status === "archived" && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  This forecast is archived and will not appear in the active list.
                </div>
              )}

              <section className="rounded-md border border-border bg-card px-4 py-3">
                <p className="text-xs font-medium text-foreground">Why this forecast matters</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is a saved expectation about the future. When it is relevant, it may shape planning-oriented conversations.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  If it no longer reflects your current expectations, archive it or delete it.
                </p>
              </section>

              {/* Premise */}
              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Premise</h2>
                <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground">
                  {projection.premise}
                </p>
              </section>

              {/* Drivers */}
              {projection.drivers.length > 0 && (
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Drivers</h2>
                  <ul className="space-y-1.5">
                    {projection.drivers.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Outcomes */}
              {projection.outcomes.length > 0 && (
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Predicted Outcomes</h2>
                  <ul className="space-y-1.5">
                    {projection.outcomes.map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
                        {o}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Source */}
              {projection.sourceSessionId && (
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source</h2>
                  <Link
                    href={`/chat?session=${projection.sourceSessionId}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View source conversation →
                  </Link>
                </section>
              )}

              {projection.status === "active" && (
                <section className="rounded-md border border-border bg-card px-4 py-3">
                  <p className="text-xs font-medium text-foreground">Actions</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Archive if this forecast no longer reflects your current expectations.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Delete permanently removes this forecast.
                  </p>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
