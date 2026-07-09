/**
 * Local runtime fixture for live evidence depth pipeline validation.
 *
 * DEV/TEST ONLY — refuses production DATABASE_URL and requires explicit allow flag.
 * Not imported by production routes or UI.
 */

import {
  ModelUpdateType,
  ModelUpdateVisibility,
  PatternClaimStatus,
  PatternType,
  StrengthLevel,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
  type PrismaClient,
} from "@prisma/client";

import {
  persistEvidenceDepthAuthoringInputsForSource,
  type EvidenceDepthAuthoringInput,
} from "./live-evidence-depth-authoring-path";
import {
  createSurfacedEvidenceDepthLinkageDeps,
  readSurfacedEvidencePointersForUser,
} from "./live-evidence-depth-linkage";
import {
  applyTodayEvidenceDepthGateFromReadGraph,
  fetchEvidencePointersGraphService,
} from "./live-evidence-depth-runtime-validation";
import { publishModelUpdateCandidate } from "./model-update-candidate-publish-helper";
import { normalizeSummary } from "./pattern-claim-lifecycle";
import { buildSurfacedEvidencePointerId } from "./live-evidence-depth-write-path";
import { REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS } from "./orvek-v0/production/today-evidence-pointer-depth-gate";
import { isEvidenceLinkTargetPublicEligible } from "./understanding-evidence-link-public-eligibility";

export const EVIDENCE_DEPTH_FIXTURE_PREFIX = "dev-live-evidence-depth";
export const EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV = "ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE";
export const EVIDENCE_DEPTH_FIXTURE_USER_ENV = "EVIDENCE_DEPTH_FIXTURE_USER_ID";
export const EVIDENCE_DEPTH_FIXTURE_MARKER = "devFixture:live-evidence-depth-runtime";

export const FIXTURE_CLAIM_ID = `${EVIDENCE_DEPTH_FIXTURE_PREFIX}-claim`;
export const FIXTURE_CONCLUSION_ID = `${EVIDENCE_DEPTH_FIXTURE_PREFIX}-conclusion`;
export const FIXTURE_EVIDENCE_ID = `${EVIDENCE_DEPTH_FIXTURE_PREFIX}-evidence`;

export const FIXTURE_MOVEMENT_SUMMARY =
  "There is early evidence that energy drops after meetings.";

export const FIXTURE_SOURCE_TEXT =
  "I keep working past the stop point even when I said I would not.";

export const FIXTURE_AUTHORED_RATIONALE =
  "Connects evening overwork to the missing stop point before commitments lock.";

const PRODUCTION_DATABASE_URL_PATTERNS = [
  /amazonaws\.com/i,
  /\.rds\./i,
  /neon\.tech/i,
  /supabase\.co/i,
  /railway\.app/i,
  /planetscale\.com/i,
  /cockroachlabs\.cloud/i,
  /\.azure\.com/i,
  /render\.com/i,
  /heroku\.com/i,
  /prod\./i,
  /production/i,
] as const;

const LOCAL_DATABASE_URL_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/i,
  /0\.0\.0\.0/i,
  /companion-db/i,
  /@postgres:/i,
  /file:/i,
  /_test_/i,
  /prisma\+postgres:\/\/localhost/i,
] as const;

export type LiveEvidenceDepthFixtureSafetyAssessment = {
  allowed: boolean;
  blockers: string[];
  databaseUrlHost: string | null;
  nodeEnv: string | null;
};

export type ParseLiveEvidenceDepthFixtureCliArgs = {
  userId?: string;
  dryRun: boolean;
  keepData: boolean;
  verifyUnsafeFallback: boolean;
};

export type ParseLiveEvidenceDepthFixtureCliResult =
  | { ok: true; args: ParseLiveEvidenceDepthFixtureCliArgs }
  | { ok: false; message: string };

export type LiveEvidenceDepthFixtureSeedResult = {
  claimId: string;
  conclusionId: string;
  evidenceId: string;
  modelUpdateId: string;
  authoringReady: boolean;
  authoringBlockers: string[];
};

export type LiveEvidenceDepthFixtureReport = {
  ok: boolean;
  dryRun: boolean;
  keepData: boolean;
  cleanupPerformed: boolean;
  userId: string | null;
  safety: LiveEvidenceDepthFixtureSafetyAssessment;
  fixtureIds: {
    claimId: string;
    conclusionId: string;
    conclusionTargetId: string;
    expectedPointerId: string | null;
    modelUpdateId: string | null;
  };
  steps: {
    seed: LiveEvidenceDepthFixtureSeedResult | null;
    publish: {
      attempted: boolean;
      status: string | null;
      pointerId: string | null;
      blockers: string[];
    };
    dbVerification: {
      pointerExists: boolean;
      pointerWhyItMatters: string | null;
      pointerPublicEligible: boolean | null;
      rationaleStored: boolean;
      graphSlotLinkCount: number;
      movementSummaryRejectedAsRationale: boolean;
    };
    readService: {
      attempted: boolean;
      inspectorDepthListReady: boolean;
      depthSafePointerIds: string[];
      linkedObjectIds: string[];
      rejectedPointerCount: number;
      routeEquivalentOnly: true;
    };
    todayGate: {
      storedPointerReplacesFallback: boolean;
      todayResurfacedIds: string[];
    };
    unsafeFallback: {
      checked: boolean;
      preservesReferenceFallback: boolean;
    };
  };
  httpRouteExecuted: false;
  validationPath: "service_route_equivalent";
  diagnosticMessage: string;
  errors: string[];
};

export function looksLikeProductionDatabaseUrl(databaseUrl: string): boolean {
  return PRODUCTION_DATABASE_URL_PATTERNS.some((pattern) => pattern.test(databaseUrl));
}

export function looksLikeLocalDatabaseUrl(databaseUrl: string): boolean {
  return LOCAL_DATABASE_URL_PATTERNS.some((pattern) => pattern.test(databaseUrl));
}

export function extractDatabaseUrlHost(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl).host || null;
  } catch {
    return databaseUrl.slice(0, 80);
  }
}

export function assessLiveEvidenceDepthFixtureSafety(
  env: NodeJS.ProcessEnv = process.env,
): LiveEvidenceDepthFixtureSafetyAssessment {
  const blockers: string[] = [];
  const nodeEnv = env.NODE_ENV ?? null;
  const databaseUrl = env.DATABASE_URL ?? "";

  if (env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] !== "1") {
    blockers.push("missing_allow_env_flag");
  }

  if (nodeEnv === "production") {
    blockers.push("production_node_env");
  }

  if (!databaseUrl.trim()) {
    blockers.push("missing_database_url");
  } else {
    if (looksLikeProductionDatabaseUrl(databaseUrl)) {
      blockers.push("production_database_url");
    }
    if (!looksLikeLocalDatabaseUrl(databaseUrl)) {
      blockers.push("non_local_database_url");
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    databaseUrlHost: databaseUrl ? extractDatabaseUrlHost(databaseUrl) : null,
    nodeEnv,
  };
}

export function resolveLiveEvidenceDepthFixtureUserId(
  args: { userId?: string },
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; userId: string } | { ok: false; message: string } {
  const userId = args.userId?.trim() || env[EVIDENCE_DEPTH_FIXTURE_USER_ENV]?.trim();
  if (!userId) {
    return {
      ok: false,
      message:
        "Missing fixture userId. Pass --user-id <id> or set EVIDENCE_DEPTH_FIXTURE_USER_ID.",
    };
  }
  return { ok: true, userId };
}

export function parseLiveEvidenceDepthFixtureCliArgs(
  argv: string[],
): ParseLiveEvidenceDepthFixtureCliResult {
  let userId: string | undefined;
  let dryRun = true;
  let keepData = false;
  let verifyUnsafeFallback = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === "--user-id" && argv[index + 1]) {
      userId = argv[index + 1]!.trim();
      index += 1;
      continue;
    }

    if (arg === "--execute" || arg === "--no-dry-run") {
      dryRun = false;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--keep-data") {
      keepData = true;
      continue;
    }

    if (arg === "--skip-unsafe-fallback") {
      verifyUnsafeFallback = false;
    }
  }

  return {
    ok: true,
    args: {
      userId,
      dryRun,
      keepData,
      verifyUnsafeFallback,
    },
  };
}

export function buildFixtureEvidenceDepthAuthoringInput(): EvidenceDepthAuthoringInput {
  return {
    authoredRationale: FIXTURE_AUTHORED_RATIONALE,
    authoredFrom: EVIDENCE_DEPTH_FIXTURE_MARKER,
    sourceTextForValidation: FIXTURE_SOURCE_TEXT,
    graphSlotLinks: [
      {
        targetType: UnderstandingLinkTargetType.usermap_conclusion,
        targetId: FIXTURE_CONCLUSION_ID,
        role: UnderstandingLinkRole.supports,
        graphSlot: "related",
      },
    ],
  };
}

export function isFixtureOwnedId(value: string): boolean {
  return value.startsWith(`${EVIDENCE_DEPTH_FIXTURE_PREFIX}-`);
}

export async function cleanupLiveEvidenceDepthFixtureData(args: {
  userId: string;
  db: PrismaClient;
  modelUpdateId?: string | null;
}): Promise<{
  deletedPointers: number;
  deletedRationales: number;
  deletedLinks: number;
  deletedModelUpdates: number;
  deletedEvidence: number;
  deletedClaims: number;
  deletedConclusions: number;
}> {
  const fixtureSourceIds = [FIXTURE_CLAIM_ID];
  const fixtureTargetIds = [
    FIXTURE_CONCLUSION_ID,
    ...(args.modelUpdateId ? [args.modelUpdateId] : []),
  ];

  const deletedPointers = (
    await args.db.surfacedEvidencePointer.deleteMany({
      where: {
        userId: args.userId,
        sourceObjectId: { in: fixtureSourceIds },
      },
    })
  ).count;

  const deletedRationales = (
    await args.db.evidencePointerSurfacingRationale.deleteMany({
      where: {
        userId: args.userId,
        sourceObjectId: { in: fixtureSourceIds },
      },
    })
  ).count;

  const deletedLinks = (
    await args.db.understandingEvidenceLink.deleteMany({
      where: {
        userId: args.userId,
        OR: [
          { sourceId: { in: fixtureSourceIds } },
          { targetId: { in: [...fixtureTargetIds, ...fixtureSourceIds] } },
        ],
      },
    })
  ).count;

  const deletedModelUpdates = (
    await args.db.modelUpdate.deleteMany({
      where: {
        userId: args.userId,
        internalNotes: { contains: EVIDENCE_DEPTH_FIXTURE_MARKER },
      },
    })
  ).count;

  const deletedEvidence = (
    await args.db.patternClaimEvidence.deleteMany({
      where: { id: FIXTURE_EVIDENCE_ID },
    })
  ).count;

  const deletedClaims = (
    await args.db.patternClaim.deleteMany({
      where: { id: FIXTURE_CLAIM_ID, userId: args.userId },
    })
  ).count;

  const deletedConclusions = (
    await args.db.userMapConclusion.deleteMany({
      where: { id: FIXTURE_CONCLUSION_ID, userId: args.userId },
    })
  ).count;

  return {
    deletedPointers,
    deletedRationales,
    deletedLinks,
    deletedModelUpdates,
    deletedEvidence,
    deletedClaims,
    deletedConclusions,
  };
}

async function seedLiveEvidenceDepthFixtureRecords(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<LiveEvidenceDepthFixtureSeedResult> {
  const now = args.now ?? new Date();
  const claimSummary = "Evening overwork keeps resurfacing before commitments lock.";

  await args.db.userMapConclusion.upsert({
    where: { id: FIXTURE_CONCLUSION_ID },
    create: {
      id: FIXTURE_CONCLUSION_ID,
      userId: args.userId,
      area: UserMapConclusionArea.operating_logic,
      status: UserMapConclusionStatus.supported,
      visibility: UserMapConclusionVisibility.user_visible,
      title: "Evening stop point matters",
      summary: "Commitments lock before the body signals a stop.",
      confidenceScore: 0.72,
      confidenceLevel: UserMapConfidenceLevel.medium,
      evidenceCount: 1,
      sourceDiversity: 1,
      timeSpreadDays: 3,
      notes: EVIDENCE_DEPTH_FIXTURE_MARKER,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      visibility: UserMapConclusionVisibility.user_visible,
      title: "Evening stop point matters",
      summary: "Commitments lock before the body signals a stop.",
      notes: EVIDENCE_DEPTH_FIXTURE_MARKER,
      updatedAt: now,
    },
  });

  await args.db.patternClaim.upsert({
    where: { id: FIXTURE_CLAIM_ID },
    create: {
      id: FIXTURE_CLAIM_ID,
      userId: args.userId,
      patternType: PatternType.repetitive_loop,
      strengthLevel: StrengthLevel.tentative,
      status: PatternClaimStatus.active,
      summary: claimSummary,
      summaryNorm: normalizeSummary(claimSummary),
      createdAt: now,
      updatedAt: now,
    },
    update: {
      summary: claimSummary,
      summaryNorm: normalizeSummary(claimSummary),
      updatedAt: now,
    },
  });

  await args.db.patternClaimEvidence.upsert({
    where: { id: FIXTURE_EVIDENCE_ID },
    create: {
      id: FIXTURE_EVIDENCE_ID,
      claimId: FIXTURE_CLAIM_ID,
      quote: FIXTURE_SOURCE_TEXT,
      source: "user_input",
      createdAt: now,
    },
    update: {
      quote: FIXTURE_SOURCE_TEXT,
    },
  });

  const authoring = await persistEvidenceDepthAuthoringInputsForSource({
    userId: args.userId,
    sourceObjectType: "pattern_claim",
    sourceObjectId: FIXTURE_CLAIM_ID,
    input: buildFixtureEvidenceDepthAuthoringInput(),
    deps: {
      db: args.db as never,
      now,
      checkPublicTargetEligibility: (checkArgs) =>
        isEvidenceLinkTargetPublicEligible({ ...checkArgs, db: args.db as never }),
    },
  });

  const modelUpdate = await args.db.modelUpdate.create({
    data: {
      userId: args.userId,
      updateType: ModelUpdateType.link_detected,
      visibility: ModelUpdateVisibility.internal_only,
      affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
      affectedObjectId: FIXTURE_CLAIM_ID,
      userFacingSummary: FIXTURE_MOVEMENT_SUMMARY,
      isMeaningful: false,
      internalNotes: `${EVIDENCE_DEPTH_FIXTURE_MARKER};candidateLane:internal_only`,
    },
    select: { id: true },
  });

  await args.db.understandingEvidenceLink.create({
    data: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.pattern_claim,
      sourceId: FIXTURE_CLAIM_ID,
      targetType: UnderstandingLinkTargetType.model_update,
      targetId: modelUpdate.id,
      role: UnderstandingLinkRole.supports,
      summary: "Fixture evidence link for publish precondition",
    },
  });

  return {
    claimId: FIXTURE_CLAIM_ID,
    conclusionId: FIXTURE_CONCLUSION_ID,
    evidenceId: FIXTURE_EVIDENCE_ID,
    modelUpdateId: modelUpdate.id,
    authoringReady: authoring.ready,
    authoringBlockers: "blockers" in authoring ? authoring.blockers : [],
  };
}

export async function runLiveEvidenceDepthRuntimeFixture(args: {
  userId: string;
  db: PrismaClient;
  dryRun?: boolean;
  keepData?: boolean;
  verifyUnsafeFallback?: boolean;
  now?: Date;
  publishCandidate?: typeof publishModelUpdateCandidate;
  env?: NodeJS.ProcessEnv;
}): Promise<LiveEvidenceDepthFixtureReport> {
  const safety = assessLiveEvidenceDepthFixtureSafety(args.env);
  const dryRun = args.dryRun ?? true;
  const keepData = args.keepData ?? false;
  const verifyUnsafeFallback = args.verifyUnsafeFallback ?? true;
  const publishCandidate = args.publishCandidate ?? publishModelUpdateCandidate;
  const expectedPointerId = buildSurfacedEvidencePointerId({
    sourceObjectType: "pattern_claim",
    sourceObjectId: FIXTURE_CLAIM_ID,
  });

  const report: LiveEvidenceDepthFixtureReport = {
    ok: false,
    dryRun,
    keepData,
    cleanupPerformed: false,
    userId: args.userId,
    safety,
    fixtureIds: {
      claimId: FIXTURE_CLAIM_ID,
      conclusionId: FIXTURE_CONCLUSION_ID,
      conclusionTargetId: FIXTURE_CONCLUSION_ID,
      expectedPointerId,
      modelUpdateId: null,
    },
    steps: {
      seed: null,
      publish: {
        attempted: false,
        status: null,
        pointerId: null,
        blockers: [],
      },
      dbVerification: {
        pointerExists: false,
        pointerWhyItMatters: null,
        pointerPublicEligible: null,
        rationaleStored: false,
        graphSlotLinkCount: 0,
        movementSummaryRejectedAsRationale: true,
      },
      readService: {
        attempted: false,
        inspectorDepthListReady: false,
        depthSafePointerIds: [],
        linkedObjectIds: [],
        rejectedPointerCount: 0,
        routeEquivalentOnly: true,
      },
      todayGate: {
        storedPointerReplacesFallback: false,
        todayResurfacedIds: [],
      },
      unsafeFallback: {
        checked: false,
        preservesReferenceFallback: false,
      },
    },
    httpRouteExecuted: false,
    validationPath: "service_route_equivalent",
    diagnosticMessage: "",
    errors: [],
  };

  if (!safety.allowed) {
    report.diagnosticMessage = `Refused: fixture safety guards blocked execution (${safety.blockers.join(",")}).`;
    return report;
  }

  if (dryRun) {
    report.ok = true;
    report.diagnosticMessage =
      "Dry-run only: safety guards passed. Re-run with --execute to seed, publish, read, and gate-validate against local DB.";
    return report;
  }

  let seeded: LiveEvidenceDepthFixtureSeedResult | null = null;

  try {
    seeded = await seedLiveEvidenceDepthFixtureRecords({
      userId: args.userId,
      db: args.db,
      now: args.now,
    });
    report.steps.seed = seeded;
    report.fixtureIds.modelUpdateId = seeded.modelUpdateId;

    if (!seeded.authoringReady) {
      report.errors.push(
        `authoring_not_ready:${seeded.authoringBlockers.join(",")}`,
      );
      report.diagnosticMessage = "Fixture authoring inputs were not ready.";
      return report;
    }

    report.steps.publish.attempted = true;
    const publishResult = await publishCandidate(args.userId, seeded.modelUpdateId, {
      db: args.db,
      now: () => args.now ?? new Date(),
    });
    report.steps.publish.status =
      publishResult.evidenceDepthMaterialization?.status ?? "missing_materialization_result";
    report.steps.publish.pointerId =
      publishResult.evidenceDepthMaterialization?.pointerId ?? null;
    report.steps.publish.blockers =
      publishResult.evidenceDepthMaterialization?.blockers ?? [];

    const pointer = expectedPointerId
      ? await args.db.surfacedEvidencePointer.findFirst({
          where: { id: expectedPointerId, userId: args.userId },
          select: {
            id: true,
            whyItMatters: true,
            publicEligible: true,
            sourceObjectId: true,
          },
        })
      : null;

    const rationale = await args.db.evidencePointerSurfacingRationale.findFirst({
      where: {
        userId: args.userId,
        sourceObjectType: "pattern_claim",
        sourceObjectId: FIXTURE_CLAIM_ID,
      },
      select: { rationale: true },
    });

    const graphSlotLinks = await args.db.understandingEvidenceLink.findMany({
      where: {
        userId: args.userId,
        sourceType: "pattern_claim",
        sourceId: FIXTURE_CLAIM_ID,
      },
      select: { meta: true, targetId: true },
    });

    report.steps.dbVerification = {
      pointerExists: Boolean(pointer),
      pointerWhyItMatters: pointer?.whyItMatters ?? null,
      pointerPublicEligible: pointer?.publicEligible ?? null,
      rationaleStored: Boolean(rationale),
      graphSlotLinkCount: graphSlotLinks.filter(
        (row) =>
          row.targetId === FIXTURE_CONCLUSION_ID &&
          typeof row.meta === "object" &&
          row.meta !== null &&
          "graphSlot" in (row.meta as Record<string, unknown>),
      ).length,
      movementSummaryRejectedAsRationale:
        rationale?.rationale !== FIXTURE_MOVEMENT_SUMMARY &&
        pointer?.whyItMatters !== FIXTURE_MOVEMENT_SUMMARY,
    };

    report.steps.readService.attempted = true;
    const linkageDeps = createSurfacedEvidenceDepthLinkageDeps(args.db as never);
    const readGraph = await fetchEvidencePointersGraphService({
      userId: args.userId,
      deps: linkageDeps,
    });
    report.steps.readService.inspectorDepthListReady = readGraph.inspectorDepthListReady;
    report.steps.readService.depthSafePointerIds = readGraph.depthSafePointerIds;
    report.steps.readService.linkedObjectIds = readGraph.linkedObjects.map(
      (object) => object.id,
    );
    report.steps.readService.rejectedPointerCount = readGraph.rejectedPointers.length;

    const { gatedApi } = applyTodayEvidenceDepthGateFromReadGraph({ readGraph });
    report.steps.todayGate.todayResurfacedIds = [...(gatedApi.todayResurfacedIds ?? [])];
    report.steps.todayGate.storedPointerReplacesFallback =
      readGraph.inspectorDepthListReady &&
      readGraph.depthSafePointerIds.length > 0 &&
      JSON.stringify(gatedApi.todayResurfacedIds) ===
        JSON.stringify(readGraph.depthSafePointerIds);

    if (verifyUnsafeFallback) {
      const unsafeGraph = await readSurfacedEvidencePointersForUser(
        { userId: args.userId },
        {
          ...linkageDeps,
          listSurfacedEvidencePointers: async () => [
            {
              id: `${EVIDENCE_DEPTH_FIXTURE_PREFIX}-unsafe-pointer`,
              userId: args.userId,
              sourceObjectType: "pattern_claim",
              sourceObjectId: FIXTURE_CLAIM_ID,
              sourceText: FIXTURE_SOURCE_TEXT,
              sourceOrigin: "Recent Pattern",
              whyItMatters: "Surfaced from your recent material.",
              whyResurfaced: null,
              surfacedAt: args.now ?? new Date(),
              publicEligible: true,
              status: "active",
              detailHref: null,
              libraryReceiptId: null,
            },
          ],
        },
      );
      const unsafeGate = applyTodayEvidenceDepthGateFromReadGraph({
        readGraph: unsafeGraph,
      });
      report.steps.unsafeFallback.checked = true;
      report.steps.unsafeFallback.preservesReferenceFallback =
        unsafeGate.gatedApi.todayResurfacedIds?.join(",") ===
        REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS.join(",");
    }

    const publishOk =
      report.steps.publish.status === "materialized" && report.steps.dbVerification.pointerExists;
    const readOk =
      report.steps.readService.inspectorDepthListReady &&
      report.steps.readService.depthSafePointerIds.includes(expectedPointerId ?? "");
    const gateOk = report.steps.todayGate.storedPointerReplacesFallback;
    const rationaleOk =
      report.steps.dbVerification.rationaleStored &&
      report.steps.dbVerification.pointerWhyItMatters === FIXTURE_AUTHORED_RATIONALE &&
      report.steps.dbVerification.movementSummaryRejectedAsRationale;
    const graphSlotOk = report.steps.dbVerification.graphSlotLinkCount > 0;
    const unsafeOk =
      !verifyUnsafeFallback || report.steps.unsafeFallback.preservesReferenceFallback;

    report.ok =
      publishOk && readOk && gateOk && rationaleOk && graphSlotOk && unsafeOk;
    report.diagnosticMessage = report.ok
      ? "Live evidence depth runtime fixture passed (service route-equivalent; HTTP auth route not executed)."
      : "Live evidence depth runtime fixture completed with validation failures.";
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
    report.diagnosticMessage = "Fixture execution failed.";
  } finally {
    if (!dryRun && !keepData) {
      await cleanupLiveEvidenceDepthFixtureData({
        userId: args.userId,
        db: args.db,
        modelUpdateId: seeded?.modelUpdateId ?? report.fixtureIds.modelUpdateId,
      });
      report.cleanupPerformed = true;
    }
  }

  return report;
}
