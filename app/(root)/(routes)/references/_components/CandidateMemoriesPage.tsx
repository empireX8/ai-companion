"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Trash2 } from "lucide-react";

import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { dispatchCandidatesUpdated } from "@/components/command/candidateEvents";
import { fetchReferences, performReferenceActionApi } from "@/lib/nodes-api";
import type { ReferenceListItem } from "@/lib/nodes-api";
import { ReferenceListPanel } from "./ReferenceListPanel";

const TYPE_LABELS: Record<string, string> = {
  goal: "Goal",
  constraint: "Constraint",
  preference: "Preference",
  pattern: "Pattern",
  assumption: "Assumption",
  hypothesis: "Hypothesis",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const provenanceLabel = (
  sourceSessionId: string | null | undefined,
  sessionOrigin: string | null | undefined,
  dateStr: string
): string => {
  const formatted = formatDate(dateStr);
  if (!sourceSessionId) return `Detected on ${formatted}`;
  if (sessionOrigin === "IMPORTED_ARCHIVE") return `Detected during import on ${formatted}`;
  return `Detected during chat on ${formatted}`;
};

export function CandidateMemoriesPage() {
  const [items, setItems] = useState<ReferenceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchReferences();
      setItems((all ?? []).filter((item) => item.status === "candidate"));
    } catch {
      setError("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirmAll = async () => {
    const toProcess = [...items];
    if (toProcess.length === 0) return;
    setError(null);
    setIsBatchRunning(true);
    const failed: string[] = [];
    for (const item of toProcess) {
      try {
        await performReferenceActionApi(item.id, "confirm_governance");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } catch {
        failed.push(item.id);
      }
    }
    dispatchCandidatesUpdated();
    if (failed.length > 0) {
      setError(`${failed.length} item(s) could not be confirmed — please retry.`);
    }
    setIsBatchRunning(false);
  };

  const handleDismissAll = async () => {
    const toProcess = [...items];
    if (toProcess.length === 0) return;
    if (!window.confirm(`Dismiss all ${toProcess.length} visible candidate memories? This cannot be undone.`)) return;
    setError(null);
    setIsBatchRunning(true);
    const failed: string[] = [];
    for (const item of toProcess) {
      try {
        await performReferenceActionApi(item.id, "dismiss_governance");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } catch {
        failed.push(item.id);
      }
    }
    dispatchCandidatesUpdated();
    if (failed.length > 0) {
      setError(`${failed.length} item(s) could not be dismissed — please retry.`);
    }
    setIsBatchRunning(false);
  };

  const handleConfirm = async (id: string) => {
    setError(null);
    setBusy((prev) => ({ ...prev, [id]: true }));
    try {
      await performReferenceActionApi(id, "confirm_governance");
      setItems((prev) => prev.filter((item) => item.id !== id));
      dispatchCandidatesUpdated();
    } catch {
      setError("Failed to confirm — please try again");
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDismiss = async (id: string) => {
    setError(null);
    setBusy((prev) => ({ ...prev, [id]: true }));
    try {
      await performReferenceActionApi(id, "dismiss_governance");
      setItems((prev) => prev.filter((item) => item.id !== id));
      dispatchCandidatesUpdated();
    } catch {
      setError("Failed to dismiss — please try again");
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <>
      <DomainListSlot>
        <ReferenceListPanel />
      </DomainListSlot>

      <div className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
          <Link
            href="/references"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            ← All memories
          </Link>

          <div className="mb-6 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Candidate Memories
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                These are suggestions — they do not affect future chats until you confirm them. Dismissing a candidate removes it from consideration permanently.
              </p>
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">No candidate memories.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Memories proposed during chat or import will appear here for review.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  These actions apply only to the candidates currently shown on this page.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleConfirmAll()}
                    disabled={isBatchRunning}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirm all visible
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDismissAll()}
                    disabled={isBatchRunning}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Dismiss all visible
                  </button>
                </div>
              </div>

              <ul className="space-y-3">
                {items.map((item) => {
                  const isBusy = busy[item.id] ?? false;
                  return (
                    <li
                      key={item.id}
                      className={`rounded-lg border border-border bg-card px-4 py-4 ${isBusy ? "opacity-60" : ""}`}
                    >
                      <p className="text-sm font-semibold leading-snug text-foreground">
                        {item.statement}
                      </p>

                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {provenanceLabel(item.sourceSessionId, item.sessionOrigin, item.createdAt)}
                      </p>

                      {item.supersedesId && (
                        <p className="mt-1.5 text-[11px] text-amber-500/80">
                          Would replace:{" "}
                          <span className="italic">
                            {item.supersedesStatement ?? "an existing memory"}
                          </span>
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {TYPE_LABELS[item.type] ?? item.type}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {CONFIDENCE_LABELS[item.confidence] ?? item.confidence} confidence
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleConfirm(item.id)}
                          disabled={isBusy || isBatchRunning}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDismiss(item.id)}
                          disabled={isBusy || isBatchRunning}
                          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
