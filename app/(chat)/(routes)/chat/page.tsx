"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
};

const SESSION_STORAGE_KEY = "double:lastSessionId";
const REFERENCE_TYPES: ReferenceType[] = [
  "constraint",
  "pattern",
  "goal",
  "preference",
  "assumption",
  "hypothesis",
];
const REFERENCE_CONFIDENCE: ReferenceConfidence[] = ["low", "medium", "high"];

const shortenId = (id: string) => {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
};

const createTempId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function ChatPage() {
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
    const response = await fetch("/api/reference/list", { method: "GET" });

    if (!response.ok) {
      throw new Error("Failed to load saved memory");
    }

    const data = (await response.json()) as ReferenceItem[];
    setSavedReferences(data);
  }, []);

  const setActiveSession = useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    setSelectedSessionId(nextSessionId);
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const storedSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);

        let activeSessionId = storedSessionId;
        if (!activeSessionId) {
          activeSessionId = await createSession();
        }

        if (!isMounted) return;

        setActiveSession(activeSessionId);
        await fetchSessions();
        await fetchMessages(activeSessionId);
        await fetchSavedReferences();
      } catch {
        if (!isMounted) return;
        setError("Failed to initialize session.");
      } finally {
        if (!isMounted) return;
        setIsLoadingSession(false);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [createSession, fetchMessages, fetchSavedReferences, fetchSessions, setActiveSession]);

  const shortSessionId = useMemo(() => {
    if (!sessionId) return "...";
    return shortenId(sessionId);
  }, [sessionId]);
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
      await fetchMessages(newSessionId);
      await fetchSessions();
    } catch {
      setError("Failed to create session.");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const onSelectSession = async (nextSessionId: string) => {
    if (nextSessionId === sessionId) {
      return;
    }

    setError(null);
    setActiveSession(nextSessionId);
    setMessages([]);

    try {
      await fetchMessages(nextSessionId);
    } catch {
      setError("Failed to load messages.");
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = content.trim();
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
      setContent("");
    } catch {
      setError("Failed to send message.");
      try {
        await fetchMessages(sessionId);
      } catch {
        // Keep original send error if resync also fails.
      }
    } finally {
      setIsSending(false);
    }
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <h1 className="text-xl font-semibold">Double — Session</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Session: <span className="font-mono">{shortSessionId}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNewSession}
          disabled={isCreatingSession || isLoadingSession}
          className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          {isCreatingSession ? "Creating..." : "New session"}
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <aside className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Sessions</h2>

          {isLoadingSessions ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sessions.map((session) => {
                const isActive = selectedSessionId === session.id;

                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => void onSelectSession(session.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        isActive
                          ? "border-foreground bg-muted"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <p className="font-mono text-xs">{shortenId(session.id)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(session.startedAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[420px] flex-col gap-4 rounded-md border border-border p-4">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Save memory</p>
            <form onSubmit={onSaveReference} className="mt-2 flex flex-col gap-2">
              <input
                type="text"
                value={referenceStatement}
                onChange={(event) => setReferenceStatement(event.target.value)}
                placeholder="Save a stable preference, goal, or constraint"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={isSavingReference}
              />
              <div className="flex gap-2">
                <select
                  value={referenceType}
                  onChange={(event) => setReferenceType(event.target.value as ReferenceType)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  disabled={isSavingReference}
                >
                  {REFERENCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={referenceConfidence}
                  onChange={(event) =>
                    setReferenceConfidence(event.target.value as ReferenceConfidence)
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  disabled={isSavingReference}
                >
                  {REFERENCE_CONFIDENCE.map((confidence) => (
                    <option key={confidence} value={confidence}>
                      {confidence}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isSavingReference || referenceStatement.trim().length === 0}
                  className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
                >
                  {isSavingReference ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
            {referenceStatus ? (
              <p className="mt-2 text-xs text-muted-foreground">{referenceStatus}</p>
            ) : null}
            {savedReferences.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {savedReferences.slice(0, 10).map((item) => (
                  <li key={item.id} className="rounded border border-border p-2">
                    <p className="text-xs text-muted-foreground">
                      {item.statement} ({item.type}, {item.confidence})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onStartEditReference(item)}
                        disabled={
                          !!updatingReferenceId ||
                          !!deactivatingReferenceId ||
                          !!supersedingReferenceId
                        }
                        className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {editingReferenceId === item.id ? "Editing" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartSupersedeReference(item)}
                        disabled={
                          !!updatingReferenceId ||
                          !!deactivatingReferenceId ||
                          !!editingReferenceId
                        }
                        className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {supersedingReferenceId === item.id ? "Replacing" : "Supersede"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeactivateReference(item.id)}
                        disabled={
                          updatingReferenceId === item.id ||
                          deactivatingReferenceId === item.id ||
                          supersedingReferenceId === item.id
                        }
                        className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {deactivatingReferenceId === item.id ? "Deactivating..." : "Deactivate"}
                      </button>
                    </div>

                    {editingReferenceId === item.id ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={editStatement}
                          onChange={(event) => setEditStatement(event.target.value)}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                          disabled={updatingReferenceId === item.id}
                        />
                        <div className="flex gap-2">
                          <select
                            value={editType}
                            onChange={(event) => setEditType(event.target.value as ReferenceType)}
                            className="rounded border border-border bg-background px-2 py-1 text-xs"
                            disabled={updatingReferenceId === item.id}
                          >
                            {REFERENCE_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editConfidence}
                            onChange={(event) =>
                              setEditConfidence(event.target.value as ReferenceConfidence)
                            }
                            className="rounded border border-border bg-background px-2 py-1 text-xs"
                            disabled={updatingReferenceId === item.id}
                          >
                            {REFERENCE_CONFIDENCE.map((confidence) => (
                              <option key={confidence} value={confidence}>
                                {confidence}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void onUpdateReference(item.id)}
                            disabled={
                              updatingReferenceId === item.id ||
                              editStatement.trim().length === 0
                            }
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {updatingReferenceId === item.id ? "Updating..." : "Update"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingReferenceId(null)}
                            disabled={updatingReferenceId === item.id}
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {supersedingReferenceId === item.id ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={replaceStatement}
                          onChange={(event) => setReplaceStatement(event.target.value)}
                          placeholder="Replace with..."
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                          disabled={updatingReferenceId === item.id}
                        />
                        <div className="flex gap-2">
                          <select
                            value={replaceType}
                            onChange={(event) =>
                              setReplaceType(event.target.value as ReferenceType)
                            }
                            className="rounded border border-border bg-background px-2 py-1 text-xs"
                            disabled={updatingReferenceId === item.id}
                          >
                            {REFERENCE_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <select
                            value={replaceConfidence}
                            onChange={(event) =>
                              setReplaceConfidence(event.target.value as ReferenceConfidence)
                            }
                            className="rounded border border-border bg-background px-2 py-1 text-xs"
                            disabled={updatingReferenceId === item.id}
                          >
                            {REFERENCE_CONFIDENCE.map((confidence) => (
                              <option key={confidence} value={confidence}>
                                {confidence}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void onSupersedeReference(item.id)}
                            disabled={
                              updatingReferenceId === item.id ||
                              replaceStatement.trim().length === 0
                            }
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {updatingReferenceId === item.id ? "Replacing..." : "Replace"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSupersedingReferenceId(null)}
                            disabled={updatingReferenceId === item.id}
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex-1 rounded-md border border-border p-4">
            {isLoadingSession ? (
              <p className="text-sm text-muted-foreground">Loading session...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <ul className="space-y-3">
                {messages.map((message) => (
                  <li key={message.id} className="rounded border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {message.role}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{message.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2">
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
              disabled={
                !sessionId ||
                isSending ||
                isCreatingSession ||
                content.trim().length === 0
              }
              className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>
        </section>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
