"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Plus, Send, Square, Mic } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceWaveform } from "@/components/VoiceWaveform";

import {
  buildAppSessionCreateRequestInit,
  buildAppSessionListUrl,
  type SessionSurfaceType,
} from "@/lib/chat-surface-routing";

type SurfaceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type SurfaceSession = {
  id: string;
  label: string | null;
  preview: string | null;
  startedAt: string;
  endedAt: string | null;
};

type SurfaceChatShellProps = {
  title: string;
  subtitle: string;
  surfaceType: SessionSurfaceType;
  sessionStorageKey: string;
  placeholder: string;
  emptyPrompt: string;
  contextBanner?: ReactNode;
  contextPanel?: ReactNode;
  footerNote?: string;
  assistantEyebrow: string;
};

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function toSessionTitle(session: SurfaceSession | null, messages: SurfaceMessage[]): string {
  if (session?.label?.trim()) {
    return session.label.trim();
  }

  const firstUser = messages.find((message) => message.role === "user" && message.content.trim().length > 0);
  if (firstUser?.content) {
    return firstUser.content.length > 88
      ? `${firstUser.content.slice(0, 85)}...`
      : firstUser.content;
  }

  return "New session";
}

function buildTempId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Subtle animated thinking indicator for assistant pending/streaming state. */
function ThinkingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-cyan/70">
      <span className="flex items-center gap-[3px]">
        <span className="w-[5px] h-[5px] rounded-full bg-cyan/70 animate-pulse-cyan" />
        <span className="w-[5px] h-[5px] rounded-full bg-cyan/70 animate-pulse-cyan" style={{ animationDelay: "400ms" }} />
        <span className="w-[5px] h-[5px] rounded-full bg-cyan/70 animate-pulse-cyan" style={{ animationDelay: "800ms" }} />
      </span>
      <span className="opacity-60">reflecting</span>
    </span>
  );
}

export function SurfaceChatShell({
  title,
  subtitle,
  surfaceType,
  sessionStorageKey,
  placeholder,
  emptyPrompt,
  contextBanner,
  contextPanel,
  footerNote,
  assistantEyebrow,
}: SurfaceChatShellProps) {
  const [sessions, setSessions] = useState<SurfaceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SurfaceMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const voice = useVoiceInput();

  // Insert voice transcript into draft when recording completes
  useEffect(() => {
    if (voice.transcript && voice.state === "idle") {
      setDraft((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${voice.transcript}` : voice.transcript;
      });
    }
  }, [voice.transcript, voice.state]);

  // Auto-scroll composer textarea to bottom when voice interim transcript updates
  useEffect(() => {
    if (voice.state === "recording" && composerRef.current) {
      composerRef.current.scrollTop = composerRef.current.scrollHeight;
    }
  }, [voice.interimTranscript, voice.state]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const sessionTitle = useMemo(
    () => toSessionTitle(selectedSession, messages),
    [messages, selectedSession]
  );

  const persistSessionSelection = useCallback((sessionId: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (!sessionId) {
        window.localStorage.removeItem(sessionStorageKey);
        return;
      }

      window.localStorage.setItem(sessionStorageKey, sessionId);
    } catch {
      // Ignore storage failures; in-memory state still works.
    }
  }, [sessionStorageKey]);

  const loadSessions = useCallback(async (): Promise<SurfaceSession[]> => {
    const response = await fetch(buildAppSessionListUrl(surfaceType), {
      method: "GET",
      cache: "no-store",
    });

    if (response.status === 401) {
      throw new Error("Please sign in to view sessions.");
    }

    if (!response.ok) {
      throw new Error("Could not load sessions. The server may be unavailable.");
    }

    return (await response.json()) as SurfaceSession[];
  }, [surfaceType]);

  const loadMessages = useCallback(async (sessionId: string): Promise<SurfaceMessage[]> => {
    const response = await fetch(
      `/api/message/list?sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (response.status === 401) {
      throw new Error("Please sign in to view messages.");
    }

    if (response.status === 404) {
      throw new Error("Session not found. It may have been deleted.");
    }

    if (!response.ok) {
      throw new Error("Could not load messages. The server may be unavailable.");
    }

    return (await response.json()) as SurfaceMessage[];
  }, []);

  const createSession = useCallback(async (): Promise<string> => {
    const response = await fetch(
      "/api/session",
      buildAppSessionCreateRequestInit(surfaceType)
    );

    if (response.status === 401) {
      throw new Error("Please sign in to create a session.");
    }

    if (!response.ok) {
      throw new Error("Could not create session. The server may be unavailable.");
    }

    const payload = (await response.json()) as { sessionId: string };
    return payload.sessionId;
  }, [surfaceType]);

  const activateSession = useCallback(
    async (sessionId: string) => {
      setIsLoadingSession(true);
      setErrorMessage(null);

      try {
        const nextMessages = await loadMessages(sessionId);
        setSelectedSessionId(sessionId);
        persistSessionSelection(sessionId);
        setMessages(nextMessages);
      } finally {
        setIsLoadingSession(false);
      }
    },
    [loadMessages, persistSessionSelection]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsBooting(true);
      setErrorMessage(null);

      try {
        const sessionList = await loadSessions();
        if (cancelled) {
          return;
        }

        const storedSessionId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(sessionStorageKey)
            : null;

        let nextSessionId =
          storedSessionId && sessionList.some((session) => session.id === storedSessionId)
            ? storedSessionId
            : sessionList[0]?.id ?? null;

        let nextSessions = sessionList;

        if (!nextSessionId) {
          nextSessionId = await createSession();
          if (cancelled) {
            return;
          }
          nextSessions = await loadSessions();
        }

        if (!nextSessionId || cancelled) {
          return;
        }

        const nextMessages = await loadMessages(nextSessionId);
        if (cancelled) {
          return;
        }

        setSessions(nextSessions);
        setSelectedSessionId(nextSessionId);
        persistSessionSelection(nextSessionId);
        setMessages(nextMessages);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : "Could not initialize chat."
        );
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [createSession, loadMessages, loadSessions, persistSessionSelection, sessionStorageKey]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const refreshSessions = useCallback(async () => {
    try {
      const nextSessions = await loadSessions();
      setSessions(nextSessions);
    } catch {
      // Keep current list if refresh fails.
    }
  }, [loadSessions]);

  const onCreateNewSession = useCallback(async () => {
    if (isCreatingSession || isSending) {
      return;
    }

    setIsCreatingSession(true);
    setErrorMessage(null);

    try {
      const nextSessionId = await createSession();
      await refreshSessions();
      await activateSession(nextSessionId);
      setDraft("");
      setDrawerOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not create session."
      );
    } finally {
      setIsCreatingSession(false);
    }
  }, [activateSession, createSession, isCreatingSession, isSending, refreshSessions]);

  const onSelectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === selectedSessionId || isLoadingSession || isSending) {
        return;
      }

      try {
        await activateSession(sessionId);
      } catch (error) {
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : "Could not load that session."
        );
      }
    },
    [activateSession, isLoadingSession, isSending, selectedSessionId]
  );

  const sendMessage = useCallback(async () => {
    const content = draft.trim();
    if (!content || !selectedSessionId || isSending) {
      return;
    }

    const userTempId = buildTempId("tmp-user");
    const assistantTempId = buildTempId("tmp-assistant");
    const nowIso = new Date().toISOString();

    setIsSending(true);
    setErrorMessage(null);
    setDraft("");

    setMessages((current) => [
      ...current,
      {
        id: userTempId,
        role: "user",
        content,
        createdAt: nowIso,
      },
      {
        id: assistantTempId,
        role: "assistant",
        content: "",
        createdAt: nowIso,
      },
    ]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          content,
          model: "gpt-4o-mini",
          responseMode: "standard",
        }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Could not send message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

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
              ? { ...message, content: `${message.content}${chunk}` }
              : message
          )
        );
      }

      const trailing = decoder.decode();
      if (trailing) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantTempId
              ? { ...message, content: `${message.content}${trailing}` }
              : message
          )
        );
      }

      const reconciledMessages = await loadMessages(selectedSessionId);
      setMessages(reconciledMessages);

      void fetch("/api/session/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSessionId }),
      }).then((result) => {
        if (result.ok) {
          void refreshSessions();
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not send message."
      );

      try {
        const reconciledMessages = await loadMessages(selectedSessionId);
        setMessages(reconciledMessages);
      } catch {
        setMessages((current) =>
          current.filter((message) => message.id !== assistantTempId)
        );
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  }, [draft, isSending, loadMessages, refreshSessions, selectedSessionId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage();
  };

  return (
    <div className="flex h-screen">
      <div className="w-[280px] shrink-0 border-r hairline flex flex-col">
        <div className="p-5 border-b hairline flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <div className="label-meta mt-0.5">{subtitle}</div>
          </div>
          <button
            onClick={() => {
              void onCreateNewSession();
            }}
            disabled={isCreatingSession || isBooting || isSending}
            className="h-8 w-8 rounded-md card-standard hover:border-[hsl(187_100%_50%/0.3)] flex items-center justify-center disabled:opacity-45 disabled:cursor-not-allowed"
            aria-label="Create new session"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.map((session) => {
            const active = selectedSessionId === session.id;
            return (
              <button
                key={session.id}
                onClick={() => {
                  void onSelectSession(session.id);
                }}
                className={`w-full text-left px-5 py-3 transition-colors ${
                  active
                    ? "bg-[hsl(187_100%_50%/0.04)] border-l-2 border-cyan"
                    : "hover:bg-white/[0.02] border-l-2 border-transparent"
                }`}
              >
                <div className="label-meta mb-1">{formatDayLabel(session.startedAt)}</div>
                <div className="text-[13px] mb-1 leading-snug line-clamp-2">
                  {(session.label ?? session.preview ?? "New session").trim() || "New session"}
                </div>
                <div className="label-meta">{session.id.slice(0, 8)}</div>
              </button>
            );
          })}
          {!isBooting && sessions.length === 0 && (
            <div className="px-5 py-4 text-[12px] text-meta">No sessions yet.</div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-10 py-5 border-b hairline flex items-center justify-between">
          <div>
            <div className="label-meta mb-1">
              Session {selectedSession ? `· ${formatDayLabel(selectedSession.startedAt)}` : ""}
            </div>
            <h1 className="text-[18px] font-semibold tracking-tight">{sessionTitle}</h1>
          </div>
          {contextPanel ? (
            <button
              onClick={() => setDrawerOpen((current) => !current)}
              className="label-meta px-3 h-8 rounded card-standard hover:border-[hsl(187_100%_50%/0.3)]"
            >
              Context {drawerOpen ? "·" : "+"}
            </button>
          ) : null}
        </div>

        {contextBanner ? (
          <div className="px-10 py-4 border-b hairline">{contextBanner}</div>
        ) : null}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8">
          <div className="max-w-[720px] mx-auto space-y-6">
            {isBooting || isLoadingSession ? (
              <div className="text-[13px] text-meta">Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div className="text-[14px] text-[hsl(216_11%_75%)] leading-relaxed">{emptyPrompt}</div>
            ) : (
              messages.map((message) =>
                message.role === "assistant" ? (
                  <div key={message.id} className="animate-fade-in">
                    <div className="label-meta mb-2 text-cyan/80 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan glow-cyan" /> {assistantEyebrow}
                    </div>
                    <div className="text-[15px] leading-[1.7] text-[hsl(216_11%_82%)] max-w-[600px] whitespace-pre-wrap">
                      {message.content || <ThinkingIndicator />}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex justify-end animate-fade-in">
                    <div className="card-standard px-4 py-3 max-w-[560px] text-[14px] leading-[1.65] whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                )
              )
            )}
            {errorMessage && (
              <div className="text-[12px] text-[hsl(12_80%_64%)]">{errorMessage}</div>
            )}
          </div>
        </div>

        <div className="px-10 pb-6 pt-4 border-t hairline">
          <div className="max-w-[720px] mx-auto">
            <form onSubmit={onSubmit} className="card-standard p-3 flex items-end gap-2">
              <textarea
                ref={composerRef}
                rows={1}
                value={
                  voice.state === "recording" && voice.interimTranscript
                    ? draft
                      ? `${draft}\n${voice.interimTranscript}`
                      : voice.interimTranscript
                    : draft
                }
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={placeholder}
                className="flex-1 bg-transparent resize-none focus:outline-none text-[14px] py-1.5 px-2 placeholder:text-meta-deep max-h-40 overflow-y-auto"
                disabled={!selectedSessionId || isSending || isBooting}
              />
              <button
                type="button"
                onClick={() => {
                  void voice.toggle();
                }}
                disabled={!selectedSessionId || isBooting}
                className={`h-9 w-9 rounded-md flex items-center justify-center transition-colors ${
                  voice.state === "recording"
                    ? "text-[hsl(12_80%_64%)] bg-[hsl(12_80%_64%/0.1)]"
                    : "border border-white/[0.08] text-meta hover:text-white hover:bg-white/5"
                } disabled:opacity-45 disabled:cursor-not-allowed`}
                title="Voice input"
              >
                {voice.state === "recording" ? (
                  <VoiceWaveform active={true} />
                ) : (
                  <Mic className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
              </button>
              {isSending ? (
                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort();
                    setIsSending(false);
                  }}
                  className="h-9 w-9 rounded-md border border-white/[0.08] text-meta hover:text-white hover:bg-white/5 flex items-center justify-center"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!selectedSessionId || !draft.trim() || isBooting || isCreatingSession}
                  className="h-9 px-3 rounded-md bg-cyan text-black flex items-center gap-1.5 text-[12.5px] font-medium disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={1.8} /> Send
                </button>
              )}
            </form>
            {voice.message ? (
              <div className="mt-2 text-[12px] text-[hsl(216_11%_65%)]">{voice.message}</div>
            ) : null}
            <div className="flex items-center justify-between mt-3">
              <div className="label-meta">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </div>
              {footerNote ? <div className="label-meta text-cyan">{footerNote}</div> : null}
            </div>
          </div>
        </div>
      </div>

      {drawerOpen && contextPanel ? (
        <div className="w-[300px] shrink-0 border-l hairline p-5 overflow-y-auto">
          {contextPanel}
        </div>
      ) : null}
    </div>
  );
}
