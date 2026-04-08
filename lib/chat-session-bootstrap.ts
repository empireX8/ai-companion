type SessionLike = {
  id: string;
};

/**
 * Wraps an async function so that concurrent calls share the same in-flight
 * promise — the inner function is called at most once per "batch" of concurrent
 * invocations. After the promise settles, the guard resets so future sequential
 * calls execute normally.
 *
 * Used by the chat bootstrap to prevent React Strict-Mode double-effect
 * execution from creating two empty sessions.
 */
export function createOnceGuard<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (!inFlight) {
      inFlight = fn().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}

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
