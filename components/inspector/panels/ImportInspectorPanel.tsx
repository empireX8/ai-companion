"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "double:lastImportSessionId";

type UploadStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "processing"
  | "complete"
  | "failed"
  | "expired";

type HistoryItem = {
  id: string;
  filename: string;
  status: UploadStatus;
  createdAt: string;
  sessionsCreated: number;
  contradictionsCreated: number;
  error: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<UploadStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  uploading: "bg-amber-500/10 text-amber-600",
  uploaded: "bg-amber-500/10 text-amber-600",
  processing: "bg-blue-500/10 text-blue-600",
  complete: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

function PanelSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ImportInspectorPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    try {
      setActiveId(localStorage.getItem(STORAGE_KEY));
    } catch {
      // ignore storage errors
    }

    void (async () => {
      try {
        const res = await fetch("/api/upload/history?limit=5", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = (await res.json()) as { items: HistoryItem[] };
        if (!cancelled) setItems(data.items);
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
  if (items.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">No imports yet.</p>
    );
  }

  return (
    <div className="p-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Recent Imports
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li
              key={item.id}
              className={`rounded-md border px-2.5 py-2 text-xs ${
                isActive ? "border-primary/30 bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className="truncate font-medium text-foreground"
                  title={item.filename}
                >
                  {item.filename}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {item.status}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {fmtDate(item.createdAt)}
                {item.status === "complete" &&
                  ` · ${item.sessionsCreated}s ${item.contradictionsCreated}c`}
                {item.status === "failed" && item.error && ` · ${item.error.slice(0, 35)}`}
                {isActive && (
                  <span className="ml-1 text-primary">· active</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
