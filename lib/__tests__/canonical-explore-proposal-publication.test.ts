/**
 * Phase 3B — canonical Explore proposal acceptance / publication.
 *
 * Isolated Postgres proofs use CANONICAL_AUTHORITY_DB_TEST_URL.
 * Suites use unique user IDs and do not globally truncate shared tables.
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
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
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
  CanonicalModelAuthorityError,
  type CanonicalModelAuthorityError as CanonicalModelAuthorityErrorType,
} from "../canonical-model-authority-errors";
import * as canonicalRevisionEvidence from "../canonical-revision-evidence";
import {
  createOrReuseSemanticExploreMovementProposal,
  publishExploreMovementProposal,
  rejectExploreMovementProposal,
} from "../explore-movement-proposal";
import {
  buildExploreMovementProposalProvenance,
} from "../explore-movement-proposal-provenance";
import type { ExploreGroundingSource } from "../explore-grounding-contract";
import {
  completedPassReferee,
  validProposeDecision,
} from "./helpers/explore-movement-semantic-test-helpers";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "../explore-movement-semantic-contract";

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
  code: CanonicalModelAuthorityErrorType["code"],
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

describe("canonical Explore proposal publication — URL safety", () => {
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

describe.skipIf(!shouldAttemptRealDb)(
  "canonical Explore proposal publication — database",
  () => {
    let prisma: PrismaClient;
    const userId = id("pub_user");
    const otherUserId = id("pub_other");

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
      await prisma.$disconnect();
    });

    beforeEach(() => {
      clearCanonicalGateEnv();
    });

    afterEach(() => {
      clearCanonicalGateEnv();
    });

    async function createUmc(args?: {
      userId?: string;
      title?: string;
      summary?: string;
    }) {
      return prisma.userMapConclusion.create({
        data: {
          userId: args?.userId ?? userId,
          area: UserMapConclusionArea.operating_logic,
          status: UserMapConclusionStatus.emerging,
          visibility: UserMapConclusionVisibility.user_visible,
          title: args?.title ?? "Working title",
          summary:
            args?.summary ??
            "Evening recovery boundary weakens when meetings stack without a hard stop.",
          confidenceScore: 0.55,
          confidenceLevel: UserMapConfidenceLevel.medium,
        },
      });
    }

    async function seedExploreLineage(args?: { userId?: string }) {
      const owner = args?.userId ?? userId;
      const conversationId = id("session");
      const userMessageId = id("umsg");
      const assistantMessageId = id("amsg");
      await prisma.session.create({
        data: {
          id: conversationId,
          userId: owner,
          surfaceType: SessionSurfaceType.explore_chat,
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

    async function createCanonicalProposal(args?: {
      userId?: string;
      afterSummary?: string;
    }) {
      const owner = args?.userId ?? userId;
      enableCanonicalGateFor(owner);
      const umc = await createUmc({ userId: owner });
      const lineage = await seedExploreLineage({ userId: owner });
      const journalId = await seedJournal({ userId: owner });
      const afterSummary =
        args?.afterSummary ??
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId: owner,
        afterSummary,
      });
      const created = await createOrReuseSemanticExploreMovementProposal({
        userId: owner,
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
      expect(created.created).toBe(true);
      const proposal = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: created.record.proposalId },
      });
      return { umc, lineage, journalId, proposal, provenance, decision };
    }

    it("canonical proposal publishes revision 2 with preserved fields and evidence", async () => {
      const { umc, proposal } = await createCanonicalProposal();
      const rev1 = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: proposal.expectedCurrentRevisionId! },
      });
      const rev1Snapshot = { ...rev1 };

      const published = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({
        status: "published",
        idempotent: false,
      });
      if (typeof published === "string") throw new Error("expected publish ok");

      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      expect(rev2.version).toBe(2);
      expect(rev2.title).toBe(rev1.title);
      expect(rev2.status).toBe(rev1.status);
      expect(rev2.confidenceScore).toBe(rev1.confidenceScore);
      expect(rev2.confidenceLevel).toBe(rev1.confidenceLevel);
      expect(rev2.summary).toBe(proposal.afterSummary);
      expect(rev2.rationale).toBe(proposal.rationale);
      expect(rev2.previousRevisionId).toBe(proposal.expectedCurrentRevisionId);
      expect(rev2.createdFromProposalId).toBe(proposal.id);
      expect(rev2.operation).toBe(CanonicalRevisionOperation.strengthen);
      expect(rev2.decisionSource).toBe(
        CanonicalRevisionDecisionSource.explore_proposal,
      );

      const links = await prisma.understandingEvidenceLink.findMany({
        where: {
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: rev2.id,
        },
      });
      const supports = links.filter(
        (link) => link.role === UnderstandingLinkRole.supports,
      );
      expect(rev2.evidenceCount).toBe(supports.length);
      expect(supports.length).toBeGreaterThan(0);

      const assistantLinks = links.filter(
        (link) =>
          link.sourceType === UnderstandingLinkSourceType.message &&
          link.sourceId === proposal.assistantMessageId,
      );
      expect(assistantLinks.length).toBe(1);
      expect(assistantLinks[0]?.role).toBe(UnderstandingLinkRole.context);

      const concept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: proposal.canonicalConceptId! },
      });
      expect(concept.currentRevisionId).toBe(rev2.id);

      const modelUpdate = await prisma.modelUpdate.findUniqueOrThrow({
        where: { id: published.modelUpdateId },
      });
      expect(modelUpdate.exploreProposalId).toBe(proposal.id);
      expect(modelUpdate.canonicalConceptId).toBe(proposal.canonicalConceptId);
      expect(modelUpdate.previousRevisionId).toBe(
        proposal.expectedCurrentRevisionId,
      );
      expect(modelUpdate.resultingRevisionId).toBe(rev2.id);
      expect(modelUpdate.beforeSummary).toBe(rev1.summary);
      expect(modelUpdate.afterSummary).toBe(rev2.summary);
      expect(modelUpdate.userFacingSummary).toBe(proposal.userFacingSummary);
      expect(modelUpdate.affectedObjectType).toBe(
        UnderstandingLinkTargetType.canonical_concept_revision,
      );

      const publishedProposal =
        await prisma.exploreMovementProposal.findUniqueOrThrow({
          where: { id: proposal.id },
        });
      expect(publishedProposal.status).toBe(
        ExploreMovementProposalStatus.published,
      );
      expect(publishedProposal.modelUpdateId).toBe(published.modelUpdateId);

      const rev1After = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: rev1.id },
      });
      expect(rev1After).toEqual(rev1Snapshot);

      // No legacy UMC write-back.
      const umcAfter = await prisma.userMapConclusion.findUniqueOrThrow({
        where: { id: umc.id },
      });
      expect(umcAfter.summary).toBe(umc.summary);
      expect(umcAfter.title).toBe(umc.title);
    });

    it("repeated publication is idempotent", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens more specifically when meetings stack and recovery is skipped.",
      });
      const first = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      const second = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(first).toMatchObject({ status: "published", idempotent: false });
      expect(second).toMatchObject({ status: "published", idempotent: true });
      if (typeof first === "string" || typeof second === "string") {
        throw new Error("expected publish ok");
      }
      expect(second.modelUpdateId).toBe(first.modelUpdateId);
      expect(
        await prisma.canonicalConceptRevision.count({
          where: { createdFromProposalId: proposal.id },
        }),
      ).toBe(1);
      expect(
        await prisma.modelUpdate.count({
          where: { exploreProposalId: proposal.id },
        }),
      ).toBe(1);
    });

    it("concurrent publication creates one revision and one ModelUpdate", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens concurrently when dense meetings stack and the stop is skipped.",
      });
      const [a, b] = await Promise.all([
        publishExploreMovementProposal({
          userId,
          proposalId: proposal.id,
          db: prisma,
        }),
        publishExploreMovementProposal({
          userId,
          proposalId: proposal.id,
          db: prisma,
        }),
      ]);
      const results = [a, b];
      expect(
        results.every(
          (result) =>
            typeof result !== "string" && result.status === "published",
        ),
      ).toBe(true);
      const typed = results as Array<{
        modelUpdateId: string;
        idempotent: boolean;
      }>;
      expect(typed.filter((result) => result.idempotent)).toHaveLength(1);
      expect(typed.filter((result) => !result.idempotent)).toHaveLength(1);
      expect(new Set(typed.map((result) => result.modelUpdateId)).size).toBe(1);
      expect(
        await prisma.canonicalConceptRevision.count({
          where: { createdFromProposalId: proposal.id },
        }),
      ).toBe(1);
    }, 40_000);

    it("stale pointer returns STALE_CURRENT_REVISION", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens when the pointer has already moved ahead.",
      });

      const placeholder = await prisma.exploreMovementProposal.create({
        data: {
          userId,
          conversationId: id("conv"),
          assistantMessageId: id("asst"),
          userMessageId: id("umsg"),
          status: ExploreMovementProposalStatus.proposed,
          authorityMode: ExploreMovementAuthorityMode.canonical_v1,
          revisionOperation: CanonicalRevisionOperation.strengthen,
          expectedLegacySnapshotHash: "umc_snap_v1:" + "b".repeat(64),
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: proposal.affectedObjectId,
          beforeSummary: "b",
          afterSummary: "a",
          rationale: "r",
          userFacingSummary: "u",
          sourcesJson: [],
        },
      });
      const rev2 = await prisma.canonicalConceptRevision.create({
        data: {
          userId,
          conceptId: proposal.canonicalConceptId!,
          version: 2,
          title: "t",
          summary: "already moved",
          status: "emerging",
          confidenceScore: 0.55,
          confidenceLevel: UserMapConfidenceLevel.medium,
          evidenceCount: 0,
          operation: CanonicalRevisionOperation.strengthen,
          decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
          acceptedAt: new Date(),
          previousRevisionId: proposal.expectedCurrentRevisionId!,
          createdFromProposalId: placeholder.id,
        },
      });
      await prisma.canonicalConcept.update({
        where: { id: proposal.canonicalConceptId! },
        data: { currentRevisionId: rev2.id },
      });

      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "STALE_CURRENT_REVISION",
      );
      expect(
        await prisma.canonicalConceptRevision.count({
          where: { createdFromProposalId: proposal.id },
        }),
      ).toBe(0);
      expect(
        await prisma.modelUpdate.count({
          where: { exploreProposalId: proposal.id },
        }),
      ).toBe(0);
      const stillProposed = await prisma.exploreMovementProposal.findUniqueOrThrow(
        {
          where: { id: proposal.id },
        },
      );
      expect(stillProposed.status).toBe(ExploreMovementProposalStatus.proposed);
      expect(stillProposed.modelUpdateId).toBeNull();
    });

    it("rejected proposal cannot publish", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens after rejection and must not publish.",
      });
      await rejectExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      const result = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(result).toBe("rejected");
    });

    it("cross-user proposal cannot publish", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens across users and must fail closed.",
      });
      const result = await publishExploreMovementProposal({
        userId: otherUserId,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(result).toBe("not_found");
    });

    it("malformed canonical authority shape fails closed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens when authority shape is broken before publish.",
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "ExploreMovementProposal"
         SET "expectedCurrentRevisionId" = NULL,
             "canonicalConceptId" = NULL,
             "expectedLegacySnapshotHash" = $1
         WHERE id = $2`,
        "umc_snap_v1:" + "c".repeat(64),
        proposal.id,
      );

      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PUBLICATION",
      );
    });

    it("malformed provenance fails closed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens when provenance is corrupted before publish.",
      });
      await prisma.exploreMovementProposal.update({
        where: { id: proposal.id },
        data: { sourcesJson: [{ sourceId: "x", sourceType: "journal_entry", userId }] },
      });
      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "INVALID_PROPOSAL_PROVENANCE",
      );
    });

    it("invalid evidence ownership rolls back everything", async () => {
      const { proposal, journalId } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens when journal ownership is stolen before publish.",
      });
      await prisma.journalEntry.update({
        where: { id: journalId },
        data: { userId: otherUserId },
      });

      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "INVALID_EVIDENCE_OWNERSHIP",
      );

      expect(
        await prisma.canonicalConceptRevision.count({
          where: { createdFromProposalId: proposal.id },
        }),
      ).toBe(0);
      expect(
        await prisma.modelUpdate.count({
          where: { exploreProposalId: proposal.id },
        }),
      ).toBe(0);
      const concept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: proposal.canonicalConceptId! },
      });
      expect(concept.currentRevisionId).toBe(proposal.expectedCurrentRevisionId);
      const still = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      });
      expect(still.status).toBe(ExploreMovementProposalStatus.proposed);
      expect(still.modelUpdateId).toBeNull();
    });

    it("unsupported evidence pair rolls back everything", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens when an unsupported evidence pair is injected.",
      });

      const spy = vi
        .spyOn(canonicalRevisionEvidence, "prepareCanonicalProposalEvidence")
        .mockRejectedValue(
          new CanonicalModelAuthorityError(
            "UNSUPPORTED_EVIDENCE_PAIR",
            "injected unsupported pair for publication rollback proof",
          ),
        );

      try {
        await expectCode(
          () =>
            publishExploreMovementProposal({
              userId,
              proposalId: proposal.id,
              db: prisma,
            }),
          "UNSUPPORTED_EVIDENCE_PAIR",
        );
      } finally {
        spy.mockRestore();
      }

      expect(
        await prisma.canonicalConceptRevision.count({
          where: { createdFromProposalId: proposal.id },
        }),
      ).toBe(0);
      expect(
        await prisma.modelUpdate.count({
          where: { exploreProposalId: proposal.id },
        }),
      ).toBe(0);
      const concept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: proposal.canonicalConceptId! },
      });
      expect(concept.currentRevisionId).toBe(proposal.expectedCurrentRevisionId);
      const still = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      });
      expect(still.status).toBe(ExploreMovementProposalStatus.proposed);
      expect(still.modelUpdateId).toBeNull();
    });

    it("pointer-CAS failure rolls back revision, evidence, ModelUpdate and proposal mutation", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens when the pointer CAS is forced to affect zero rows.",
      });
      const conceptId = proposal.canonicalConceptId!;
      const expectedRevisionId = proposal.expectedCurrentRevisionId!;
      const rev1Before = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: expectedRevisionId },
      });

      const fnName = `phase3b_cas_block_${randomBytes(4).toString("hex")}`;
      const trgName = `${fnName}_trg`;

      try {
        await prisma.$executeRawUnsafe(`
          CREATE OR REPLACE FUNCTION ${fnName}()
          RETURNS trigger AS $$
          BEGIN
            IF NEW.id = '${conceptId}' THEN
              RETURN NULL;
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TRIGGER ${trgName}
          BEFORE UPDATE ON "CanonicalConcept"
          FOR EACH ROW
          EXECUTE FUNCTION ${fnName}();
        `);

        await expectCode(
          () =>
            publishExploreMovementProposal({
              userId,
              proposalId: proposal.id,
              db: prisma,
            }),
          "STALE_CURRENT_REVISION",
        );
      } finally {
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS ${trgName} ON "CanonicalConcept"`,
        );
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fnName}()`);
      }

      expect(
        await prisma.canonicalConceptRevision.count({
          where: { createdFromProposalId: proposal.id },
        }),
      ).toBe(0);
      expect(
        await prisma.understandingEvidenceLink.count({
          where: {
            userId,
            targetType: UnderstandingLinkTargetType.canonical_concept_revision,
            targetId: {
              in: (
                await prisma.canonicalConceptRevision.findMany({
                  where: { createdFromProposalId: proposal.id },
                  select: { id: true },
                })
              ).map((row) => row.id),
            },
          },
        }),
      ).toBe(0);
      expect(
        await prisma.modelUpdate.count({
          where: { exploreProposalId: proposal.id },
        }),
      ).toBe(0);

      const concept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: conceptId },
      });
      expect(concept.currentRevisionId).toBe(expectedRevisionId);

      const still = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      });
      expect(still.status).toBe(ExploreMovementProposalStatus.proposed);
      expect(still.modelUpdateId).toBeNull();

      const rev1After = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: expectedRevisionId },
      });
      expect(rev1After).toEqual(rev1Before);
    });

    it("published ModelUpdate semantic corruption fails idempotent republish", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens then ModelUpdate afterSummary is corrupted.",
      });
      const published = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({ status: "published", idempotent: false });
      if (typeof published === "string") throw new Error("expected publish ok");

      await prisma.$executeRawUnsafe(
        `UPDATE "ModelUpdate" SET "afterSummary" = $1 WHERE id = $2`,
        "corrupted after summary",
        published.modelUpdateId,
      );

      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PUBLICATION",
      );
    });

    it("published ModelUpdate affectedObjectId corruption fails idempotent republish", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens then ModelUpdate affectedObjectId is corrupted.",
      });
      const published = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      if (typeof published === "string") throw new Error("expected publish ok");

      await prisma.$executeRawUnsafe(
        `UPDATE "ModelUpdate" SET "affectedObjectId" = $1 WHERE id = $2`,
        proposal.expectedCurrentRevisionId,
        published.modelUpdateId,
      );

      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PUBLICATION",
      );
    });

    it("mismatched proposal.modelUpdateId fails idempotent republish", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens then proposal.modelUpdateId is swapped.",
      });
      const published = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      if (typeof published === "string") throw new Error("expected publish ok");

      const decoy = await prisma.modelUpdate.create({
        data: {
          id: id("mu_decoy"),
          userId,
          updateType: "conclusion_strengthened",
          visibility: "user_visible",
          isMeaningful: true,
          affectedObjectType: "usermap_conclusion",
          affectedObjectId: proposal.affectedObjectId,
          userFacingSummary: "decoy",
          beforeSummary: "b",
          afterSummary: "a",
        },
      });

      await prisma.$executeRawUnsafe(
        `UPDATE "ExploreMovementProposal" SET "modelUpdateId" = $1 WHERE id = $2`,
        decoy.id,
        proposal.id,
      );

      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PUBLICATION",
      );
    });

    it("published-but-broken lineage throws BROKEN_CANONICAL_PUBLICATION", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens then publication lineage is corrupted.",
      });
      const published = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({ status: "published" });
      if (typeof published === "string") throw new Error("expected publish ok");

      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = $1 WHERE id = $2`,
        proposal.expectedCurrentRevisionId,
        proposal.canonicalConceptId,
      );

      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PUBLICATION",
      );
    });

    it("canonical proposal still publishes when feature flag is later disabled", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens even after the feature flag is turned off.",
      });
      clearCanonicalGateEnv();
      const published = await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({
        status: "published",
        idempotent: false,
      });
      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      });
      expect(row.authorityMode).toBe(ExploreMovementAuthorityMode.canonical_v1);
    });

    it("legacy proposal still uses legacy publisher when flag is later enabled", async () => {
      clearCanonicalGateEnv();
      const umc = await createUmc({ title: "Legacy publish" });
      const lineage = await seedExploreLineage();
      const journalId = await seedJournal();
      const afterSummary =
        "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.";
      const { provenance, decision } = buildProvenance({
        umcId: umc.id,
        journalId,
        userId,
        afterSummary,
      });
      const created = await createOrReuseSemanticExploreMovementProposal({
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
      const legacy = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: created.record.proposalId },
      });
      expect(legacy.authorityMode).toBe(ExploreMovementAuthorityMode.legacy);

      enableCanonicalGateFor(userId);
      const published = await publishExploreMovementProposal({
        userId,
        proposalId: legacy.id,
        db: prisma,
      });
      expect(published).toMatchObject({ status: "published", idempotent: false });
      if (typeof published === "string") throw new Error("expected publish ok");

      const modelUpdate = await prisma.modelUpdate.findUniqueOrThrow({
        where: { id: published.modelUpdateId },
      });
      expect(modelUpdate.canonicalConceptId).toBeNull();
      expect(modelUpdate.exploreProposalId).toBeNull();
      expect(modelUpdate.affectedObjectType).toBe(
        UnderstandingLinkTargetType.usermap_conclusion,
      );
      expect(modelUpdate.affectedObjectId).toBe(umc.id);
      expect(
        await prisma.canonicalConcept.count({
          where: { userId, registrationKey: { contains: umc.id } },
        }),
      ).toBe(0);
    });

    it("canonical failure never falls back to legacy", async () => {
      const { proposal, journalId } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens then evidence fails without legacy fallback.",
      });
      await prisma.journalEntry.update({
        where: { id: journalId },
        data: { userId: otherUserId },
      });
      await expectCode(
        () =>
          publishExploreMovementProposal({
            userId,
            proposalId: proposal.id,
            db: prisma,
          }),
        "INVALID_EVIDENCE_OWNERSHIP",
      );
      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      });
      expect(row.status).toBe(ExploreMovementProposalStatus.proposed);
      expect(row.authorityMode).toBe(ExploreMovementAuthorityMode.canonical_v1);
      expect(row.modelUpdateId).toBeNull();
      expect(
        await prisma.modelUpdate.count({
          where: {
            userId,
            affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
            affectedObjectId: proposal.affectedObjectId,
          },
        }),
      ).toBe(0);
    });

    it("immutable revision trigger remains armed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens and revision 1 must stay immutable after publish.",
      });
      await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      await expect(
        prisma.canonicalConceptRevision.update({
          where: { id: proposal.expectedCurrentRevisionId! },
          data: { summary: "mutated" },
        }),
      ).rejects.toThrow(/canonical_concept_revision_is_immutable/);
    });

    it("deliberately malformed canonical ModelUpdate is rejected by lineage trigger", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens then a malformed ModelUpdate is rejected.",
      });
      await publishExploreMovementProposal({
        userId,
        proposalId: proposal.id,
        db: prisma,
      });
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });

      await expect(
        prisma.modelUpdate.create({
          data: {
            id: id("mu_bad"),
            userId,
            updateType: "conclusion_strengthened",
            visibility: "user_visible",
            isMeaningful: true,
            affectedObjectType: "canonical_concept_revision",
            affectedObjectId: rev2.id,
            userFacingSummary: "bad",
            canonicalConceptId: proposal.canonicalConceptId,
            previousRevisionId: proposal.expectedCurrentRevisionId,
            resultingRevisionId: rev2.id,
            // Missing exploreProposalId → incomplete lineage
          },
        }),
      ).rejects.toThrow(/model_update_canonical_lineage_incomplete/);
    });

    it("proposal rejection racing publication produces one coherent terminal state", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary:
          "Evening recovery boundary weakens under a reject-vs-publish race.",
      });
      const results = await Promise.all([
        publishExploreMovementProposal({
          userId,
          proposalId: proposal.id,
          db: prisma,
        }),
        rejectExploreMovementProposal({
          userId,
          proposalId: proposal.id,
          db: prisma,
        }),
      ]);

      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      });
      expect([
        ExploreMovementProposalStatus.published,
        ExploreMovementProposalStatus.rejected,
      ]).toContain(row.status);

      if (row.status === ExploreMovementProposalStatus.published) {
        expect(row.modelUpdateId).toBeTruthy();
        expect(
          results.some(
            (result) =>
              typeof result !== "string" &&
              "status" in result &&
              result.status === "published",
          ),
        ).toBe(true);
        expect(
          await prisma.canonicalConceptRevision.count({
            where: { createdFromProposalId: proposal.id },
          }),
        ).toBe(1);
      } else {
        expect(row.modelUpdateId).toBeNull();
        expect(
          await prisma.canonicalConceptRevision.count({
            where: { createdFromProposalId: proposal.id },
          }),
        ).toBe(0);
        expect(results).toContainEqual(
          expect.objectContaining({ status: "rejected" }),
        );
      }
    }, 40_000);
  },
);
