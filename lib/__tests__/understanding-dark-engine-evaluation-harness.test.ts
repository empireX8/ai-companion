import {
  InvestigationSeedType,
  UnderstandingLinkSourceType,
  UserMapConclusionStatus,
} from "@prisma/client";

import type { RejectionReasonCode } from "../understanding-dark-engine/constants";
import { describe, expect, it, vi } from "vitest";

import { runNoWriteUnderstandingDarkRun } from "../understanding-dark-engine/dark-run-orchestrator";
import { evaluateNoWriteDarkRunOutput } from "../understanding-dark-engine/dark-run-evaluation-harness";

type NoWriteDbInput = NonNullable<
  Parameters<typeof runNoWriteUnderstandingDarkRun>[0]["db"]
>;

type NoWriteDbMockOptions = {
  includeSurfacedAction?: boolean;
  empty?: boolean;
};

function createNoWriteDbMock(options: NoWriteDbMockOptions = {}) {
  const includeSurfacedAction = options.includeSurfacedAction ?? true;
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

  const patternClaims = empty
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

  const patternClaimEvidence = empty
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

  const sessions = empty
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

  const messages = empty
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

  const messageOrigins = empty
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

describe("Phase 2C no-write dark-run evaluation harness", () => {
  it("passes baseline no-write orchestrator output", async () => {
    const db = createNoWriteDbMock();

    const output = await runNoWriteUnderstandingDarkRun({
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

    const result = evaluateNoWriteDarkRunOutput(output);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.summary.itemCount).toBeGreaterThan(0);
    expectNoWritePathCalls(db);
  });

  it("fails when a sanitized item leaks a raw-like field", async () => {
    const db = createNoWriteDbMock();
    const output = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    const mutated = structuredClone(output) as typeof output & {
      packet: { items: Array<Record<string, unknown>> };
    };
    mutated.packet.items[0] = {
      ...mutated.packet.items[0],
      quote: "do not expose this text",
    };

    const result = evaluateNoWriteDarkRunOutput(mutated);

    expect(result.passed).toBe(false);
    expect(
      result.failures.some(
        (failure) => failure.invariant === "no_raw_evidence_leakage"
      )
    ).toBe(true);
    expect(
      result.failures.every(
        (failure) => !failure.message.includes("do not expose this text")
      )
    ).toBe(true);
    expectNoWritePathCalls(db);
  });

  it("fails when publicSafeSummary appears on non-safe_summary items", async () => {
    const db = createNoWriteDbMock();
    const output = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    const mutated = structuredClone(output) as typeof output & {
      packet: { items: Array<Record<string, unknown>> };
    };
    const targetItem = mutated.packet.items.find(
      (item) => item.publicSafetyLevel !== "safe_summary"
    );
    expect(targetItem).toBeTruthy();
    if (targetItem) {
      targetItem.publicSafeSummary = "should not be exposed";
    }

    const result = evaluateNoWriteDarkRunOutput(mutated);

    expect(result.passed).toBe(false);
    expect(
      result.failures.some(
        (failure) => failure.invariant === "source_safety_compliance"
      )
    ).toBe(true);
    expectNoWritePathCalls(db);
  });

  it("reports phase H compatibility issues when surfaced_action evidence exists but marker is corrupted", async () => {
    const db = createNoWriteDbMock({ includeSurfacedAction: true });
    const output = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    const mutated = structuredClone(output);
    mutated.phaseHCompatibility.required = false;
    mutated.phaseHCompatibility.reasons = [];
    mutated.diagnostics.notes = [];

    const result = evaluateNoWriteDarkRunOutput(mutated);

    expect(result.passed).toBe(false);
    expect(
      result.failures.some(
        (failure) => failure.invariant === "phase_h_compatibility"
      ) ||
        result.warnings.some(
          (warning) => warning.invariant === "phase_h_compatibility"
        )
    ).toBe(true);
    expectNoWritePathCalls(db);
  });

  it("fails cleanly on missing gate/diagnostics structure without throwing", async () => {
    const db = createNoWriteDbMock();
    const output = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    const brokenOutput = {
      ...output,
      userMapEvaluation: undefined,
      diagnostics: undefined,
    } as unknown as Parameters<typeof evaluateNoWriteDarkRunOutput>[0];

    expect(() => evaluateNoWriteDarkRunOutput(brokenOutput)).not.toThrow();
    const result = evaluateNoWriteDarkRunOutput(brokenOutput);
    expect(result.passed).toBe(false);
    expect(
      result.failures.some(
        (failure) => failure.invariant === "evaluation_gate_quality"
      )
    ).toBe(true);
    expectNoWritePathCalls(db);
  });

  it("passes investigation proposal safety checks on thin-evidence abstain output", async () => {
    const db = createNoWriteDbMock({ includeSurfacedAction: false, empty: false });
    const output = await runNoWriteUnderstandingDarkRun({
      userId: "user-1",
      db: db as unknown as NoWriteDbInput,
      now: new Date("2026-05-15T12:00:00.000Z"),
    });

    const thinAbstainOutput = {
      ...output,
      userMapCandidateProposal: null,
      investigationCandidateProposal: {
        seedType: InvestigationSeedType.pattern,
        title: "Worth exploring: Conflict spike pattern.",
        organizingQuestion: "What would clarify whether conflict spike pattern?",
        summary:
          "This looks worth watching as an open question. Conflict spike pattern.",
        abstainReasons: ["INSUFFICIENT_EVIDENCE_COUNT" as RejectionReasonCode],
        evidenceSelections: [
          {
            sourceType: UnderstandingLinkSourceType.pattern_claim,
            sourceId: "pc-1",
          },
        ],
      },
    };

    const result = evaluateNoWriteDarkRunOutput(thinAbstainOutput);
    expect(result.passed).toBe(true);
    expect(
      result.checkedInvariants.includes("investigation_candidate_proposal_safety")
    ).toBe(true);
    expectNoWritePathCalls(db);
  });
});
