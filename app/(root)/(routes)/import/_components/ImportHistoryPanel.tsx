"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, Upload } from "lucide-react";

const IMPORT_SESSION_STORAGE_KEY = "double:lastImportSessionId";

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
  finishedAt: string | null;
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  error: string | null;
};

const STATUS_STYLES: Record<UploadStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  uploading: "bg-amber-500/10 text-amber-600",
  uploaded: "bg-amber-500/10 text-amber-600",
  processing: "bg-blue-500/10 text-blue-600",
  complete: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<UploadStatus, string> = {
  pending: "Pending",
  uploading: "Uploading…",
  uploaded: "Uploaded",
  processing: "Processing…",
  complete: "Complete",
  failed: "Failed",
  expired: "Expired",
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return `Today at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (diffDays === 1) return `Yesterday at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export function ImportHistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setActiveId(localStorage.getItem(IMPORT_SESSION_STORAGE_KEY));
    } catch {
      // ignore
    }

    void (async () => {
      try {
        const res = await fetch("/api/upload/history");
        if (res.ok) {
          const data = (await res.json()) as { items: HistoryItem[] };
          setItems(data.items);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 p-3 pb-2">
        <div className="flex flex-1 overflow-hidden rounded-md shadow-glow-sm">
          <button
            type="button"
            className="flex flex-1 items-center gap-2 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>Import export</span>
          </button>
          <div className="w-px shrink-0 bg-primary-foreground/20" />
          <button
            type="button"
            className="flex shrink-0 items-center justify-center bg-primary px-2.5 text-primary-foreground transition-opacity hover:opacity-90"
            aria-label="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Section header */}
      <div className="flex shrink-0 items-center justify-between border-t border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Import History</span>
        </div>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          aria-label="More options"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 space-y-2 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 p-4 text-center">
          <p className="text-xs font-medium text-foreground">No imports yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a ChatGPT export to get started.
          </p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border/60 overflow-y-auto">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id} className={`px-3 py-2.5 transition-colors ${isActive ? "bg-primary/10" : "hover:bg-accent/40"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate text-xs font-semibold text-foreground"
                    title={item.filename}
                  >
                    {item.filename}
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[item.status]}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(item.createdAt)}
                  {item.status === "complete" &&
                    ` · ${item.sessionsCreated} sessions, ${item.contradictionsCreated} contradictions`}
                  {item.status === "failed" &&
                    item.error &&
                    ` · ${item.error.slice(0, 40)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
