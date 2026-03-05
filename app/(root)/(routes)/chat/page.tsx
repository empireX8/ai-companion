"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Brain,
  ChevronLeft,
  Clock3,
  PanelLeft,
  Copy,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { MemoryPanel } from "./_components/memory-panel";
import { SessionListPanel } from "./_components/SessionListPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { TopBarSlot } from "@/components/layout/TopBarSlot";
import { useDomainListPanel } from "@/components/layout/DomainListContext";
import { ChatContextDrawer } from "@/components/chat/ChatContextDrawer";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  label: string | null;
  preview: string | null;
  startedAt: string;
  endedAt: string | null;
};

type ReferenceType =
  | "rule"
  | "constraint"
  | "pattern"
  | "goal"
  | "preference"
  | "assumption"
  | "hypothesis";

type ReferenceConfidence = "low" | "medium" | "high";

type ReferenceItem = {
  id: string;
  type: ReferenceType;
  confidence: ReferenceConfidence;
  statement: string;
  createdAt: string;
  updatedAt: string;
  status?: "active" | "inactive" | "superseded" | string;
  sourceSessionId?: string | null;
  sourceMessageId?: string | null;
  supersedesId?: string | null;
};

type PendingReferenceItem = {
  id: string;
  type: ReferenceType;
  confidence: ReferenceConfidence;
  statement: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

const SESSION_STORAGE_KEY = "double:lastSessionId";


const createTempId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function ChatPage() {
  const { toggleCollapsed: toggleSessionsPanel } = useDomainListPanel();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const [isSending, setIsSending] = useState(false);

  const [referenceStatement, setReferenceStatement] = useState("");
  const [referenceType, setReferenceType] = useState<ReferenceType>("preference");
  const [referenceConfidence, setReferenceConfidence] =
    useState<ReferenceConfidence>("medium");
  const [savedReferences, setSavedReferences] = useState<ReferenceItem[]>([]);
  const [isSavingReference, setIsSavingReference] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<string | null>(null);
  const [updatingReferenceId, setUpdatingReferenceId] = useState<string | null>(null);
  const [deactivatingReferenceId, setDeactivatingReferenceId] = useState<string | null>(null);
  const [supersedingReferenceId, setSupersedingReferenceId] = useState<string | null>(null);
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [editStatement, setEditStatement] = useState("");
  const [editType, setEditType] = useState<ReferenceType>("preference");
  const [editConfidence, setEditConfidence] = useState<ReferenceConfidence>("medium");
  const [replaceStatement, setReplaceStatement] = useState("");
  const [replaceType, setReplaceType] = useState<ReferenceType>("preference");
  const [replaceConfidence, setReplaceConfidence] =
    useState<ReferenceConfidence>("medium");
  const [pendingCandidate, setPendingCandidate] = useState<PendingReferenceItem>(null);

  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [mobileMemoryOpen, setMobileMemoryOpen] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Tracks which sessionId has already had its scroll position restored this mount
  const didRestoreRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);

    try {
      const response = await fetch("/api/session/list?origin=app", { method: "GET" });
      if (!response.ok) {
        throw new Error("Failed to load sessions");
      }

      const data = (await response.json()) as ChatSession[];
      setSessions(data);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);


  const fetchMessages = useCallback(async (activeSessionId: string) => {
    const response = await fetch(
      `/api/message/list?sessionId=${encodeURIComponent(activeSessionId)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      throw new Error("Failed to load messages");
    }

    const data = (await response.json()) as ChatMessage[];
    setMessages(data);
  }, []);

  const createSession = useCallback(async () => {
    const response = await fetch("/api/session", { method: "POST" });
    if (!response.ok) {
      throw new Error("Failed to create session");
    }

    const data = (await response.json()) as { sessionId: string };
    return data.sessionId;
  }, []);

  const fetchSavedReferences = useCallback(async () => {
    const response = await fetch("/api/reference/list", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load saved memory");
    }

    const data = (await response.json()) as ReferenceItem[];
    setSavedReferences(data);
  }, []);

  const fetchPendingCandidate = useCallback(async (activeSessionId: string) => {
    const response = await fetch(
      `/api/reference/pending?sessionId=${encodeURIComponent(activeSessionId)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to load pending memory update");
    }

    const data = (await response.json()) as PendingReferenceItem;
    setPendingCandidate(data);
  }, []);


  const setActiveSession = useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    setSelectedSessionId(nextSessionId);
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (!force && isUserScrolled) return;
    const el = messageScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isUserScrolled]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const storedSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);

        let activeSessionId = storedSessionId;
        if (!activeSessionId) {
          activeSessionId = await createSession();
        }

        if (!isMounted) {
          return;
        }

        setActiveSession(activeSessionId);
        await fetchSessions();
        await fetchMessages(activeSessionId);
        await fetchSavedReferences();
        await fetchPendingCandidate(activeSessionId);
      } catch {
        if (!isMounted) {
          return;
        }
        setError("Failed to initialize session.");
      } finally {
        if (!isMounted) {
          return;
        }
        setIsLoadingSession(false);
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [
    createSession,
    fetchMessages,
    fetchPendingCandidate,
    fetchSavedReferences,
    fetchSessions,
    setActiveSession,
  ]);

  useEffect(() => {
    if (!sessionId) {
      setPendingCandidate(null);
      return;
    }

    let isMounted = true;
    const loadPending = async () => {
      try {
        const response = await fetch(
          `/api/reference/pending?sessionId=${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as PendingReferenceItem;
        if (isMounted) {
          setPendingCandidate(data);
        }
      } catch {
        // Ignore transient polling errors.
      }
    };

    void loadPending();
    const intervalId = window.setInterval(() => {
      void loadPending();
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [sessionId]);

  // ── Scroll persistence ──────────────────────────────────────────────────────

  const saveScrollPosition = useCallback(() => {
    if (!sessionId || !messageScrollRef.current) return;
    sessionStorage.setItem(
      `double:chat:scrollTop:${sessionId}`,
      String(messageScrollRef.current.scrollTop)
    );
  }, [sessionId]);

  // Fallback: save scroll when the user navigates away
  useEffect(() => {
    window.addEventListener("beforeunload", saveScrollPosition);
    return () => window.removeEventListener("beforeunload", saveScrollPosition);
  }, [saveScrollPosition]);

  // Restore scroll once per session after messages have loaded
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    if (didRestoreRef.current === sessionId) return;
    didRestoreRef.current = sessionId;
    const stored = sessionStorage.getItem(`double:chat:scrollTop:${sessionId}`);
    if (!stored) return;
    const top = Number(stored);
    if (!Number.isFinite(top) || top <= 0) return;
    requestAnimationFrame(() => {
      if (messageScrollRef.current) {
        messageScrollRef.current.scrollTop = top;
      }
    });
  }, [sessionId, messages]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, scrollToBottom]);

  const desktopGridColumns = useMemo(
    () => `minmax(0, 1fr) ${rightCollapsed ? "2.75rem" : "20rem"}`,
    [rightCollapsed]
  );

  const memorySourceSessionId = selectedSessionId ?? sessionId;

  const onCreateNewSession = async () => {
    if (isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);
    setError(null);

    try {
      const newSessionId = await createSession();
      setActiveSession(newSessionId);
      setMessages([]);
      setPendingCandidate(null);
      setIsUserScrolled(false);
      await fetchMessages(newSessionId);
      await fetchPendingCandidate(newSessionId);
      await fetchSessions();
      setMobileSessionsOpen(false);
      scrollToBottom(true);
    } catch {
      setError("Failed to create session.");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const onSelectSession = async (nextSessionId: string) => {
    if (nextSessionId === sessionId) {
      setMobileSessionsOpen(false);
      return;
    }

    setError(null);
    setActiveSession(nextSessionId);
    setMessages([]);
    setPendingCandidate(null);
    setIsUserScrolled(false);

    try {
      await fetchMessages(nextSessionId);
      await fetchPendingCandidate(nextSessionId);
      setMobileSessionsOpen(false);
      scrollToBottom(true);
    } catch {
      setError("Failed to load messages.");
    }
  };

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const trimmed = rawContent.trim();
      if (!trimmed || !sessionId || isSending) {
        return;
      }

      setIsSending(true);
      setError(null);
      setIsUserScrolled(false);

      // Capture whether this is the first message before we update state
      const isFirstMessage = messages.length === 0;

      try {
        const userTempId = createTempId();
        const assistantTempId = createTempId();
        const now = new Date().toISOString();

        setMessages((current) => [
          ...current,
          {
            id: userTempId,
            role: "user",
            content: trimmed,
            createdAt: now,
          },
          {
            id: assistantTempId,
            role: "assistant",
            content: "",
            createdAt: now,
          },
        ]);

        const response = await fetch("/api/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId, content: trimmed }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response stream");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) {
            continue;
          }

          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, content: message.content + chunk }
                : message
            )
          );
        }

        const remaining = decoder.decode();
        if (remaining) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, content: message.content + remaining }
                : message
            )
          );
        }

        await fetchMessages(sessionId);
        await fetchPendingCandidate(sessionId);
        setContent("");
        setMobileMemoryOpen(false);

        // After first exchange completes, generate a title in the background
        if (isFirstMessage) {
          void fetch("/api/session/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          }).then((r) => {
            if (r.ok) void fetchSessions();
          });
        }
      } catch {
        setError("Failed to send message.");
        try {
          await fetchMessages(sessionId);
          await fetchPendingCandidate(sessionId);
        } catch {
          // Keep original send error if resync also fails.
        }
      } finally {
        setIsSending(false);
      }
    },
    [fetchMessages, fetchPendingCandidate, fetchSessions, isSending, messages.length, sessionId]
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(content);
  };

  const onSaveReference = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const statement = referenceStatement.trim();
    if (!statement || isSavingReference) {
      return;
    }

    setIsSavingReference(true);
    setReferenceStatus(null);

    try {
      const response = await fetch("/api/reference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          statement,
          type: referenceType,
          confidence: referenceConfidence,
          sourceSessionId: memorySourceSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save memory");
      }

      setReferenceStatement("");
      setReferenceStatus("Saved.");
      await fetchSavedReferences();
    } catch {
      setReferenceStatus("Failed to save.");
    } finally {
      setIsSavingReference(false);
    }
  };

  const onStartEditReference = (item: ReferenceItem) => {
    setEditingReferenceId(item.id);
    setEditStatement(item.statement);
    setEditType(item.type);
    setEditConfidence(item.confidence);
    setSupersedingReferenceId((current) => (current === item.id ? null : current));
  };

  const onUpdateReference = async (id: string) => {
    const statement = editStatement.trim();
    if (!statement || updatingReferenceId) {
      return;
    }

    setUpdatingReferenceId(id);
    setReferenceStatus(null);

    try {
      const response = await fetch(`/api/reference/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          statement,
          type: editType,
          confidence: editConfidence,
          status: "active",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update memory");
      }

      setEditingReferenceId(null);
      setReferenceStatus("Updated.");
      await fetchSavedReferences();
    } catch {
      setReferenceStatus("Failed to update.");
    } finally {
      setUpdatingReferenceId(null);
    }
  };

  const onDeactivateReference = async (id: string) => {
    if (deactivatingReferenceId) {
      return;
    }

    setDeactivatingReferenceId(id);
    setReferenceStatus(null);

    try {
      const response = await fetch("/api/reference/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Failed to deactivate memory");
      }

      if (editingReferenceId === id) {
        setEditingReferenceId(null);
      }

      if (supersedingReferenceId === id) {
        setSupersedingReferenceId(null);
      }

      setReferenceStatus("Deactivated.");
      await fetchSavedReferences();
    } catch {
      setReferenceStatus("Failed to deactivate.");
    } finally {
      setDeactivatingReferenceId(null);
    }
  };

  const onStartSupersedeReference = (item: ReferenceItem) => {
    setSupersedingReferenceId(item.id);
    setReplaceStatement("");
    setReplaceType(item.type);
    setReplaceConfidence(item.confidence);
    setEditingReferenceId((current) => (current === item.id ? null : current));
  };

  const onSupersedeReference = async (id: string) => {
    const statement = replaceStatement.trim();
    if (!statement || updatingReferenceId) {
      return;
    }

    setUpdatingReferenceId(id);
    setReferenceStatus(null);

    try {
      const response = await fetch("/api/reference/supersede", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          oldId: id,
          statement,
          type: replaceType,
          confidence: replaceConfidence,
          sourceSessionId: memorySourceSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to supersede memory");
      }

      setSupersedingReferenceId(null);
      setReplaceStatement("");
      setReferenceStatus("Replaced.");
      await fetchSavedReferences();
    } catch {
      setReferenceStatus("Failed to replace.");
    } finally {
      setUpdatingReferenceId(null);
    }
  };

  const onMessageScroll = () => {
    const el = messageScrollRef.current;
    if (!el) {
      return;
    }

    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsUserScrolled(distanceToBottom > 40);
  };


  const sessionListProps = {
    sessions,
    selectedSessionId,
    isLoadingSessions,
    isCreatingSession,
    isLoadingSession,
    onCreateNewSession: () => void onCreateNewSession(),
    onSelectSession: (id: string) => void onSelectSession(id),
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <DomainListSlot>
        <SessionListPanel {...sessionListProps} />
      </DomainListSlot>

      <TopBarSlot>
        <button
          type="button"
          onClick={toggleSessionsPanel}
          title="Toggle sessions"
          aria-label="Toggle sessions"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setRightCollapsed((v) => !v)}
          title="Toggle memory"
          aria-label="Toggle memory"
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            !rightCollapsed
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setContextOpen((v) => !v)}
          title="Toggle context"
          aria-label="Toggle context"
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            contextOpen
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Clock3 className="h-4 w-4" />
        </button>
      </TopBarSlot>

      <header className="flex h-12 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 md:hidden">
        <Link
          href="/"
          className="font-display text-xs font-semibold uppercase tracking-wider text-foreground transition-opacity hover:opacity-80"
        >
          Double
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMemoryOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <Brain className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileSessionsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
          <UserButton />
        </div>
      </header>

      <div
        className="flex min-h-0 flex-1 overflow-hidden md:grid"
        style={{ gridTemplateColumns: desktopGridColumns }}
      >
        <section className="flex min-w-0 flex-1 min-h-0 flex-col bg-background">
          {/* Context tuck-down panel — vertical animation, no horizontal shift */}
          <ChatContextDrawer isOpen={contextOpen} onClose={() => setContextOpen(false)} />
          <div
            ref={messageScrollRef}
            onScroll={onMessageScroll}
            className="relative flex-1 min-h-0 overflow-y-auto px-4"
          >
            <div className="mx-auto w-full max-w-3xl py-4">
              {pendingCandidate ? (
                <div className="mb-3 rounded-md border border-memory-pending/40 bg-memory-pending/10 p-3 text-sm">
                  <p className="font-semibold">Pending memory update</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {pendingCandidate.statement}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void sendMessage("yes")}
                      disabled={isSending || isCreatingSession || !sessionId}
                      className="rounded-md border border-border bg-background px-3 py-1 text-xs disabled:opacity-50"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendMessage("no")}
                      disabled={isSending || isCreatingSession || !sessionId}
                      className="rounded-md border border-border bg-background px-3 py-1 text-xs disabled:opacity-50"
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : null}

              {isLoadingSession ? (
                <p className="text-sm text-muted-foreground">Loading session...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                <ul className="space-y-8">
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    return (
                      <li
                        key={message.id}
                        className={`group flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        {!isUser && (
                          <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 shadow-glow-sm">
                            <Brain className="h-3 w-3 text-primary-foreground" />
                            <span className="text-xs font-semibold text-primary-foreground">
                              Companion
                            </span>
                          </div>
                        )}
                        <div className={isUser ? "max-w-[75%] rounded-3xl bg-primary px-4 py-2.5 shadow-glow" : "max-w-[90%]"}>
                          {!isUser && isSending && !message.content ? (
                            <div className="flex items-center gap-2 px-1 py-2">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="h-2.5 w-2.5 rounded-full bg-primary animate-dot-pop"
                                  style={{ animationDelay: `${i * 0.22}s` }}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isUser ? "text-primary-foreground" : "text-foreground"}`}>
                              {message.content}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(message.content)}
                          title="Copy"
                          className="mt-1.5 flex h-5 w-5 items-center justify-center text-muted-foreground/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-muted-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {isUserScrolled ? (
            <div className="shrink-0 flex justify-center border-t border-border py-2">
              <button
                type="button"
                onClick={() => {
                  setIsUserScrolled(false);
                  scrollToBottom(true);
                }}
                className="rounded-full border border-border bg-card px-3 py-1 font-display text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                ↓ Latest
              </button>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="shrink-0 border-t border-border/60 bg-background px-4 py-4">
            <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-xl border border-primary/40 bg-card/50 px-4 py-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-primary/60 focus-within:shadow-glow">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground/30" aria-hidden />
              <input
                type="text"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Type a message…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                disabled={!sessionId || isSending || isCreatingSession}
              />
              <button
                type="submit"
                disabled={!sessionId || isSending || isCreatingSession || content.trim().length === 0}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow-sm transition-all disabled:opacity-25 enabled:hover:opacity-90"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </section>

        {rightCollapsed ? (
          <button
            type="button"
            onClick={() => setRightCollapsed(false)}
            className="hidden min-h-0 h-full shrink-0 flex-col items-center justify-start border-l border-border/40 bg-sidebar pt-4 transition-colors hover:bg-accent md:flex"
          >
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="mt-3 font-display text-[9px] uppercase tracking-widest text-text-dim [writing-mode:vertical-rl]">
              Memory
            </span>
          </button>
        ) : (
          <aside className="hidden min-h-0 shrink-0 flex-col border-l border-border/40 bg-sidebar md:flex">
            <MemoryPanel
              savedReferences={savedReferences}
              pendingCandidate={pendingCandidate}
              referenceStatement={referenceStatement}
              setReferenceStatement={setReferenceStatement}
              referenceType={referenceType}
              setReferenceType={setReferenceType}
              referenceConfidence={referenceConfidence}
              setReferenceConfidence={setReferenceConfidence}
              isSavingReference={isSavingReference}
              referenceStatus={referenceStatus}
              onSaveReference={onSaveReference}
              updatingReferenceId={updatingReferenceId}
              deactivatingReferenceId={deactivatingReferenceId}
              supersedingReferenceId={supersedingReferenceId}
              editingReferenceId={editingReferenceId}
              onStartEditReference={onStartEditReference}
              onStartSupersedeReference={onStartSupersedeReference}
              onDeactivateReference={onDeactivateReference}
              onUpdateReference={onUpdateReference}
              onSupersedeReference={onSupersedeReference}
              editStatement={editStatement}
              setEditStatement={setEditStatement}
              editType={editType}
              setEditType={setEditType}
              editConfidence={editConfidence}
              setEditConfidence={setEditConfidence}
              onCancelEdit={() => setEditingReferenceId(null)}
              replaceStatement={replaceStatement}
              setReplaceStatement={setReplaceStatement}
              replaceType={replaceType}
              setReplaceType={setReplaceType}
              replaceConfidence={replaceConfidence}
              setReplaceConfidence={setReplaceConfidence}
              onCancelSupersede={() => setSupersedingReferenceId(null)}
              onTogglePanel={() => setRightCollapsed(true)}
            />
          </aside>
        )}
      </div>

      <Sheet open={mobileMemoryOpen} onOpenChange={setMobileMemoryOpen}>
        <SheetContent side="right" className="w-88 border-l border-border bg-sidebar p-0 [&>button]:hidden">
          <MemoryPanel
            savedReferences={savedReferences}
            pendingCandidate={pendingCandidate}
            referenceStatement={referenceStatement}
            setReferenceStatement={setReferenceStatement}
            referenceType={referenceType}
            setReferenceType={setReferenceType}
            referenceConfidence={referenceConfidence}
            setReferenceConfidence={setReferenceConfidence}
            isSavingReference={isSavingReference}
            referenceStatus={referenceStatus}
            onSaveReference={onSaveReference}
            updatingReferenceId={updatingReferenceId}
            deactivatingReferenceId={deactivatingReferenceId}
            supersedingReferenceId={supersedingReferenceId}
            editingReferenceId={editingReferenceId}
            onStartEditReference={onStartEditReference}
            onStartSupersedeReference={onStartSupersedeReference}
            onDeactivateReference={onDeactivateReference}
            onUpdateReference={onUpdateReference}
            onSupersedeReference={onSupersedeReference}
            editStatement={editStatement}
            setEditStatement={setEditStatement}
            editType={editType}
            setEditType={setEditType}
            editConfidence={editConfidence}
            setEditConfidence={setEditConfidence}
            onCancelEdit={() => setEditingReferenceId(null)}
            replaceStatement={replaceStatement}
            setReplaceStatement={setReplaceStatement}
            replaceType={replaceType}
            setReplaceType={setReplaceType}
            replaceConfidence={replaceConfidence}
            setReplaceConfidence={setReplaceConfidence}
            onCancelSupersede={() => setSupersedingReferenceId(null)}
            onTogglePanel={() => setMobileMemoryOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
        <SheetContent side="bottom" className="h-[72vh] border-t border-border bg-sidebar p-0 [&>button]:hidden">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
                Sessions
              </h2>
              <button
                type="button"
                onClick={() => setMobileSessionsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4 -rotate-90" />
              </button>
            </div>
            <SessionListPanel {...sessionListProps} />
          </div>
        </SheetContent>
      </Sheet>

      {error ? <p className="border-t border-border px-4 py-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
