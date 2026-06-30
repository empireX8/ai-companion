"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildAppSessionCreateRequestInit,
  buildAppSessionListUrl,
} from "@/lib/chat-surface-routing";

export type OrvekExploreMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type OrvekExploreSession = {
  id: string;
  label: string | null;
  preview: string | null;
  startedAt: string;
  endedAt: string | null;
};

const EXPLORE_SURFACE_TYPE = "explore_chat" as const;
const EXPLORE_CHAT_STORAGE_KEY = "mindlabs:explore:session-id";

function buildTempId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useOrvekExploreChat(options?: {
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
  const onActiveSessionIdChange = options?.onActiveSessionIdChange;
  const onConversationUpdated = options?.onConversationUpdated;

  useEffect(() => {
    onActiveSessionIdChange?.(selectedSessionId);
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

    return (await response.json()) as OrvekExploreMessage[];
  }, []);

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
            ? window.localStorage.getItem(EXPLORE_CHAT_STORAGE_KEY)
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
  }, [createSession, loadMessages, loadSessions, persistSessionSelection]);

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
