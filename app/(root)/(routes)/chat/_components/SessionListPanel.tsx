"use client";

import { MessageSquare, Plus } from "lucide-react";

type ChatSession = {
  id: string;
  label: string | null;
  startedAt: string;
  endedAt: string | null;
};

function shortenId(id: string): string {
  return id.slice(0, 8);
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
      <div className="border-b border-border p-2">
        <button
          type="button"
          onClick={onCreateNewSession}
          disabled={isCreatingSession || isLoadingSession}
          className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>{isCreatingSession ? "Creating..." : "New session"}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
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
                        ? "bg-accent text-foreground"
                        : "text-sidebar-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <MessageSquare
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        isActive ? "text-primary" : "text-text-dim"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {session.label || shortenId(session.id)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(session.startedAt).toLocaleString()}
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
