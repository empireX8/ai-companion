import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const {
  assembleEvidencePacketV1Mock,
  verifySourceOwnershipMock,
  verifyTargetOwnershipMock,
  persistInvestigationMock,
  persistFieldworkMock,
  persistModelUpdateMock,
  publishInvestigationMock,
  publishFieldworkMock,
  publishModelUpdateMock,
  updateInvestigationLifecycleMock,
  updateFieldworkLifecycleMock,
  findInvestigationFixtureMock,
  findFieldworkFixtureMock,
  findModelUpdateFixtureMock,
} = vi.hoisted(() => ({
  assembleEvidencePacketV1Mock: vi.fn(),
  verifySourceOwnershipMock: vi.fn(),
  verifyTargetOwnershipMock: vi.fn(),
  persistInvestigationMock: vi.fn(),
  persistFieldworkMock: vi.fn(),
  persistModelUpdateMock: vi.fn(),
  publishInvestigationMock: vi.fn(),
  publishFieldworkMock: vi.fn(),
  publishModelUpdateMock: vi.fn(),
  updateInvestigationLifecycleMock: vi.fn(),
  updateFieldworkLifecycleMock: vi.fn(),
  findInvestigationFixtureMock: vi.fn(),
  findFieldworkFixtureMock: vi.fn(),
  findModelUpdateFixtureMock: vi.fn(),
}));

vi.mock("../understanding-dark-engine/evidence-packet", () => ({
  assembleEvidencePacketV1: assembleEvidencePacketV1Mock,
}));

vi.mock("../understanding-evidence-link-writer", () => ({
  verifyUnderstandingEvidenceLinkSourceOwnership: verifySourceOwnershipMock,
  verifyUnderstandingEvidenceLinkTargetOwnership: verifyTargetOwnershipMock,
}));

vi.mock("../understanding-dark-engine/investigation-candidate-persistence", () => ({
  persistInternalInvestigationCandidate: persistInvestigationMock,
}));

vi.mock("../understanding-dark-engine/fieldwork-candidate-persistence", () => ({
  persistInternalFieldworkCandidate: persistFieldworkMock,
}));

vi.mock("../understanding-dark-engine/model-update-candidate-persistence", () => ({
  persistInternalModelUpdateCandidate: persistModelUpdateMock,
}));

vi.mock("../investigation-publish-helper", () => ({
  publishInvestigationCandidate: publishInvestigationMock,
}));

vi.mock("../fieldwork-publish-helper", () => ({
  publishFieldworkCandidate: publishFieldworkMock,
}));

vi.mock("../model-update-candidate-publish-helper", () => ({
  publishModelUpdateCandidate: publishModelUpdateMock,
}));

vi.mock("../investigation-candidate-lifecycle-persistence", () => ({
  updateInvestigationCandidateLifecycleStatus: updateInvestigationLifecycleMock,
}));

vi.mock("../fieldwork-candidate-lifecycle-persistence", () => ({
  updateFieldworkCandidateLifecycleStatus: updateFieldworkLifecycleMock,
}));

import {
  DEV_FIXTURE_MARKER,
  type LowerFamilyFixtureExecuteReport,
  parseSeedLowerFamilyValidationFixturesCliArgs,
  runSeedLowerFamilyValidationFixtures,
  runSeedLowerFamilyValidationFixturesPreflight,
  selectFixtureEvidenceFromPacket,
} from "../seed-lower-family-validation-fixtures";
import type { EvidencePacket } from "../understanding-dark-engine/types";

const NOW = new Date("2026-06-09T12:00:00.000Z");
const USER_ID = "user-1";

type PacketItemInput = {
  sourceType: EvidencePacket["items"][number]["sourceType"];
  sourceId: string;
  role?: EvidencePacket["items"][number]["role"];
  linkable: boolean;
  ownershipResolvable: boolean;
  origin: EvidencePacket["items"][number]["origin"];
  messageId?: string;
  sessionId?: string;
};

function buildPacket(items: PacketItemInput[]): EvidencePacket {
  const linkableEvidenceCount = items.filter((item) => item.linkable).length;
  const ownershipResolvableCount = items.filter((item) => item.ownershipResolvable).length;

  return {
    userId: USER_ID,
    assembledAt: NOW,
    windowStart: new Date("2026-01-01T00:00:00.000Z"),
    windowEnd: NOW,
    items: items.map((item, index) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      role: item.role ?? "signal",
      weightClass: "moderate" as const,
      sourceFamily: item.sourceType,
      timestamp: new Date(NOW.getTime() - index * 1000),
      authoredAt: null,
      snippet: `snippet-${item.sourceId}`,
      quote: `quote-${item.sourceId}`,
      publicSafetyLevel: "internal_only" as const,
      publicSafeSummary: null,
      containsRawPrivateText: true,
      provenanceRefs: {
        messageId: item.messageId,
        sessionId: item.sessionId,
      },
      qualityFlags: [],
      linkable: item.linkable,
      ownershipResolvable: item.ownershipResolvable,
      highEmotionSignal: false,
      origin: item.origin,
      episodeKey: null,
    })),
    metrics: {
      evidenceCount: items.length,
      linkableEvidenceCount,
      ownershipResolvableCount,
      sourceCounts: Object.fromEntries(
        [...new Set(items.map((item) => item.sourceType))].map((sourceType) => [
          sourceType,
          items.filter((item) => item.sourceType === sourceType).length,
        ])
      ),
      sourceDiversity: new Set(items.map((item) => item.sourceType)).size,
      timeSpreadDays: 7,
      importedCount: 0,
      nativeCount: items.length,
      mixedCount: 0,
      unknownOriginCount: 0,
      highEmotionItemCount: 0,
      nonLinkableContextItems: items.filter((item) => !item.linkable).length,
      quoteQualityLowCount: 0,
      receiptCount: items.filter((item) => item.role === "receipt").length,
      unresolvedContradictionCount: 0,
      correctionSignalCount: 0,
      distinctEpisodeCount: 1,
    },
  };
}

function makeDb(): PrismaClient {
  return {
    patternClaim: {
      count: vi.fn().mockResolvedValue(2),
    },
    message: {
      count: vi.fn().mockResolvedValue(10),
    },
    contradictionNode: {
      count: vi.fn().mockResolvedValue(1),
    },
  } as unknown as PrismaClient;
}

function asExecuteReport(report: Awaited<ReturnType<typeof runSeedLowerFamilyValidationFixtures>>) {
  expect(report.dryRun).toBe(false);
  return report as LowerFamilyFixtureExecuteReport;
}

function makePersistResult(args: {
  id: string;
  idField: "persistedInvestigationId" | "persistedFieldworkAssignmentId" | "persistedModelUpdateId";
  candidatesWritten?: number;
  evidenceLinksWritten?: number;
  blockedWriteReasons?: string[];
}) {
  return {
    runId: "run-1",
    artifactId: "artifact-1",
    artifactType: "diagnostics",
    processorVersion: "understanding-dark-engine-v1",
    runCreatedAt: NOW.toISOString(),
    persistedAt: NOW.toISOString(),
    diagnostics: {},
    payload: {
      candidatesWritten: args.candidatesWritten ?? 1,
      evidenceLinksWritten: args.evidenceLinksWritten ?? 2,
      blockedWriteReasons: args.blockedWriteReasons ?? [],
    },
    [args.idField]: args.id,
  };
}

describe("seed lower-family validation fixtures preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assembleEvidencePacketV1Mock.mockResolvedValue(
      buildPacket([
        {
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "signal",
          linkable: true,
          ownershipResolvable: true,
          origin: "native",
        },
        {
          sourceType: "message",
          sourceId: "msg-1",
          role: "receipt",
          linkable: true,
          ownershipResolvable: true,
          origin: "native",
          messageId: "msg-1",
          sessionId: "session-1",
        },
      ])
    );
    verifySourceOwnershipMock.mockResolvedValue(true);
    verifyTargetOwnershipMock.mockResolvedValue(true);
    findInvestigationFixtureMock.mockResolvedValue(null);
    findFieldworkFixtureMock.mockResolvedValue(null);
    findModelUpdateFixtureMock.mockResolvedValue(null);
    persistInvestigationMock.mockResolvedValue(
      makePersistResult({
        id: "inv-created",
        idField: "persistedInvestigationId",
      })
    );
    persistFieldworkMock.mockResolvedValue(
      makePersistResult({
        id: "fw-created",
        idField: "persistedFieldworkAssignmentId",
      })
    );
    persistModelUpdateMock.mockResolvedValue(
      makePersistResult({
        id: "mu-created",
        idField: "persistedModelUpdateId",
      })
    );
  });

  it("requires explicit user id", () => {
    expect(parseSeedLowerFamilyValidationFixturesCliArgs([])).toEqual({
      ok: false,
      message: "--user-id is required.",
    });
  });

  it("parses execute mode and family filters", () => {
    expect(
      parseSeedLowerFamilyValidationFixturesCliArgs([
        "--user-id",
        USER_ID,
        "--families",
        "investigation,fieldwork",
        "--execute",
      ])
    ).toEqual({
      ok: true,
      args: {
        userId: USER_ID,
        families: ["investigation", "fieldwork"],
        execute: true,
      },
    });
  });

  it("returns dry-run JSON contract with writesPerformed false", async () => {
    const report = await runSeedLowerFamilyValidationFixturesPreflight({
      userId: USER_ID,
      db: makeDb(),
      now: NOW,
    });

    expect(report).toEqual(
      expect.objectContaining({
        dryRun: true,
        writesPerformed: false,
        devFixtureOnly: true,
        naturalValidation: false,
        userId: USER_ID,
      })
    );
    expect(report.investigation?.preflightReady).toBe(true);
    expect(report.fieldwork?.preflightReady).toBe(true);
    expect(report.modelUpdate?.preflightReady).toBe(true);
  });

  it("selects real evidence ids and verifies user ownership", async () => {
    const report = await runSeedLowerFamilyValidationFixturesPreflight({
      userId: USER_ID,
      db: makeDb(),
      now: NOW,
    });

    expect(report.investigation?.selectedEvidence).toEqual([
      expect.objectContaining({
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        linkable: true,
        ownershipResolvable: true,
        userOwnedVerified: true,
      }),
      expect.objectContaining({
        sourceType: "message",
        sourceId: "msg-1",
        userOwnedVerified: true,
      }),
    ]);
  });

  it("marks family blocked when linkable evidence is insufficient", async () => {
    assembleEvidencePacketV1Mock.mockResolvedValue(
      buildPacket([
        {
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "signal",
          linkable: false,
          ownershipResolvable: true,
          origin: "native",
        },
      ])
    );

    const report = await runSeedLowerFamilyValidationFixturesPreflight({
      userId: USER_ID,
      db: makeDb(),
      now: NOW,
    });

    expect(report.investigation?.preflightReady).toBe(false);
    expect(report.investigation?.blockers).toContain("INSUFFICIENT_LINKABLE_PACKET_EVIDENCE");
    expect(selectFixtureEvidenceFromPacket(buildPacket([]))).toBeNull();
  });

  it("includes DEV FIXTURE markers in proposal previews", async () => {
    const report = await runSeedLowerFamilyValidationFixturesPreflight({
      userId: USER_ID,
      db: makeDb(),
      now: NOW,
    });

    expect(report.investigation?.proposalPreview.title).toContain(DEV_FIXTURE_MARKER);
    expect(report.fieldwork?.proposalPreview.prompt).toContain(DEV_FIXTURE_MARKER);
    expect(report.modelUpdate?.proposalPreview.userFacingSummary).toContain(
      DEV_FIXTURE_MARKER
    );
  });

  it("dry-run does not call persistence, publish, or lifecycle mutators", async () => {
    await runSeedLowerFamilyValidationFixtures({
      userId: USER_ID,
      families: ["investigation", "fieldwork", "model-update"],
      execute: false,
      db: makeDb(),
      now: NOW,
    });

    expect(persistInvestigationMock).not.toHaveBeenCalled();
    expect(persistFieldworkMock).not.toHaveBeenCalled();
    expect(persistModelUpdateMock).not.toHaveBeenCalled();
    expect(publishInvestigationMock).not.toHaveBeenCalled();
    expect(publishFieldworkMock).not.toHaveBeenCalled();
    expect(publishModelUpdateMock).not.toHaveBeenCalled();
    expect(updateInvestigationLifecycleMock).not.toHaveBeenCalled();
    expect(updateFieldworkLifecycleMock).not.toHaveBeenCalled();
  });

  it("respects family filter and omits unrequested families", async () => {
    const report = await runSeedLowerFamilyValidationFixturesPreflight({
      userId: USER_ID,
      families: ["investigation"],
      db: makeDb(),
      now: NOW,
    });

    expect(report.investigation).not.toBeNull();
    expect(report.fieldwork).toBeNull();
    expect(report.modelUpdate).toBeNull();
  });
});

describe("seed lower-family validation fixtures execute mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assembleEvidencePacketV1Mock.mockResolvedValue(
      buildPacket([
        {
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "signal",
          linkable: true,
          ownershipResolvable: true,
          origin: "native",
        },
        {
          sourceType: "message",
          sourceId: "msg-1",
          role: "receipt",
          linkable: true,
          ownershipResolvable: true,
          origin: "native",
          messageId: "msg-1",
          sessionId: "session-1",
        },
      ])
    );
    verifySourceOwnershipMock.mockResolvedValue(true);
    verifyTargetOwnershipMock.mockResolvedValue(true);
    findInvestigationFixtureMock.mockResolvedValue(null);
    findFieldworkFixtureMock.mockResolvedValue(null);
    findModelUpdateFixtureMock.mockResolvedValue(null);
    persistInvestigationMock.mockResolvedValue(
      makePersistResult({
        id: "inv-created",
        idField: "persistedInvestigationId",
      })
    );
    persistFieldworkMock.mockResolvedValue(
      makePersistResult({
        id: "fw-created",
        idField: "persistedFieldworkAssignmentId",
      })
    );
    persistModelUpdateMock.mockResolvedValue(
      makePersistResult({
        id: "mu-created",
        idField: "persistedModelUpdateId",
      })
    );
  });

  it("calls persistence helpers only after preflightReady true", async () => {
    const report = asExecuteReport(
      await runSeedLowerFamilyValidationFixtures({
        userId: USER_ID,
        families: ["investigation", "fieldwork", "model-update"],
        execute: true,
        db: makeDb(),
        now: NOW,
        persistInvestigation: persistInvestigationMock,
        persistFieldwork: persistFieldworkMock,
        persistModelUpdate: persistModelUpdateMock,
        findExistingInvestigation: findInvestigationFixtureMock,
        findExistingFieldwork: findFieldworkFixtureMock,
        findExistingModelUpdate: findModelUpdateFixtureMock,
      })
    );

    expect(report.writesPerformed).toBe(true);
    expect(report.devFixtureOnly).toBe(true);
    expect(report.naturalValidation).toBe(false);
    expect(persistInvestigationMock).toHaveBeenCalledOnce();
    expect(persistFieldworkMock).toHaveBeenCalledOnce();
    expect(persistModelUpdateMock).toHaveBeenCalledOnce();
    expect(report.investigationExecute).toEqual(
      expect.objectContaining({
        status: "created",
        candidateId: "inv-created",
        evidenceLinksWritten: 2,
      })
    );
  });

  it("skips blocked family without calling its persistence helper", async () => {
    assembleEvidencePacketV1Mock.mockResolvedValue(buildPacket([]));

    const report = asExecuteReport(
      await runSeedLowerFamilyValidationFixtures({
        userId: USER_ID,
        families: ["investigation", "fieldwork"],
        execute: true,
        db: makeDb(),
        now: NOW,
        persistInvestigation: persistInvestigationMock,
        persistFieldwork: persistFieldworkMock,
        findExistingInvestigation: findInvestigationFixtureMock,
        findExistingFieldwork: findFieldworkFixtureMock,
      })
    );

    expect(report.writesPerformed).toBe(false);
    expect(report.investigationExecute?.status).toBe("skipped_not_ready");
    expect(report.fieldworkExecute?.status).toBe("skipped_not_ready");
    expect(persistInvestigationMock).not.toHaveBeenCalled();
    expect(persistFieldworkMock).not.toHaveBeenCalled();
  });

  it("skips existing fixture without creating duplicate", async () => {
    findInvestigationFixtureMock.mockResolvedValue("inv-existing");

    const report = asExecuteReport(
      await runSeedLowerFamilyValidationFixtures({
        userId: USER_ID,
        families: ["investigation"],
        execute: true,
        db: makeDb(),
        now: NOW,
        persistInvestigation: persistInvestigationMock,
        findExistingInvestigation: findInvestigationFixtureMock,
      })
    );

    expect(report.investigationExecute).toEqual(
      expect.objectContaining({
        status: "skipped_already_exists",
        candidateId: "inv-existing",
        candidatesWritten: 0,
      })
    );
    expect(persistInvestigationMock).not.toHaveBeenCalled();
    expect(report.writesPerformed).toBe(false);
  });

  it("does not call publish or lifecycle mutators in execute mode", async () => {
    await runSeedLowerFamilyValidationFixtures({
      userId: USER_ID,
      execute: true,
      db: makeDb(),
      now: NOW,
      persistInvestigation: persistInvestigationMock,
      persistFieldwork: persistFieldworkMock,
      persistModelUpdate: persistModelUpdateMock,
      findExistingInvestigation: findInvestigationFixtureMock,
      findExistingFieldwork: findFieldworkFixtureMock,
      findExistingModelUpdate: findModelUpdateFixtureMock,
    });

    expect(publishInvestigationMock).not.toHaveBeenCalled();
    expect(publishFieldworkMock).not.toHaveBeenCalled();
    expect(publishModelUpdateMock).not.toHaveBeenCalled();
    expect(updateInvestigationLifecycleMock).not.toHaveBeenCalled();
    expect(updateFieldworkLifecycleMock).not.toHaveBeenCalled();
  });

  it("isolates per-family errors without blocking other families", async () => {
    persistInvestigationMock.mockRejectedValue(new Error("investigation failed"));

    const report = asExecuteReport(
      await runSeedLowerFamilyValidationFixtures({
        userId: USER_ID,
        families: ["investigation", "fieldwork"],
        execute: true,
        db: makeDb(),
        now: NOW,
        persistInvestigation: persistInvestigationMock,
        persistFieldwork: persistFieldworkMock,
        findExistingInvestigation: findInvestigationFixtureMock,
        findExistingFieldwork: findFieldworkFixtureMock,
      })
    );

    expect(report.investigationExecute?.status).toBe("error");
    expect(report.fieldworkExecute?.status).toBe("created");
    expect(report.writesPerformed).toBe(true);
    expect(report.transactionIsolation).toBe("per-family");
  });

  it("respects family filter in execute mode", async () => {
    const report = asExecuteReport(
      await runSeedLowerFamilyValidationFixtures({
        userId: USER_ID,
        families: ["model-update"],
        execute: true,
        db: makeDb(),
        now: NOW,
        persistModelUpdate: persistModelUpdateMock,
        findExistingModelUpdate: findModelUpdateFixtureMock,
      })
    );

    expect(report.investigationExecute).toBeNull();
    expect(report.fieldworkExecute).toBeNull();
    expect(report.modelUpdateExecute?.candidateId).toBe("mu-created");
    expect(persistInvestigationMock).not.toHaveBeenCalled();
    expect(persistFieldworkMock).not.toHaveBeenCalled();
    expect(persistModelUpdateMock).toHaveBeenCalledOnce();
  });
});
