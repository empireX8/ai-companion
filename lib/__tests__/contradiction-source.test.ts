import { describe, expect, it, vi } from "vitest";

import { resolveContradictionSource } from "../contradiction-source";

describe("resolveContradictionSource", () => {
  it("rejects mismatched sourceMessageId/sourceSessionId", async () => {
    const db = {
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "msg-a",
          sessionId: "session-a",
        }),
      },
      session: {
        findFirst: vi.fn().mockResolvedValue({ id: "session-b" }),
      },
    };

    await expect(
      resolveContradictionSource({
        userId: "user-1",
        sourceSessionId: "session-b",
        sourceMessageId: "msg-a",
        db,
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "SOURCE_RELATION_MISMATCH",
      message: "SOURCE_RELATION_MISMATCH",
    });
  });

  it("infers sourceSessionId from sourceMessageId when session is omitted", async () => {
    const db = {
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "msg-a",
          sessionId: "session-a",
        }),
      },
      session: {
        findFirst: vi.fn(),
      },
    };

    await expect(
      resolveContradictionSource({
        userId: "user-1",
        sourceMessageId: "msg-a",
        db,
      })
    ).resolves.toEqual({
      sourceSessionId: "session-a",
      sourceMessageId: "msg-a",
    });
  });
});
