/**
 * Phase 3A — canonical Explore movement proposal creation.
 *
 * Isolated Postgres proofs use CANONICAL_AUTHORITY_DB_TEST_URL.
 * Legacy-path proofs also cover the in-memory semantic fake DB.
 */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  PrismaClient,
  Role,
  SessionSurfaceType,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
} from "@prisma/client";

import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../canonical-model-authority-flag";
import {
  isCanonicalModelAuthorityError,
  type CanonicalModelAuthorityError,
} from "../canonical-model-authority-errors";
import { deriveCanonicalUmcSnapshotHash } from "../canonical-umc-snapshot-hash";
import * as umcSnapshotHash from "../canonical-umc-snapshot-hash";
import {
  createExploreMovementProposal,
  createOrReuseSemanticExploreMovementProposal,
} from "../explore-movement-proposal";
import { deriveExploreMovementProposalId } from "../explore-movement-proposal-provenance";
import { buildExploreMovementProposalProvenance } from "../explore-movement-proposal-provenance";
import { resolveOrRegisterCanonicalConceptFromUserMapConclusion } from "../canonical-concept-registration";
import type { ExploreGroundingSource } from "../explore-grounding-contract";
import {
  makeSemanticTestDb,
  SEMANTIC_USER_ID,
  UMC_ID,
  SESSION_ID,
  USER_MSG_ID,
  ASSISTANT_MSG_ID,
  validProposeDecision,
  completedPassReferee,
  validProvenance,
} from "./helpers/explore-movement-semantic-test-helpers";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "../explore-movement-semantic-contract";
import type { ExploreMovementProposalProvenance } from "../explore-movement-proposal-provenance";
import type { ExploreMovementProposeConclusionStrengthening } from "../explore-movement-semantic-contract";

function requireProposeDecision(
  provenance: ExploreMovementProposalProvenance,
): ExploreMovementProposeConclusionStrengthening {
  const decision = provenance.semanticDecision;
  if (decision.outcome !== "PROPOSE_CONCLUSION_STRENGTHENING") {
    throw new Error("expected PROPOSE_CONCLUSION_STRENGTHENING");
  }
  return decision;
}

const CANONICAL_AUTHORITY_DB_TEST_URL_ENV =
  "CANONICAL_AUTHORITY_DB_TEST_URL" as const;

const rawTestUrl = process.env[CANONICAL_AUTHORITY_DB_TEST_URL_ENV]?.trim() ?? "";

function assessCanonicalAuthorityDbUrl(url: string): {
  ok: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  if (!url) {
    blockers.push(`${CANONICAL_AUTHORITY_DB_TEST_URL_ENV} is blank or missing`);
    return { ok: false, blockers };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    blockers.push("URL is not a valid absolute URL");
    return { ok: false, blockers };
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    blockers.push("URL must use postgresql:// or postgres://");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") {
    blockers.push("host must be localhost or 127.0.0.1");
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!dbName.includes("canonical_authority")) {
    blockers.push(`database name must include "canonical_authority"`);
  }
  const appUrl = process.env.DATABASE_URL?.trim();
  if (appUrl && appUrl === url) {
    blockers.push(
      `${CANONICAL_AUTHORITY_DB_TEST_URL_ENV} must not equal DATABASE_URL`,
    );
  }
  return { ok: blockers.length === 0, blockers };
}

const safety = assessCanonicalAuthorityDbUrl(rawTestUrl);
const shouldAttemptRealDb = safety.ok;

function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function clearCanonicalGateEnv(): void {
  delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
  delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];
}

function enableCanonicalGateFor(userId: string): void {
  process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "1";
  process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] = userId;
}

async function expectCode(
  action: () => Promise<unknown>,
  code: CanonicalModelAuthorityError["code"],
): Promise<void> {
  try {
    await action();
    expect.fail(`Expected CanonicalModelAuthorityError ${code}`);
  } catch (error) {
    expect(isCanonicalModelAuthorityError(error)).toBe(true);
    if (isCanonicalModelAuthorityError(error)) {
      expect(error.code).toBe(code);
    }
  }
}

describe("canonical Explore proposal creation — identity", () => {
  it("legacy proposal IDs omit authorityMode and stay stable", () => {
    const base = {
      userId: "u1",
      conversationId: "c1",
      assistantMessageId: "a1",
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: "umc1",
      afterSummary: "  same summary  ",
    };
    const legacy = deriveExploreMovementProposalId(base);
    const legacyExplicit = deriveExploreMovementProposalId({
      ...base,
      authorityMode: "legacy",
    });
    expect(legacy).toBe(legacyExplicit);
    expect(legacy.startsWith("emp_")).toBe(true);
  });

  it("canonical_v1 proposal IDs differ from legacy IDs", () => {
    const base = {
      userId: "u1",
      conversationId: "c1",
      assistantMessageId: "a1",
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: "umc1",
      afterSummary: "same summary",
    };
    const legacy = deriveExploreMovementProposalId(base);
    const canonical = deriveExploreMovementProposalId({
      ...base,
      authorityMode: "canonical_v1",
    });
    expect(canonical).not.toBe(legacy);
  });
});

describe("canonical Explore proposal creation — legacy fake path", () => {
  afterEach(() => {
    clearCanonicalGateEnv();
  });

  it("disabled flag creates the unchanged legacy proposal", async () => {
    clearCanonicalGateEnv();
    const harness = makeSemanticTestDb();
    const provenance = validProvenance();
    const decision = requireProposeDecision(provenance);
    const result = await createOrReuseSemanticExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      db: harness.db as never,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      affectedObjectId: UMC_ID,
      beforeSummary: harness.umc.summary,
      afterSummary: decision.afterSummary,
      rationale: decision.rationale,
      userFacingSummary: decision.userFacingSummary,
      provenance,
    });
    expect(result.created).toBe(true);
    const row = harness.proposals[0];
    expect(row?.authorityMode).toBe(ExploreMovementAuthorityMode.legacy);
    expect(row?.canonicalConceptId ?? null).toBeNull();
    expect(row?.expectedCurrentRevisionId ?? null).toBeNull();
    expect(row?.revisionOperation ?? null).toBeNull();
  });

  it("enabled flag but user absent from allowlist creates legacy", async () => {
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "1";
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] =
      "some_other_user";
    const harness = makeSemanticTestDb();
    const provenance = validProvenance();
    const decision = requireProposeDecision(provenance);
    const result = await createOrReuseSemanticExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      db: harness.db as never,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      affectedObjectId: UMC_ID,
      beforeSummary: harness.umc.summary,
      afterSummary: decision.afterSummary,
      rationale: decision.rationale,
      userFacingSummary: decision.userFacingSummary,
      provenance,
    });
    expect(result.created).toBe(true);
    expect(harness.proposals[0]?.authorityMode).toBe(
      ExploreMovementAuthorityMode.legacy,
    );
  });
});

describe.skipIf(!shouldAttemptRealDb)(
  "canonical Explore proposal creation — database",
  () => {
    let prisma: PrismaClient;
    const userId = id("user");
    const otherUserId = id("other");

    beforeAll(async () => {
      execFileSync("npx", ["prisma", "migrate", "deploy"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: rawTestUrl },
        stdio: "pipe",
      });
      prisma = new PrismaClient({
        datasources: { db: { url: rawTestUrl } },
      });
      await prisma.$connect();
    }, 120_000);

    afterAll(async () => {
      if (!prisma) return;
      // Do not TRUNCATE shared tables — parallel canonical suites share this DB
      // and revision rows are immutability-protected (DELETE blocked).
      await prisma.$disconnect();
    });

    beforeEach(() => {
      clearCanonicalGateEnv();
      vi.restoreAllMocks();
    });

    afterEach(() => {
      clearCanonicalGateEnv();
      vi.restoreAllMocks();
    });

    async function createUmc(args?: {
      userId?: string;
      title?: string;
      summary?: string;
      status?: UserMapConclusionStatus;
      visibility?: UserMapConclusionVisibility;
    }) {
      return prisma.userMapConclusion.create({
        data: {
          userId: args?.userId ?? userId,
          area: UserMapConclusionArea.operating_logic,
          status: args?.status ?? UserMapConclusionStatus.emerging,
          visibility:
            args?.visibility ?? UserMapConclusionVisibility.user_visible,
          title: args?.title ?? "Working title",
          summary:
            args?.summary ??
            "Evening recovery boundary weakens when meetings stack without a hard stop.",
          confidenceScore: 0.55,
          confidenceLevel: UserMapConfidenceLevel.medium,
        },
      });
    }

    async function seedExploreLineage(args?: {
      userId?: string;
      conversationId?: string;
      userMessageId?: string;
      assistantMessageId?: string;
      surfaceType?: SessionSurfaceType | null;
    }) {
      const owner = args?.userId ?? userId;
      const conversationId = args?.conversationId ?? id("session");
      const userMessageId = args?.userMessageId ?? id("umsg");
      const assistantMessageId = args?.assistantMessageId ?? id("amsg");
      await prisma.session.create({
        data: {
          id: conversationId,
          userId: owner,
          surfaceType:
            args?.surfaceType === undefined
              ? SessionSurfaceType.explore_chat
              : args.surfaceType,
        },
      });
      await prisma.message.create({
        data: {
          id: userMessageId,
          sessionId: conversationId,
          userId: owner,
          role: Role.user,
          content: "I keep skipping the evening stop after dense meetings.",
        },
      });
      await prisma.message.create({
        data: {
          id: assistantMessageId,
          sessionId: conversationId,
          userId: owner,
          role: Role.assistant,
          content: "That may strengthen the recovery-boundary conclusion.",
        },
      });
      return { conversationId, userMessageId, assistantMessageId };
    }

    async function seedJournal(args?: { userId?: string; journalId?: string }) {
      const journalId = args?.journalId ?? id("journal");
      await prisma.journalEntry.create({
        data: {
          id: journalId,
          userId: args?.userId ?? userId,
          title: "Recovery journal",
          body: "After dense meetings I lose the evening stop point.",
        },
      });
      return journalId;
    }

    function buildProvenance(args: {
      umcId: string;
      journalId: string;
      userId: string;
      afterSummary: string;
      beforeSummary: string;
    }) {
      const sources: ExploreGroundingSource[] = [
        {
          sourceId: args.journalId,
          sourceType: "journal_entry",
          sourceFamily: "journal_entry",
          userId: args.userId,
          title: "Recovery journal",
          extract:
            "After dense meetings I lose the evening stop point and keep working past fatigue.",
          retrievalReason:
            "Stored extract directly supports the conversational claim.",
          claimSupport: "verifies",
          epistemicStatus: "VERIFIED",
        },
      ];
      const decision = validProposeDecision({
        targetObjectId: args.umcId,
        afterSummary: args.afterSummary,
        evidenceSourceIds: [args.journalId],
        confidence: Math.max(EXPLORE_MOVEMENT_MIN_CONFIDENCE, 0.72),
      });
      const provenance = buildExploreMovementProposalProvenance({
        sources,
        semanticDecision: decision,
        refereeResult: completedPassReferee({
          proposedConfidence: decision.confidence,
        }),
        providerMetadata: {
          providerId: "injected",
          adjudicatorModelId: "fake-adjudicator",
          refereeModelId: "fake-referee",
          adjudicatorCalls: 1,
          refereeCalls: 1,
          totalCalls: 2,
        },
      });
      return { provenance, decision };
    }

    async function createCanonicalProposal(args: {
      umc: {
        id: string;
        summary: string;
      };
      lineage: {
        conversationId: string;
        userMessageId: string;
        assistantMessageId: string;
      };
      journalId: string;
      afterSummary?: string;
    }) {
      const afterSummary =
        args.afterSummary ??
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: args.umc.id,
        journalId: args.journalId,
        userId,
        afterSummary,
        beforeSummary: args.umc.summary,
      });
      return createOrReuseSemanticExploreMovementProposal({
        userId,
        db: prisma,
        conversationId: args.lineage.conversationId,
        assistantMessageId: args.lineage.assistantMessageId,
        userMessageId: args.lineage.userMessageId,
        affectedObjectId: args.umc.id,
        beforeSummary: args.umc.summary,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance,
      });
    }

    it("enabled and allowlisted user creates canonical_v1", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Canonical create" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();

      const result = await createCanonicalProposal({ umc, lineage, journalId });
      expect(result.created).toBe(true);

      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: result.record.proposalId },
      });
      expect(row.authorityMode).toBe(ExploreMovementAuthorityMode.canonical_v1);
      expect(row.revisionOperation).toBe(
        CanonicalRevisionOperation.strengthen,
      );
      expect(row.canonicalConceptId).toBeTruthy();
      expect(row.expectedCurrentRevisionId).toBeTruthy();
      expect(row.expectedLegacySnapshotHash).toBeNull();
    });

    it("canonical creation lazily registers revision 1", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Lazy register" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();

      expect(
        await prisma.canonicalConceptSourceBinding.count({
          where: {
            userId,
            sourceId: umc.id,
          },
        }),
      ).toBe(0);

      const result = await createCanonicalProposal({ umc, lineage, journalId });
      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: result.record.proposalId },
      });
      const revision = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: row.expectedCurrentRevisionId! },
      });
      expect(revision.version).toBe(1);
      expect(revision.operation).toBe(CanonicalRevisionOperation.registered);
      expect(revision.decisionSource).toBe(
        CanonicalRevisionDecisionSource.legacy_registration,
      );
      expect(
        await prisma.canonicalConceptSourceBinding.count({
          where: {
            userId,
            sourceId: umc.id,
          },
        }),
      ).toBe(1);
    });

    it("canonical proposal freezes exact concept ID, revision ID and version 1", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Freeze ids" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();

      const result = await createCanonicalProposal({ umc, lineage, journalId });
      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: result.record.proposalId },
      });
      const concept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: row.canonicalConceptId! },
      });
      expect(concept.currentRevisionId).toBe(row.expectedCurrentRevisionId);
      const revision = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: row.expectedCurrentRevisionId! },
      });
      expect(revision.conceptId).toBe(concept.id);
      expect(revision.version).toBe(1);
      expect(revision.userId).toBe(userId);
    });

    it("repeated equivalent canonical creation preserves existing dedupe behaviour", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Dedupe canonical" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();

      const first = await createCanonicalProposal({ umc, lineage, journalId });
      const second = await createCanonicalProposal({ umc, lineage, journalId });
      expect(second.created).toBe(false);
      expect(second.record.proposalId).toBe(first.record.proposalId);
      expect(
        await prisma.exploreMovementProposal.count({
          where: {
            userId,
            affectedObjectId: umc.id,
            authorityMode: ExploreMovementAuthorityMode.canonical_v1,
          },
        }),
      ).toBe(1);
    });

    it("a legacy proposal does not satisfy canonical dedupe", async () => {
      const umc = await createUmc({ title: "Legacy then canonical" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      clearCanonicalGateEnv();
      const legacy = await createOrReuseSemanticExploreMovementProposal({
        userId,
        db: prisma,
        conversationId: lineage.conversationId,
        assistantMessageId: lineage.assistantMessageId,
        userMessageId: lineage.userMessageId,
        affectedObjectId: umc.id,
        beforeSummary: umc.summary,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance,
      });
      expect(legacy.created).toBe(true);

      enableCanonicalGateFor(userId);
      const canonical = await createOrReuseSemanticExploreMovementProposal({
        userId,
        db: prisma,
        conversationId: lineage.conversationId,
        assistantMessageId: lineage.assistantMessageId,
        userMessageId: lineage.userMessageId,
        affectedObjectId: umc.id,
        beforeSummary: umc.summary,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance,
      });
      expect(canonical.created).toBe(true);
      expect(canonical.record.proposalId).not.toBe(legacy.record.proposalId);

      const legacyRow = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: legacy.record.proposalId },
      });
      const canonicalRow =
        await prisma.exploreMovementProposal.findUniqueOrThrow({
          where: { id: canonical.record.proposalId },
        });
      expect(legacyRow.authorityMode).toBe(ExploreMovementAuthorityMode.legacy);
      expect(canonicalRow.authorityMode).toBe(
        ExploreMovementAuthorityMode.canonical_v1,
      );
    });

    it("a canonical proposal does not satisfy legacy dedupe", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Canonical then legacy" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      const canonical = await createOrReuseSemanticExploreMovementProposal({
        userId,
        db: prisma,
        conversationId: lineage.conversationId,
        assistantMessageId: lineage.assistantMessageId,
        userMessageId: lineage.userMessageId,
        affectedObjectId: umc.id,
        beforeSummary: umc.summary,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance,
      });
      expect(canonical.created).toBe(true);

      clearCanonicalGateEnv();
      const legacy = await createOrReuseSemanticExploreMovementProposal({
        userId,
        db: prisma,
        conversationId: lineage.conversationId,
        assistantMessageId: lineage.assistantMessageId,
        userMessageId: lineage.userMessageId,
        affectedObjectId: umc.id,
        beforeSummary: umc.summary,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance,
      });
      expect(legacy.created).toBe(true);
      expect(legacy.record.proposalId).not.toBe(canonical.record.proposalId);
    });

    it("UMC snapshot drift returns STALE_CURRENT_REVISION", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Drift" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      const realDerive = deriveCanonicalUmcSnapshotHash;
      let calls = 0;
      vi.spyOn(umcSnapshotHash, "deriveCanonicalUmcSnapshotHash").mockImplementation(
        (args) => {
          calls += 1;
          if (calls === 1) {
            return `umc_snap_v1:${"a".repeat(64)}`;
          }
          return realDerive(args);
        },
      );

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "STALE_CURRENT_REVISION",
      );
      expect(
        await prisma.exploreMovementProposal.count({
          where: { userId, affectedObjectId: umc.id },
        }),
      ).toBe(0);
    });

    it("cross-user target cannot create a canonical proposal", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({
        userId: otherUserId,
        title: "Other owner",
      });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "WRONG_OWNER",
      );
    });

    it("non-qualifying UMC fails closed", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({
        title: "Internal only",
        visibility: UserMapConclusionVisibility.internal_only,
      });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "NOT_QUALIFYING_CONCLUSION",
      );
    });

    it("invalid Explore evidence lineage fails closed", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Bad lineage" });
      const lineage = await seedExploreLineage({
        surfaceType: SessionSurfaceType.journal_chat,
      });
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "INVALID_EVIDENCE_OWNERSHIP",
      );
    });

    it("canonical evidence preparation failure creates no proposal", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Bad evidence source" });
      const lineage = await seedExploreLineage();
      const foreignJournalId = await seedJournal({ userId: otherUserId });
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId: foreignJournalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "INVALID_EVIDENCE_OWNERSHIP",
      );

      expect(
        await prisma.exploreMovementProposal.count({
          where: { userId, affectedObjectId: umc.id },
        }),
      ).toBe(0);
    });

    it("concept already at revision 2 returns STALE_CURRENT_REVISION", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Already rev2" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      // First create registers revision 1 and a proposal.
      const first = await createOrReuseSemanticExploreMovementProposal({
        userId,
        db: prisma,
        conversationId: lineage.conversationId,
        assistantMessageId: lineage.assistantMessageId,
        userMessageId: lineage.userMessageId,
        affectedObjectId: umc.id,
        beforeSummary: umc.summary,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance,
      });
      const firstRow = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: first.record.proposalId },
      });

      const placeholderProposal = await prisma.exploreMovementProposal.create({
        data: {
          userId,
          conversationId: id("conv"),
          assistantMessageId: id("asst"),
          userMessageId: id("umsg"),
          status: ExploreMovementProposalStatus.proposed,
          authorityMode: ExploreMovementAuthorityMode.canonical_v1,
          revisionOperation: CanonicalRevisionOperation.strengthen,
          expectedLegacySnapshotHash: deriveCanonicalUmcSnapshotHash({
            id: umc.id,
            title: umc.title,
            summary: umc.summary,
            status: umc.status,
            confidenceScore: umc.confidenceScore,
            confidenceLevel: umc.confidenceLevel,
            updatedAt: umc.updatedAt,
          }),
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: umc.id,
          beforeSummary: umc.summary,
          afterSummary: "placeholder strengthen",
          rationale: "placeholder",
          userFacingSummary: "placeholder",
          sourcesJson: [],
        },
      });

      const rev2 = await prisma.canonicalConceptRevision.create({
        data: {
          userId,
          conceptId: firstRow.canonicalConceptId!,
          version: 2,
          title: umc.title,
          summary: "strengthened",
          status: "emerging",
          confidenceScore: umc.confidenceScore,
          confidenceLevel: umc.confidenceLevel,
          evidenceCount: 0,
          operation: CanonicalRevisionOperation.strengthen,
          decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
          acceptedAt: new Date(),
          previousRevisionId: firstRow.expectedCurrentRevisionId!,
          createdFromProposalId: placeholderProposal.id,
        },
      });
      await prisma.canonicalConcept.update({
        where: { id: firstRow.canonicalConceptId! },
        data: { currentRevisionId: rev2.id },
      });

      // Different afterSummary → different deterministic ID, so create is attempted.
      const { provenance: driftedProvenance, decision: driftedDecision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary:
          "Evening recovery boundary weakens even more when meetings stack and recovery is skipped entirely.",
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: driftedDecision.afterSummary,
            rationale: driftedDecision.rationale,
            userFacingSummary:
              driftedDecision.userFacingSummary,
            provenance: driftedProvenance,
          }),
        "STALE_CURRENT_REVISION",
      );
    });

    it("canonical failure never falls back to legacy", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "No legacy fallback" });
      const lineage = await seedExploreLineage({
        surfaceType: SessionSurfaceType.journal_chat,
      });
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "INVALID_EVIDENCE_OWNERSHIP",
      );

      const rows = await prisma.exploreMovementProposal.findMany({
        where: { userId, affectedObjectId: umc.id },
      });
      expect(rows).toHaveLength(0);
      expect(
        rows.every(
          (row) => row.authorityMode !== ExploreMovementAuthorityMode.legacy,
        ),
      ).toBe(true);
    });

    it("transaction rollback leaves no partial concept, revision, binding or proposal when creation fails after registration begins", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Rollback" });
      const lineage = await seedExploreLineage();
      const foreignJournalId = await seedJournal({ userId: otherUserId });
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId: foreignJournalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      const conceptsBefore = await prisma.canonicalConcept.count({
        where: { userId },
      });
      const revisionsBefore = await prisma.canonicalConceptRevision.count({
        where: { userId },
      });
      const bindingsBefore = await prisma.canonicalConceptSourceBinding.count({
        where: { userId },
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "INVALID_EVIDENCE_OWNERSHIP",
      );

      expect(
        await prisma.canonicalConcept.count({ where: { userId } }),
      ).toBe(conceptsBefore);
      expect(
        await prisma.canonicalConceptRevision.count({ where: { userId } }),
      ).toBe(revisionsBefore);
      expect(
        await prisma.canonicalConceptSourceBinding.count({ where: { userId } }),
      ).toBe(bindingsBefore);
      expect(
        await prisma.exploreMovementProposal.count({
          where: { userId, affectedObjectId: umc.id },
        }),
      ).toBe(0);
    });

    it("missing provenance fails closed with INVALID_PROPOSAL_PROVENANCE", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Missing provenance" });
      const lineage = await seedExploreLineage();

      await expectCode(
        () =>
          createExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary:
              "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.",
            rationale: "r",
            userFacingSummary: "u",
          }),
        "INVALID_PROPOSAL_PROVENANCE",
      );
      expect(
        await prisma.exploreMovementProposal.count({
          where: { userId, affectedObjectId: umc.id },
        }),
      ).toBe(0);
      expect(
        await prisma.canonicalConceptSourceBinding.count({
          where: { userId, sourceId: umc.id },
        }),
      ).toBe(0);
    });

    it("legacy array-only sources fail closed for canonical creation", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Array only" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();

      await expectCode(
        () =>
          createExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary:
              "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.",
            rationale: "r",
            userFacingSummary: "u",
            sources: [
              {
                sourceId: journalId,
                sourceType: "journal_entry",
                sourceFamily: "journal_entry",
                userId,
                title: "j",
                extract: "extract",
                retrievalReason: "reason",
                claimSupport: "verifies",
                epistemicStatus: "VERIFIED",
              },
            ],
          }),
        "INVALID_PROPOSAL_PROVENANCE",
      );
      expect(
        await prisma.canonicalConceptSourceBinding.count({
          where: { userId, sourceId: umc.id },
        }),
      ).toBe(0);
    });

    it("mismatched provenance decision fields fail closed", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Mismatch decision" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary:
          "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.",
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: umc.summary,
            afterSummary: `${decision.afterSummary} (tampered)`,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "INVALID_PROPOSAL_PROVENANCE",
      );
    });

    it("stale beforeSummary returns STALE_CURRENT_REVISION without writes", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Stale before" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary:
          "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.",
        beforeSummary: umc.summary,
      });

      await expectCode(
        () =>
          createOrReuseSemanticExploreMovementProposal({
            userId,
            db: prisma,
            conversationId: lineage.conversationId,
            assistantMessageId: lineage.assistantMessageId,
            userMessageId: lineage.userMessageId,
            affectedObjectId: umc.id,
            beforeSummary: `${umc.summary} (stale)`,
            afterSummary: decision.afterSummary,
            rationale: decision.rationale,
            userFacingSummary: decision.userFacingSummary,
            provenance,
          }),
        "STALE_CURRENT_REVISION",
      );
      expect(
        await prisma.canonicalConceptSourceBinding.count({
          where: { userId, sourceId: umc.id },
        }),
      ).toBe(0);
      expect(
        await prisma.exploreMovementProposal.count({
          where: { userId, affectedObjectId: umc.id },
        }),
      ).toBe(0);
    });

    it("broken canonical_v1 same-ID row with only legacy snapshot is not reused", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Broken reuse shape" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      const proposalId = deriveExploreMovementProposalId({
        userId,
        conversationId: lineage.conversationId,
        assistantMessageId: lineage.assistantMessageId,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: umc.id,
        afterSummary: decision.afterSummary,
        authorityMode: "canonical_v1",
      });

      await prisma.exploreMovementProposal.create({
        data: {
          id: proposalId,
          userId,
          conversationId: lineage.conversationId,
          assistantMessageId: lineage.assistantMessageId,
          userMessageId: lineage.userMessageId,
          status: ExploreMovementProposalStatus.proposed,
          authorityMode: ExploreMovementAuthorityMode.canonical_v1,
          revisionOperation: CanonicalRevisionOperation.strengthen,
          expectedLegacySnapshotHash: deriveCanonicalUmcSnapshotHash({
            id: umc.id,
            title: umc.title,
            summary: umc.summary,
            status: umc.status,
            confidenceScore: umc.confidenceScore,
            confidenceLevel: umc.confidenceLevel,
            updatedAt: umc.updatedAt,
          }),
          expectedCurrentRevisionId: null,
          canonicalConceptId: null,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: umc.id,
          beforeSummary: umc.summary,
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: provenance,
        },
      });

      await expect(
        createOrReuseSemanticExploreMovementProposal({
          userId,
          db: prisma,
          conversationId: lineage.conversationId,
          assistantMessageId: lineage.assistantMessageId,
          userMessageId: lineage.userMessageId,
          affectedObjectId: umc.id,
          beforeSummary: umc.summary,
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          provenance,
        }),
      ).rejects.toThrow(
        "explore_movement_deterministic_id_occupied_by_invalid_provenance",
      );

      expect(
        await prisma.exploreMovementProposal.count({
          where: { id: proposalId },
        }),
      ).toBe(1);
      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposalId },
      });
      expect(row.canonicalConceptId).toBeNull();
      expect(row.expectedCurrentRevisionId).toBeNull();
    });

    it("FOR UPDATE concept lock observes concurrent revision 2 as STALE_CURRENT_REVISION", async () => {
      enableCanonicalGateFor(userId);
      const umc = await createUmc({ title: "Concurrent pointer race" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
        beforeSummary: umc.summary,
      });

      const hash = deriveCanonicalUmcSnapshotHash({
        id: umc.id,
        title: umc.title,
        summary: umc.summary,
        status: umc.status,
        confidenceScore: umc.confidenceScore,
        confidenceLevel: umc.confidenceLevel,
        updatedAt: umc.updatedAt,
      });

      const registration = await prisma.$transaction(async (tx) =>
        resolveOrRegisterCanonicalConceptFromUserMapConclusion({
          userId,
          userMapConclusionId: umc.id,
          expectedLegacySnapshotHash: hash,
          tx: tx as never,
        }),
      );

      let releaseCommit!: () => void;
      const holdCommit = new Promise<void>((resolve) => {
        releaseCommit = resolve;
      });
      let markReady!: () => void;
      const aReady = new Promise<void>((resolve) => {
        markReady = resolve;
      });

      const txA = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT id
            FROM "CanonicalConcept"
            WHERE id = ${registration.conceptId}
              AND "userId" = ${userId}
            FOR UPDATE
          `;

          const placeholder = await tx.exploreMovementProposal.create({
            data: {
              userId,
              conversationId: id("conv"),
              assistantMessageId: id("asst"),
              userMessageId: id("umsg"),
              status: ExploreMovementProposalStatus.proposed,
              authorityMode: ExploreMovementAuthorityMode.canonical_v1,
              revisionOperation: CanonicalRevisionOperation.strengthen,
              expectedLegacySnapshotHash: hash,
              affectedObjectType:
                UnderstandingLinkTargetType.usermap_conclusion,
              affectedObjectId: umc.id,
              beforeSummary: umc.summary,
              afterSummary: "placeholder concurrent strengthen",
              rationale: "placeholder",
              userFacingSummary: "placeholder",
              sourcesJson: [],
            },
          });

          const rev2 = await tx.canonicalConceptRevision.create({
            data: {
              userId,
              conceptId: registration.conceptId,
              version: 2,
              title: umc.title,
              summary: "strengthened concurrently",
              status: "emerging",
              confidenceScore: umc.confidenceScore,
              confidenceLevel: umc.confidenceLevel,
              evidenceCount: 0,
              operation: CanonicalRevisionOperation.strengthen,
              decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
              acceptedAt: new Date(),
              previousRevisionId: registration.currentRevisionId,
              createdFromProposalId: placeholder.id,
            },
          });
          await tx.canonicalConcept.update({
            where: { id: registration.conceptId },
            data: { currentRevisionId: rev2.id },
          });

          markReady();
          await holdCommit;
        },
        { maxWait: 20_000, timeout: 30_000 },
      );

      await aReady;

      const createB = createOrReuseSemanticExploreMovementProposal({
        userId,
        db: prisma,
        conversationId: lineage.conversationId,
        assistantMessageId: lineage.assistantMessageId,
        userMessageId: lineage.userMessageId,
        affectedObjectId: umc.id,
        beforeSummary: umc.summary,
        afterSummary: decision.afterSummary,
        rationale: decision.rationale,
        userFacingSummary: decision.userFacingSummary,
        provenance,
      });

      // Allow B to reach the concept FOR UPDATE wait behind A.
      await new Promise((resolve) => setTimeout(resolve, 250));
      releaseCommit();
      await txA;

      await expectCode(() => createB, "STALE_CURRENT_REVISION");
      expect(
        await prisma.exploreMovementProposal.count({
          where: {
            userId,
            affectedObjectId: umc.id,
            conversationId: lineage.conversationId,
          },
        }),
      ).toBe(0);
    }, 40_000);
  },
);

describe("canonical Explore proposal creation — URL safety", () => {
  it("documents the isolated URL gate", () => {
    if (!rawTestUrl) {
      expect(safety.ok).toBe(false);
      return;
    }
    if (!safety.ok) {
      expect(safety.blockers.length).toBeGreaterThan(0);
      return;
    }
    expect(safety.ok).toBe(true);
  });
});

