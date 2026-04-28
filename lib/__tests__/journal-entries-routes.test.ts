import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

const prismaMock = {
  journalEntry: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

describe("/api/journal/entries routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
  });

  it("creates an entry", async () => {
    const createdAt = new Date("2026-04-28T10:00:00.000Z");
    const updatedAt = new Date("2026-04-28T10:00:00.000Z");
    prismaMock.journalEntry.create.mockResolvedValueOnce({
      id: "entry-1",
      title: "Morning",
      body: "I feel grounded today.",
      authoredAt: null,
      createdAt,
      updatedAt,
    });

    const route = await import("../../app/api/journal/entries/route");
    const response = await route.POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Morning", body: "I feel grounded today." }),
      })
    );

    expect(response.status).toBe(201);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        title: "Morning",
        body: "I feel grounded today.",
        authoredAt: null,
      },
      select: {
        id: true,
        title: true,
        body: true,
        authoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await expect(response.json()).resolves.toEqual({
      id: "entry-1",
      title: "Morning",
      body: "I feel grounded today.",
      authoredAt: null,
      createdAt: "2026-04-28T10:00:00.000Z",
      updatedAt: "2026-04-28T10:00:00.000Z",
    });
  });

  it("lists entries newest-first with default limit", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValueOnce([
      {
        id: "entry-2",
        title: "Evening",
        body: "Long day.",
        authoredAt: null,
        createdAt: new Date("2026-04-28T20:00:00.000Z"),
        updatedAt: new Date("2026-04-28T20:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/journal/entries/route");
    const response = await route.GET(
      new Request("http://localhost/api/journal/entries")
    );

    expect(response.status).toBe(200);
    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        body: true,
        authoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await expect(response.json()).resolves.toEqual([
      {
        id: "entry-2",
        title: "Evening",
        body: "Long day.",
        authoredAt: null,
        createdAt: "2026-04-28T20:00:00.000Z",
        updatedAt: "2026-04-28T20:00:00.000Z",
      },
    ]);
  });

  it("reads own entry", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValueOnce({
      id: "entry-3",
      title: null,
      body: "Short note",
      authoredAt: new Date("2026-04-27T08:00:00.000Z"),
      createdAt: new Date("2026-04-27T08:00:00.000Z"),
      updatedAt: new Date("2026-04-27T08:00:00.000Z"),
    });

    const route = await import("../../app/api/journal/entries/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/journal/entries/entry-3"),
      { params: Promise.resolve({ id: "entry-3" }) }
    );

    expect(response.status).toBe(200);
    expect(prismaMock.journalEntry.findFirst).toHaveBeenCalledWith({
      where: { id: "entry-3", userId: "user-1" },
      select: {
        id: true,
        title: true,
        body: true,
        authoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("updates own entry", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValueOnce({ id: "entry-4" });
    prismaMock.journalEntry.update.mockResolvedValueOnce({
      id: "entry-4",
      title: "Updated title",
      body: "Updated body",
      authoredAt: null,
      createdAt: new Date("2026-04-26T08:00:00.000Z"),
      updatedAt: new Date("2026-04-28T08:00:00.000Z"),
    });

    const route = await import("../../app/api/journal/entries/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/journal/entries/entry-4", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Updated title", body: "Updated body" }),
      }),
      { params: Promise.resolve({ id: "entry-4" }) }
    );

    expect(response.status).toBe(200);
    expect(prismaMock.journalEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-4" },
      data: {
        title: "Updated title",
        body: "Updated body",
        authoredAt: null,
      },
      select: {
        id: true,
        title: true,
        body: true,
        authoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("deletes own entry", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValueOnce({ id: "entry-5" });
    prismaMock.journalEntry.delete.mockResolvedValueOnce({ id: "entry-5" });

    const route = await import("../../app/api/journal/entries/[id]/route");
    const response = await route.DELETE(
      new Request("http://localhost/api/journal/entries/entry-5", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "entry-5" }) }
    );

    expect(response.status).toBe(204);
    expect(prismaMock.journalEntry.findFirst).toHaveBeenCalledWith({
      where: { id: "entry-5", userId: "user-1" },
      select: { id: true },
    });
    expect(prismaMock.journalEntry.delete).toHaveBeenCalledWith({ where: { id: "entry-5" } });
  });

  it("returns unauthorized when no user is signed in", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/journal/entries/route");
    const response = await route.GET(
      new Request("http://localhost/api/journal/entries")
    );

    expect(response.status).toBe(401);
    expect(prismaMock.journalEntry.findMany).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid create body", async () => {
    const route = await import("../../app/api/journal/entries/route");
    const response = await route.POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "X", body: "   " }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 for overly long title", async () => {
    const route = await import("../../app/api/journal/entries/route");
    const response = await route.POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "t".repeat(161),
          body: "valid body",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid patch body", async () => {
    const route = await import("../../app/api/journal/entries/[id]/route");
    const response = await route.PATCH(
      new Request("http://localhost/api/journal/entries/entry-6", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "ok", body: "\n\n" }),
      }),
      { params: Promise.resolve({ id: "entry-6" }) }
    );

    expect(response.status).toBe(400);
    expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
  });
});
