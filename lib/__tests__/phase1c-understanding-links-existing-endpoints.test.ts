import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getTopContradictionsMock = vi.fn();
const projectVisiblePatternClaimMock = vi.fn();
const expireSnoozedContradictionsForUserMock = vi.fn();
const getTop3WithOptionalSurfacingMock = vi.fn();
const buildCurrentPrioritySnapshotMock = vi.fn();
const selectBuildForwardActionBlueprintsMock = vi.fn();
const selectStabilizeActionBlueprintsMock = vi.fn();
const syncSurfacedActionsMock = vi.fn();

const prismadbMock = {
  patternClaim: {
    findMany: vi.fn(),
  },
  message: {
    count: vi.fn(),
  },
  session: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  contradictionNode: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  evidenceSpan: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  referenceItem: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismadbMock,
}));

vi.mock("@/lib/contradiction-top", () => ({
  getTopContradictions: getTopContradictionsMock,
}));

vi.mock("@/lib/patterns-api", async () => {
  const actual = await import("../patterns-api");
  return actual;
});

vi.mock("@/lib/pattern-visible-claim", () => ({
  projectVisiblePatternClaim: projectVisiblePatternClaimMock,
}));

vi.mock("@/lib/pattern-batch-orchestrator", () => ({
  patternBatchOrchestrator: {
    runForUser: vi.fn(),
  },
}));

vi.mock("@/lib/pattern-rerun-debug", () => ({
  createPatternRerunDebugCollector: vi.fn(),
}));

vi.mock("@/lib/understanding-links", async () => {
  const actual = await import("../understanding-links");
  return actual;
});

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
  getTop3WithOptionalSurfacing: getTop3WithOptionalSurfacingMock,
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

vi.mock("@/lib/contradiction-patch", () => ({
  buildContradictionPatchData: vi.fn(),
}));

vi.mock("@/lib/contradiction-transitions", () => ({
  applyContradictionAction: vi.fn(),
  ContradictionTransitionError: class ContradictionTransitionError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/metrics-server", () => ({
  serverLogMetric: vi.fn(),
}));

vi.mock("@/lib/actions-v1", () => ({
  buildCurrentPrioritySnapshot: buildCurrentPrioritySnapshotMock,
  selectBuildForwardActionBlueprints: selectBuildForwardActionBlueprintsMock,
  selectStabilizeActionBlueprints: selectStabilizeActionBlueprintsMock,
  syncSurfacedActions: syncSurfacedActionsMock,
}));

function makePatternClaim() {
  return {
    id: "pc1",
    patternType: "trigger_condition",
    summary: "pattern summary",
    status: "active",
    strengthLevel: "developing",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    journalEvidenceCount: 0,
    journalEntrySpread: 0,
    journalDaySpread: 0,
    supportContainerSpread: 0,
    evidence: [],
    actions: [],
  };
}

function makeProjectedPatternClaim() {
  return {
    id: "pc1",
    patternType: "trigger_condition",
    summary: "visible pattern",
    status: "active",
    strengthLevel: "developing",
    evidenceCount: 0,
    sessionCount: 0,
    journalEvidenceCount: 0,
    journalEntrySpread: 0,
    journalDaySpread: 0,
    supportContainerSpread: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    receipts: [],
    action: null,
  };
}

function makeContradictionNode(id: string) {
  return {
    id,
    userId: "u1",
    title: "Contradiction",
    sideA: "A",
    sideB: "B",
    type: "goal_behavior_gap",
    confidence: "medium",
    status: "open",
    weight: 10,
    snoozeCount: 0,
    timesSurfaced: 0,
    lastSurfacedAt: null,
    lastEvidenceAt: null,
    evidenceCount: 1,
    recommendedRung: "rung2_explicit_contradiction",
    escalationLevel: 0,
    avoidanceCount: 0,
    lastEscalatedAt: null,
    lastAvoidedAt: null,
    rung: null,
    snoozedUntil: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    lastTouchedAt: new Date("2026-05-02T00:00:00.000Z"),
    sourceSessionId: null,
    sourceMessageId: "msg-1",
    evidence: [
      {
        id: "ce-1",
        source: "reflection",
        quote: "quote",
        sessionId: "s1",
        messageId: "msg-1",
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
      },
    ],
    _count: {
      evidence: 1,
    },
  };
}

function makeAction(id: string, bucket: "stabilize" | "build") {
  return {
    id,
    title: `${bucket} title`,
    whySuggested: `${bucket} why`,
    bucket,
    effort: "Low",
    linkedFamily: null,
    linkedFamilyLabel: null,
    linkedClaimId: null,
    linkedClaimSummary: null,
    linkedGoalId: null,
    linkedGoalStatement: null,
    linkedSourceLabel: "source",
    status: "not_started",
    note: null,
    surfacedAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  };
}

function makeEvidenceSpan(id: string) {
  return {
    id,
    createdAt: new Date("2026-05-03T00:00:00.000Z"),
    charStart: 0,
    charEnd: 10,
    messageId: "msg-1",
    message: {
      content: "abcdefghij and more text",
      session: {
        id: "sess-1",
        label: "Session 1",
        origin: "APP",
      },
    },
    profileArtifactLinks: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  authMock.mockResolvedValue({ userId: "u1" });

  prismadbMock.patternClaim.findMany.mockResolvedValue([makePatternClaim()]);
  prismadbMock.message.count.mockResolvedValue(10);
  prismadbMock.session.count.mockResolvedValue(3);
  prismadbMock.session.findMany.mockResolvedValue([]);
  prismadbMock.contradictionNode.findMany.mockResolvedValue([
    makeContradictionNode("c1"),
  ]);
  prismadbMock.contradictionNode.findFirst.mockResolvedValue(
    makeContradictionNode("c1")
  );
  prismadbMock.evidenceSpan.findMany.mockResolvedValue([
    { id: "es-1", messageId: "msg-1" },
  ]);
  prismadbMock.evidenceSpan.findFirst.mockResolvedValue(makeEvidenceSpan("es-1"));
  prismadbMock.referenceItem.findMany.mockResolvedValue([]);
  prismadbMock.understandingEvidenceLink.findMany.mockResolvedValue([]);

  getTopContradictionsMock.mockResolvedValue([]);
  projectVisiblePatternClaimMock.mockReturnValue(makeProjectedPatternClaim());
  expireSnoozedContradictionsForUserMock.mockResolvedValue(undefined);
  getTop3WithOptionalSurfacingMock.mockResolvedValue({
    items: [{ id: "c1" }],
  });

  buildCurrentPrioritySnapshotMock.mockReturnValue({
    featured: [],
    totalActive: 0,
    totalCandidate: 0,
    hasData: false,
  });
  selectBuildForwardActionBlueprintsMock.mockReturnValue([]);
  selectStabilizeActionBlueprintsMock.mockReturnValue([]);
  syncSurfacedActionsMock.mockResolvedValue([
    makeAction("a1", "stabilize"),
    makeAction("a2", "build"),
  ]);
});

const EMPTY_RELATED = {
  userMapConclusionIds: [],
  investigationIds: [],
  modelUpdateIds: [],
  fieldworkAssignmentIds: [],
};

const DISABLED_INCLUDE_VALUES = [
  "",
  "?includeUnderstandingLinks=false",
  "?includeUnderstandingLinks=0",
  "?includeUnderstandingLinks=yes",
];

describe("Phase 1C includeUnderstandingLinks gating", () => {
  it("patterns: include flag matrix keeps default shape and skips link query unless true", async () => {
    const route = await import("../../app/api/patterns/route");
    for (const suffix of DISABLED_INCLUDE_VALUES) {
      prismadbMock.understandingEvidenceLink.findMany.mockClear();
      const response = await route.GET(
        new Request(`http://localhost/api/patterns${suffix}`)
      );
      const payload = await response.json();
      const triggerSection = payload.sections.find(
        (section: { familyKey: string }) => section.familyKey === "trigger_condition"
      );
      expect(triggerSection.claims[0]).not.toHaveProperty("relatedUnderstanding");
      expect(prismadbMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
    }
  });

  it("patterns: include=true groups IDs by target type, ignores unsupported targets, and keeps cross-user rows out", async () => {
    const route = await import("../../app/api/patterns/route");
    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { sourceId: "pc1", targetType: "usermap_conclusion", targetId: "umc-1" },
      { sourceId: "pc1", targetType: "investigation", targetId: "inv-1" },
      { sourceId: "pc1", targetType: "model_update", targetId: "mu-1" },
      { sourceId: "pc1", targetType: "fieldwork_assignment", targetId: "fw-1" },
      { sourceId: "pc1", targetType: "pattern_claim", targetId: "ignore-me" },
      { sourceId: "pc-other", targetType: "investigation", targetId: "cross-user" },
    ]);

    const response = await route.GET(
      new Request("http://localhost/api/patterns?includeUnderstandingLinks=true")
    );
    const payload = await response.json();
    const triggerSection = payload.sections.find(
      (section: { familyKey: string }) => section.familyKey === "trigger_condition"
    );
    expect(triggerSection.claims[0].relatedUnderstanding).toEqual({
      userMapConclusionIds: ["umc-1"],
      investigationIds: ["inv-1"],
      modelUpdateIds: ["mu-1"],
      fieldworkAssignmentIds: ["fw-1"],
    });
    expect(prismadbMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          sourceType: "pattern_claim",
          sourceId: { in: ["pc1"] },
        },
      })
    );
  });

  it("patterns: include=true returns empty relatedUnderstanding arrays when no links exist", async () => {
    const route = await import("../../app/api/patterns/route");
    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const response = await route.GET(
      new Request("http://localhost/api/patterns?includeUnderstandingLinks=true")
    );
    const payload = await response.json();
    const triggerSection = payload.sections.find(
      (section: { familyKey: string }) => section.familyKey === "trigger_condition"
    );
    expect(triggerSection.claims[0].relatedUnderstanding).toEqual(EMPTY_RELATED);
  });

  it("contradiction list: include flag matrix keeps paginated shape and skips link query unless true", async () => {
    const route = await import("../../app/api/contradiction/route");
    for (const suffix of DISABLED_INCLUDE_VALUES) {
      prismadbMock.understandingEvidenceLink.findMany.mockClear();
      const response = await route.GET(
        new Request(`http://localhost/api/contradiction?status=open&page=1&limit=20${suffix ? `&${suffix.slice(1)}` : ""}`)
      );
      const payload = await response.json();
      expect(payload.items[0]).not.toHaveProperty("relatedUnderstanding");
      expect(prismadbMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
    }
  });

  it("contradiction list: include=true adds grouped links, scopes query, returns empty arrays, and keeps top=3 deferred", async () => {
    const route = await import("../../app/api/contradiction/route");

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { sourceId: "c1", targetType: "model_update", targetId: "mu-1" },
      { sourceId: "c-other", targetType: "investigation", targetId: "cross-user" },
    ]);
    const statusResponse = await route.GET(
      new Request(
        "http://localhost/api/contradiction?status=open&page=1&limit=20&includeUnderstandingLinks=true"
      )
    );
    const statusPayload = await statusResponse.json();
    expect(statusPayload.items[0].relatedUnderstanding).toEqual({
      userMapConclusionIds: [],
      investigationIds: [],
      modelUpdateIds: ["mu-1"],
      fieldworkAssignmentIds: [],
    });
    expect(prismadbMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          sourceType: "contradiction_node",
          sourceId: { in: ["c1"] },
        },
      })
    );

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);
    const emptyResponse = await route.GET(
      new Request(
        "http://localhost/api/contradiction?status=open&page=1&limit=20&includeUnderstandingLinks=true"
      )
    );
    const emptyPayload = await emptyResponse.json();
    expect(emptyPayload.items[0].relatedUnderstanding).toEqual(EMPTY_RELATED);

    prismadbMock.understandingEvidenceLink.findMany.mockClear();
    const topResponse = await route.GET(
      new Request(
        "http://localhost/api/contradiction?top=3&includeUnderstandingLinks=true"
      )
    );
    const topPayload = await topResponse.json();
    expect(Array.isArray(topPayload)).toBe(true);
    expect(topPayload[0]).not.toHaveProperty("relatedUnderstanding");
    expect(prismadbMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("contradiction detail: include flag off keeps default shape and include=true returns grouped/empty arrays with user-scoped query", async () => {
    const route = await import("../../app/api/contradiction/[id]/route");

    prismadbMock.understandingEvidenceLink.findMany.mockClear();
    const defaultResponse = await route.GET(
      new Request("http://localhost/api/contradiction/c1?includeUnderstandingLinks=0"),
      { params: Promise.resolve({ id: "c1" }) }
    );
    const defaultPayload = await defaultResponse.json();
    expect(defaultPayload).not.toHaveProperty("relatedUnderstanding");
    expect(prismadbMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { sourceId: "c1", targetType: "investigation", targetId: "inv-2" },
      { sourceId: "other", targetType: "model_update", targetId: "cross-user" },
    ]);
    const withLinksResponse = await route.GET(
      new Request(
        "http://localhost/api/contradiction/c1?includeUnderstandingLinks=true"
      ),
      { params: Promise.resolve({ id: "c1" }) }
    );
    const withLinksPayload = await withLinksResponse.json();
    expect(withLinksPayload.relatedUnderstanding).toEqual({
      userMapConclusionIds: [],
      investigationIds: ["inv-2"],
      modelUpdateIds: [],
      fieldworkAssignmentIds: [],
    });
    expect(prismadbMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          sourceType: "contradiction_node",
          sourceId: { in: ["c1"] },
        },
      })
    );

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);
    const emptyLinksResponse = await route.GET(
      new Request(
        "http://localhost/api/contradiction/c1?includeUnderstandingLinks=true"
      ),
      { params: Promise.resolve({ id: "c1" }) }
    );
    const emptyLinksPayload = await emptyLinksResponse.json();
    expect(emptyLinksPayload.relatedUnderstanding).toEqual(EMPTY_RELATED);
  });

  it("actions: include flag matrix keeps default shape and skips link query unless true", async () => {
    const route = await import("../../app/api/actions/route");
    for (const suffix of DISABLED_INCLUDE_VALUES) {
      prismadbMock.understandingEvidenceLink.findMany.mockClear();
      const response = await route.GET(
        new Request(`http://localhost/api/actions${suffix}`)
      );
      const payload = await response.json();
      expect(payload.stabilizeNow[0]).not.toHaveProperty("relatedUnderstanding");
      expect(payload.buildForward[0]).not.toHaveProperty("relatedUnderstanding");
      expect(prismadbMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
    }
  });

  it("actions: include=true adds grouped links for both buckets and returns empty arrays for unlinked items", async () => {
    const route = await import("../../app/api/actions/route");
    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { sourceId: "a1", targetType: "fieldwork_assignment", targetId: "fw-1" },
      { sourceId: "a1", targetType: "investigation", targetId: "inv-10" },
      { sourceId: "foreign", targetType: "model_update", targetId: "cross-user" },
    ]);

    const response = await route.GET(
      new Request("http://localhost/api/actions?includeUnderstandingLinks=true")
    );
    const payload = await response.json();
    expect(payload.stabilizeNow[0].relatedUnderstanding).toEqual({
      userMapConclusionIds: [],
      investigationIds: ["inv-10"],
      modelUpdateIds: [],
      fieldworkAssignmentIds: ["fw-1"],
    });
    expect(payload.buildForward[0].relatedUnderstanding).toEqual(EMPTY_RELATED);
    expect(prismadbMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          sourceType: "surfaced_action",
          sourceId: { in: ["a1", "a2"] },
        },
      })
    );
  });

  it("evidence list: include flag matrix keeps default shape and skips link query unless true", async () => {
    const route = await import("../../app/api/evidence/route");
    prismadbMock.evidenceSpan.findMany.mockResolvedValue([makeEvidenceSpan("es-1")]);

    for (const suffix of DISABLED_INCLUDE_VALUES) {
      prismadbMock.understandingEvidenceLink.findMany.mockClear();
      const response = await route.GET(
        new Request(`http://localhost/api/evidence?limit=30${suffix ? `&${suffix.slice(1)}` : ""}`)
      );
      const payload = await response.json();
      expect(payload.items[0]).not.toHaveProperty("relatedUnderstanding");
      expect(prismadbMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
    }
  });

  it("evidence list: include=true adds grouped links, returns empty arrays, and scopes query by user/source", async () => {
    const route = await import("../../app/api/evidence/route");
    prismadbMock.evidenceSpan.findMany.mockResolvedValue([makeEvidenceSpan("es-1")]);

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { sourceId: "es-1", targetType: "usermap_conclusion", targetId: "umc-9" },
      { sourceId: "es-1", targetType: "model_update", targetId: "mu-7" },
      { sourceId: "es-other", targetType: "investigation", targetId: "cross-user" },
    ]);
    const withLinksResponse = await route.GET(
      new Request(
        "http://localhost/api/evidence?limit=30&includeUnderstandingLinks=true"
      )
    );
    const withLinksPayload = await withLinksResponse.json();
    expect(withLinksPayload.items[0].relatedUnderstanding).toEqual({
      userMapConclusionIds: ["umc-9"],
      investigationIds: [],
      modelUpdateIds: ["mu-7"],
      fieldworkAssignmentIds: [],
    });
    expect(prismadbMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          sourceType: "evidence_span",
          sourceId: { in: ["es-1"] },
        },
      })
    );

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);
    const emptyResponse = await route.GET(
      new Request(
        "http://localhost/api/evidence?limit=30&includeUnderstandingLinks=true"
      )
    );
    const emptyPayload = await emptyResponse.json();
    expect(emptyPayload.items[0].relatedUnderstanding).toEqual(EMPTY_RELATED);
  });

  it("evidence detail: include=true uses evidence_span + detail id source mapping with user scoping and empty-array behavior", async () => {
    const route = await import("../../app/api/evidence/[id]/route");

    prismadbMock.understandingEvidenceLink.findMany.mockClear();
    const defaultResponse = await route.GET(
      new Request("http://localhost/api/evidence/es-1?includeUnderstandingLinks=false"),
      { params: Promise.resolve({ id: "es-1" }) }
    );
    const defaultPayload = await defaultResponse.json();
    expect(defaultPayload).not.toHaveProperty("relatedUnderstanding");
    expect(prismadbMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { sourceId: "es-1", targetType: "investigation", targetId: "inv-77" },
      { sourceId: "es-foreign", targetType: "usermap_conclusion", targetId: "cross-user" },
    ]);
    const withLinksResponse = await route.GET(
      new Request(
        "http://localhost/api/evidence/es-1?includeUnderstandingLinks=true"
      ),
      { params: Promise.resolve({ id: "es-1" }) }
    );
    const withLinksPayload = await withLinksResponse.json();
    expect(withLinksPayload.relatedUnderstanding).toEqual({
      userMapConclusionIds: [],
      investigationIds: ["inv-77"],
      modelUpdateIds: [],
      fieldworkAssignmentIds: [],
    });
    expect(prismadbMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          sourceType: "evidence_span",
          sourceId: { in: ["es-1"] },
        },
      })
    );

    prismadbMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);
    const emptyLinksResponse = await route.GET(
      new Request(
        "http://localhost/api/evidence/es-1?includeUnderstandingLinks=true"
      ),
      { params: Promise.resolve({ id: "es-1" }) }
    );
    const emptyLinksPayload = await emptyLinksResponse.json();
    expect(emptyLinksPayload.relatedUnderstanding).toEqual(EMPTY_RELATED);
  });
});
