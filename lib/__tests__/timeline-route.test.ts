import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

const prismaMock = {
  quickCheckIn: {
    findMany: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

describe("/api/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00.000Z"));
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.quickCheckIn.findMany.mockResolvedValue([]);
    prismaMock.session.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns imported conversation activity from imported sessions inside the 90-day window", async () => {
    prismaMock.session.findMany.mockResolvedValue([
      {
        id: "session-1",
        label: "Imported conversation 1",
        startedAt: new Date("2026-02-14T09:00:00.000Z"),
        messages: [{ content: "Imported opening message" }],
        _count: { messages: 4 },
      },
    ]);

    const route = await import("../../app/api/timeline/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline?window=90d")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.session.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        origin: "IMPORTED_ARCHIVE",
        startedAt: { gte: new Date("2026-01-18T00:00:00.000Z") },
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        label: true,
        startedAt: true,
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    });
    expect(payload.importedActivity).toEqual([
      {
        id: "session-1",
        startedAt: "2026-02-14T09:00:00.000Z",
        label: "Imported conversation 1",
        preview: "Imported opening message",
        messageCount: 4,
      },
    ]);
  });

  it("returns unauthorized when no user is signed in", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/timeline/route");
    const response = await route.GET(new Request("http://localhost/api/timeline"));

    expect(response.status).toBe(401);
  });
});
