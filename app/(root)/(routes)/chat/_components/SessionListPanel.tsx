"use client";

import { MessageSquare, MoreHorizontal, Plus, Search } from "lucide-react";

type ChatSession = {
  id: string;
  label: string | null;
  preview: string | null;
  startedAt: string;
  endedAt: string | null;
};

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  isLoadingSessions: boolean;
  isCreatingSession: boolean;
  isLoadingSession: boolean;
  onCreateNewSession: () => void;
  onSelectSession: (id: string) => void;
};

export function SessionListPanel({
  sessions,
  selectedSessionId,
  isLoadingSessions,
  isCreatingSession,
  isLoadingSession,
  onCreateNewSession,
  onSelectSession,
}: Props) {

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar — compound New session button */}
      <div className="shrink-0 p-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 overflow-hidden rounded-md shadow-glow-sm">
            <button
              type="button"
              onClick={onCreateNewSession}
              disabled={isCreatingSession || isLoadingSession}
              className="flex flex-1 items-center gap-2 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{isCreatingSession ? "Creating..." : "New session"}</span>
            </button>
            <div className="w-px shrink-0 bg-primary-foreground/20" />
            <button
              type="button"
              className="flex shrink-0 items-center justify-center bg-primary px-2.5 text-primary-foreground transition-opacity hover:opacity-90"
              aria-label="Session options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sessions header with search */}
      <div className="flex shrink-0 items-center justify-between border-t border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Sessions</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Search sessions"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            aria-label="More options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoadingSessions ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No sessions yet.</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => {
              const isActive = selectedSessionId === session.id;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className={`flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-sidebar-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {session.label ?? session.preview ?? "New conversation"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatSessionDate(session.startedAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
