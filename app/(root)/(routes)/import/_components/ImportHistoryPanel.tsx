"use client";

import { useEffect, useState } from "react";

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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

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
      <div className="flex h-12 shrink-0 items-center border-b border-border/60 px-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Import History
        </p>
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
              <li key={item.id} className={`px-3 py-2 ${isActive ? "bg-accent/60" : ""}`}>
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="truncate text-xs font-medium text-foreground"
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
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatDate(item.createdAt)}
                  {item.status === "complete" &&
                    ` · ${item.sessionsCreated}s ${item.contradictionsCreated}c`}
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
