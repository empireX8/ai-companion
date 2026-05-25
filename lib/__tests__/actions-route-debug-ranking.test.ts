import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const projectVisiblePatternClaimMock = vi.fn();
const buildCurrentPrioritySnapshotMock = vi.fn();
const selectBuildForwardActionBlueprintsMock = vi.fn();
const selectStabilizeActionBlueprintsMock = vi.fn();
const syncSurfacedActionsMock = vi.fn();
const isIncludeUnderstandingLinksEnabledMock = vi.fn();
const buildRelatedUnderstandingBySourceIdMock = vi.fn();

const surfacedActionFindManyMock = vi.fn();
const prismadbMock = {
  patternClaim: {
    findMany: vi.fn(),
  },
  referenceItem: {
    findMany: vi.fn(),
  },
  surfacedAction: {
    findMany: surfacedActionFindManyMock,
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismadbMock,
}));

vi.mock("@/lib/pattern-visible-claim", () => ({
  projectVisiblePatternClaim: projectVisiblePatternClaimMock,
}));

vi.mock("@/lib/actions-v1", () => ({
  buildCurrentPrioritySnapshot: buildCurrentPrioritySnapshotMock,
  selectBuildForwardActionBlueprints: selectBuildForwardActionBlueprintsMock,
  selectStabilizeActionBlueprints: selectStabilizeActionBlueprintsMock,
  syncSurfacedActions: syncSurfacedActionsMock,
}));

vi.mock("@/lib/understanding-links", () => ({
  buildRelatedUnderstandingBySourceId: buildRelatedUnderstandingBySourceIdMock,
  isIncludeUnderstandingLinksEnabled: isIncludeUnderstandingLinksEnabledMock,
}));

function makePatternClaim() {
  return {
    id: "pc-1",
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
    id: "pc-1",
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

function makeAction(
  id: string,
  bucket: "stabilize" | "build",
  note = "private note should not appear in debug payload"
) {
  return {
    id,
    title: `${id} title`,
    whySuggested: `${id} why`,
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
    note,
    surfacedAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  authMock.mockResolvedValue({ userId: "u1" });
  prismadbMock.patternClaim.findMany.mockResolvedValue([makePatternClaim()]);
  prismadbMock.referenceItem.findMany.mockResolvedValue([]);

  projectVisiblePatternClaimMock.mockReturnValue(makeProjectedPatternClaim());
  buildCurrentPrioritySnapshotMock.mockReturnValue({
    featured: [],
    totalActive: 1,
    totalCandidate: 0,
    hasData: true,
  });
  selectBuildForwardActionBlueprintsMock.mockReturnValue([]);
  selectStabilizeActionBlueprintsMock.mockReturnValue([]);
  syncSurfacedActionsMock.mockResolvedValue([
    makeAction("a1", "stabilize"),
    makeAction("a2", "build"),
    makeAction("a3", "stabilize"),
  ]);

  isIncludeUnderstandingLinksEnabledMock.mockReturnValue(false);
  buildRelatedUnderstandingBySourceIdMock.mockResolvedValue(new Map());

  surfacedActionFindManyMock.mockImplementation(async (args) => {
    if ("id" in args.select) {
      return [
        { id: "a1", templateId: "s1" },
        { id: "a2", templateId: "b2" },
        { id: "a3", templateId: "s3" },
      ];
    }

    return [
      {
        templateId: "s1",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "helped",
        updatedAt: new Date("2026-05-01T10:00:00.000Z"),
      },
      {
        templateId: "s1",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "helped",
        updatedAt: new Date("2026-05-02T10:00:00.000Z"),
      },
      {
        templateId: "s1",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "helped",
        updatedAt: new Date("2026-05-03T10:00:00.000Z"),
      },
      {
        templateId: "b2",
        bucket: "build",
        linkedFamily: null,
        effort: "Low",
        status: "didnt_help",
        updatedAt: new Date("2026-05-01T10:00:00.000Z"),
      },
      {
        templateId: "b2",
        bucket: "build",
        linkedFamily: null,
        effort: "Low",
        status: "didnt_help",
        updatedAt: new Date("2026-05-02T10:00:00.000Z"),
      },
      {
        templateId: "b2",
        bucket: "build",
        linkedFamily: null,
        effort: "Low",
        status: "didnt_help",
        updatedAt: new Date("2026-05-03T10:00:00.000Z"),
      },
      {
        templateId: "s3",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "helped",
        updatedAt: new Date("2026-05-01T10:00:00.000Z"),
      },
      {
        templateId: "s3",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "helped",
        updatedAt: new Date("2026-05-02T10:00:00.000Z"),
      },
      {
        templateId: "s3",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "helped",
        updatedAt: new Date("2026-05-03T10:00:00.000Z"),
      },
      {
        templateId: "s3",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "didnt_help",
        updatedAt: new Date("2026-05-04T10:00:00.000Z"),
      },
      {
        templateId: "s3",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "didnt_help",
        updatedAt: new Date("2026-05-05T10:00:00.000Z"),
      },
      {
        templateId: "s3",
        bucket: "stabilize",
        linkedFamily: "trigger_condition",
        effort: "Low",
        status: "didnt_help",
        updatedAt: new Date("2026-05-06T10:00:00.000Z"),
      },
    ];
  });
});

describe("GET /api/actions debugRanking simulation gate", () => {
  it("keeps default response shape unchanged when debugRanking is not requested", async () => {
    const route = await import("../../app/api/actions/route");
    const response = await route.GET(new Request("http://localhost/api/actions"));
    const payload = await response.json();

    expect(payload).toEqual({
      currentPriority: {
        featured: [],
        totalActive: 1,
        totalCandidate: 0,
        hasData: true,
      },
      stabilizeNow: [makeAction("a1", "stabilize"), makeAction("a3", "stabilize")],
      buildForward: [makeAction("a2", "build")],
    });
    expect(payload).not.toHaveProperty("rankingDiagnostics");
    expect(payload).not.toHaveProperty("simulatedRankingPreview");
    expect(surfacedActionFindManyMock).not.toHaveBeenCalled();
  });

  it("adds diagnostics and simulated preview only when debugRanking=1", async () => {
    const route = await import("../../app/api/actions/route");
    const response = await route.GET(
      new Request("http://localhost/api/actions?debugRanking=1")
    );
    const payload = await response.json();

    expect(payload.stabilizeNow.map((action: { id: string }) => action.id)).toEqual([
      "a1",
      "a3",
    ]);
    expect(payload.buildForward.map((action: { id: string }) => action.id)).toEqual([
      "a2",
    ]);

    expect(payload.rankingDiagnostics).toEqual([
      {
        templateId: "b2",
        helpedCount: 0,
        didntHelpCount: 3,
        repeatedHelped: false,
        repeatedDidntHelp: true,
        suggestedRankingHint: "suppress",
      },
      {
        templateId: "s1",
        helpedCount: 3,
        didntHelpCount: 0,
        repeatedHelped: true,
        repeatedDidntHelp: false,
        suggestedRankingHint: "promote",
      },
      {
        templateId: "s3",
        helpedCount: 3,
        didntHelpCount: 3,
        repeatedHelped: true,
        repeatedDidntHelp: true,
        suggestedRankingHint: "neutral",
      },
    ]);

    expect(payload.simulatedRankingPreview).toEqual([
      {
        actionId: "a1",
        templateId: "s1",
        originalIndex: 0,
        simulatedIndex: 0,
        suggestedRankingHint: "promote",
      },
      {
        actionId: "a3",
        templateId: "s3",
        originalIndex: 2,
        simulatedIndex: 1,
        suggestedRankingHint: "neutral",
      },
      {
        actionId: "a2",
        templateId: "b2",
        originalIndex: 1,
        simulatedIndex: 2,
        suggestedRankingHint: "suppress",
      },
    ]);

    const helperQueryCall = surfacedActionFindManyMock.mock.calls[0]?.[0];
    expect(helperQueryCall).toEqual(
      expect.objectContaining({
        where: { userId: "u1" },
        select: expect.objectContaining({
          templateId: true,
          bucket: true,
          linkedFamily: true,
          status: true,
          updatedAt: true,
        }),
      })
    );

    const mappingQueryCall = surfacedActionFindManyMock.mock.calls[1]?.[0];
    expect(mappingQueryCall).toEqual({
      where: {
        userId: "u1",
        id: { in: ["a1", "a2", "a3"] },
      },
      select: {
        id: true,
        templateId: true,
      },
    });

    expect(
      Object.keys(payload.simulatedRankingPreview[0] as Record<string, unknown>)
    ).toEqual([
      "actionId",
      "templateId",
      "originalIndex",
      "simulatedIndex",
      "suggestedRankingHint",
    ]);

    const debugOnly = JSON.stringify({
      rankingDiagnostics: payload.rankingDiagnostics,
      simulatedRankingPreview: payload.simulatedRankingPreview,
    });
    expect(debugOnly).not.toContain("private note should not appear");
    expect(debugOnly).not.toContain("raw evidence");
  });
});
