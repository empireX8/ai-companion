import { UserMapConclusionStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { extractStructuredUserMapCandidateProposal } from "../understanding-dark-engine/app-message-candidate-bridge";
import { extractStructuredFieldworkCandidateProposal } from "../understanding-dark-engine/fieldwork-candidate-proposal";
import { extractStructuredInvestigationCandidateProposal } from "../understanding-dark-engine/investigation-candidate-proposal";
import { extractStructuredModelUpdateCandidateProposal } from "../understanding-dark-engine/model-update-candidate-proposal";
import * as candidatePersistenceModule from "../understanding-dark-engine/user-map-candidate-persistence";
import * as evidenceLinkWriterModule from "../understanding-evidence-link-writer";
import { runNoWriteUnderstandingDarkRun } from "../understanding-dark-engine/dark-run-orchestrator";

type NoWriteDbInput = NonNullable<
  Parameters<typeof runNoWriteUnderstandingDarkRun>[0]["db"]
>;

type NoWriteDbMockOptions = {
  includeSurfacedAction?: boolean;
  includePatternClaim?: boolean;
  patternClaimOnly?: boolean;
  empty?: boolean;
};

function createNoWriteDbMock(options: NoWriteDbMockOptions = {}) {
  const includeSurfacedAction = options.includeSurfacedAction ?? true;
  const includePatternClaim = options.includePatternClaim ?? true;
  const patternClaimOnly = options.patternClaimOnly ?? false;
  const empty = options.empty ?? false;

  const writes = {
    derivationRunCreate: vi.fn(),
    derivationRunUpdate: vi.fn(),
    derivationArtifactCreate: vi.fn(),
    userMapConclusionCreate: vi.fn(),
    userMapConclusionUpdate: vi.fn(),
    modelUpdateCreate: vi.fn(),
    modelUpdateUpdate: vi.fn(),
    investigationCreate: vi.fn(),
    investigationUpdate: vi.fn(),
    fieldworkAssignmentCreate: vi.fn(),
    fieldworkAssignmentUpdate: vi.fn(),
    understandingEvidenceLinkCreate: vi.fn(),
    understandingEvidenceLinkUpdate: vi.fn(),
  };

  const patternClaims =
    empty || !includePatternClaim
      ? []
      : [
          {
            id: "pc-1",
            summary: "Conflict spike pattern.",
            status: "active",
            sourceRunId: null,
            createdAt: new Date("2026-05-02T00:00:00.000Z"),
            updatedAt: new Date("2026-05-10T00:00:00.000Z"),
          },
        ];

  const patternClaimEvidence =
    empty || !includePatternClaim || patternClaimOnly
      ? []
      : [
        {
          id: "pce-1",
          claimId: "pc-1",
          source: "derivation",
          sessionId: "s-1",
          messageId: "m-1",
          journalEntryId: null,
          quote: "I panic when conflict appears.",
          createdAt: new Date("2026-05-11T00:00:00.000Z"),
        },
      ];

  const surfacedActions =
    empty || !includeSurfacedAction
      ? []
      : [
          {
            id: "sa-1",
            bucket: "stabilize",
            status: "helped",
            note: "Raw private action note.",
            surfacedAt: new Date("2026-05-11T01:00:00.000Z"),
            updatedAt: new Date("2026-05-12T01:00:00.000Z"),
            linkedClaimId: "pc-1",
          },
        ];

  const sessions = empty || patternClaimOnly
    ? []
    : [
        {
          id: "s-1",
          origin: "APP",
          startedAt: new Date("2026-05-10T09:00:00.000Z"),
          createdAt: new Date("2026-05-10T09:00:00.000Z"),
          label: "Session 1",
        },
      ];

  const messages = empty || patternClaimOnly
    ? []
    : [
        {
          id: "m-1",
          sessionId: "s-1",
          role: "user",
          content: "I felt overwhelmed and shut down today.",
          createdAt: new Date("2026-05-10T09:10:00.000Z"),
          session: {
            origin: "APP",
          },
        },
      ];

  const messageOrigins = empty || patternClaimOnly
    ? []
    : [
        {
          id: "m-1",
          sessionId: "s-1",
          session: {
            origin: "APP",
          },
        },
      ];

  const db = {
    patternClaim: {
      findMany: vi.fn(async () => patternClaims),
    },
    patternClaimEvidence: {
      findMany: vi.fn(async () => patternClaimEvidence),
    },
    contradictionNode: {
      findMany: vi.fn(async () => []),
    },
    contradictionEvidence: {
      findMany: vi.fn(async () => []),
    },
    profileArtifact: {
      findMany: vi.fn(async () => []),
    },
    evidenceSpan: {
      findMany: vi.fn(async () => []),
    },
    referenceItem: {
      findMany: vi.fn(async () => []),
    },
    surfacedAction: {
      findMany: vi.fn(async () => surfacedActions),
    },
    quickCheckIn: {
      findMany: vi.fn(async () => []),
    },
    journalEntry: {
      findMany: vi.fn(async () => []),
    },
    session: {
      findMany: vi.fn(async () => sessions),
    },
    message: {
      findMany: vi.fn(async (args: { select: Record<string, unknown> }) => {
        if ("role" in args.select) {
          return messages;
        }
        return messageOrigins;
      }),
    },
    importUploadSession: {
      findMany: vi.fn(async () => []),
    },
    importUploadChunk: {
      findMany: vi.fn(async () => []),
    },
    derivationRun: {
      findMany: vi.fn(async () => []),
      create: writes.derivationRunCreate,
      update: writes.derivationRunUpdate,
    },
    profileArtifactEvidenceLink: {
      findMany: vi.fn(async () => []),
    },
    derivationArtifact: {
      create: writes.derivationArtifactCreate,
    },
    modelUpdate: {
      findMany: vi.fn(async () => []),
      create: writes.modelUpdateCreate,
      update: writes.modelUpdateUpdate,
    },
    userMapConclusion: {
      findMany: vi.fn(async () => []),
      create: writes.userMapConclusionCreate,
      update: writes.userMapConclusionUpdate,
    },
    investigation: {
      create: writes.investigationCreate,
      update: writes.investigationUpdate,
    },
    fieldworkAssignment: {
      create: writes.fieldworkAssignmentCreate,
      update: writes.fieldworkAssignmentUpdate,
    },
    understandingEvidenceLink: {
      create: writes.understandingEvidenceLinkCreate,
      update: writes.understandingEvidenceLinkUpdate,
    },
    __writes: writes,
  };

  return db;
}

function expectNoWritePathCalls(db: ReturnType<typeof createNoWriteDbMock>) {
  expect(db.__writes.derivationRunCreate).not.toHaveBeenCalled();
  expect(db.__writes.derivationRunUpdate).not.toHaveBeenCalled();
  expect(db.__writes.derivationArtifactCreate).not.toHaveBeenCalled();
  expect(db.__writes.userMapConclusionCreate).not.toHaveBeenCalled();
  expect(db.__writes.userMapConclusionUpdate).not.toHaveBeenCalled();
  expect(db.__writes.modelUpdateCreate).not.toHaveBeenCalled();
  expect(db.__writes.modelUpdateUpdate).not.toHaveBeenCalled();
  expect(db.__writes.investigationCreate).not.toHaveBeenCalled();
  expect(db.__writes.investigationUpdate).not.toHaveBeenCalled();
  expect(db.__writes.fieldworkAssignmentCreate).not.toHaveBeenCalled();
  expect(db.__writes.fieldworkAssignmentUpdate).not.toHaveBeenCalled();
  expect(db.__writes.understandingEvidenceLinkCreate).not.toHaveBeenCalled();
  expect(db.__writes.understandingEvidenceLinkUpdate).not.toHaveBeenCalled();
}

describe("Phase 2B no-write dark-run orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns packet metrics, diagnostics summary, and gate evaluation result", async () => {
    const db = createNoWriteDbMock();

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Early candidate signal.",
        requiresReceipt: true,
      },
    });

    expect(result.mode).toBe("no_write_dark_run");
    expect(result.userId).toBe("user-1");
    expect(result.packet.metrics.evidenceCount).toBeGreaterThan(0);
    expect(result.packet.items.length).toBeGreaterThan(0);
    expect(result.userMapEvaluation.decision).toMatch(
      /^(pass|pass_with_cap|abstain)$/
    );
    expect(result.diagnostics.packetsAssembled).toBe(1);
    expect(result.diagnostics.candidatesWritten).toBe(0);

    expectNoWritePathCalls(db);
  });

  it("emits sanitized packet projection without raw snippet/quote leakage", async () => {
    const db = createNoWriteDbMock();

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.packet.items.length).toBeGreaterThan(0);
    for (const item of result.packet.items) {
      expect("snippet" in item).toBe(false);
      expect("quote" in item).toBe(false);
      expect(typeof item.sourceId).toBe("string");
      expect(typeof item.sourceType).toBe("string");
      expect(typeof item.timestamp).toBe("string");
      expect(Number.isNaN(Date.parse(item.timestamp))).toBe(false);

      if (item.publicSafetyLevel !== "safe_summary") {
        expect("publicSafeSummary" in item).toBe(false);
      } else {
        expect("publicSafeSummary" in item).toBe(true);
      }

      if (item.containsRawPrivateText) {
        expect(item.publicSafetyLevel).toBe("internal_only");
      }
    }

    expectNoWritePathCalls(db);
  });

  it("marks Phase H compatibility when surfaced_action evidence is present", async () => {
    const candidateSpy = vi.spyOn(
      candidatePersistenceModule,
      "persistInternalUserMapConclusionCandidate"
    );
    const evidenceWriterSpy = vi.spyOn(
      evidenceLinkWriterModule,
      "createUnderstandingEvidenceLinkForUser"
    );
    const db = createNoWriteDbMock({ includeSurfacedAction: true });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.phaseHCompatibility.required).toBe(true);
    expect(result.phaseHCompatibility.reasons).toContain(
      "surfaced_action_evidence_present"
    );
    expect(result.diagnostics.notes).toContain(
      "phase_h_compatibility_required:surfaced_action_evidence_present"
    );

    expect(candidateSpy).not.toHaveBeenCalled();
    expect(evidenceWriterSpy).not.toHaveBeenCalled();
    expectNoWritePathCalls(db);
  });

  it("handles empty packet sources with safe diagnostics and no uncontrolled failure", async () => {
    const db = createNoWriteDbMock({
      includeSurfacedAction: false,
      empty: true,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
    });

    expect(result.packet.metrics.evidenceCount).toBe(0);
    expect(result.packet.items).toHaveLength(0);
    expect(result.userMapEvaluation.decision).toBe("abstain");
    expect(result.diagnostics.abstentions).toBe(1);
    expect(result.phaseHCompatibility.required).toBe(false);

    expectNoWritePathCalls(db);
  });

  it("does not emit userMapCandidateProposal when gates abstain", async () => {
    const db = createNoWriteDbMock({
      includeSurfacedAction: false,
      empty: true,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
      includeTimelineAggregationContext: false,
      includeUserCorrectionContext: false,
    });

    expect(result.userMapEvaluation.decision).toBe("abstain");
    expect(result.userMapCandidateProposal).toBeNull();
    expect(extractStructuredUserMapCandidateProposal(result)).toBeNull();
    expectNoWritePathCalls(db);
  });

  it("does not emit userMapCandidateProposal when evidence lacks a safe-summary anchor", async () => {
    const db = createNoWriteDbMock({
      includePatternClaim: false,
      includeSurfacedAction: false,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.userMapEvaluation.decision).not.toBe("abstain");
    expect(result.userMapCandidateProposal).toBeNull();
    expect(extractStructuredUserMapCandidateProposal(result)).toBeNull();
    expectNoWritePathCalls(db);
  });

  it("emits structured userMapCandidateProposal when gates pass and evidence is sufficient", async () => {
    const db = createNoWriteDbMock();

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.userMapEvaluation.decision).not.toBe("abstain");
    expect(result.userMapCandidateProposal).toEqual({
      area: "operating_logic",
      title: "Conflict spike pattern.",
      summary: "Conflict spike pattern.",
      target: expect.objectContaining({
        requestedStatus: result.userMapEvaluation.allowedStatus,
        identityLevelClaim: false,
        proposedSummary: "Conflict spike pattern.",
        requiresReceipt: true,
      }),
      evidenceSelections: expect.arrayContaining([
        { sourceType: "pattern_claim", sourceId: "pc-1" },
      ]),
    });
    expect(extractStructuredUserMapCandidateProposal(result)).toEqual(
      result.userMapCandidateProposal
    );
    expectNoWritePathCalls(db);
  });

  it("emits investigationCandidateProposal on abstain when UserMap conclusion is not appropriate", async () => {
    const db = createNoWriteDbMock({
      includeSurfacedAction: false,
      patternClaimOnly: true,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.userMapEvaluation.decision).toBe("abstain");
    expect(result.userMapCandidateProposal).toBeNull();
    expect(result.investigationCandidateProposal).toEqual({
      seedType: "pattern",
      title: "Worth exploring: Conflict spike pattern.",
      organizingQuestion: expect.stringMatching(/\?$/),
      summary:
        "This looks worth watching as an open question. Conflict spike pattern.",
      abstainReasons: expect.arrayContaining([
        "INSUFFICIENT_EVIDENCE_COUNT",
        "INSUFFICIENT_SOURCE_DIVERSITY",
      ]),
      evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "pc-1" }],
    });
    expect(extractStructuredInvestigationCandidateProposal(result)).toEqual(
      result.investigationCandidateProposal
    );
    expect(result.investigationCandidateProposal?.summary).not.toContain(
      "I panic when conflict"
    );
    expectNoWritePathCalls(db);
  });

  it("does not emit investigationCandidateProposal when UserMap proposal is present", async () => {
    const db = createNoWriteDbMock({ includeSurfacedAction: false });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.userMapCandidateProposal).not.toBeNull();
    expect(result.investigationCandidateProposal).toBeNull();
    expect(result.fieldworkCandidateProposal).toBeNull();
    expect(result.modelUpdateCandidateProposal).toBeNull();
    expectNoWritePathCalls(db);
  });

  it("does not emit fieldworkCandidateProposal when investigation proposal is present", async () => {
    const db = createNoWriteDbMock({
      includeSurfacedAction: false,
      patternClaimOnly: true,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.investigationCandidateProposal).not.toBeNull();
    expect(result.fieldworkCandidateProposal).toBeNull();
    expect(result.modelUpdateCandidateProposal).toBeNull();
    expectNoWritePathCalls(db);
  });

  it("keeps fieldworkCandidateProposal null on default thin-evidence abstain runs", async () => {
    const db = createNoWriteDbMock({
      includeSurfacedAction: false,
      patternClaimOnly: true,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.userMapCandidateProposal).toBeNull();
    expect(result.investigationCandidateProposal).not.toBeNull();
    expect(result.fieldworkCandidateProposal).toBeNull();
    expect(result.modelUpdateCandidateProposal).toBeNull();
    expect(extractStructuredFieldworkCandidateProposal(result)).toBeNull();
    expectNoWritePathCalls(db);
  });

  it("does not emit modelUpdateCandidateProposal for thin surfaced_action evidence", async () => {
    const db = createNoWriteDbMock({
      includePatternClaim: false,
      includeSurfacedAction: true,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.userMapCandidateProposal).toBeNull();
    expect(result.investigationCandidateProposal).toBeNull();
    expect(result.fieldworkCandidateProposal).toBeNull();
    expect(result.modelUpdateCandidateProposal).toBeNull();
    expect(extractStructuredModelUpdateCandidateProposal(result)).toBeNull();
    expectNoWritePathCalls(db);
  });

  it("does not emit modelUpdateCandidateProposal when investigation proposal is present", async () => {
    const db = createNoWriteDbMock({
      includeSurfacedAction: false,
      patternClaimOnly: true,
    });

    const result = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    expect(result.investigationCandidateProposal).not.toBeNull();
    expect(result.modelUpdateCandidateProposal).toBeNull();
    expectNoWritePathCalls(db);
  });
});
