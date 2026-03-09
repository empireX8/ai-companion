"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Trash2, TrendingUp } from "lucide-react";

import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { ContradictionListPanel } from "../_components/ContradictionListPanel";
import type { ContradictionListItem } from "@/lib/nodes-api";
import { dispatchCandidatesUpdated } from "@/components/command/candidateEvents";

type CandidatePage = {
  items: ContradictionListItem[];
  hasMore: boolean;
};

async function fetchCandidates(): Promise<ContradictionListItem[]> {
  const res = await fetch("/api/contradiction?status=candidate&page=1&limit=50", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load candidates");
  const data = (await res.json()) as CandidatePage;
  return data.items;
}

async function confirmCandidate(id: string): Promise<void> {
  const res = await fetch(`/api/contradiction/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "confirm_candidate" }),
  });
  if (!res.ok) throw new Error("Failed to confirm candidate");
}

async function dismissCandidate(id: string): Promise<void> {
  const res = await fetch(`/api/contradiction/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to dismiss candidate");
}

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

const CONTRADICTION_TYPE_LABELS: Record<string, string> = {
  value: "Value",
  belief: "Belief",
  commitment: "Commitment",
  identity: "Identity",
  behavior: "Behavior",
};

export default function CandidatesPage() {
  const [items, setItems] = useState<ContradictionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchCandidates());
    } catch {
      setError("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleConfirmAll = async () => {
    const toProcess = [...items];
    if (toProcess.length === 0) return;
    setError(null);
    setIsBatchRunning(true);
    const failed: string[] = [];
    for (const item of toProcess) {
      try {
        await confirmCandidate(item.id);
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
    if (!window.confirm(`Dismiss all ${toProcess.length} visible candidate tensions? This cannot be undone.`)) return;
    setError(null);
    setIsBatchRunning(true);
    const failed: string[] = [];
    for (const item of toProcess) {
      try {
        await dismissCandidate(item.id);
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
      await confirmCandidate(id);
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
      await dismissCandidate(id);
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
        <ContradictionListPanel />
      </DomainListSlot>

      <div className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
          {/* Back */}
          <Link
            href="/contradictions"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            ← All tensions
          </Link>

          {/* Header */}
          <div className="mb-6 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Candidate Tensions
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                These are suggestions — they do not affect future chats until you confirm them. Dismissing a candidate deletes it permanently.
              </p>
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">No candidate tensions.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                New tensions detected during chat will appear here for review.
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
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border bg-card px-4 py-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {CONTRADICTION_TYPE_LABELS[item.type] ?? item.type}
                        {" · "}{provenanceLabel(item.sourceSessionId, item.sessionOrigin, item.lastTouchedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <div className="rounded bg-muted/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Side A</p>
                      <p className="mt-0.5 text-xs text-foreground">{item.sideA}</p>
                    </div>
                    <div className="rounded bg-muted/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Side B</p>
                      <p className="mt-0.5 text-xs text-foreground">{item.sideB}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleConfirm(item.id)}
                      disabled={busy[item.id] || isBatchRunning}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm
                    </button>
                    <button
                      onClick={() => void handleDismiss(item.id)}
                      disabled={busy[item.id] || isBatchRunning}
                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
