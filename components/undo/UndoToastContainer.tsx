"use client";

import { useCallback, useEffect, useState } from "react";

import { undoManager, type UndoAction } from "@/lib/undo-manager";
import { postMetricEvent } from "@/lib/metrics-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSecondsLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function formatActionLabel(name: string): string {
  // "contradiction.resolve" → "Contradiction resolved"
  const parts = name.split(".");
  const entity = parts[0] ?? "";
  const verb = parts[1] ?? "";
  const verbPast =
    verb === "resolve" ? "resolved"
    : verb === "snooze" ? "snoozed"
    : verb === "accept_tradeoff" ? "trade-off accepted"
    : verb;
  return `${entity.charAt(0).toUpperCase() + entity.slice(1)} ${verbPast}`;
}

// ── Toast item ────────────────────────────────────────────────────────────────

function UndoToastItem({
  action,
  onExpire,
}: {
  action: UndoAction;
  onExpire: (id: string) => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsLeft(action.expiresAt));
  const [isReverting, setIsReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const left = getSecondsLeft(action.expiresAt);
      setSecondsLeft(left);
      if (left <= 0) {
        onExpire(action.id);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [action.id, action.expiresAt, onExpire]);

  const handleUndo = async () => {
    setIsReverting(true);
    setRevertError(null);
    try {
      await action.revert();
      void postMetricEvent({
        name: "undo.executed",
        meta: { actionName: action.name, actionId: action.id },
      });
      undoManager.cancelUndo(action.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Undo failed";
      setRevertError(reason);
      void postMetricEvent({
        name: "undo.failed_invariant",
        level: "warn",
        meta: { actionName: action.name, actionId: action.id, reason },
      });
      setIsReverting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm shadow-md">
      <div className="min-w-0 flex-1">
        <span className="text-foreground">{formatActionLabel(action.name)}</span>
        {revertError && (
          <div className="mt-0.5 text-xs text-destructive">{revertError}</div>
        )}
      </div>
      <button
        onClick={() => void handleUndo()}
        disabled={isReverting || secondsLeft <= 0}
        className="shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        {isReverting ? "Undoing…" : `Undo (${secondsLeft}s)`}
      </button>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

export function UndoToastContainer() {
  const [actions, setActions] = useState<UndoAction[]>([]);

  useEffect(() => {
    setActions(undoManager.getActiveUndoActions());
    return undoManager.subscribe(() => {
      setActions(undoManager.getActiveUndoActions());
    });
  }, []);

  const handleExpire = useCallback((id: string) => {
    void postMetricEvent({
      name: "undo.expired",
      meta: { actionId: id },
    });
    undoManager.cancelUndo(id);
  }, []);

  if (actions.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {actions.map((action) => (
        <UndoToastItem key={action.id} action={action} onExpire={handleExpire} />
      ))}
    </div>
  );
}
