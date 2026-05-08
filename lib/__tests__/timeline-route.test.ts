import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

const prismaMock = {
  quickCheckIn: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
  },
  journalEntry: {
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
    prismaMock.journalEntry.findMany.mockResolvedValue([]);
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
    expect(prismaMock.session.findMany).toHaveBeenCalledTimes(1);
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
    expect(payload.stateSummary).toEqual({
      window: "90d",
      totalCheckIns: 0,
      rhythms: {
        totalCount: 0,
        topStateTags: [],
        topEventTags: [],
        lastCheckInAt: null,
      },
      repeatedSignals: {
        repeatedStateTags: [],
        repeatedEventTags: [],
        repeatedPairs: [],
        rankedItems: [],
      },
      links: [],
      recentStates: [],
      topEventTags: [],
    });
    expect(payload).not.toHaveProperty("appActivity");
    expect(payload).not.toHaveProperty("journalEntries");
    expect(prismaMock.journalEntry.findMany).not.toHaveBeenCalled();
  });

  it("returns appActivity only when includeAppActivity is enabled", async () => {
    prismaMock.session.findMany
      .mockResolvedValueOnce([
        {
          id: "imported-1",
          label: "Imported conversation 3",
          startedAt: new Date("2026-04-12T08:00:00.000Z"),
          messages: [{ content: "Imported preview message" }],
          _count: { messages: 6 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "app-1",
          label: "Morning reflection",
          startedAt: new Date("2026-04-15T07:30:00.000Z"),
          surfaceType: "explore_chat",
          messages: [{ content: "I woke up anxious today" }],
          _count: { messages: 2 },
        },
      ]);

    const route = await import("../../app/api/timeline/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/timeline?window=30d&includeAppActivity=1"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.session.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.session.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        userId: "user-1",
        origin: "IMPORTED_ARCHIVE",
        startedAt: { gte: new Date("2026-03-19T00:00:00.000Z") },
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
    expect(prismaMock.session.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: "user-1",
        origin: "APP",
        startedAt: { gte: new Date("2026-03-19T00:00:00.000Z") },
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        label: true,
        startedAt: true,
        surfaceType: true,
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
        id: "imported-1",
        startedAt: "2026-04-12T08:00:00.000Z",
        label: "Imported conversation 3",
        preview: "Imported preview message",
        messageCount: 6,
      },
    ]);
    expect(payload.appActivity).toEqual([
      {
        id: "app-1",
        startedAt: "2026-04-15T07:30:00.000Z",
        label: "Morning reflection",
        preview: "I woke up anxious today",
        messageCount: 2,
        surfaceType: "explore_chat",
      },
    ]);
    expect(payload.stateSummary).toMatchObject({
      window: "30d",
      totalCheckIns: 0,
    });
    expect(payload).not.toHaveProperty("journalEntries");
    expect(prismaMock.journalEntry.findMany).not.toHaveBeenCalled();
  });

  it("returns journalEntries when includeJournalEntries=1 and orders by newest timeline timestamp", async () => {
    prismaMock.journalEntry.findMany
      .mockResolvedValueOnce([
        {
          id: "authored-older",
          title: "Authored older",
          body: "Authored older entry",
          authoredAt: new Date("2026-04-10T05:00:00.000Z"),
          createdAt: new Date("2026-04-11T05:00:00.000Z"),
          updatedAt: new Date("2026-04-11T06:00:00.000Z"),
        },
        {
          id: "authored-newer",
          title: "Authored newer",
          body: "Authored newer entry",
          authoredAt: new Date("2026-04-17T06:30:00.000Z"),
          createdAt: new Date("2026-04-16T06:30:00.000Z"),
          updatedAt: new Date("2026-04-17T07:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "created-newest",
          title: null,
          body: "Created newest entry",
          authoredAt: null,
          createdAt: new Date("2026-04-18T09:00:00.000Z"),
          updatedAt: new Date("2026-04-18T09:30:00.000Z"),
        },
        {
          id: "created-older",
          title: "Created older",
          body: "Created older entry",
          authoredAt: null,
          createdAt: new Date("2026-04-05T02:00:00.000Z"),
          updatedAt: new Date("2026-04-05T02:30:00.000Z"),
        },
      ]);

    const route = await import("../../app/api/timeline/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/timeline?window=30d&includeJournalEntries=1"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.session.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.journalEntry.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        userId: "user-1",
        authoredAt: { gte: new Date("2026-03-19T00:00:00.000Z") },
      },
      orderBy: [{ authoredAt: "desc" }, { id: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        body: true,
        authoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(prismaMock.journalEntry.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: "user-1",
        authoredAt: null,
        createdAt: { gte: new Date("2026-03-19T00:00:00.000Z") },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        body: true,
        authoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(payload.importedActivity).toEqual([]);
    expect(payload.stateSummary).toMatchObject({
      window: "30d",
      totalCheckIns: 0,
    });
    expect(payload.journalEntries).toEqual([
      {
        id: "created-newest",
        createdAt: "2026-04-18T09:00:00.000Z",
        updatedAt: "2026-04-18T09:30:00.000Z",
        authoredAt: null,
        title: null,
        preview: "Created newest entry",
        bodyLength: 20,
      },
      {
        id: "authored-newer",
        createdAt: "2026-04-16T06:30:00.000Z",
        updatedAt: "2026-04-17T07:00:00.000Z",
        authoredAt: "2026-04-17T06:30:00.000Z",
        title: "Authored newer",
        preview: "Authored newer entry",
        bodyLength: 20,
      },
      {
        id: "authored-older",
        createdAt: "2026-04-11T05:00:00.000Z",
        updatedAt: "2026-04-11T06:00:00.000Z",
        authoredAt: "2026-04-10T05:00:00.000Z",
        title: "Authored older",
        preview: "Authored older entry",
        bodyLength: 20,
      },
      {
        id: "created-older",
        createdAt: "2026-04-05T02:00:00.000Z",
        updatedAt: "2026-04-05T02:30:00.000Z",
        authoredAt: null,
        title: "Created older",
        preview: "Created older entry",
        bodyLength: 19,
      },
    ]);
    expect(payload).not.toHaveProperty("appActivity");
  });

  it("accepts includeJournalEntries=true", async () => {
    const route = await import("../../app/api/timeline/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/timeline?window=30d&includeJournalEntries=true"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledTimes(2);
    expect(payload).toHaveProperty("journalEntries");
    expect(payload.journalEntries).toEqual([]);
    expect(payload.stateSummary).toMatchObject({
      window: "30d",
      totalCheckIns: 0,
    });
  });

  it("builds stateSummary from check-ins and includes possible links when repeated patterns exist", async () => {
    prismaMock.quickCheckIn.findMany.mockResolvedValue([
      {
        id: "ci-4",
        stateTag: "overloaded",
        eventTags: ["pressure"],
        note: "hit a wall",
        createdAt: new Date("2026-04-18T06:00:00.000Z"),
        updatedAt: new Date("2026-04-18T06:00:00.000Z"),
      },
      {
        id: "ci-3",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: "still tense",
        createdAt: new Date("2026-04-18T04:00:00.000Z"),
        updatedAt: new Date("2026-04-18T04:00:00.000Z"),
      },
      {
        id: "ci-2",
        stateTag: "overloaded",
        eventTags: ["pressure"],
        note: null,
        createdAt: new Date("2026-04-18T02:00:00.000Z"),
        updatedAt: new Date("2026-04-18T02:00:00.000Z"),
      },
      {
        id: "ci-1",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: "deadline sprint",
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/timeline/route");
    const response = await route.GET(
      new Request("http://localhost/api/timeline?window=30d")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.stateSummary.window).toBe("30d");
    expect(payload.stateSummary.totalCheckIns).toBe(4);
    expect(payload.stateSummary.rhythms.totalCount).toBe(4);
    expect(payload.stateSummary.rhythms.topStateTags[0]).toEqual({
      tag: "overloaded",
      count: 2,
    });
    expect(payload.stateSummary.topEventTags[0]).toEqual({
      tag: "pressure",
      count: 4,
    });
    expect(payload.stateSummary.repeatedSignals.repeatedStateTags).toEqual([
      { tag: "overloaded", count: 2 },
      { tag: "stressed", count: 2 },
    ]);
    expect(payload.stateSummary.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "event_state",
          eventTag: "pressure",
          stateTag: "overloaded",
        }),
        expect.objectContaining({
          kind: "event_state",
          eventTag: "pressure",
          stateTag: "stressed",
        }),
        expect.objectContaining({
          kind: "state_transition",
          fromState: "stressed",
          toState: "overloaded",
          count: 2,
        }),
      ])
    );
    expect(payload.stateSummary.recentStates).toEqual([
      {
        id: "ci-4",
        createdAt: "2026-04-18T06:00:00.000Z",
        stateTag: "overloaded",
        eventTags: ["pressure"],
        note: "hit a wall",
      },
      {
        id: "ci-3",
        createdAt: "2026-04-18T04:00:00.000Z",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: "still tense",
      },
      {
        id: "ci-2",
        createdAt: "2026-04-18T02:00:00.000Z",
        stateTag: "overloaded",
        eventTags: ["pressure"],
        note: null,
      },
      {
        id: "ci-1",
        createdAt: "2026-04-18T00:00:00.000Z",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: "deadline sprint",
      },
    ]);
    expect(prismaMock.quickCheckIn.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.quickCheckIn.create).not.toHaveBeenCalled();
  });

  it("returns unauthorized when no user is signed in", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/timeline/route");
    const response = await route.GET(new Request("http://localhost/api/timeline"));

    expect(response.status).toBe(401);
  });
});
