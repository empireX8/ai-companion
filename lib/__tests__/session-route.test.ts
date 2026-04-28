import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

const prismaMock = {
  session: {
    create: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

describe("/api/session POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.session.create.mockResolvedValue({ id: "session-1" });
  });

  it("creates an APP session with default journal_chat surfaceType when body is omitted", async () => {
    const route = await import("../../app/api/session/route");
    const response = await route.POST(
      new Request("http://localhost/api/session", { method: "POST" })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        origin: "APP",
        surfaceType: "journal_chat",
      },
      select: {
        id: true,
      },
    });

    await expect(response.json()).resolves.toEqual({ sessionId: "session-1" });
  });

  it("accepts explore_chat surfaceType", async () => {
    const route = await import("../../app/api/session/route");
    const response = await route.POST(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ surfaceType: "explore_chat" }),
      })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        origin: "APP",
        surfaceType: "explore_chat",
      },
      select: {
        id: true,
      },
    });
  });

  it("returns 400 for invalid surfaceType", async () => {
    const route = await import("../../app/api/session/route");
    const response = await route.POST(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ surfaceType: "web_chat" }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.session.create).not.toHaveBeenCalled();
  });
});
