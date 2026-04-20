"use client";

/**
 * History — conversation history destination (P1-03)
 *
 * Shows all user sessions with dates and previews.
 * Scope stays focused on review: conversation history only.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";

type Session = {
  id: string;
  label: string | null;
  preview: string | null;
  startedAt: string;
  endedAt: string | null;
  origin: "APP" | "IMPORTED_ARCHIVE";
  importedSource: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/session/list?origin=all", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Session[]) => {
        setSessions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">History</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Your past conversations, in order.
          </p>
        </div>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-lg bg-muted/50"
              />
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/40 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Start a chat to see your history here.
            </p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href="/chat"
                className={cn(
                  "group flex items-start gap-3 rounded-lg border border-border/40 bg-card px-4 py-3",
                  "transition-colors hover:border-primary/20 hover:bg-primary/5"
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary/70" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.label ?? "Conversation"}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground/70">
                      {formatDate(session.startedAt)}
                    </span>
                  </div>
                  {session.preview && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {session.preview}
                    </p>
                  )}
                  {session.origin === "IMPORTED_ARCHIVE" && (
                    <span className="mt-1 inline-block rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
                      Imported
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <p className="text-center text-[11px] text-muted-foreground/50">
            Showing your {sessions.length} most recent conversation
            {sessions.length !== 1 ? "s" : ""}.
          </p>
        )}
      </div>
    </div>
  );
}
