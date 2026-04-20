"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Lightbulb, TrendingUp, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  fetchActionsPageData,
  updateSurfacedAction,
  type ActionPrioritySnapshot,
  type ActionStatus,
  type ActionsPageData,
  type SurfacedActionView,
} from "@/lib/actions-api";

const STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: "Not started",
  done: "Done",
  helped: "Helped",
  didnt_help: "Didn't help",
};

const STATUS_ACTIVE_CLASS: Record<ActionStatus, string> = {
  not_started: "bg-muted/60 text-muted-foreground",
  done: "bg-primary/10 text-primary",
  helped: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  didnt_help: "bg-muted text-muted-foreground",
};

const EFFORT_CLASS = {
  Low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  High: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
} as const;

function truncateSummary(summary: string, max = 110): string {
  return summary.length > max ? `${summary.slice(0, max).trimEnd()}…` : summary;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "recently";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function CurrentPriorityBox({
  snapshot,
  loading,
}: {
  snapshot: ActionPrioritySnapshot | null;
  loading: boolean;
}) {
  const featured = snapshot?.featured ?? [];
  const totalActive = snapshot?.totalActive ?? 0;
  const totalCandidate = snapshot?.totalCandidate ?? 0;
  const hasData = snapshot?.hasData ?? false;
  const showingActive = totalActive > 0;

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Current priority</h2>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-3.5 w-56 animate-pulse rounded bg-primary/10" />
          <div className="h-3 w-full animate-pulse rounded bg-primary/8" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-primary/8" />
        </div>
      ) : !hasData || featured.length === 0 ? (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            No confirmed patterns are visible yet. This area will update once
            live pattern signals are available in{" "}
            <Link
              href="/patterns"
              className="text-primary underline-offset-2 hover:underline"
            >
              Patterns
            </Link>
            .
          </p>
          <div className="mt-3">
            <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              No active patterns
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {showingActive
              ? `${totalActive} active ${totalActive === 1 ? "pattern" : "patterns"} visible right now.`
              : `${totalCandidate} visible ${totalCandidate === 1 ? "candidate" : "candidates"} — none confirmed yet.`}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {featured.map((claim) => (
              <li
                key={claim.id}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                {truncateSummary(claim.summary)}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {totalActive > 0 && (
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {totalActive} active {totalActive === 1 ? "pattern" : "patterns"}
              </span>
            )}
            {totalCandidate > 0 && (
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {totalCandidate} {totalCandidate === 1 ? "candidate" : "candidates"}
              </span>
            )}
            <Link
              href="/patterns"
              className="ml-auto text-[11px] text-primary/70 underline-offset-2 hover:text-primary hover:underline"
            >
              View in Patterns →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function ActionCard({
  item,
  onPatched,
}: {
  item: SurfacedActionView;
  onPatched: (
    id: string,
    patch: Partial<Pick<SurfacedActionView, "status" | "note" | "updatedAt">>
  ) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(item.note));
  const [draftNote, setDraftNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftNote(item.note ?? "");
  }, [item.note]);

  const statuses: ActionStatus[] = ["not_started", "done", "helped", "didnt_help"];
  const normalizedSavedNote = (item.note ?? "").trim();
  const normalizedDraftNote = draftNote.trim();
  const noteDirty = normalizedSavedNote !== normalizedDraftNote;

  async function savePatch(patch: { status?: ActionStatus; note?: string | null }) {
    setSaving(true);
    setError(null);

    const updated = await updateSurfacedAction(item.id, patch);
    if (!updated) {
      setError("Couldn't save that change.");
      setSaving(false);
      return;
    }

    onPatched(item.id, updated);
    setSaving(false);
  }

  const isFallbackCard = !item.linkedClaimId && !item.linkedGoalId;
  const sourceLabel = item.linkedClaimId
    ? "From Patterns"
    : item.linkedGoalId
      ? "From goals"
      : null;
  const sourceContext = item.linkedFamilyLabel ?? (item.linkedGoalId ? "Goal signal" : null);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-foreground">
          {item.title}
        </p>
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-[11px] font-medium",
            EFFORT_CLASS[item.effort]
          )}
        >
          {item.effort}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {item.whySuggested}
      </p>

      {!isFallbackCard && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {sourceLabel && (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                {sourceLabel}
              </span>
            )}
            {sourceContext && (
              <span className="text-[11px] text-muted-foreground/70">
                {sourceContext}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/60">
              Surfaced {formatDate(item.surfacedAt)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-foreground/80">
            {item.linkedClaimSummary ?? item.linkedGoalStatement ?? item.linkedSourceLabel}
          </p>
        </div>
      )}

      {isFallbackCard && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/60">
          {item.linkedSourceLabel}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            disabled={saving}
            onClick={() => void savePatch({ status })}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors",
              item.status === status
                ? STATUS_ACTIVE_CLASS[status]
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              saving && "cursor-wait opacity-70"
            )}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground/60">
          {item.updatedAt === item.surfacedAt
            ? "No saved update yet"
            : `Updated ${formatDate(item.updatedAt)}`}
        </span>
        <button
          type="button"
          onClick={() => setNoteOpen((value) => !value)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {noteOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {noteOpen ? "Hide note" : item.note ? "Edit note" : "Add a note"}
        </button>
      </div>

      {noteOpen && (
        <div className="space-y-2">
          <textarea
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            placeholder="What happened? What did you notice?"
            rows={3}
            className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground/60">
              Notes save to this action and persist across refresh.
            </span>
            <button
              type="button"
              disabled={!noteDirty || saving}
              onClick={() => void savePatch({ note: draftNote })}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                noteDirty && !saving
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "bg-muted text-muted-foreground/60"
              )}
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

function ActionSection({
  icon: Icon,
  title,
  description,
  items,
  onPatched,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: React.ReactNode;
  items: SurfacedActionView[];
  onPatched: (
    id: string,
    patch: Partial<Pick<SurfacedActionView, "status" | "note" | "updatedAt">>
  ) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <ActionCard key={item.id} item={item} onPatched={onPatched} />
        ))}
      </div>
    </section>
  );
}

export default function ActionsPage() {
  const [data, setData] = useState<ActionsPageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActionsPageData().then((response) => {
      setData(response);
      setLoading(false);
    });
  }, []);

  function patchLocalAction(
    list: SurfacedActionView[],
    id: string,
    patch: Partial<Pick<SurfacedActionView, "status" | "note" | "updatedAt">>
  ) {
    return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
  }

  function handleActionPatched(
    id: string,
    patch: Partial<Pick<SurfacedActionView, "status" | "note" | "updatedAt">>
  ) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        stabilizeNow: patchLocalAction(current.stabilizeNow, id, patch),
        buildForward: patchLocalAction(current.buildForward, id, patch),
      };
    });
  }

  const stabilizeNow = data?.stabilizeNow ?? [];
  const buildForward = data?.buildForward ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-8 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Actions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Suggested next steps linked to your live patterns and longer-horizon goals. Mark what you try and note what happens.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <CurrentPriorityBox snapshot={data?.currentPriority ?? null} loading={loading} />

          <ActionSection
            icon={Zap}
            title="Stabilize now"
            description={
              <>
                Small steps tied to your most visible live{" "}
                <Link href="/patterns" className="text-primary/70 underline-offset-2 hover:text-primary hover:underline">
                  pattern signals
                </Link>
                .
              </>
            }
            items={stabilizeNow}
            onPatched={handleActionPatched}
          />

          <ActionSection
            icon={TrendingUp}
            title="Build forward"
            description="Goal-linked steps that support steady forward motion."
            items={buildForward}
            onPatched={handleActionPatched}
          />
        </div>
      </div>
    </div>
  );
}
