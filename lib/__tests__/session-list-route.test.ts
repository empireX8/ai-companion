import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

const prismaMock = {
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

describe("/api/session/list GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.session.findMany.mockResolvedValue([]);
  });

  it("filters APP sessions by surfaceType", async () => {
    const route = await import("../../app/api/session/list/route");

    const response = await route.GET(
      new Request(
        "http://localhost/api/session/list?origin=app&surfaceType=explore_chat"
      )
    );

    expect(response.status).toBe(200);
    expect(prismaMock.session.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        origin: "APP",
        surfaceType: "explore_chat",
      },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        label: true,
        startedAt: true,
        endedAt: true,
        origin: true,
        importedSource: true,
        importedAt: true,
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
      },
    });
  });

  it("applies surfaceType only to APP sessions when origin=all", async () => {
    const route = await import("../../app/api/session/list/route");

    const response = await route.GET(
      new Request(
        "http://localhost/api/session/list?origin=all&surfaceType=journal_chat"
      )
    );

    expect(response.status).toBe(200);
    expect(prismaMock.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          OR: [
            { origin: "IMPORTED_ARCHIVE" },
            { origin: "APP", surfaceType: "journal_chat" },
          ],
        },
      })
    );
  });

  it("ignores surfaceType for imported origin filter", async () => {
    const route = await import("../../app/api/session/list/route");

    const response = await route.GET(
      new Request(
        "http://localhost/api/session/list?origin=imported&surfaceType=explore_chat"
      )
    );

    expect(response.status).toBe(200);
    expect(prismaMock.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          origin: "IMPORTED_ARCHIVE",
        },
      })
    );
  });

  it("returns 400 for invalid surfaceType", async () => {
    const route = await import("../../app/api/session/list/route");

    const response = await route.GET(
      new Request(
        "http://localhost/api/session/list?origin=app&surfaceType=web_chat"
      )
    );

    expect(response.status).toBe(400);
    expect(prismaMock.session.findMany).not.toHaveBeenCalled();
  });
});
