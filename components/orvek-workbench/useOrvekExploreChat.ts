"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildAppSessionCreateRequestInit,
  buildAppSessionListUrl,
} from "@/lib/chat-surface-routing";
import {
  bootstrapExploreChatSession,
  type OrvekExploreMessage,
  type OrvekExploreSession,
} from "@/lib/explore-chat-bootstrap";
import { isExploreGroundingPayload } from "@/lib/explore-grounding-contract";
import {
  refreshExploreSessionMovement,
  setExploreSessionBridgeSessionId,
} from "@/lib/explore-session-bridge";

export type { OrvekExploreMessage, OrvekExploreSession };

const EXPLORE_SURFACE_TYPE = "explore_chat" as const;
export const EXPLORE_CHAT_STORAGE_KEY = "mindlabs:explore:session-id";
const MAX_EXPLORE_CHAT_BOOT_ATTEMPTS = 12;
const EXPLORE_CHAT_BOOT_RETRY_MS = 500;

function buildTempId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useOrvekExploreChat(options?: {
  enabled?: boolean;
  onActiveSessionIdChange?: (sessionId: string | null) => void;
  onConversationUpdated?: () => void;
}) {
  const [sessions, setSessions] = useState<OrvekExploreSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OrvekExploreMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bootAttemptRef = useRef(0);
  const bootRunIdRef = useRef(0);
  const enabled = options?.enabled ?? true;
  const onActiveSessionIdChange = options?.onActiveSessionIdChange;
  const onConversationUpdated = options?.onConversationUpdated;

  useEffect(() => {
    onActiveSessionIdChange?.(selectedSessionId);
    setExploreSessionBridgeSessionId(selectedSessionId);
  }, [onActiveSessionIdChange, selectedSessionId]);

  const persistSessionSelection = useCallback((sessionId: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (!sessionId) {
        window.localStorage.removeItem(EXPLORE_CHAT_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(EXPLORE_CHAT_STORAGE_KEY, sessionId);
    } catch {
      // Ignore storage failures; in-memory state still works.
    }
  }, []);

  const loadSessions = useCallback(async (): Promise<OrvekExploreSession[]> => {
    const response = await fetch(buildAppSessionListUrl(EXPLORE_SURFACE_TYPE), {
      method: "GET",
      cache: "no-store",
    });

    if (response.status === 401) {
      throw new Error("Please sign in to view sessions.");
    }

    if (!response.ok) {
      throw new Error("Could not load sessions. The server may be unavailable.");
    }

    return (await response.json()) as OrvekExploreSession[];
  }, []);

  const normalizeLoadedMessages = useCallback(
    (raw: Array<Record<string, unknown>>): OrvekExploreMessage[] => {
      return raw.map((row) => {
        const groundingRaw = row.grounding;
        return {
          id: String(row.id),
          role: row.role === "assistant" ? "assistant" : "user",
          content: String(row.content ?? ""),
          createdAt:
            typeof row.createdAt === "string"
              ? row.createdAt
              : new Date(String(row.createdAt ?? Date.now())).toISOString(),
          grounding: isExploreGroundingPayload(groundingRaw) ? groundingRaw : null,
        };
      });
    },
    []
  );

  const loadMessages = useCallback(async (sessionId: string): Promise<OrvekExploreMessage[]> => {
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

    const raw = (await response.json()) as Array<Record<string, unknown>>;
    return normalizeLoadedMessages(raw);
  }, [normalizeLoadedMessages]);

  const createSession = useCallback(async (): Promise<string> => {
    const response = await fetch(
      "/api/session",
      buildAppSessionCreateRequestInit(EXPLORE_SURFACE_TYPE)
    );

    if (response.status === 401) {
      throw new Error("Please sign in to create a session.");
    }

    if (!response.ok) {
      throw new Error("Could not create session. The server may be unavailable.");
    }

    const payload = (await response.json()) as { sessionId: string };
    return payload.sessionId;
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const nextSessions = await loadSessions();
      setSessions(nextSessions);
    } catch {
      // Keep current list if refresh fails.
    }
  }, [loadSessions]);

  useEffect(() => {
    if (!enabled) {
      setIsBooting(false);
      setErrorMessage(null);
      return;
    }

    setIsBooting(true);
  }, [enabled]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const initializeExploreChat = useCallback(async (): Promise<boolean> => {
    if (!enabled) {
      setIsBooting(false);
      setErrorMessage(null);
      return false;
    }

    const runId = ++bootRunIdRef.current;

    if (bootAttemptRef.current >= MAX_EXPLORE_CHAT_BOOT_ATTEMPTS) {
      setIsBooting(false);
      return false;
    }

    bootAttemptRef.current += 1;
    setIsBooting(true);
    setErrorMessage(null);

    try {
      const storedSessionId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(EXPLORE_CHAT_STORAGE_KEY)
          : null;

      const bootstrapped = await bootstrapExploreChatSession({
        loadSessions,
        createSession,
        loadMessages,
        storedSessionId,
      });
      if (runId !== bootRunIdRef.current) {
        return false;
      }

      setSessions(bootstrapped.sessions);
      setSelectedSessionId(bootstrapped.sessionId);
      persistSessionSelection(bootstrapped.sessionId);
      setMessages(bootstrapped.messages);
      bootAttemptRef.current = 0;
      return true;
    } catch (error) {
      if (runId !== bootRunIdRef.current) {
        return false;
      }

      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not initialize chat.",
      );
      return false;
    } finally {
      if (runId === bootRunIdRef.current) {
        setIsBooting(false);
      }
    }
  }, [createSession, enabled, loadMessages, loadSessions, persistSessionSelection]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void initializeExploreChat();
  }, [enabled, initializeExploreChat]);

  useEffect(() => {
    if (!enabled || isBooting || selectedSessionId) {
      return;
    }

    if (bootAttemptRef.current >= MAX_EXPLORE_CHAT_BOOT_ATTEMPTS) {
      return;
    }

    const timer = window.setTimeout(() => {
      void initializeExploreChat();
    }, EXPLORE_CHAT_BOOT_RETRY_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, errorMessage, initializeExploreChat, isBooting, selectedSessionId]);

  const sendMessage = useCallback(async (overrideContent?: string) => {
    const content = (overrideContent ?? draft).trim();
    if (!content || !selectedSessionId || isSending) {
      return;
    }

    const userTempId = buildTempId("tmp-user");
    const assistantTempId = buildTempId("tmp-assistant");
    const nowIso = new Date().toISOString();

    setIsSending(true);
    setErrorMessage(null);
    if (overrideContent === undefined) {
      setDraft("");
    }

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
      refreshExploreSessionMovement();
      onConversationUpdated?.();

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

      if (overrideContent === undefined) {
        setDraft(content);
      }

      try {
        const reconciledMessages = await loadMessages(selectedSessionId);
        setMessages(reconciledMessages);
      } catch {
        setMessages((current) =>
          current.filter(
            (message) => message.id !== userTempId && message.id !== assistantTempId,
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  }, [draft, isSending, loadMessages, onConversationUpdated, refreshSessions, selectedSessionId]);

  const cancelSend = useCallback(() => {
    abortRef.current?.abort();
    setIsSending(false);
  }, []);

  return {
    sessions,
    selectedSessionId,
    messages,
    draft,
    setDraft,
    isBooting,
    isSending,
    errorMessage,
    sendMessage,
    cancelSend,
  };
}
