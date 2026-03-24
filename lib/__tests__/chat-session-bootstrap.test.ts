import { describe, expect, it, vi } from "vitest";

import { resolveChatBootstrapSession } from "../chat-session-bootstrap";

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
});
