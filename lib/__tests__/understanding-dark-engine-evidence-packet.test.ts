import { UnderstandingLinkSourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assembleEvidencePacketV1 } from "../understanding-dark-engine/evidence-packet";

type PatternClaimRow = {
  id: string;
  summary: string;
  status: string;
  sourceRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PatternClaimEvidenceRow = {
  id: string;
  claimId: string;
  source: string;
  sessionId: string | null;
  messageId: string | null;
  journalEntryId: string | null;
  quote: string | null;
  createdAt: Date;
};

type ContradictionNodeRow = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  createdAt: Date;
  lastTouchedAt: Date;
  lastEvidenceAt: Date | null;
};

type ContradictionEvidenceRow = {
  id: string;
  nodeId: string;
  sessionId: string | null;
  messageId: string | null;
  quote: string | null;
  createdAt: Date;
};

type ProfileArtifactRow = {
  id: string;
  type: string;
  claim: string;
  confidence: number;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

type EvidenceSpanRow = {
  id: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  createdAt: Date;
  message: {
    content: string;
    session: { origin: "APP" | "IMPORTED_ARCHIVE" };
  };
};

type ReferenceItemRow = {
  id: string;
  type: string;
  status: string;
  statement: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SurfacedActionRow = {
  id: string;
  bucket: string;
  status: string;
  note: string | null;
  surfacedAt: Date;
  updatedAt: Date;
  linkedClaimId: string | null;
};

type QuickCheckInRow = {
  id: string;
  stateTag: string | null;
  eventTags: string[];
  note: string | null;
  createdAt: Date;
};

type JournalEntryRow = {
  id: string;
  title: string | null;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRow = {
  id: string;
  origin: "APP" | "IMPORTED_ARCHIVE";
  startedAt: Date;
  createdAt: Date;
  label: string | null;
};

type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
  session: { origin: "APP" | "IMPORTED_ARCHIVE" };
};

type MessageOriginRow = {
  id: string;
  sessionId: string;
  session: { origin: "APP" | "IMPORTED_ARCHIVE" };
};

type ImportUploadSessionRow = {
  id: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  processedConversations: number;
  processedMessages: number;
};

type ImportUploadChunkRow = {
  id: string;
  sessionId: string;
  sizeBytes: number;
  createdAt: Date;
};

type DerivationRunRow = {
  id: string;
  scope: string;
};

type ProfileArtifactEvidenceLinkRow = {
  artifactId: string;
  spanId: string;
  span: {
    message: {
      session: { origin: "APP" | "IMPORTED_ARCHIVE" };
    };
  };
};

type ModelUpdateCorrectionRow = {
  id: string;
  userFacingSummary: string;
  createdAt: Date;
};

type UserMapCorrectionRow = {
  id: string;
  lastUserCorrectionAt: Date | null;
  lastUserCorrectionLabel: string | null;
};

type MockState = {
  patternClaims: PatternClaimRow[];
  patternClaimEvidence: PatternClaimEvidenceRow[];
  contradictionNodes: ContradictionNodeRow[];
  contradictionEvidence: ContradictionEvidenceRow[];
  profileArtifacts: ProfileArtifactRow[];
  evidenceSpans: EvidenceSpanRow[];
  referenceItems: ReferenceItemRow[];
  surfacedActions: SurfacedActionRow[];
  quickCheckIns: QuickCheckInRow[];
  journalEntries: JournalEntryRow[];
  sessions: SessionRow[];
  messages: MessageRow[];
  messageOrigins: MessageOriginRow[];
  importSessions: ImportUploadSessionRow[];
  importChunks: ImportUploadChunkRow[];
  derivationRuns: DerivationRunRow[];
  profileArtifactEvidenceLinks: ProfileArtifactEvidenceLinkRow[];
  correctionUpdates: ModelUpdateCorrectionRow[];
  correctionConclusions: UserMapCorrectionRow[];
};

function createDbMock() {
  return {
    patternClaim: { findMany: vi.fn() },
    patternClaimEvidence: { findMany: vi.fn() },
    contradictionNode: { findMany: vi.fn() },
    contradictionEvidence: { findMany: vi.fn() },
    profileArtifact: { findMany: vi.fn() },
    evidenceSpan: { findMany: vi.fn() },
    referenceItem: { findMany: vi.fn() },
    surfacedAction: { findMany: vi.fn() },
    quickCheckIn: { findMany: vi.fn() },
    journalEntry: { findMany: vi.fn() },
    session: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    importUploadSession: { findMany: vi.fn() },
    importUploadChunk: { findMany: vi.fn() },
    derivationRun: { findMany: vi.fn() },
    profileArtifactEvidenceLink: { findMany: vi.fn() },
    modelUpdate: { findMany: vi.fn() },
    userMapConclusion: { findMany: vi.fn() },
  };
}

function createDefaultState(): MockState {
  return {
    patternClaims: [
      {
        id: "pc-1",
        summary: "I avoid difficult conversations",
        status: "active",
        sourceRunId: null,
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
        updatedAt: new Date("2026-05-10T10:00:00.000Z"),
      },
    ],
    patternClaimEvidence: [
      {
        id: "pce-1",
        claimId: "pc-1",
        source: "derivation",
        sessionId: "s-app-1",
        messageId: "m-app-1",
        journalEntryId: null,
        quote: "I keep avoiding this because I panic when conflict starts.",
        createdAt: new Date("2026-05-10T11:00:00.000Z"),
      },
    ],
    contradictionNodes: [
      {
        id: "cn-1",
        title: "Goal behavior gap",
        sideA: "Wants stability",
        sideB: "Avoids hard planning",
        status: "open",
        sourceSessionId: "s-app-1",
        sourceMessageId: "m-app-1",
        createdAt: new Date("2026-05-09T10:00:00.000Z"),
        lastTouchedAt: new Date("2026-05-10T12:00:00.000Z"),
        lastEvidenceAt: new Date("2026-05-10T12:00:00.000Z"),
      },
    ],
    contradictionEvidence: [
      {
        id: "ce-1",
        nodeId: "cn-1",
        sessionId: "s-app-1",
        messageId: "m-app-1",
        quote: "I avoid hard planning.",
        createdAt: new Date("2026-05-10T12:00:00.000Z"),
      },
    ],
    profileArtifacts: [
      {
        id: "pa-1",
        type: "FEAR",
        claim: "I fear rejection in conflict",
        confidence: 0.7,
        status: "candidate",
        firstSeenAt: new Date("2026-05-02T10:00:00.000Z"),
        lastSeenAt: new Date("2026-05-10T10:00:00.000Z"),
      },
    ],
    evidenceSpans: [
      {
        id: "es-app-1",
        messageId: "m-app-1",
        charStart: 0,
        charEnd: 48,
        createdAt: new Date("2026-05-10T11:30:00.000Z"),
        message: {
          content: "I panic quickly and shut down when conflict appears.",
          session: {
            origin: "APP",
          },
        },
      },
      {
        id: "es-import-1",
        messageId: "m-import-1",
        charStart: 0,
        charEnd: 44,
        createdAt: new Date("2026-05-10T11:31:00.000Z"),
        message: {
          content: "Imported user note about conflict avoidance.",
          session: {
            origin: "IMPORTED_ARCHIVE",
          },
        },
      },
    ],
    referenceItems: [
      {
        id: "ref-1",
        type: "pattern",
        status: "active",
        statement: "Conflict is overwhelming",
        sourceSessionId: "s-app-1",
        sourceMessageId: "m-app-1",
        createdAt: new Date("2026-05-03T10:00:00.000Z"),
        updatedAt: new Date("2026-05-10T10:00:00.000Z"),
      },
    ],
    surfacedActions: [],
    quickCheckIns: [
      {
        id: "qc-1",
        stateTag: "stressed",
        eventTags: ["pressure"],
        note: "I felt panicked today",
        createdAt: new Date("2026-05-10T13:00:00.000Z"),
      },
    ],
    journalEntries: [
      {
        id: "j-1",
        title: "Reflecting on conflict",
        body: "I felt more regulated by the end of the day.",
        authoredAt: new Date("2026-05-09T13:00:00.000Z"),
        createdAt: new Date("2026-05-09T13:00:00.000Z"),
        updatedAt: new Date("2026-05-09T13:00:00.000Z"),
      },
    ],
    sessions: [
      {
        id: "s-app-1",
        origin: "APP",
        startedAt: new Date("2026-05-10T10:00:00.000Z"),
        createdAt: new Date("2026-05-10T10:00:00.000Z"),
        label: "Morning session",
      },
      {
        id: "s-import-1",
        origin: "IMPORTED_ARCHIVE",
        startedAt: new Date("2026-05-05T10:00:00.000Z"),
        createdAt: new Date("2026-05-05T10:00:00.000Z"),
        label: "Imported session",
      },
    ],
    messages: [
      {
        id: "m-app-1",
        sessionId: "s-app-1",
        role: "user",
        content: "I panic and avoid conflict.",
        createdAt: new Date("2026-05-10T10:05:00.000Z"),
        session: {
          origin: "APP",
        },
      },
      {
        id: "m-import-1",
        sessionId: "s-import-1",
        role: "user",
        content: "Imported: conflict pattern appears often.",
        createdAt: new Date("2026-05-05T10:05:00.000Z"),
        session: {
          origin: "IMPORTED_ARCHIVE",
        },
      },
    ],
    messageOrigins: [
      {
        id: "m-app-1",
        sessionId: "s-app-1",
        session: {
          origin: "APP",
        },
      },
      {
        id: "m-import-1",
        sessionId: "s-import-1",
        session: {
          origin: "IMPORTED_ARCHIVE",
        },
      },
    ],
    importSessions: [
      {
        id: "imp-1",
        status: "complete",
        createdAt: new Date("2026-05-05T10:00:00.000Z"),
        startedAt: new Date("2026-05-05T10:01:00.000Z"),
        finishedAt: new Date("2026-05-05T10:02:00.000Z"),
        processedConversations: 3,
        processedMessages: 40,
      },
    ],
    importChunks: [
      {
        id: "imp-chunk-1",
        sessionId: "imp-1",
        sizeBytes: 4096,
        createdAt: new Date("2026-05-05T10:01:30.000Z"),
      },
    ],
    derivationRuns: [
      {
        id: "run-import-1",
        scope: "import",
      },
      {
        id: "run-native-1",
        scope: "native",
      },
      {
        id: "run-manual-1",
        scope: "manual",
      },
    ],
    profileArtifactEvidenceLinks: [
      {
        artifactId: "pa-1",
        spanId: "es-app-1",
        span: {
          message: {
            session: {
              origin: "APP",
            },
          },
        },
      },
    ],
    correctionUpdates: [
      {
        id: "mu-correction-1",
        userFacingSummary: "User corrected prior framing",
        createdAt: new Date("2026-05-10T14:00:00.000Z"),
      },
    ],
    correctionConclusions: [
      {
        id: "umc-1",
        lastUserCorrectionAt: new Date("2026-05-10T14:30:00.000Z"),
        lastUserCorrectionLabel: "Partly right",
      },
    ],
  };
}

function createFixture() {
  const state = createDefaultState();
  const db = createDbMock();

  db.patternClaim.findMany.mockImplementation(async () => state.patternClaims);
  db.patternClaimEvidence.findMany.mockImplementation(
    async () => state.patternClaimEvidence
  );
  db.contradictionNode.findMany.mockImplementation(async () => state.contradictionNodes);
  db.contradictionEvidence.findMany.mockImplementation(
    async () => state.contradictionEvidence
  );
  db.profileArtifact.findMany.mockImplementation(async () => state.profileArtifacts);
  db.evidenceSpan.findMany.mockImplementation(async () => state.evidenceSpans);
  db.referenceItem.findMany.mockImplementation(async () => state.referenceItems);
  db.surfacedAction.findMany.mockImplementation(async () => state.surfacedActions);
  db.quickCheckIn.findMany.mockImplementation(async () => state.quickCheckIns);
  db.journalEntry.findMany.mockImplementation(async () => state.journalEntries);
  db.session.findMany.mockImplementation(async () => state.sessions);
  db.message.findMany.mockImplementation(async (args: { select: Record<string, unknown> }) => {
    if ("role" in args.select) {
      return state.messages;
    }
    return state.messageOrigins;
  });
  db.importUploadSession.findMany.mockImplementation(async () => state.importSessions);
  db.importUploadChunk.findMany.mockImplementation(async () => state.importChunks);
  db.derivationRun.findMany.mockImplementation(async () => state.derivationRuns);
  db.profileArtifactEvidenceLink.findMany.mockImplementation(
    async () => state.profileArtifactEvidenceLinks
  );
  db.modelUpdate.findMany.mockImplementation(async () => state.correctionUpdates);
  db.userMapConclusion.findMany.mockImplementation(async () => state.correctionConclusions);

  return { db, state };
}

function findSourceOrigins(
  packet: Awaited<ReturnType<typeof assembleEvidencePacketV1>>,
  sourceType: UnderstandingLinkSourceType
): string[] {
  return packet.items
    .filter((item) => item.sourceType === sourceType)
    .map((item) => item.origin);
}

describe("Phase 2 dark engine EvidencePacket assembly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles typed packet items and metrics across source families", async () => {
    const { db } = createFixture();

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      db,
    });

    expect(packet.userId).toBe("user-1");
    expect(packet.items.length).toBeGreaterThan(0);

    const sourceTypes = new Set(packet.items.map((item) => item.sourceType));

    expect(sourceTypes.has(UnderstandingLinkSourceType.pattern_claim)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.pattern_claim_evidence)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.profile_artifact)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.quick_check_in)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.timeline_aggregation)).toBe(true);
    expect(sourceTypes.has(UnderstandingLinkSourceType.user_correction)).toBe(true);

    expect(packet.metrics.sourceDiversity).toBeGreaterThanOrEqual(6);
    expect(packet.metrics.sourceCounts.pattern_claim).toBe(1);
    expect(packet.metrics.highEmotionItemCount).toBeGreaterThan(0);
    expect(packet.metrics.importedCount).toBeGreaterThan(0);
  });

  it("treats timeline_aggregation and user_correction as non-linkable context sources", async () => {
    const { db } = createFixture();

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      db,
    });

    const contextItems = packet.items.filter(
      (item) =>
        item.sourceType === UnderstandingLinkSourceType.timeline_aggregation ||
        item.sourceType === UnderstandingLinkSourceType.user_correction
    );

    expect(contextItems.length).toBeGreaterThan(0);
    for (const item of contextItems) {
      expect(item.linkable).toBe(false);
      expect(item.ownershipResolvable).toBe(false);
      expect(item.qualityFlags).toContain("NON_LINKABLE_CONTEXT");
    }

    expect(packet.metrics.nonLinkableContextItems).toBeGreaterThanOrEqual(
      contextItems.length
    );
  });

  it("derives pattern_claim origin as imported from imported claim evidence", async () => {
    const { db, state } = createFixture();

    state.patternClaimEvidence = [
      {
        ...state.patternClaimEvidence[0]!,
        sessionId: "s-import-1",
        messageId: "m-import-1",
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.pattern_claim)).toEqual([
      "imported",
    ]);
  });

  it("derives pattern_claim origin as native from native claim evidence", async () => {
    const { db, state } = createFixture();

    state.patternClaimEvidence = [
      {
        ...state.patternClaimEvidence[0]!,
        sessionId: "s-app-1",
        messageId: "m-app-1",
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.pattern_claim)).toEqual([
      "native",
    ]);
  });

  it("derives pattern_claim origin as mixed when claim evidence mixes native and imported", async () => {
    const { db, state } = createFixture();

    state.patternClaimEvidence = [
      {
        ...state.patternClaimEvidence[0]!,
        id: "pce-app",
        sessionId: "s-app-1",
        messageId: "m-app-1",
      },
      {
        ...state.patternClaimEvidence[0]!,
        id: "pce-import",
        sessionId: "s-import-1",
        messageId: "m-import-1",
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.pattern_claim)).toEqual([
      "mixed",
    ]);
  });

  it("keeps pattern_claim origin unknown when provenance is unresolvable", async () => {
    const { db, state } = createFixture();

    state.patternClaims = [
      {
        ...state.patternClaims[0]!,
        sourceRunId: null,
      },
    ];
    state.patternClaimEvidence = [
      {
        ...state.patternClaimEvidence[0]!,
        sessionId: "s-missing",
        messageId: "m-missing",
        journalEntryId: null,
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.pattern_claim)).toEqual([
      "unknown",
    ]);
  });

  it("falls back pattern_claim origin from safe sourceRun scope when evidence is unresolvable", async () => {
    const { db, state } = createFixture();

    state.patternClaims = [
      {
        ...state.patternClaims[0]!,
        sourceRunId: "run-import-1",
      },
    ];
    state.patternClaimEvidence = [
      {
        ...state.patternClaimEvidence[0]!,
        sessionId: "s-missing",
        messageId: "m-missing",
        journalEntryId: null,
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.pattern_claim)).toEqual([
      "imported",
    ]);
  });

  it("derives profile_artifact origin as imported from linked imported spans", async () => {
    const { db, state } = createFixture();

    state.profileArtifactEvidenceLinks = [
      {
        artifactId: "pa-1",
        spanId: "es-import-1",
        span: {
          message: {
            session: {
              origin: "IMPORTED_ARCHIVE",
            },
          },
        },
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.profile_artifact)).toEqual([
      "imported",
    ]);
  });

  it("derives profile_artifact origin as native from linked native spans", async () => {
    const { db, state } = createFixture();

    state.profileArtifactEvidenceLinks = [
      {
        artifactId: "pa-1",
        spanId: "es-app-1",
        span: {
          message: {
            session: {
              origin: "APP",
            },
          },
        },
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.profile_artifact)).toEqual([
      "native",
    ]);
  });

  it("derives profile_artifact origin as mixed from mixed linked spans", async () => {
    const { db, state } = createFixture();

    state.profileArtifactEvidenceLinks = [
      {
        artifactId: "pa-1",
        spanId: "es-app-1",
        span: {
          message: {
            session: {
              origin: "APP",
            },
          },
        },
      },
      {
        artifactId: "pa-1",
        spanId: "es-import-1",
        span: {
          message: {
            session: {
              origin: "IMPORTED_ARCHIVE",
            },
          },
        },
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.profile_artifact)).toEqual([
      "mixed",
    ]);
  });

  it("keeps profile_artifact origin unknown when there are no linked spans", async () => {
    const { db, state } = createFixture();

    state.profileArtifactEvidenceLinks = [];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.profile_artifact)).toEqual([
      "unknown",
    ]);
  });

  it("uses session-only fallback when messageId is absent", async () => {
    const { db, state } = createFixture();

    state.patternClaims = [
      {
        ...state.patternClaims[0]!,
        sourceRunId: null,
      },
    ];
    state.patternClaimEvidence = [
      {
        ...state.patternClaimEvidence[0]!,
        messageId: null,
        sessionId: "s-import-1",
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(
      findSourceOrigins(packet, UnderstandingLinkSourceType.pattern_claim_evidence)
    ).toEqual(["imported"]);
    expect(findSourceOrigins(packet, UnderstandingLinkSourceType.pattern_claim)).toEqual([
      "imported",
    ]);
  });

  it("updates imported/native/mixed/unknown counts while preserving sourceCounts and link semantics", async () => {
    const { db, state } = createFixture();

    state.quickCheckIns = [];
    state.correctionUpdates = [];
    state.correctionConclusions = [];
    state.importSessions = [];
    state.importChunks = [];
    state.contradictionNodes = [];
    state.contradictionEvidence = [];
    state.referenceItems = [];
    state.journalEntries = [];
    state.evidenceSpans = [
      {
        ...state.evidenceSpans[1]!,
      },
    ];

    state.patternClaims = [
      {
        ...state.patternClaims[0]!,
        sourceRunId: null,
      },
    ];
    state.patternClaimEvidence = [
      {
        ...state.patternClaimEvidence[0]!,
        id: "pce-app",
        sessionId: "s-app-1",
        messageId: "m-app-1",
      },
      {
        ...state.patternClaimEvidence[0]!,
        id: "pce-import",
        sessionId: "s-import-1",
        messageId: "m-import-1",
      },
    ];
    state.profileArtifactEvidenceLinks = [
      {
        artifactId: "pa-1",
        spanId: "es-app-1",
        span: {
          message: {
            session: {
              origin: "APP",
            },
          },
        },
      },
      {
        artifactId: "pa-1",
        spanId: "es-import-1",
        span: {
          message: {
            session: {
              origin: "IMPORTED_ARCHIVE",
            },
          },
        },
      },
    ];

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    expect(packet.metrics.importedCount).toBe(4);
    expect(packet.metrics.nativeCount).toBe(3);
    expect(packet.metrics.mixedCount).toBe(2);
    expect(packet.metrics.unknownOriginCount).toBe(0);

    expect(packet.metrics.sourceCounts.pattern_claim).toBe(1);
    expect(packet.metrics.sourceCounts.pattern_claim_evidence).toBe(2);
    expect(packet.metrics.sourceCounts.profile_artifact).toBe(1);
    expect(packet.metrics.sourceCounts.evidence_span).toBe(1);
    expect(packet.metrics.sourceCounts.session).toBe(2);
    expect(packet.metrics.sourceCounts.message).toBe(2);

    for (const item of packet.items) {
      expect(item.linkable).toBe(true);
      expect(item.ownershipResolvable).toBe(true);
    }
  });

  it("keeps profile artifacts low-to-moderate weight class with linkable semantics", async () => {
    const { db } = createFixture();

    const packet = await assembleEvidencePacketV1({
      userId: "user-1",
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
      db,
    });

    const profileItems = packet.items.filter(
      (item) => item.sourceType === UnderstandingLinkSourceType.profile_artifact
    );

    expect(profileItems.length).toBeGreaterThan(0);
    for (const item of profileItems) {
      expect(item.weightClass).toBe("low_to_moderate");
      expect(item.linkable).toBe(true);
      expect(item.ownershipResolvable).toBe(true);
    }
  });
});
