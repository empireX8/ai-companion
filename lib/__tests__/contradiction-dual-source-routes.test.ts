import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const authMock = vi.fn();
const expireSnoozedContradictionsForUserMock = vi.fn();

const prismadbMock = {
  contradictionNode: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  evidenceSpan: {
    findMany: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
  modelUpdate: {
    findMany: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismadbMock,
}));

vi.mock("../prismadb", () => ({
  default: prismadbMock,
}));

vi.mock("@/lib/contradiction-escalation", async () => {
  const actual = await import("../contradiction-escalation");
  return actual;
});

vi.mock("@/lib/contradiction-enums", async () => {
  const actual = await import("../contradiction-enums");
  return actual;
});

vi.mock("@/lib/contradiction-schema", async () => {
  const actual = await import("../contradiction-schema");
  return actual;
});

vi.mock("@/lib/contradiction-snooze-expiry", () => ({
  expireSnoozedContradictionsForUser: expireSnoozedContradictionsForUserMock,
}));

vi.mock("@/lib/contradiction-surface", () => ({
  getTop3WithOptionalSurfacing: vi.fn(),
}));

vi.mock("@/lib/contradiction-source", () => ({
  ContradictionSourceError: class ContradictionSourceError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  resolveContradictionSource: vi.fn(),
}));

vi.mock("@/lib/understanding-links", async () => {
  const actual = await import("../understanding-links");
  return actual;
});

vi.mock("@/lib/contradiction-dual-source-presentation", async () => {
  const actual = await import("../contradiction-dual-source-presentation");
  return actual;
});

vi.mock("@/lib/contradiction-patch", async () => {
  const actual = await import("../contradiction-patch");
  return actual;
});

vi.mock("@/lib/contradiction-transitions", async () => {
  const actual = await import("../contradiction-transitions");
  return actual;
});

vi.mock("@/lib/metrics-server", () => ({
  serverLogMetric: vi.fn(),
}));

function sha(quote: string): string {
  return createHash("sha256").update(quote, "utf8").digest("hex");
}

function baseNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "cn-1",
    userId: "user-a",
    title: "Tension",
    sideA: "Interpreted A",
    sideB: "Interpreted B",
    type: "value",
    confidence: "medium",
    status: "candidate",
    weight: 1,
    snoozeCount: 0,
    timesSurfaced: 0,
    lastSurfacedAt: null,
    lastEvidenceAt: null,
    evidenceCount: 0,
    recommendedRung: null,
    escalationLevel: 0,
    avoidanceCount: 0,
    lastEscalatedAt: null,
    lastAvoidedAt: null,
    rung: null,
    snoozedUntil: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    lastTouchedAt: new Date("2026-07-01T00:00:00.000Z"),
    sourceSessionId: null,
    sourceMessageId: null,
    sideASourceSpanId: null,
    sideBSourceSpanId: null,
    evidence: [],
    _count: { evidence: 0 },
    ...overrides,
  };
}

describe("CEQR-008/009 contradiction dual-source route projection", () => {
  beforeEach(() => {
    authMock.mockReset();
    expireSnoozedContradictionsForUserMock.mockReset();
    expireSnoozedContradictionsForUserMock.mockResolvedValue(undefined);
    prismadbMock.contradictionNode.findMany.mockReset();
    prismadbMock.contradictionNode.findFirst.mockReset();
    prismadbMock.evidenceSpan.findMany.mockReset();
    prismadbMock.message.findMany.mockReset();
    prismadbMock.session.findMany.mockReset();
    prismadbMock.session.findMany.mockResolvedValue([]);
    prismadbMock.evidenceSpan.findMany.mockResolvedValue([]);
    prismadbMock.message.findMany.mockResolvedValue([]);
  });

  it("19: candidate list dual-source projection is opt-in", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findMany.mockResolvedValue([
      baseNode({ id: "cn-legacy" }),
    ]);

    const route = await import("../../app/api/contradiction/route");
    const without = await route.GET(
      new Request(
        "http://localhost/api/contradiction?status=candidate&page=1&limit=50",
      ),
    );
    expect(without.status).toBe(200);
    const withoutPayload = await without.json();
    expect(withoutPayload.items[0].dualSource).toBeUndefined();
    expect(prismadbMock.evidenceSpan.findMany).not.toHaveBeenCalled();

    prismadbMock.contradictionNode.findMany.mockResolvedValue([
      baseNode({ id: "cn-legacy" }),
    ]);
    const withFlag = await route.GET(
      new Request(
        "http://localhost/api/contradiction?status=candidate&page=1&limit=50&includeDualSource=true",
      ),
    );
    expect(withFlag.status).toBe(200);
    const withPayload = await withFlag.json();
    expect(withPayload.items[0].dualSource).toEqual({
      lineageState: "legacy_unavailable",
      sideA: {
        side: "A",
        availability: "unavailable",
        reason: "legacy_lineage_not_recorded",
        integrityVerified: false,
      },
      sideB: {
        side: "B",
        availability: "unavailable",
        reason: "legacy_lineage_not_recorded",
        integrityVerified: false,
      },
    });
  });

  it("20: list response preserves existing fields", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findMany.mockResolvedValue([baseNode()]);
    const route = await import("../../app/api/contradiction/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/contradiction?status=candidate&page=1&limit=50&includeDualSource=true",
      ),
    );
    const payload = await response.json();
    const item = payload.items[0];
    expect(item).toMatchObject({
      id: "cn-1",
      title: "Tension",
      sideA: "Interpreted A",
      sideB: "Interpreted B",
      status: "candidate",
      type: "value",
    });
    expect(payload).toMatchObject({ page: 1, limit: 50, hasMore: false });
  });

  it("21: detail route exposes dual-source projection", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    const quoteA = "exact side a quote";
    const quoteB = "exact side b quote";
    const contentA = `xx${quoteA}yy`;
    const contentB = `aa${quoteB}bb`;
    const startA = 2;
    const endA = startA + quoteA.length;
    const startB = 2;
    const endB = startB + quoteB.length;

    prismadbMock.contradictionNode.findFirst.mockResolvedValue(
      baseNode({
        status: "open",
        sideASourceSpanId: "span-a",
        sideBSourceSpanId: "span-b",
      }),
    );
    prismadbMock.evidenceSpan.findMany.mockResolvedValue([
      {
        id: "span-a",
        userId: "user-a",
        messageId: "msg-a",
        charStart: startA,
        charEnd: endA,
        contentHash: sha(quoteA),
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "span-b",
        userId: "user-a",
        messageId: "msg-b",
        charStart: startB,
        charEnd: endB,
        contentHash: sha(quoteB),
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    prismadbMock.message.findMany.mockResolvedValue([
      {
        id: "msg-a",
        userId: "user-a",
        sessionId: "sess-1",
        content: contentA,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "msg-b",
        userId: "user-a",
        sessionId: "sess-2",
        content: contentB,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    prismadbMock.session.findMany.mockResolvedValue([
      {
        id: "sess-1",
        userId: "user-a",
        origin: "APP",
        label: "App session",
      },
      {
        id: "sess-2",
        userId: "user-a",
        origin: "IMPORTED_ARCHIVE",
        label: "Import session",
      },
    ]);

    const route = await import("../../app/api/contradiction/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/contradiction/cn-1"),
      { params: Promise.resolve({ id: "cn-1" }) },
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.dualSource.lineageState).toBe("complete_verified");
    expect(payload.dualSource.sideA.exactQuote).toBe(quoteA);
    expect(payload.dualSource.sideB.exactQuote).toBe(quoteB);
    expect(payload.sideA).toBe("Interpreted A");
    expect(payload.sideB).toBe("Interpreted B");
  });

  it("22: shared Inspector route exposes projection for permitted statuses", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findFirst.mockResolvedValue(
      baseNode({
        status: "open",
        sideASourceSpanId: null,
        sideBSourceSpanId: null,
      }),
    );
    const route = await import(
      "../../app/api/inspector/contradictions/[id]/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/inspector/contradictions/cn-1"),
      { params: Promise.resolve({ id: "cn-1" }) },
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.item.dualSource.lineageState).toBe("legacy_unavailable");
    expect(payload.item.sideA).toBe("Interpreted A");
  });

  it("23: unauthorized access remains blocked", async () => {
    authMock.mockResolvedValue({ userId: null });
    const listRoute = await import("../../app/api/contradiction/route");
    const list = await listRoute.GET(
      new Request(
        "http://localhost/api/contradiction?status=candidate&includeDualSource=true",
      ),
    );
    expect(list.status).toBe(401);

    const detailRoute = await import("../../app/api/contradiction/[id]/route");
    const detail = await detailRoute.GET(
      new Request("http://localhost/api/contradiction/cn-1"),
      { params: Promise.resolve({ id: "cn-1" }) },
    );
    expect(detail.status).toBe(401);

    const inspectorRoute = await import(
      "../../app/api/inspector/contradictions/[id]/route"
    );
    const inspector = await inspectorRoute.GET(
      new Request("http://localhost/api/inspector/contradictions/cn-1"),
      { params: Promise.resolve({ id: "cn-1" }) },
    );
    expect(inspector.status).toBe(401);
  });

  it("24: cross-user source data is never returned", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findFirst.mockResolvedValue(
      baseNode({
        status: "open",
        sideASourceSpanId: "span-other",
        sideBSourceSpanId: "span-b",
      }),
    );
    prismadbMock.evidenceSpan.findMany.mockResolvedValue([
      {
        id: "span-other",
        userId: "user-other",
        messageId: "msg-other",
        charStart: 0,
        charEnd: 5,
        contentHash: sha("hello"),
        createdAt: new Date(),
      },
      {
        id: "span-b",
        userId: "user-a",
        messageId: "msg-b",
        charStart: 0,
        charEnd: 4,
        contentHash: sha("side"),
        createdAt: new Date(),
      },
    ]);
    prismadbMock.message.findMany.mockResolvedValue([
      {
        id: "msg-other",
        userId: "user-other",
        sessionId: "sess-x",
        content: "hello world secret",
        createdAt: new Date(),
      },
      {
        id: "msg-b",
        userId: "user-a",
        sessionId: "sess-b",
        content: "side",
        createdAt: new Date(),
      },
    ]);

    const route = await import("../../app/api/contradiction/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/contradiction/cn-1"),
      { params: Promise.resolve({ id: "cn-1" }) },
    );
    const payload = await response.json();
    expect(payload.dualSource.sideA.availability).toBe("unavailable");
    expect(payload.dualSource.sideA.reason).toBe("span_wrong_user");
    expect(JSON.stringify(payload)).not.toContain("hello world secret");
  });

  it("25: legacy rows return truthful unavailable state rather than 500", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findFirst.mockResolvedValue(baseNode());
    const route = await import("../../app/api/contradiction/[id]/route");
    const response = await route.GET(
      new Request("http://localhost/api/contradiction/cn-1"),
      { params: Promise.resolve({ id: "cn-1" }) },
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.dualSource.lineageState).toBe("legacy_unavailable");
  });

  it("candidate status remains excluded from shared Inspector allowlist", async () => {
    authMock.mockResolvedValue({ userId: "user-a" });
    prismadbMock.contradictionNode.findFirst.mockResolvedValue(null);
    const route = await import(
      "../../app/api/inspector/contradictions/[id]/route"
    );
    const response = await route.GET(
      new Request("http://localhost/api/inspector/contradictions/cn-cand"),
      { params: Promise.resolve({ id: "cn-cand" }) },
    );
    expect(response.status).toBe(404);
    expect(prismadbMock.contradictionNode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: expect.not.arrayContaining(["candidate"]) },
        }),
      }),
    );
  });
});
