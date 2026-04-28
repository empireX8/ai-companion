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
  Link2,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { CHAT_EVENTS } from "@/components/command/chatEvents";
import { UserButton } from "@clerk/nextjs";

import { MemoryPanel } from "./_components/memory-panel";
import { SessionListPanel } from "./_components/SessionListPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { TopBarSlot } from "@/components/layout/TopBarSlot";
import { useDomainListPanel } from "@/components/layout/DomainListContext";
import { ChatContextDrawer } from "@/components/chat/ChatContextDrawer";
import { createOnceGuard, resolveChatBootstrapSession } from "@/lib/chat-session-bootstrap";
import {
  buildAppSessionCreateRequestInit,
  buildAppSessionListUrl,
  buildChatSurfaceSwitcherItems,
  type SessionSurfaceType,
} from "@/lib/chat-surface-routing";

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

type ChatSurfaceProps = {
  surfaceType?: SessionSurfaceType | null;
  sessionStorageKey?: string;
  switcherMode?: "chat-query" | "route-aliases";
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

type SavedMemory = {
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

type PendingMemory = {
  id: string;
  type: ReferenceType;
  confidence: ReferenceConfidence;
  statement: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  supersedesId: string | null;
  supersedesStatement?: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

const DEFAULT_SESSION_STORAGE_KEY = "double:lastSessionId";


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

// ── Model switcher ───────────────────────────────────────────────────────────
const ALLOWED_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];
const MODEL_KEY = "double:model";

// ── Response mode ─────────────────────────────────────────────────────────────
type ResponseMode = "standard" | "deep";
const RESPONSE_MODES: ResponseMode[] = ["standard", "deep"];
const RESPONSE_MODE_KEY = "double:response-mode";

// ── Voice recognition ────────────────────────────────────────────────────────
type VoiceRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [i: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};
type VoiceRecognitionCtor = { new(): VoiceRecognitionLike };
function getSpeechRecognition(): VoiceRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as { SpeechRecognition?: VoiceRecognitionCtor; webkitSpeechRecognition?: VoiceRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── Response cache (sessionStorage, 5-min TTL) ───────────────────────────────
const CACHE_TTL = 5 * 60 * 1000;
function buildCacheKey(payload: string): string {
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h * 33) ^ payload.charCodeAt(i)) >>> 0;
  return `double:cache:${h.toString(36)}`;
}
function cacheGet(key: string): string | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw) as { text: string; ts: number };
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return text;
  } catch { return null; }
}
function cacheSet(key: string, text: string): void {
  try { sessionStorage.setItem(key, JSON.stringify({ text, ts: Date.now() })); } catch { /* quota */ }
}

export function ChatSurface({
  surfaceType = null,
  sessionStorageKey = DEFAULT_SESSION_STORAGE_KEY,
  switcherMode = "route-aliases",
}: ChatSurfaceProps) {
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
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  type CaptureMode = "memory" | "ref";
  const [openCapture, setOpenCapture] = useState<{ id: string; mode: CaptureMode } | null>(null);
  const [captureText, setCaptureText] = useState("");
  const [captureUrl, setCaptureUrl] = useState("");
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureType, setCaptureType] = useState("preference");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureSuccess, setCaptureSuccess] = useState<Set<string>>(new Set());
  const [captureSuccessMsg, setCaptureSuccessMsg] = useState<{ id: string; mode: CaptureMode } | null>(null);
  // D-14: governance card action state
  const [governanceBusy, setGovernanceBusy] = useState(false);

  // Model switcher
  const [selectedModel, setSelectedModel] = useState<AllowedModel>(() => {
    if (typeof window === "undefined") return "gpt-4o-mini";
    const stored = localStorage.getItem(MODEL_KEY);
    return (ALLOWED_MODELS as readonly string[]).includes(stored ?? "")
      ? (stored as AllowedModel)
      : "gpt-4o-mini";
  });

  // Response mode — stable SSR default, hydrated from localStorage after mount
  const [selectedResponseMode, setSelectedResponseMode] = useState<ResponseMode>("standard");

  // Voice input
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<VoiceRecognitionLike | null>(null);
  const voiceBaseTextRef = useRef<string>("");
  const voiceFinalTranscriptRef = useRef<string>("");

  const [referenceStatement, setReferenceStatement] = useState("");
  const [referenceType, setReferenceType] = useState<ReferenceType>("preference");
  const [referenceConfidence, setReferenceConfidence] =
    useState<ReferenceConfidence>("medium");
  const [savedReferences, setSavedReferences] = useState<SavedMemory[]>([]);
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
  const [pendingCandidate, setPendingCandidate] = useState<PendingMemory>(null);

  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [mobileMemoryOpen, setMobileMemoryOpen] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Tracks which sessionId has already had its scroll position restored this mount
  const didRestoreRef = useRef<string | null>(null);
  // Guards against duplicate session creation when the bootstrap effect fires
  // more than once concurrently (e.g. React Strict Mode double-invocation).
  const bootstrapCreateOnceRef = useRef<(() => Promise<string>) | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(buildAppSessionListUrl(surfaceType), { method: "GET" });
      if (!response.ok) {
        throw new Error("Failed to load sessions");
      }

      return (await response.json()) as ChatSession[];
    } catch (error) {
      throw error;
    }
  }, [surfaceType]);

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);

    try {
      const data = await loadSessions();
      setSessions(data);
      return data;
    } finally {
      setIsLoadingSessions(false);
    }
  }, [loadSessions]);

  const loadMessages = useCallback(async (activeSessionId: string) => {
    const response = await fetch(
      `/api/message/list?sessionId=${encodeURIComponent(activeSessionId)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      throw new Error("Failed to load messages");
    }

    return (await response.json()) as ChatMessage[];
  }, []);

  const fetchMessages = useCallback(async (activeSessionId: string) => {
    const data = await loadMessages(activeSessionId);
    setMessages(data);
    return data;
  }, [loadMessages]);

  const createSession = useCallback(async () => {
    const response = await fetch(
      "/api/session",
      buildAppSessionCreateRequestInit(surfaceType)
    );
    if (!response.ok) {
      throw new Error("Failed to create session");
    }

    const data = (await response.json()) as { sessionId: string };
    return data.sessionId;
  }, [surfaceType]);

  const loadSavedReferences = useCallback(async () => {
    const response = await fetch("/api/reference/list", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load saved memory");
    }

    return (await response.json()) as SavedMemory[];
  }, []);

  const fetchSavedReferences = useCallback(async () => {
    const data = await loadSavedReferences();
    setSavedReferences(data);
    return data;
  }, [loadSavedReferences]);

  const loadPendingCandidate = useCallback(async (activeSessionId: string) => {
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

    return (await response.json()) as PendingMemory;
  }, []);

  const fetchPendingCandidate = useCallback(async (activeSessionId: string) => {
    const data = await loadPendingCandidate(activeSessionId);
    setPendingCandidate(data);
    return data;
  }, [loadPendingCandidate]);

  const setActiveSession = useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    setSelectedSessionId(nextSessionId);
    window.localStorage.setItem(sessionStorageKey, nextSessionId);
  }, [sessionStorageKey]);

  const clearStoredSessionSelection = useCallback(() => {
    setSessionId(null);
    setSelectedSessionId(null);
    window.localStorage.removeItem(sessionStorageKey);
  }, [sessionStorageKey]);

  const scrollToBottom = useCallback((force = false) => {
    if (!force && isUserScrolled) return;
    const el = messageScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isUserScrolled]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Ensure concurrent effect executions (e.g. React Strict Mode) share
        // a single in-flight session-creation promise so at most one POST fires.
        if (!bootstrapCreateOnceRef.current) {
          bootstrapCreateOnceRef.current = createOnceGuard(createSession);
        }
        const resolution = await resolveChatBootstrapSession({
          storedSessionId: window.localStorage.getItem(sessionStorageKey),
          fetchSessions: loadSessions,
          createSession: bootstrapCreateOnceRef.current,
        });

        if (!isMounted) {
          return;
        }

        if (resolution.clearedStaleSelection) {
          clearStoredSessionSelection();
        }

        const [messagesData, savedReferencesData, pendingCandidateData] = await Promise.all([
          loadMessages(resolution.activeSessionId),
          loadSavedReferences(),
          loadPendingCandidate(resolution.activeSessionId),
        ]);

        if (!isMounted) {
          return;
        }

        setSessions(resolution.sessions);
        setMessages(messagesData);
        setSavedReferences(savedReferencesData);
        setPendingCandidate(pendingCandidateData);
        setActiveSession(resolution.activeSessionId);
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
    clearStoredSessionSelection,
    createSession,
    loadMessages,
    loadPendingCandidate,
    loadSavedReferences,
    loadSessions,
    sessionStorageKey,
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

        const data = (await response.json()) as PendingMemory;
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

  // Detect voice support once on mount
  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  // Hydrate response mode from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(RESPONSE_MODE_KEY);
    if ((RESPONSE_MODES as string[]).includes(stored ?? "")) {
      setSelectedResponseMode(stored as ResponseMode);
    }
  }, []);

  // Persist response mode changes
  useEffect(() => {
    localStorage.setItem(RESPONSE_MODE_KEY, selectedResponseMode);
  }, [selectedResponseMode]);

  // Stop recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

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
  const surfaceSwitcherItems = useMemo(
    () => buildChatSurfaceSwitcherItems(surfaceType, switcherMode),
    [surfaceType, switcherMode]
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

  // Stable ref — avoids listing onCreateNewSession as an effect dep (it changes every render)
  const onCreateNewSessionRef = useRef(onCreateNewSession);
  onCreateNewSessionRef.current = onCreateNewSession;

  // Listen for command-palette chat actions
  useEffect(() => {
    const handlers: [string, () => void][] = [
      [CHAT_EVENTS.NEW_SESSION, () => void onCreateNewSessionRef.current()],
      [CHAT_EVENTS.FOCUS_COMPOSER, () => composerInputRef.current?.focus()],
      [CHAT_EVENTS.TOGGLE_MEMORY, () => setRightCollapsed((v) => !v)],
      [CHAT_EVENTS.TOGGLE_SESSIONS, () => toggleSessionsPanel()],
      [CHAT_EVENTS.TOGGLE_CONTEXT, () => setContextOpen((v) => !v)],
    ];
    for (const [evt, fn] of handlers) window.addEventListener(evt, fn as EventListener);
    return () => { for (const [evt, fn] of handlers) window.removeEventListener(evt, fn as EventListener); };
  }, [toggleSessionsPanel]);

  const cancelSend = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSendState("idle");
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = composerInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Resize when content changes (covers voice-driven updates)
  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  const toggleVoice = useCallback(() => {
    if (voiceListening) {
      recognitionRef.current?.stop();
      // onend will finalize content and clear listening state
      return;
    }
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    // Snapshot what's in the composer at mic-start
    voiceBaseTextRef.current = content;
    voiceFinalTranscriptRef.current = "";

    rec.onresult = (ev) => {
      let newFinal = "";
      let newInterim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          newFinal += text;
        } else {
          newInterim += text;
        }
      }
      if (newFinal) {
        voiceFinalTranscriptRef.current += (voiceFinalTranscriptRef.current ? " " : "") + newFinal.trim();
      }
      const base = voiceBaseTextRef.current;
      const finalPart = voiceFinalTranscriptRef.current;
      const interimPart = newInterim.trim();
      let next = base;
      if (finalPart) next += (next ? " " : "") + finalPart;
      if (interimPart) next += (next ? " " : "") + interimPart;
      setContent(next);
    };
    rec.onend = () => {
      // Commit — keep whatever is currently in content (final + interim merged)
      setVoiceListening(false);
    };
    rec.onerror = () => setVoiceListening(false);
    recognitionRef.current = rec;
    rec.start();
    setVoiceListening(true);
  }, [voiceListening, content]);

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
      if (mode === "memory") {
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
        }
        setCaptureSuccess((prev) => new Set(prev).add(`${openCapture.id}:${openCapture.mode}`));
        setCaptureSuccessMsg({ id: openCapture.id, mode: openCapture.mode });
        setTimeout(() => setCaptureSuccessMsg(null), 2500);
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

      const t0 = performance.now();
      const reqId = Math.random().toString(36).slice(2, 9);
      console.debug(`[CHAT_TIMING_CLIENT][${reqId}] submit_click mode=${selectedResponseMode}`, 0);

      lastPayloadRef.current = trimmed;

      // Check response cache (client-side, sessionStorage, 5-min TTL)
      // Key covers full conversation context so the same text at different points in the
      // session won't collide.
      const cachePayload = JSON.stringify({
        model: selectedModel,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: trimmed },
        ],
      });
      const ck = buildCacheKey(cachePayload);
      const cached = cacheGet(ck);
      if (cached) {
        const now = new Date().toISOString();
        setMessages((current) => [
          ...current,
          { id: createTempId(), role: "user", content: trimmed, createdAt: now },
          { id: createTempId(), role: "assistant", content: cached, createdAt: now },
        ]);
        setContent("");
        setIsUserScrolled(false);
        return;
      }

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

        console.debug(`[CHAT_TIMING_CLIENT][${reqId}] fetch_start`, +(performance.now() - t0).toFixed(1));
        const response = await fetch("/api/message", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-request-id": reqId },
          body: JSON.stringify({ sessionId, content: trimmed, model: selectedModel, responseMode: selectedResponseMode }),
          signal: abort.signal,
        });
        console.debug(`[CHAT_TIMING_CLIENT][${reqId}] headers_received`, +(performance.now() - t0).toFixed(1));

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response stream");
        }

        let firstChunk = true;
        let accumulated = "";
        try {
          while (true) {
            if (abort.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done || abort.signal.aborted) break;

            const chunk = decoder.decode(value, { stream: true });
            if (!chunk) continue;

            if (firstChunk) {
              console.debug(`[CHAT_TIMING_CLIENT][${reqId}] first_chunk`, +(performance.now() - t0).toFixed(1));
              setSendState("streaming");
              firstChunk = false;
            }

            accumulated += chunk;
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
          accumulated += remaining;
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
        console.debug(`[CHAT_TIMING_CLIENT][${reqId}] stream_complete`, +(performance.now() - t0).toFixed(1));
        // Write successful response to cache
        if (accumulated) cacheSet(ck, accumulated);
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
    [fetchMessages, fetchPendingCandidate, fetchSessions, messages, selectedModel, selectedResponseMode, sendState, sessionId]
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

  const onStartEditReference = (item: SavedMemory) => {
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

      setReferenceStatus("Removed.");
      await fetchSavedReferences();
    } catch {
      setReferenceStatus("Failed to remove.");
    } finally {
      setDeactivatingReferenceId(null);
    }
  };

  const onStartSupersedeReference = (item: SavedMemory) => {
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
          MindLab
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
          {surfaceSwitcherItems.length > 0 ? (
            <div className="shrink-0 border-b border-border/50 bg-background/80 px-4 py-2">
              <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                  Chat Mode
                </p>
                <div
                  className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5"
                  role="tablist"
                  aria-label="Chat surface mode"
                >
                  {surfaceSwitcherItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="tab"
                      aria-selected={item.isActive}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${
                        item.isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {/* Context tuck-down panel — vertical animation, no horizontal shift */}
          <ChatContextDrawer isOpen={contextOpen} onClose={() => setContextOpen(false)} />
          <div
            ref={messageScrollRef}
            onScroll={onMessageScroll}
            className="relative flex-1 min-h-0 overflow-y-auto px-4"
          >
            <div className="mx-auto w-full max-w-3xl py-4">
              {pendingCandidate ? (
                <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Memory update candidate</p>
                  <p className="mt-1 text-xs text-foreground">
                    Update <span className="font-medium">{pendingCandidate.type}</span> to:
                  </p>
                  <p className="mt-0.5 text-xs italic text-muted-foreground">
                    &ldquo;{pendingCandidate.statement}&rdquo;
                  </p>
                  {pendingCandidate.supersedesId && (
                    <p className="mt-1 text-[11px] text-amber-500/80">
                      Would replace:{" "}
                      <span className="italic">
                        {pendingCandidate.supersedesStatement ?? "an existing memory"}
                      </span>
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={governanceBusy}
                      onClick={async () => {
                        setGovernanceBusy(true);
                        try {
                          await fetch(`/api/reference/${pendingCandidate.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "confirm_governance" }),
                          });
                          setPendingCandidate(null);
                        } catch { /* silent */ } finally { setGovernanceBusy(false); }
                      }}
                      className="rounded border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={governanceBusy}
                      onClick={async () => {
                        setGovernanceBusy(true);
                        try {
                          await fetch(`/api/reference/${pendingCandidate.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "dismiss_governance" }),
                          });
                          setPendingCandidate(null);
                        } catch { /* silent */ } finally { setGovernanceBusy(false); }
                      }}
                      className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}

              {isLoadingSession ? (
                <p className="text-sm text-muted-foreground">Loading session…</p>
              ) : error && messages.length === 0 ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <p className="text-sm font-medium text-foreground">Start a conversation</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Suggestions stay as candidates until you confirm them — nothing is saved without your approval.
                  </p>
                  <div className="mt-5 flex flex-col items-center gap-2">
                    {[
                      "Help me think through a decision I'm stuck on",
                      "Remember this constraint for future chats",
                    ].map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => {
                          setContent(starter);
                          composerInputRef.current?.focus();
                        }}
                        className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/help"
                    className="mt-4 text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Learn how it works →
                  </Link>
                </div>
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
                              {(["memory", "ref"] as CaptureMode[]).map((mode) => {
                                const successKey = `${message.id}:${mode}`;
                                const saved = captureSuccess.has(successKey);
                                const active = openCapture?.id === message.id && openCapture.mode === mode;
                                const Icon = mode === "memory" ? BookmarkPlus : Globe;
                                const label = mode === "memory" ? "Save to memory" : "Save source";
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
                              {captureSuccessMsg?.id === message.id && (
                                <span className="ml-1 text-[10px] font-medium text-primary">
                                  {captureSuccessMsg.mode === "memory" ? "Saved to memory" : "Saved as source"}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {/* Inline capture panel */}
                        {openCapture?.id === message.id && (
                          <div className="mt-2 w-full max-w-[90%] rounded-lg border border-border bg-card p-3 text-xs">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-semibold text-muted-foreground">
                                {openCapture.mode === "memory" ? "Save to memory" : "Save source"}
                              </span>
                              <button type="button" onClick={() => setOpenCapture(null)} className="text-muted-foreground/60 hover:text-foreground">✕</button>
                            </div>
                            {openCapture.mode === "memory" && (
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
                {sendState === "thinking"
                  ? "Thinking…"
                  : sendState === "streaming"
                  ? "Responding…"
                  : ""}
              </span>
              <div className="flex items-center gap-2">
                {/* Response mode segmented control */}
                <div
                  className="flex rounded border border-border/40 overflow-hidden"
                  title="Standard: faster, lighter responses. Deep: broader context, more deliberate reasoning."
                >
                  {RESPONSE_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={isSending}
                      onClick={() => {
                        setSelectedResponseMode(mode);
                      }}
                      title={mode === "standard" ? "Standard: faster, lighter responses" : "Deep: broader context, more deliberate reasoning"}
                      className={`px-2 py-0.5 text-[11px] transition-colors disabled:opacity-40 ${
                        selectedResponseMode === mode
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground/60 hover:text-muted-foreground"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                {/* Model switcher */}
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const m = e.target.value as AllowedModel;
                    setSelectedModel(m);
                    localStorage.setItem(MODEL_KEY, m);
                  }}
                  disabled={isSending}
                  className="rounded border border-border/40 bg-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground/60 focus:outline-none disabled:opacity-40"
                >
                  {ALLOWED_MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* URL input row (secondary) */}
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
            {/* File chips */}
            {attachedFiles.length > 0 && (
              <div className="mx-auto mb-2 flex w-full max-w-3xl flex-wrap gap-1.5">
                {attachedFiles.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                    {f.name}
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 opacity-60 hover:opacity-100"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <span className="self-center text-[10px] text-muted-foreground/60">
                  Attached files are not included in the message yet.
                </span>
              </div>
            )}
            {/* Hidden file picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setAttachedFiles((prev) => [...prev, ...files]);
                e.target.value = "";
              }}
            />
            <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-xl border border-primary/40 bg-card/50 px-4 py-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-primary/60 focus-within:shadow-glow">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors text-muted-foreground/40 hover:text-muted-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setLinkOpen((v) => !v)}
                title="Insert URL"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${linkOpen ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
              >
                <Link2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleVoice}
                disabled={!voiceSupported}
                title={voiceListening ? "Stop listening" : "Voice input"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${
                  voiceListening
                    ? "animate-pulse text-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                } disabled:opacity-25`}
              >
                <Mic className="h-4 w-4" />
              </button>
              <textarea
                ref={composerInputRef}
                rows={1}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isSending && sessionId && !isCreatingSession && content.trim()) {
                      void sendMessage(content);
                    }
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 resize-none overflow-y-auto bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none max-h-40"
                style={{ height: "auto" }}
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
