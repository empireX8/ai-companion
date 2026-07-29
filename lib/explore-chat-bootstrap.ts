export type OrvekExploreMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  grounding?: import("@/lib/explore-grounding-contract").ExploreGroundingPayload | null;
};

export type OrvekExploreSession = {
  id: string;
  label: string | null;
  preview: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type ExploreChatBootstrapResult = {
  sessionId: string;
  sessions: OrvekExploreSession[];
  messages: OrvekExploreMessage[];
};

type ExploreChatBootstrapDeps = {
  loadSessions: () => Promise<OrvekExploreSession[]>;
  createSession: () => Promise<string>;
  loadMessages: (sessionId: string) => Promise<OrvekExploreMessage[]>;
  storedSessionId?: string | null;
};

/**
 * Empty list → create explore_chat session → load messages.
 * Used by the live hook and the bootstrap integration regression.
 */
export async function bootstrapExploreChatSession(
  deps: ExploreChatBootstrapDeps,
): Promise<ExploreChatBootstrapResult> {
  const sessionList = await deps.loadSessions();
  const storedSessionId = deps.storedSessionId ?? null;

  let nextSessionId =
    storedSessionId && sessionList.some((session) => session.id === storedSessionId)
      ? storedSessionId
      : sessionList[0]?.id ?? null;

  let nextSessions = sessionList;

  if (!nextSessionId) {
    nextSessionId = await deps.createSession();
    nextSessions = await deps.loadSessions();
  }

  if (!nextSessionId) {
    throw new Error("Could not initialize chat.");
  }

  const nextMessages = await deps.loadMessages(nextSessionId);

  return {
    sessionId: nextSessionId,
    sessions: nextSessions,
    messages: nextMessages,
  };
}
