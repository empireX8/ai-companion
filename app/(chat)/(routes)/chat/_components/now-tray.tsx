"use client";

import { useState } from "react";
import Link from "next/link";

import { performContradictionAction } from "@/lib/nodes-api";

export type NowTrayItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  recommendedRung: string | null;
  sideA: string;
  sideB: string;
};

const SNOOZE_PRESETS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
] as const;

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0); // end of day
  return d.toISOString();
}

const shortId = (id: string) => id.slice(-6);

export function NowTray({
  items,
  onActionComplete,
  onNavigate,
}: {
  items: NowTrayItem[];
  onActionComplete?: () => void | Promise<void>;
  onNavigate?: () => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Tracks which card + action type is in-flight
  const [actionState, setActionState] = useState<{
    id: string;
    type: "snooze" | "resolve";
  } | null>(null);
  // True while onActionComplete() is awaited after a successful action
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [snoozeTargetId, setSnoozeTargetId] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState("");

  // Any in-flight work disables all interactive controls
  const anyBusy = actionState !== null || refreshing;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const runAction = async (
    id: string,
    type: "snooze" | "resolve",
    snoozedUntil?: string
  ) => {
    setActionError(null);
    setActionState({ id, type });
    try {
      await performContradictionAction(id, type === "snooze" ? "snooze" : "resolve", snoozedUntil);
      // Action succeeded — trigger parent refresh
      if (onActionComplete) {
        setRefreshing(true);
        try {
          await onActionComplete();
        } finally {
          setRefreshing(false);
        }
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionState(null);
    }
  };

  const handleSnooze = (id: string, until: string) => {
    setSnoozeTargetId(null);
    setCustomDate("");
    void runAction(id, "snooze", until);
  };

  const closeSnoozeModal = () => {
    setSnoozeTargetId(null);
    setCustomDate("");
  };

  if (items.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">No active contradictions.</p>
    );
  }

  return (
    <div className="mt-2">
      {actionError && (
        <p className="mb-2 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {actionError}
        </p>
      )}

      {refreshing && (
        <p className="mb-2 text-xs text-muted-foreground">Updating…</p>
      )}

      {/* Snooze modal */}
      {snoozeTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeSnoozeModal}
        >
          <div
            className="w-72 rounded-lg border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-medium">Snooze until…</h3>
            <div className="grid grid-cols-3 gap-2">
              {SNOOZE_PRESETS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleSnooze(snoozeTargetId, addDays(opt.days))}
                  className="rounded border border-border px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-muted-foreground">
                Custom date
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
              {customDate && (
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(customDate);
                    d.setHours(23, 59, 59, 0);
                    handleSnooze(snoozeTargetId, d.toISOString());
                  }}
                  className="mt-2 w-full rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                >
                  Snooze to {customDate}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={closeSnoozeModal}
              className="mt-3 w-full rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item, index) => {
          const cardBusy = actionState?.id === item.id;
          const expanded = expandedIds.has(item.id);
          const snoozeLabel = cardBusy && actionState?.type === "snooze" ? "Snoozing…" : "Snooze";
          const resolveLabel = cardBusy && actionState?.type === "resolve" ? "Resolving…" : "Resolve";

          return (
            <li
              key={item.id}
              className={`rounded border border-border p-2 transition-opacity ${
                cardBusy || refreshing ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs text-text-dim">
                  {index + 1}. [{item.type}]
                </p>
                <button
                  type="button"
                  disabled={anyBusy}
                  onClick={() => toggleExpand(item.id)}
                  className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground disabled:pointer-events-none"
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  {expanded ? "▲" : "▼"}
                </button>
              </div>

              <Link
                href={`/contradictions/${item.id}`}
                onClick={onNavigate}
                className="mt-0.5 block text-sm font-medium text-foreground hover:underline"
              >
                {item.title}
              </Link>

              {/* Disambiguator */}
              <p className="mt-0.5 text-[10px] text-text-dim">
                id…{shortId(item.id)} · {item.status}
                {item.recommendedRung ? ` · rung ${item.recommendedRung}` : ""}
              </p>

              {expanded && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">A:</span>{" "}
                    {item.sideA}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">B:</span>{" "}
                    {item.sideB}
                  </p>
                </div>
              )}

              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={anyBusy}
                  onClick={() => setSnoozeTargetId(item.id)}
                  className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  {snoozeLabel}
                </button>
                <button
                  type="button"
                  disabled={anyBusy}
                  onClick={() => void runAction(item.id, "resolve")}
                  className="rounded border border-primary/50 px-2 py-1 text-xs text-primary hover:bg-muted disabled:opacity-40"
                >
                  {resolveLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
