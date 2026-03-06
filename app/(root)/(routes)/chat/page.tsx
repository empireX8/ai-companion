"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  BookmarkPlus,
  Brain,
  ChevronLeft,
  Clock3,
  PanelLeft,
  Copy,
  Globe,
  TextQuote,
  Link2,
  MessageSquare,
  RefreshCw,
  Square,
  Trash2,
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

const URL_REGEX = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/g;

function linkifyText(text: string) {
  const parts: Array<string | React.ReactElement> = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[0];
    const href = raw.startsWith("www.") ? `https://${raw}` : raw;
    parts.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="underline-offset-2 opacity-80 hover:underline hover:opacity-100"
      >
        {raw}
      </a>
    );
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

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

  type SendState = "idle" | "thinking" | "streaming" | "error";
  const [sendState, setSendState] = useState<SendState>("idle");
  const isSending = sendState !== "idle";
  const abortRef = useRef<AbortController | null>(null);
  const lastPayloadRef = useRef<string | null>(null);
  const failedAssistantIdRef = useRef<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const composerInputRef = useRef<HTMLInputElement>(null);

  type CaptureMode = "memory" | "ref" | "evidence";
  const [openCapture, setOpenCapture] = useState<{ id: string; mode: CaptureMode } | null>(null);
  const [captureText, setCaptureText] = useState("");
  const [captureUrl, setCaptureUrl] = useState("");
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureType, setCaptureType] = useState("preference");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureSuccess, setCaptureSuccess] = useState<Set<string>>(new Set());

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

  const cancelSend = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSendState("idle");
  }, []);

  const copyMessage = useCallback((id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 800);
    });
  }, []);

  const deleteMessage = useCallback((id: string) => {
    // If deleting the streaming assistant placeholder, cancel first
    if (isSending) cancelSend();
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, [cancelSend, isSending]);

  const insertLink = useCallback(() => {
    const url = linkInput.trim();
    if (!url || (!url.startsWith("http") && !url.startsWith("www."))) return;
    const normalised = url.startsWith("www.") ? `https://${url}` : url;
    const el = composerInputRef.current;
    if (el) {
      const start = el.selectionStart ?? content.length;
      const end = el.selectionEnd ?? content.length;
      const next = content.slice(0, start) + normalised + content.slice(end);
      setContent(next);
    } else {
      setContent((prev) => (prev ? `${prev} ${normalised}` : normalised));
    }
    setLinkInput("");
    setLinkOpen(false);
  }, [content, linkInput]);

  const openCapturePanel = useCallback(
    (messageId: string, mode: CaptureMode, msgContent: string) => {
      if (openCapture?.id === messageId && openCapture.mode === mode) {
        setOpenCapture(null);
        return;
      }
      setCaptureError(null);
      if (mode === "memory" || mode === "evidence") {
        // Pre-fill with selection if any, else full content
        const sel = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
        setCaptureText(sel && msgContent.includes(sel) ? sel : msgContent);
      } else {
        setCaptureText("");
      }
      if (mode === "ref") {
        URL_REGEX.lastIndex = 0;
        const m = URL_REGEX.exec(msgContent);
        const found = m ? (m[0].startsWith("www.") ? `https://${m[0]}` : m[0]) : "";
        setCaptureUrl(found);
        setCaptureTitle("");
      }
      setOpenCapture({ id: messageId, mode });
    },
    [openCapture]
  );

  const submitCapture = useCallback(
    async (message: ChatMessage) => {
      if (!openCapture) return;
      setCaptureLoading(true);
      setCaptureError(null);
      try {
        if (openCapture.mode === "memory") {
          const r = await fetch("/api/reference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              statement: captureText,
              type: captureType,
              confidence: "medium",
              sourceSessionId: sessionId ?? undefined,
              sourceMessageId: message.id.startsWith("temp-") ? undefined : message.id,
            }),
          });
          if (!r.ok) throw new Error(await r.text());
          void fetchSavedReferences();
        } else if (openCapture.mode === "ref") {
          const url = captureUrl.startsWith("www.") ? `https://${captureUrl}` : captureUrl;
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new Error("Please enter a valid URL starting with http(s)://");
          }
          const r = await fetch("/api/reference/from-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              title: captureTitle || undefined,
              sourceSessionId: sessionId ?? undefined,
              sourceMessageId: message.id.startsWith("temp-") ? undefined : message.id,
            }),
          });
          if (!r.ok) throw new Error(await r.text());
        } else if (openCapture.mode === "evidence") {
          if (message.id.startsWith("temp-")) throw new Error("Message not yet saved — try again after it finishes");
          const r = await fetch("/api/evidence/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: message.id, quote: captureText }),
          });
          if (!r.ok) throw new Error(await r.text());
        }
        setCaptureSuccess((prev) => new Set(prev).add(`${openCapture.id}:${openCapture.mode}`));
        setOpenCapture(null);
      } catch (e) {
        setCaptureError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setCaptureLoading(false);
      }
    },
    [openCapture, captureText, captureUrl, captureTitle, captureType, sessionId, fetchSavedReferences]
  );

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const trimmed = rawContent.trim();
      if (!trimmed || !sessionId || sendState !== "idle") {
        return;
      }

      lastPayloadRef.current = trimmed;
      const abort = new AbortController();
      abortRef.current = abort;

      setSendState("thinking");
      setError(null);
      failedAssistantIdRef.current = null;
      setIsUserScrolled(false);

      // Capture whether this is the first message before we update state
      const isFirstMessage = messages.length === 0;

      // Hoist temp IDs so they're accessible in catch
      const userTempId = createTempId();
      const assistantTempId = createTempId();

      try {
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, content: trimmed }),
          signal: abort.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response stream");
        }

        let firstChunk = true;
        try {
          while (true) {
            if (abort.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done || abort.signal.aborted) break;

            const chunk = decoder.decode(value, { stream: true });
            if (!chunk) continue;

            if (firstChunk) {
              setSendState("streaming");
              firstChunk = false;
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantTempId
                  ? { ...message, content: message.content + chunk }
                  : message
              )
            );
          }
        } catch (readErr) {
          if (!(readErr instanceof Error && readErr.name === "AbortError")) throw readErr;
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

        if (abort.signal.aborted) {
          setSendState("idle");
          return;
        }
        failedAssistantIdRef.current = null;
        setSendState("idle");
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
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled — leave streamed content, return to idle
          setSendState("idle");
          return;
        }
        failedAssistantIdRef.current = assistantTempId;
        setSendState("error");
        setError("Failed to send message.");
        try {
          await fetchMessages(sessionId);
          await fetchPendingCandidate(sessionId);
        } catch {
          // Keep original send error if resync also fails.
        }
      } finally {
        abortRef.current = null;
      }
    },
    [fetchMessages, fetchPendingCandidate, fetchSessions, messages.length, sendState, sessionId]
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
                          {!isUser && sendState === "thinking" && !message.content ? (
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
                              {linkifyText(message.content)}
                            </p>
                          )}
                        </div>
                        {/* Hover action bar */}
                        <div className={`mt-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${isUser ? "justify-end" : "justify-start"}`}>
                          {message.content && (
                            <button
                              type="button"
                              onClick={() => copyMessage(message.id, message.content)}
                              title="Copy"
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                            >
                              {copiedId === message.id
                                ? <span className="text-[10px] font-medium text-primary">✓</span>
                                : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteMessage(message.id)}
                            title="Delete"
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-accent hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {!isUser && sendState === "error" && failedAssistantIdRef.current === message.id && lastPayloadRef.current && (
                            <button
                              type="button"
                              onClick={() => void sendMessage(lastPayloadRef.current!)}
                              title="Retry"
                              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                          )}
                          {/* Capture buttons — assistant messages only */}
                          {!isUser && message.content && (
                            <>
                              {(["memory", "ref", "evidence"] as CaptureMode[]).map((mode) => {
                                const successKey = `${message.id}:${mode}`;
                                const saved = captureSuccess.has(successKey);
                                const active = openCapture?.id === message.id && openCapture.mode === mode;
                                const Icon = mode === "memory" ? BookmarkPlus : mode === "ref" ? Globe : TextQuote;
                                const label = mode === "memory" ? "Save to memory" : mode === "ref" ? "Save reference" : "Save evidence";
                                return (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => openCapturePanel(message.id, mode, message.content)}
                                    title={label}
                                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                                      active ? "bg-muted text-foreground" :
                                      saved ? "text-primary/70" :
                                      "text-muted-foreground/50 hover:bg-accent hover:text-foreground"
                                    }`}
                                  >
                                    {saved && !active ? <span className="text-[10px] font-medium text-primary">✓</span> : <Icon className="h-3 w-3" />}
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                        {/* Inline capture panel */}
                        {openCapture?.id === message.id && (
                          <div className="mt-2 w-full max-w-[90%] rounded-lg border border-border bg-card p-3 text-xs">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-semibold text-muted-foreground">
                                {openCapture.mode === "memory" ? "Save to memory" : openCapture.mode === "ref" ? "Save reference" : "Save evidence"}
                              </span>
                              <button type="button" onClick={() => setOpenCapture(null)} className="text-muted-foreground/60 hover:text-foreground">✕</button>
                            </div>
                            {(openCapture.mode === "memory" || openCapture.mode === "evidence") && (
                              <textarea
                                value={captureText}
                                onChange={(e) => setCaptureText(e.target.value)}
                                rows={3}
                                className="mb-2 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                              />
                            )}
                            {openCapture.mode === "memory" && (
                              <select
                                value={captureType}
                                onChange={(e) => setCaptureType(e.target.value)}
                                className="mb-2 w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                              >
                                {["preference", "goal", "constraint", "pattern", "rule", "assumption", "hypothesis"].map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            )}
                            {openCapture.mode === "ref" && (
                              <div className="mb-2 space-y-1.5">
                                <input
                                  type="url"
                                  value={captureUrl}
                                  onChange={(e) => setCaptureUrl(e.target.value)}
                                  placeholder="https://…"
                                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                                />
                                <input
                                  value={captureTitle}
                                  onChange={(e) => setCaptureTitle(e.target.value)}
                                  placeholder="Title (optional)"
                                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                                />
                              </div>
                            )}
                            {captureError && <p className="mb-2 text-destructive">{captureError}</p>}
                            <button
                              type="button"
                              onClick={() => void submitCapture(message)}
                              disabled={captureLoading}
                              className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-50 hover:opacity-90"
                            >
                              {captureLoading ? "Saving…" : "Save"}
                            </button>
                          </div>
                        )}
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
            {/* Status row */}
            <div className="mx-auto mb-1.5 flex w-full max-w-3xl items-center justify-between px-1">
              <span className="text-[11px] text-muted-foreground/60">
                {sendState === "thinking" ? "Thinking…" : sendState === "streaming" ? "Streaming…" : ""}
              </span>
            </div>
            {/* Link input row */}
            {linkOpen && (
              <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-1.5">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://…"
                  autoFocus
                  className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); insertLink(); }
                    if (e.key === "Escape") { setLinkOpen(false); setLinkInput(""); }
                  }}
                />
                <button
                  type="button"
                  onClick={insertLink}
                  className="text-xs font-medium text-primary hover:opacity-80"
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => { setLinkOpen(false); setLinkInput(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-xl border border-primary/40 bg-card/50 px-4 py-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-primary/60 focus-within:shadow-glow">
              <button
                type="button"
                onClick={() => setLinkOpen((v) => !v)}
                title="Insert link"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${linkOpen ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
              >
                <Link2 className="h-4 w-4" />
              </button>
              <input
                ref={composerInputRef}
                type="text"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Type a message…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                disabled={!sessionId || isSending || isCreatingSession}
              />
              {isSending ? (
                <button
                  type="button"
                  onClick={cancelSend}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-accent"
                  aria-label="Cancel"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!sessionId || isCreatingSession || content.trim().length === 0}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow-sm transition-all disabled:opacity-25 enabled:hover:opacity-90"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              )}
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
