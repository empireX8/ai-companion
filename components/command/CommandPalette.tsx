"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCommandPalette } from "./CommandPaletteContext";
import { dispatchChatEvent, CHAT_EVENTS } from "./chatEvents";

type CommandGroup = "navigation" | "chat";

type Command = {
  id: string;
  label: string;
  group: CommandGroup;
  action: () => void;
};

const GROUP_LABELS: Record<CommandGroup, string> = {
  navigation: "Go to",
  chat: "Chat",
};

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      // Navigation — V1 visible routes only
      { id: "nav-chat", label: "Chat", group: "navigation", action: () => router.push("/chat") },
      { id: "nav-patterns", label: "Patterns", group: "navigation", action: () => router.push("/patterns") },
      { id: "nav-history", label: "History", group: "navigation", action: () => router.push("/history") },
      { id: "nav-context", label: "Context", group: "navigation", action: () => router.push("/context") },
      { id: "nav-import", label: "Import", group: "navigation", action: () => router.push("/import") },
      { id: "nav-settings", label: "Settings", group: "navigation", action: () => router.push("/settings") },
      // Chat actions
      { id: "chat-new-session", label: "New session", group: "chat", action: () => dispatchChatEvent(CHAT_EVENTS.NEW_SESSION) },
      { id: "chat-focus", label: "Focus composer", group: "chat", action: () => dispatchChatEvent(CHAT_EVENTS.FOCUS_COMPOSER) },
      { id: "chat-toggle-memory", label: "Toggle memory panel", group: "chat", action: () => dispatchChatEvent(CHAT_EVENTS.TOGGLE_MEMORY) },
      { id: "chat-toggle-sessions", label: "Toggle sessions panel", group: "chat", action: () => dispatchChatEvent(CHAT_EVENTS.TOGGLE_SESSIONS) },
      { id: "chat-toggle-context", label: "Toggle context panel", group: "chat", action: () => dispatchChatEvent(CHAT_EVENTS.TOGGLE_CONTEXT) },
    ],
    [router]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.includes(q)
    );
  }, [commands, query]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      // Defer focus so the element is mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Reset cursor when filtered list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) {
          cmd.action();
          close();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close, filtered, activeIndex]);

  if (!isOpen) return null;

  const groups = Array.from(new Set(filtered.map((c) => c.group)));

  return (
    <div
      className="fixed inset-0 z-200 flex items-start justify-center bg-black/50 pt-[20vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No commands found</p>
          ) : (
            groups.map((group) => {
              const groupCmds = filtered.filter((c) => c.group === group);
              return (
                <div key={group}>
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {GROUP_LABELS[group]}
                  </p>
                  {groupCmds.map((cmd) => {
                    const idx = filtered.indexOf(cmd);
                    const isActive = activeIndex === idx;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onClick={() => {
                          cmd.action();
                          close();
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-accent/40"
                        }`}
                      >
                        {cmd.label}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
