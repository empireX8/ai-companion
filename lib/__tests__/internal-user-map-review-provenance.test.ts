import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userMapConclusion: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
  derivationArtifact: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

import {
  extractSafeDiagnosticsFromPayload,
  listInternalUserMapReviewCandidates,
  parseSourceRunIdFromNotes,
  readSafetyLevelFromMeta,
} from "../internal-user-map-review-candidates";

describe("internal user-map review provenance loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.derivationArtifact.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("includes provenance metadata for candidates with evidence links and diagnostics", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-1",
        title: "Candidate",
        summary: "Summary",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "low",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        notes: "sourceRun:run-1; decision:pass",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        targetId: "umc-1",
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        meta: { publicSafetyLevel: "safe_summary" },
      },
      {
        targetId: "umc-1",
        sourceType: "message",
        sourceId: "msg-1",
        meta: { publicSafetyLevel: "internal_only" },
      },
      {
        targetId: "umc-1",
        sourceType: "pattern_claim",
        sourceId: "pc-2",
        meta: null,
      },
    ]);

    prismaMock.derivationArtifact.findMany.mockResolvedValueOnce([
      {
        id: "artifact-1",
        type: "understanding_dark_engine_diagnostics",
        runId: "run-1",
        payload: {
          processorVersion: "understanding-dark-engine-v1",
          warnings: ["CORRECTION_DOWNGRADE_ACTIVE"],
          blockedWriteReasons: [],
        },
      },
    ]);

    const items = await listInternalUserMapReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.evidence).toEqual({
      linkCount: 3,
      sourceTypes: {
        pattern_claim: 2,
        message: 1,
      },
      safetyLevels: {
        safe_summary: 1,
        internal_only: 1,
      },
      linkedSources: [
        {
          sourceType: "pattern_claim",
          sourceId: "pc-1",
          safetyLevel: "safe_summary",
        },
        {
          sourceType: "message",
          sourceId: "msg-1",
          safetyLevel: "internal_only",
        },
        {
          sourceType: "pattern_claim",
          sourceId: "pc-2",
          safetyLevel: null,
        },
      ],
    });
    expect(items[0]?.diagnostics).toEqual({
      latestRunId: "run-1",
      latestArtifactId: "artifact-1",
      latestArtifactType: "understanding_dark_engine_diagnostics",
      processorVersion: "understanding-dark-engine-v1",
      blockedWriteReasons: [],
      warnings: ["CORRECTION_DOWNGRADE_ACTIVE"],
    });

    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          targetId: true,
          sourceType: true,
          sourceId: true,
          meta: true,
        },
      })
    );
    expect(prismaMock.derivationArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          runId: { in: ["run-1"] },
          type: "understanding_dark_engine_diagnostics",
        }),
      })
    );
  });

  it("returns empty provenance state for candidates without evidence links", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-empty",
        title: "Empty candidate",
        summary: "No links",
        area: "state_ecology",
        status: "tentative",
        confidenceLevel: "medium",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        notes: null,
        createdAt: new Date("2026-05-15T09:00:00.000Z"),
        updatedAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const items = await listInternalUserMapReviewCandidates(
      { userId: "reviewer-1", limit: 10 },
      prismaMock as never
    );

    expect(items[0]?.evidence).toEqual({
      linkCount: 0,
      sourceTypes: {},
      safetyLevels: {},
      linkedSources: [],
    });
    expect(items[0]?.diagnostics).toEqual({
      latestRunId: null,
      latestArtifactId: null,
      latestArtifactType: null,
      processorVersion: null,
      blockedWriteReasons: [],
      warnings: [],
    });
    expect(prismaMock.derivationArtifact.findMany).not.toHaveBeenCalled();
  });

  it("parses source run ids and extracts safe diagnostics payload fields", () => {
    expect(parseSourceRunIdFromNotes("sourceRun:run-abc; decision:pass")).toBe("run-abc");
    expect(parseSourceRunIdFromNotes(null)).toBeNull();
    expect(readSafetyLevelFromMeta({ publicSafetyLevel: "safe_summary" })).toBe(
      "safe_summary"
    );
    expect(
      extractSafeDiagnosticsFromPayload({
        processorVersion: "understanding-dark-engine-v1",
        blockedWriteReasons: ["INSUFFICIENT_LINKABLE_EVIDENCE_COUNT"],
        warnings: ["SINGLE_EPISODE_SUPPORTED_BLOCK"],
        notes: ["persistedConclusionId:umc-1"],
      })
    ).toEqual({
      processorVersion: "understanding-dark-engine-v1",
      blockedWriteReasons: ["INSUFFICIENT_LINKABLE_EVIDENCE_COUNT"],
      warnings: ["SINGLE_EPISODE_SUPPORTED_BLOCK"],
    });
  });
});
