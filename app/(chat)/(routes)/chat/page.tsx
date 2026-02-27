"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Brain,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Layers,
  Menu,
  MessageSquare,
  PanelLeft,
  Plus,
  Sparkles,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { MemoryPanel } from "./_components/memory-panel";
import { NowTray } from "./_components/now-tray";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { useProModal } from "@/hooks/use-pro-modal";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  label: string | null;
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

type TopContradiction = {
  id: string;
  title: string;
  type: string;
  status: string;
  recommendedRung: string | null;
  lastEvidenceAt: string | null;
  sideA: string;
  sideB: string;
};

type WeeklyAuditSummary = {
  weekStart: string;
  activeReferenceCount: number;
  openContradictionCount: number;
  contradictionDensity: number;
  stabilityProxy: number;
  preview?: boolean;
};

const SESSION_STORAGE_KEY = "double:lastSessionId";

const shortenId = (id: string) => {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
};

const createTempId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function ChatPage() {
  const proModal = useProModal();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const [sessionTab, setSessionTab] = useState<"native" | "imported">("native");
  const [importedSessions, setImportedSessions] = useState<ChatSession[]>([]);
  const [isLoadingImportedSessions, setIsLoadingImportedSessions] = useState(false);
  const [importedSessionsLoaded, setImportedSessionsLoaded] = useState(false);
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

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mobileNodesOpen, setMobileNodesOpen] = useState(false);
  const [mobileNowOpen, setMobileNowOpen] = useState(false);
  const [mobileMemoryOpen, setMobileMemoryOpen] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

  const [topContradictions, setTopContradictions] = useState<TopContradiction[]>([]);
  const [weeklyAudit, setWeeklyAudit] = useState<WeeklyAuditSummary | null>(null);
  const [isLoadingNow, setIsLoadingNow] = useState(false);

  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  // Tracks which sessionId has already had its scroll position restored this mount
  const didRestoreRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);

    try {
      const response = await fetch("/api/session/list", { method: "GET" });
      if (!response.ok) {
        throw new Error("Failed to load sessions");
      }

      const data = (await response.json()) as ChatSession[];
      setSessions(data);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const fetchImportedSessions = useCallback(async () => {
    setIsLoadingImportedSessions(true);
    try {
      const response = await fetch("/api/session/list?origin=imported", { method: "GET" });
      if (!response.ok) throw new Error("Failed to load imported sessions");
      const data = (await response.json()) as ChatSession[];
      setImportedSessions(data);
      setImportedSessionsLoaded(true);
    } finally {
      setIsLoadingImportedSessions(false);
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

  const fetchNowDashboard = useCallback(async () => {
    setIsLoadingNow(true);

    try {
      const [contradictionsResponse, weeklyAuditResponse] = await Promise.all([
        fetch("/api/contradiction?top=3&mode=read_only", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/audit/weekly", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      if (contradictionsResponse.ok) {
        const contradictionData = (await contradictionsResponse.json()) as TopContradiction[];
        setTopContradictions(contradictionData);
      } else {
        setTopContradictions([]);
      }

      if (weeklyAuditResponse.ok) {
        const auditData = (await weeklyAuditResponse.json()) as WeeklyAuditSummary;
        setWeeklyAudit(auditData);
      } else {
        setWeeklyAudit(null);
      }
    } catch {
      setTopContradictions([]);
      setWeeklyAudit(null);
    } finally {
      setIsLoadingNow(false);
    }
  }, []);

  const setActiveSession = useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    setSelectedSessionId(nextSessionId);
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    const el = messageScrollRef.current;
    if (!el) {
      return;
    }

    if (!force && isUserScrolled) {
      return;
    }

    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
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
        await fetchNowDashboard();
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
    fetchNowDashboard,
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

  useEffect(() => {
    void fetchNowDashboard();
    const intervalId = window.setInterval(() => {
      void fetchNowDashboard();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchNowDashboard]);

  const shortSessionId = useMemo(() => {
    if (!sessionId) {
      return "...";
    }
    return shortenId(sessionId);
  }, [sessionId]);
  const desktopGridColumns = useMemo(
    () =>
      `${leftCollapsed ? "3.5rem" : "18rem"} minmax(0, 1fr) ${
        rightCollapsed ? "2.75rem" : "20rem"
      }`,
    [leftCollapsed, rightCollapsed]
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
        await fetchNowDashboard();
        setContent("");
        setMobileMemoryOpen(false);
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
    [fetchMessages, fetchNowDashboard, fetchPendingCandidate, isSending, sessionId]
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

  const renderNowSummary = () => (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-background p-3">
        <p className="font-display text-[10px] uppercase tracking-wider text-text-dim">This week</p>
        {weeklyAudit ? (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-border p-2">
              <p className="text-text-dim">Active refs</p>
              <p className="font-semibold text-foreground">{weeklyAudit.activeReferenceCount}</p>
            </div>
            <div className="rounded border border-border p-2">
              <p className="text-text-dim">Open tensions</p>
              <p className="font-semibold text-foreground">{weeklyAudit.openContradictionCount}</p>
            </div>
            <div className="rounded border border-border p-2">
              <p className="text-text-dim">Density</p>
              <p className="font-semibold text-foreground">
                {weeklyAudit.contradictionDensity.toFixed(2)}
              </p>
            </div>
            <div className="rounded border border-border p-2">
              <p className="text-text-dim">Stability</p>
              <p className="font-semibold text-foreground">{weeklyAudit.stabilityProxy.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No weekly audit yet.</p>
        )}
        <Link
          href="/audit"
          className="mt-2 inline-flex text-xs text-primary transition-opacity hover:opacity-80"
        >
          Open full audit
        </Link>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
        <p className="font-display text-[10px] uppercase tracking-wider text-text-dim">
          Top contradictions
        </p>
        <NowTray
          items={topContradictions}
          onActionComplete={fetchNowDashboard}
          onNavigate={saveScrollPosition}
        />
      </div>
    </div>
  );

  const renderNodesTools = (collapsed: boolean) => (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        {!collapsed ? (
          <>
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
              Nodes and tools
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Pull context, then continue chat.</p>
          </>
        ) : (
          <div className="flex justify-center">
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">Contradictions (Top 3)</p>
              {isLoadingNow ? (
                <p className="mt-1 text-xs text-muted-foreground">Loading...</p>
              ) : topContradictions.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">None yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {topContradictions.map((node) => (
                    <li key={node.id} className="rounded border border-border p-2">
                      <p className="line-clamp-1 text-xs text-text-dim">[{node.type}] {node.status}</p>
                      <p className="line-clamp-2 text-sm text-foreground">{node.title}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/contradictions"
                className="mt-2 inline-flex text-xs text-primary transition-opacity hover:opacity-80"
              >
                Open contradiction list
              </Link>
            </div>

            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">References and memory</p>
              <p className="mt-1 text-xs text-muted-foreground">Read-only node list.</p>
              <Link
                href="/references"
                className="mt-2 inline-flex text-xs text-primary transition-opacity hover:opacity-80"
              >
                Open reference list
              </Link>
            </div>

            <div className="rounded-md border border-border bg-background p-3">
              <Link href="/audit" className="text-sm text-primary transition-opacity hover:opacity-80">
                Weekly audit
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">Facts-only weekly trend.</p>
              <Link
                href="/import"
                className="mt-2 inline-flex text-xs text-primary transition-opacity hover:opacity-80"
              >
                Import chat export
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setMobileSessionsOpen(true)}
            className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Open sessions
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderSessionsList = () => (
    <div className="flex h-full flex-col">
      {/* Tab strip */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setSessionTab("native")}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            sessionTab === "native"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Sessions
        </button>
        <button
          type="button"
          onClick={() => {
            setSessionTab("imported");
            if (!importedSessionsLoaded) void fetchImportedSessions();
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            sessionTab === "imported"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          Imported archive
        </button>
      </div>

      {sessionTab === "native" ? (
        <>
          <div className="border-b border-border p-2">
            <button
              type="button"
              onClick={() => void onCreateNewSession()}
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
                        onClick={() => void onSelectSession(session.id)}
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
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingImportedSessions ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Loading imported sessions...</p>
          ) : importedSessions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No imported sessions. Import your ChatGPT history to see them here.
            </p>
          ) : (
            <ul className="space-y-1">
              {importedSessions.map((session) => {
                const isActive = selectedSessionId === session.id;
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => void onSelectSession(session.id)}
                      className={`flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-sidebar-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    >
                      <Archive
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
      )}
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileNodesOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            href="/"
            className="font-display text-xs font-semibold uppercase tracking-wider text-foreground transition-opacity hover:opacity-80"
          >
            Double
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileNowOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <Clock3 className="h-5 w-5" />
          </button>
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
        className="hidden h-12 border-b border-border/60 md:grid"
        style={{ gridTemplateColumns: desktopGridColumns }}
      >
        <div className="flex items-center justify-between border-r border-border/60 bg-sidebar px-4">
          <Link
            href="/"
            className="font-display text-xs font-semibold uppercase tracking-wider text-foreground transition-opacity hover:opacity-80"
          >
            Double
          </Link>
          <button
            type="button"
            onClick={() => setLeftCollapsed((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {leftCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between bg-background px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-display text-[10px] uppercase tracking-[0.2em] text-text-dim">
              Session
            </span>
            <span className="truncate font-mono text-sm text-foreground">{shortSessionId}</span>
          </div>

          <div className="flex items-center gap-2">
            {rightCollapsed ? (
              <button
                type="button"
                onClick={() => setRightCollapsed(false)}
                className="hidden items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground lg:flex"
              >
                <PanelLeft className="h-3.5 w-3.5" />
                Memory
              </button>
            ) : null}
            <Button size="sm" variant="premium" onClick={proModal.onOpen} className="h-8 px-2 text-xs">
              Upgrade
              <Sparkles className="ml-1 h-3.5 w-3.5 fill-white text-white" />
            </Button>
            <button
              type="button"
              onClick={() => setMobileSessionsOpen(true)}
              className="hidden items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground lg:flex"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Sessions
            </button>
            <button
              type="button"
              onClick={() => setMobileNowOpen(true)}
              className="hidden items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground lg:flex"
            >
              <Clock3 className="h-3.5 w-3.5" />
              Now
            </button>
            <ModeToggle />
            {rightCollapsed ? <UserButton /> : null}
          </div>
        </div>

        <div className="flex items-center justify-between border-l border-border/60 bg-sidebar px-4">
          {rightCollapsed ? (
            <button
              type="button"
              onClick={() => setRightCollapsed(false)}
              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Open memory"
            >
              <Brain className="h-4 w-4 text-primary" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
                  Memory
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRightCollapsed(true)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Close
                </button>
                <UserButton />
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 overflow-hidden md:grid"
        style={{ gridTemplateColumns: desktopGridColumns }}
      >
        <aside
          className="hidden min-h-0 border-r border-border/60 bg-sidebar md:flex md:flex-col"
        >
          {renderNodesTools(leftCollapsed)}
        </aside>

        <section className="flex min-w-0 flex-1 min-h-0 flex-col bg-background">
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
                <ul className="space-y-3">
                  {messages.map((message) => (
                    <li key={message.id} className="rounded border border-border bg-card p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {message.role}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {message.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
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

          <form onSubmit={onSubmit} className="shrink-0 border-t border-border/60 bg-background px-4 py-3">
            <div className="mx-auto flex w-full max-w-3xl gap-2">
              <input
                type="text"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Type a message"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={!sessionId || isSending || isCreatingSession}
              />
              <button
                type="submit"
                disabled={!sessionId || isSending || isCreatingSession || content.trim().length === 0}
                className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </section>

        {rightCollapsed ? (
          <button
            type="button"
            onClick={() => setRightCollapsed(false)}
            className="hidden min-h-0 h-full shrink-0 flex-col items-center justify-start border-l border-border/60 bg-sidebar pt-4 transition-colors hover:bg-accent md:flex"
          >
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="mt-3 font-display text-[9px] uppercase tracking-widest text-text-dim [writing-mode:vertical-rl]">
              Memory
            </span>
          </button>
        ) : (
          <aside className="hidden min-h-0 shrink-0 flex-col border-l border-border/60 bg-sidebar md:flex">
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
            />
          </aside>
        )}
      </div>

      <Sheet open={mobileNodesOpen} onOpenChange={setMobileNodesOpen}>
        <SheetContent side="left" className="w-72 border-r border-border bg-sidebar p-0 [&>button]:hidden">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
                Nodes and tools
              </h2>
              <button
                type="button"
                onClick={() => setMobileNodesOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            {renderNodesTools(false)}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={mobileNowOpen} onOpenChange={setMobileNowOpen}>
        <SheetContent side="top" className="h-[70vh] border-b border-border bg-sidebar p-0 [&>button]:hidden">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
                Now
              </h2>
              <button
                type="button"
                onClick={() => setMobileNowOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{renderNowSummary()}</div>
          </div>
        </SheetContent>
      </Sheet>

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
            {renderSessionsList()}
          </div>
        </SheetContent>
      </Sheet>

      {error ? <p className="border-t border-border px-4 py-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
