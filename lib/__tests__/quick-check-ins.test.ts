import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QUICK_CHECK_IN_NOTE_MAX_LENGTH,
  createQuickCheckInSchema,
} from "../quick-check-ins";

const authMock = vi.fn();

const prismaMock = {
  quickCheckIn: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

const originalDevMobileUserId = process.env.DEV_MOBILE_USER_ID;
const originalAllowDevMobileApi = process.env.ALLOW_DEV_MOBILE_API;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

describe("createQuickCheckInSchema", () => {
  it("requires at least one saved field", () => {
    const parsed = createQuickCheckInSchema.safeParse({});

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected parse failure");
    }
    expect(parsed.error.issues[0]?.message).toBe("Add a state, event tag, or note.");
  });

  it("normalizes note and event tags deterministically", () => {
    const parsed = createQuickCheckInSchema.safeParse({
      eventTags: ["recovery", "pressure", "pressure"],
      note: "  Short note  ",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("Expected parse success");
    }
    expect(parsed.data).toEqual({
      stateTag: null,
      eventTags: ["pressure", "recovery"],
      note: "Short note",
    });
  });

  it("rejects long notes", () => {
    const parsed = createQuickCheckInSchema.safeParse({
      note: "x".repeat(QUICK_CHECK_IN_NOTE_MAX_LENGTH + 1),
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected parse failure");
    }
    expect(parsed.error.issues[0]?.message).toBe(
      `Note must be ${QUICK_CHECK_IN_NOTE_MAX_LENGTH} characters or fewer.`
    );
  });
});

describe("/api/check-ins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
  });

  afterEach(() => {
    if (originalDevMobileUserId === undefined) {
      delete process.env.DEV_MOBILE_USER_ID;
    } else {
      process.env.DEV_MOBILE_USER_ID = originalDevMobileUserId;
    }

    if (originalAllowDevMobileApi === undefined) {
      delete process.env.ALLOW_DEV_MOBILE_API;
    } else {
      process.env.ALLOW_DEV_MOBILE_API = originalAllowDevMobileApi;
    }
  });

  it("returns unauthorized when no user is signed in", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/check-ins/route");
    const response = await route.GET(
      new Request("http://localhost/api/check-ins")
    );

    expect(response.status).toBe(401);
  });

  it("lists recent check-ins newest first", async () => {
    prismaMock.quickCheckIn.findMany.mockResolvedValue([
      {
        id: "check-in-2",
        stateTag: "stable",
        eventTags: ["productive"],
        note: "Kept it moving.",
        createdAt: new Date("2026-04-17T10:30:00.000Z"),
        updatedAt: new Date("2026-04-17T10:30:00.000Z"),
      },
      {
        id: "check-in-1",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: null,
        createdAt: new Date("2026-04-16T08:15:00.000Z"),
        updatedAt: new Date("2026-04-16T08:15:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/check-ins/route");
    const response = await route.GET(
      new Request("http://localhost/api/check-ins")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.quickCheckIn.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        stateTag: true,
        eventTags: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(payload).toEqual([
      {
        id: "check-in-2",
        stateTag: "stable",
        eventTags: ["productive"],
        note: "Kept it moving.",
        createdAt: "2026-04-17T10:30:00.000Z",
        updatedAt: "2026-04-17T10:30:00.000Z",
      },
      {
        id: "check-in-1",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: null,
        createdAt: "2026-04-16T08:15:00.000Z",
        updatedAt: "2026-04-16T08:15:00.000Z",
      },
    ]);
  });

  it("rejects empty check-ins", async () => {
    const route = await import("../../app/api/check-ins/route");
    const request = new Request("http://localhost/api/check-ins", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Add a state, event tag, or note." });
    expect(prismaMock.quickCheckIn.create).not.toHaveBeenCalled();
  });

  it("creates a normalized quick check-in", async () => {
    prismaMock.quickCheckIn.create.mockResolvedValue({
      id: "check-in-3",
      stateTag: "stable",
      eventTags: ["pressure", "recovery"],
      note: "Short note",
      createdAt: new Date("2026-04-17T12:00:00.000Z"),
      updatedAt: new Date("2026-04-17T12:00:00.000Z"),
    });

    const route = await import("../../app/api/check-ins/route");
    const request = new Request("http://localhost/api/check-ins", {
      method: "POST",
      body: JSON.stringify({
        stateTag: "stable",
        eventTags: ["recovery", "pressure", "pressure"],
        note: "  Short note  ",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(prismaMock.quickCheckIn.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        stateTag: "stable",
        eventTags: ["pressure", "recovery"],
        note: "Short note",
      },
      select: {
        id: true,
        stateTag: true,
        eventTags: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(payload).toEqual({
      id: "check-in-3",
      stateTag: "stable",
      eventTags: ["pressure", "recovery"],
      note: "Short note",
      createdAt: "2026-04-17T12:00:00.000Z",
      updatedAt: "2026-04-17T12:00:00.000Z",
    });
  });

  it("accepts dev-mobile bypass requests when clerk user is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    process.env.DEV_MOBILE_USER_ID = "dev-mobile-user";

    prismaMock.quickCheckIn.create.mockResolvedValue({
      id: "check-in-dev",
      stateTag: "stable",
      eventTags: ["pressure"],
      note: "Dev mobile check-in",
      createdAt: new Date("2026-04-29T20:00:00.000Z"),
      updatedAt: new Date("2026-04-29T20:00:00.000Z"),
    });

    const route = await import("../../app/api/check-ins/route");
    const request = new Request("http://localhost/api/check-ins", {
      method: "POST",
      body: JSON.stringify({
        stateTag: "stable",
        eventTags: ["pressure"],
        note: "Dev mobile check-in",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-mindlab-dev-mobile": "1",
      },
    });

    const response = await route.POST(request);
    expect(response.status).toBe(201);
    expect(prismaMock.quickCheckIn.create).toHaveBeenCalledWith({
      data: {
        userId: "dev-mobile-user",
        stateTag: "stable",
        eventTags: ["pressure"],
        note: "Dev mobile check-in",
      },
      select: {
        id: true,
        stateTag: true,
        eventTags: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
});
