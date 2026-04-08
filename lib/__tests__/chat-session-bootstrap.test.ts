import { describe, expect, it, vi } from "vitest";

import { createOnceGuard, resolveChatBootstrapSession } from "../chat-session-bootstrap";

describe("resolveChatBootstrapSession", () => {
  it("creates a new session for a zero-session fresh account", async () => {
    const fetchSessions = vi
      .fn<() => Promise<Array<{ id: string }>>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "session-new" }]);
    const createSession = vi.fn<() => Promise<string>>().mockResolvedValue("session-new");

    const result = await resolveChatBootstrapSession({
      storedSessionId: null,
      fetchSessions,
      createSession,
    });

    expect(result).toEqual({
      activeSessionId: "session-new",
      sessions: [{ id: "session-new" }],
      clearedStaleSelection: false,
      createdSession: true,
    });
    expect(fetchSessions).toHaveBeenCalledTimes(2);
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("clears a stale selected session and falls back to the first real session", async () => {
    const sessions = [{ id: "session-a" }, { id: "session-b" }];
    const fetchSessions = vi.fn<() => Promise<Array<{ id: string }>>>().mockResolvedValue(sessions);
    const createSession = vi.fn<() => Promise<string>>();

    const result = await resolveChatBootstrapSession({
      storedSessionId: "stale-session",
      fetchSessions,
      createSession,
    });

    expect(result).toEqual({
      activeSessionId: "session-a",
      sessions,
      clearedStaleSelection: true,
      createdSession: false,
    });
    expect(fetchSessions).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("preserves a valid stored session selection", async () => {
    const sessions = [{ id: "session-a" }, { id: "session-b" }];
    const fetchSessions = vi.fn<() => Promise<Array<{ id: string }>>>().mockResolvedValue(sessions);
    const createSession = vi.fn<() => Promise<string>>();

    const result = await resolveChatBootstrapSession({
      storedSessionId: "session-b",
      fetchSessions,
      createSession,
    });

    expect(result).toEqual({
      activeSessionId: "session-b",
      sessions,
      clearedStaleSelection: false,
      createdSession: false,
    });
    expect(fetchSessions).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("treats blank stored session ids as absent", async () => {
    const fetchSessions = vi
      .fn<() => Promise<Array<{ id: string }>>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "session-new" }]);
    const createSession = vi.fn<() => Promise<string>>().mockResolvedValue("session-new");

    const result = await resolveChatBootstrapSession({
      storedSessionId: "   ",
      fetchSessions,
      createSession,
    });

    expect(result.clearedStaleSelection).toBe(false);
    expect(result.createdSession).toBe(true);
    expect(result.activeSessionId).toBe("session-new");
  });

  it("creates exactly one session when two bootstrap calls race on zero-session state", async () => {
    // Simulates React Strict Mode double-effect: two concurrent
    // resolveChatBootstrapSession calls both see 0 sessions and both
    // attempt to create a session.  The createOnceGuard (used by the
    // component) ensures only one POST fires.
    let sessionCount = 0;
    const sessions: Array<{ id: string }> = [];

    const rawCreate = vi.fn<() => Promise<string>>().mockImplementation(async () => {
      const id = `session-${++sessionCount}`;
      sessions.push({ id });
      return id;
    });

    const fetchSessions = vi
      .fn<() => Promise<Array<{ id: string }>>>()
      .mockImplementation(async () => [...sessions]);

    const guardedCreate = createOnceGuard(rawCreate);

    const [r1, r2] = await Promise.all([
      resolveChatBootstrapSession({ storedSessionId: null, fetchSessions, createSession: guardedCreate }),
      resolveChatBootstrapSession({ storedSessionId: null, fetchSessions, createSession: guardedCreate }),
    ]);

    expect(rawCreate).toHaveBeenCalledTimes(1);
    expect(r1.activeSessionId).toBe("session-1");
    expect(r2.activeSessionId).toBe("session-1");
    expect(r1.createdSession).toBe(true);
    expect(r2.createdSession).toBe(true);
  });
});

describe("createOnceGuard", () => {
  it("deduplicates concurrent calls — inner function called exactly once", async () => {
    const inner = vi.fn<() => Promise<string>>().mockResolvedValue("s-1");
    const guarded = createOnceGuard(inner);

    const [r1, r2] = await Promise.all([guarded(), guarded()]);

    expect(inner).toHaveBeenCalledTimes(1);
    expect(r1).toBe("s-1");
    expect(r2).toBe("s-1");
  });

  it("resets after the promise settles so sequential calls each execute", async () => {
    let n = 0;
    const inner = vi.fn<() => Promise<string>>().mockImplementation(async () => `s-${++n}`);
    const guarded = createOnceGuard(inner);

    const r1 = await guarded();
    const r2 = await guarded();

    expect(inner).toHaveBeenCalledTimes(2);
    expect(r1).toBe("s-1");
    expect(r2).toBe("s-2");
  });

  it("propagates rejections and resets so the next call retries", async () => {
    let n = 0;
    const inner = vi.fn<() => Promise<string>>().mockImplementation(async () => {
      if (++n === 1) throw new Error("transient");
      return "s-2";
    });
    const guarded = createOnceGuard(inner);

    await expect(guarded()).rejects.toThrow("transient");
    const r = await guarded();
    expect(r).toBe("s-2");
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
