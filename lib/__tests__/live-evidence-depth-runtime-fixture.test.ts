import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assessLiveEvidenceDepthFixtureSafety,
  buildFixtureEvidenceDepthAuthoringInput,
  cleanupLiveEvidenceDepthFixtureData,
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
  EVIDENCE_DEPTH_FIXTURE_MARKER,
  EVIDENCE_DEPTH_FIXTURE_PREFIX,
  EVIDENCE_DEPTH_FIXTURE_USER_ENV,
  FIXTURE_AUTHORED_RATIONALE,
  FIXTURE_CLAIM_ID,
  FIXTURE_CONCLUSION_ID,
  FIXTURE_MOVEMENT_SUMMARY,
  FIXTURE_SOURCE_TEXT,
  isFixtureOwnedId,
  looksLikeLocalDatabaseUrl,
  looksLikeProductionDatabaseUrl,
  parseLiveEvidenceDepthFixtureCliArgs,
  resolveLiveEvidenceDepthFixtureUserId,
  runLiveEvidenceDepthRuntimeFixture,
} from "../live-evidence-depth-runtime-fixture";
import { graphSlotFromUelMeta } from "../live-evidence-depth-write-contract";

const LOCAL_ENV = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/companion",
  [EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV]: "1",
} as NodeJS.ProcessEnv;

function executeFixtureArgs(
  overrides?: Partial<Parameters<typeof runLiveEvidenceDepthRuntimeFixture>[0]>,
) {
  return {
    userId: "local-user-1",
    db: buildExecuteDbMock() as never,
    dryRun: false,
    keepData: true,
    verifyUnsafeFallback: false,
    now: new Date("2026-07-09T20:00:00.000Z"),
    env: LOCAL_ENV,
    publishCandidate: vi.fn().mockResolvedValue({
      evidenceDepthMaterialization: {
        status: "materialized",
        pointerId: "receipt-pattern-dev-live-evidence-depth-claim",
        blockers: [],
      },
    }),
    ...overrides,
  };
}

describe("live evidence depth runtime fixture", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses without explicit allow env flag", () => {
    const assessment = assessLiveEvidenceDepthFixtureSafety({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/companion",
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.blockers).toContain("missing_allow_env_flag");
  });

  it("refuses production-looking DATABASE_URL", () => {
    const assessment = assessLiveEvidenceDepthFixtureSafety({
      ...LOCAL_ENV,
      DATABASE_URL: "postgresql://user:pass@prod.cluster.amazonaws.com:5432/companion",
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.blockers).toContain("production_database_url");
  });

  it("requires or derives local userId safely", () => {
    expect(resolveLiveEvidenceDepthFixtureUserId({})).toEqual({
      ok: false,
      message: expect.stringContaining("Missing fixture userId"),
    });

    expect(
      resolveLiveEvidenceDepthFixtureUserId(
        { userId: "local-user-1" },
        { ...LOCAL_ENV, [EVIDENCE_DEPTH_FIXTURE_USER_ENV]: "env-user" },
      ),
    ).toEqual({ ok: true, userId: "local-user-1" });

    expect(
      resolveLiveEvidenceDepthFixtureUserId({}, {
        ...LOCAL_ENV,
        [EVIDENCE_DEPTH_FIXTURE_USER_ENV]: "env-user",
      }),
    ).toEqual({ ok: true, userId: "env-user" });
  });

  it("uses publishModelUpdateCandidate as primary materialization path", async () => {
    const publishCandidate = vi.fn().mockResolvedValue({
      evidenceDepthMaterialization: {
        status: "materialized",
        pointerId: "receipt-pattern-dev-live-evidence-depth-claim",
        blockers: [],
      },
    });

    const report = await runLiveEvidenceDepthRuntimeFixture(
      executeFixtureArgs({ publishCandidate }),
    );

    expect(publishCandidate).toHaveBeenCalledOnce();
    expect(report.steps.publish.status).toBe("materialized");
    expect(report.steps.dbVerification.pointerExists).toBe(true);
  });

  it("validates SurfacedEvidencePointer after publish", async () => {
    const report = await runLiveEvidenceDepthRuntimeFixture(executeFixtureArgs());

    expect(report.steps.dbVerification.pointerExists).toBe(true);
    expect(report.steps.dbVerification.pointerWhyItMatters).toBe(
      FIXTURE_AUTHORED_RATIONALE,
    );
    expect(report.steps.dbVerification.pointerPublicEligible).toBe(true);
  });

  it("validates service route-equivalent read path", async () => {
    const report = await runLiveEvidenceDepthRuntimeFixture(executeFixtureArgs());

    expect(report.steps.readService.attempted).toBe(true);
    expect(report.httpRouteExecuted).toBe(false);
    expect(report.validationPath).toBe("service_route_equivalent");
    expect(report.steps.readService.inspectorDepthListReady).toBe(true);
    expect(report.steps.readService.depthSafePointerIds).toContain(
      "receipt-pattern-dev-live-evidence-depth-claim",
    );
  });

  it("validates Today gate stored-pointer replacement", async () => {
    const report = await runLiveEvidenceDepthRuntimeFixture(executeFixtureArgs());

    expect(report.steps.todayGate.storedPointerApplied).toBe(true);
    expect(report.steps.todayGate.todayResurfacedIds).toEqual([
      "receipt-pattern-dev-live-evidence-depth-claim",
    ]);
  });

  it("validates fallback on unsafe/thin pointer overlay", async () => {
    const report = await runLiveEvidenceDepthRuntimeFixture(
      executeFixtureArgs({ verifyUnsafeFallback: true }),
    );

    expect(report.steps.unsafeBaseState.checked).toBe(true);
    expect(report.steps.unsafeBaseState.keepsHonestEmptyState).toBe(true);
  });

  it("cleans up only deterministic fixture-owned ids by default", async () => {
    const deleted: string[] = [];
    const db = {
      surfacedEvidencePointer: {
        deleteMany: vi.fn(async () => {
          deleted.push("pointer");
          return { count: 1 };
        }),
      },
      evidencePointerSurfacingRationale: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      understandingEvidenceLink: {
        deleteMany: vi.fn(async (args: { where: { OR: unknown[] } }) => {
          expect(args.where.OR).toBeTruthy();
          return { count: 2 };
        }),
      },
      modelUpdate: {
        deleteMany: vi.fn(async (args: { where: { internalNotes: { contains: string } } }) => {
          expect(args.where.internalNotes.contains).toBe(EVIDENCE_DEPTH_FIXTURE_MARKER);
          return { count: 1 };
        }),
      },
      patternClaimEvidence: {
        deleteMany: vi.fn(async (args: { where: { id: string } }) => {
          expect(args.where.id).toContain(EVIDENCE_DEPTH_FIXTURE_PREFIX);
          return { count: 1 };
        }),
      },
      patternClaim: {
        deleteMany: vi.fn(async (args: { where: { id: string } }) => {
          expect(isFixtureOwnedId(args.where.id)).toBe(true);
          return { count: 1 };
        }),
      },
      userMapConclusion: {
        deleteMany: vi.fn(async (args: { where: { id: string } }) => {
          expect(args.where.id).toBe(FIXTURE_CONCLUSION_ID);
          return { count: 1 };
        }),
      },
    };

    const outcome = await cleanupLiveEvidenceDepthFixtureData({
      userId: "local-user-1",
      db: db as never,
      modelUpdateId: "mu-fixture-1",
    });

    expect(outcome.deletedPointers).toBe(1);
    expect(deleted).toContain("pointer");
  });

  it("rejects userFacingSummary as authored rationale in fixture input", () => {
    const input = buildFixtureEvidenceDepthAuthoringInput();
    expect(input.authoredRationale).not.toBe(FIXTURE_MOVEMENT_SUMMARY);
    expect(input.authoredRationale).toBe(FIXTURE_AUTHORED_RATIONALE);
    expect(input.authoredRationale).not.toBe(FIXTURE_SOURCE_TEXT);
  });

  it("requires explicit graphSlot on link intent", () => {
    const input = buildFixtureEvidenceDepthAuthoringInput();
    expect(input.graphSlotLinks[0]?.graphSlot).toBe("related");
    expect(input.graphSlotLinks[0]?.targetId).toBe(FIXTURE_CONCLUSION_ID);
  });

  it("parses CLI args for dry-run and execute modes", () => {
    expect(parseLiveEvidenceDepthFixtureCliArgs([])).toEqual({
      ok: true,
      args: {
        userId: undefined,
        dryRun: true,
        keepData: false,
        verifyUnsafeFallback: true,
      },
    });

    expect(
      parseLiveEvidenceDepthFixtureCliArgs([
        "--user-id",
        "local-user-1",
        "--execute",
        "--keep-data",
      ]),
    ).toEqual({
      ok: true,
      args: {
        userId: "local-user-1",
        dryRun: false,
        keepData: true,
        verifyUnsafeFallback: true,
      },
    });
  });

  it("allows dry-run safety path without resolving fixture userId in CLI", async () => {
    const report = await runLiveEvidenceDepthRuntimeFixture({
      userId: "dry-run-user",
      db: buildExecuteDbMock() as never,
      dryRun: true,
      env: LOCAL_ENV,
    });

    expect(report.ok).toBe(true);
    expect(report.steps.seed).toBeNull();
    expect(report.steps.publish.attempted).toBe(false);
  });

  it("classifies local vs production database urls", () => {
    expect(looksLikeLocalDatabaseUrl("postgresql://postgres@localhost:5432/companion")).toBe(
      true,
    );
    expect(looksLikeProductionDatabaseUrl("postgresql://x.prod.amazonaws.com/db")).toBe(true);
  });
});

function buildExecuteDbMock() {
  const pointer = {
    id: "receipt-pattern-dev-live-evidence-depth-claim",
    userId: "local-user-1",
    sourceObjectType: "pattern_claim",
    sourceObjectId: FIXTURE_CLAIM_ID,
    sourceText: FIXTURE_SOURCE_TEXT,
    sourceOrigin: "Recent Pattern",
    whyItMatters: FIXTURE_AUTHORED_RATIONALE,
    whyResurfaced: null,
    surfacedAt: new Date("2026-07-09T20:00:00.000Z"),
    publicEligible: true,
    status: "active",
    detailHref: null,
    libraryReceiptId: null,
  };

  const linkMeta = { graphSlot: "related", evidenceDepthGraphSlotMaterialization: true };
  const conclusion = {
    id: FIXTURE_CONCLUSION_ID,
    title: "Evening stop point matters",
    summary: "Commitments lock before the body signals a stop.",
  };

  return {
    userMapConclusion: {
      upsert: vi.fn(async () => ({ id: FIXTURE_CONCLUSION_ID })),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string } }) =>
        where.id === FIXTURE_CONCLUSION_ID ? conclusion : null,
      ),
      findMany: vi.fn(async () => [{ id: FIXTURE_CONCLUSION_ID }]),
    },
    patternClaim: {
      upsert: vi.fn(async () => ({ id: FIXTURE_CLAIM_ID })),
      findFirst: vi.fn(async () => ({ id: FIXTURE_CLAIM_ID, summary: "Evening overwork" })),
    },
    patternClaimEvidence: {
      upsert: vi.fn(async () => ({ id: "dev-live-evidence-depth-evidence" })),
      findFirst: vi.fn(async () => ({
        id: "dev-live-evidence-depth-evidence",
        quote: FIXTURE_SOURCE_TEXT,
      })),
    },
    evidencePointerSurfacingRationale: {
      upsert: vi.fn(async () => ({ id: "rat-1" })),
      findFirst: vi.fn(async () => ({ rationale: FIXTURE_AUTHORED_RATIONALE })),
    },
    understandingEvidenceLink: {
      create: vi.fn(async () => ({ id: "uel-1" })),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [
        {
          sourceType: "pattern_claim",
          sourceId: FIXTURE_CLAIM_ID,
          targetType: "usermap_conclusion",
          targetId: FIXTURE_CONCLUSION_ID,
          role: "supports",
          summary: null,
          meta: linkMeta,
        },
      ]),
      update: vi.fn(async () => ({ id: "uel-1" })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    modelUpdate: {
      create: vi.fn(async () => ({ id: "mu-fixture-1" })),
      findFirst: vi.fn(async () => null),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    surfacedEvidencePointer: {
      findFirst: vi.fn(async () => pointer),
      findMany: vi.fn(async () => [pointer]),
      upsert: vi.fn(async () => ({ id: pointer.id })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    investigation: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    fieldworkAssignment: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    contradictionNode: { findFirst: vi.fn(async () => null) },
    contradictionEvidence: { findFirst: vi.fn(async () => null) },
    surfacedAction: { findFirst: vi.fn(async () => null) },
    profileArtifact: { findFirst: vi.fn(async () => null) },
    evidenceSpan: { findFirst: vi.fn(async () => null) },
    referenceItem: { findFirst: vi.fn(async () => null) },
    quickCheckIn: { findFirst: vi.fn(async () => null) },
    journalEntry: { findFirst: vi.fn(async () => null) },
    session: { findFirst: vi.fn(async () => null) },
    message: { findFirst: vi.fn(async () => null) },
    importUploadSession: { findFirst: vi.fn(async () => null) },
    importUploadChunk: { findFirst: vi.fn(async () => null) },
  };
}

describe("live evidence depth runtime fixture graphSlot persistence", () => {
  it("stores explicit graphSlot meta on authored links", () => {
    const meta = { graphSlot: "related", evidenceDepthGraphSlotMaterialization: true };
    expect(graphSlotFromUelMeta(meta)).toBe("related");
  });
});
