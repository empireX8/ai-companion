type SessionLike = {
  id: string;
};

export type ChatBootstrapResolution<TSession extends SessionLike> = {
  activeSessionId: string;
  sessions: TSession[];
  clearedStaleSelection: boolean;
  createdSession: boolean;
};

type ResolveChatBootstrapSessionArgs<TSession extends SessionLike> = {
  storedSessionId: string | null;
  fetchSessions: () => Promise<TSession[]>;
  createSession: () => Promise<string>;
};

export async function resolveChatBootstrapSession<TSession extends SessionLike>(
  args: ResolveChatBootstrapSessionArgs<TSession>
): Promise<ChatBootstrapResolution<TSession>> {
  const initialSessions = await args.fetchSessions();
  const storedSessionId = args.storedSessionId?.trim() || null;

  if (storedSessionId) {
    const matchingStoredSession = initialSessions.find((session) => session.id === storedSessionId);
    if (matchingStoredSession) {
      return {
        activeSessionId: matchingStoredSession.id,
        sessions: initialSessions,
        clearedStaleSelection: false,
        createdSession: false,
      };
    }
  }

  if (initialSessions.length > 0) {
    return {
      activeSessionId: initialSessions[0].id,
      sessions: initialSessions,
      clearedStaleSelection: storedSessionId !== null,
      createdSession: false,
    };
  }

  const activeSessionId = await args.createSession();
  const createdSessions = await args.fetchSessions();

  return {
    activeSessionId,
    sessions: createdSessions,
    clearedStaleSelection: storedSessionId !== null,
    createdSession: true,
  };
}
