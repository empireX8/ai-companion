/**
 * Phase 4 — canonical model authority read projection.
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
} from "vitest";
import {
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
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
  type CanonicalModelAuthorityError,
} from "../canonical-model-authority-errors";
import { buildLegacyUserMapConclusionRegistrationKey } from "../canonical-domain-mappings";
import {
  createOrReuseSemanticExploreMovementProposal,
  publishExploreMovementProposal,
} from "../explore-movement-proposal";
import {
  buildExploreMovementProposalProvenance,
  deriveExploreMovementModelUpdateId,
} from "../explore-movement-proposal-provenance";
import { buildExploreMovementModelUpdateLineageNotes } from "../canonical-publication-integrity";
import type { ExploreGroundingSource } from "../explore-grounding-contract";
import {
  CANONICAL_MODEL_PROJECTION_VERSION,
  readCanonicalConceptProjection,
  readCanonicalConceptProjectionInTransaction,
  readCanonicalModelProjection,
} from "../canonical-model-projection";
import {
  completedPassReferee,
  validProposeDecision,
} from "./helpers/explore-movement-semantic-test-helpers";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "../explore-movement-semantic-contract";
import { Prisma } from "@prisma/client";

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

describe("canonical model projection — URL safety", () => {
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
  "canonical model projection — database",
  () => {
    let prisma: PrismaClient;
    const userId = id("proj_user");
    const otherUserId = id("proj_other");

    beforeAll(async () => {
      execFileSync("npx", ["prisma", "migrate", "deploy"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: rawTestUrl },
        stdio: "pipe",
      });
      prisma = new PrismaClient({
        datasources: { db: { url: rawTestUrl } },
        log: [{ emit: "event", level: "query" }],
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
      status?: UserMapConclusionStatus;
      confidenceScore?: number;
      confidenceLevel?: UserMapConfidenceLevel;
    }) {
      return prisma.userMapConclusion.create({
        data: {
          userId: args?.userId ?? userId,
          area: UserMapConclusionArea.operating_logic,
          status: args?.status ?? UserMapConclusionStatus.emerging,
          visibility: UserMapConclusionVisibility.user_visible,
          title: args?.title ?? "Working title",
          summary:
            args?.summary ??
            "Evening recovery boundary weakens when meetings stack without a hard stop.",
          confidenceScore: args?.confidenceScore ?? 0.55,
          confidenceLevel: args?.confidenceLevel ?? UserMapConfidenceLevel.medium,
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
      title?: string;
      summary?: string;
    }) {
      const owner = args?.userId ?? userId;
      enableCanonicalGateFor(owner);
      const umc = await createUmc({
        userId: owner,
        title: args?.title,
        summary: args?.summary,
      });
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

    async function registerOnly(args?: { userId?: string; summary?: string }) {
      const seeded = await createCanonicalProposal({
        userId: args?.userId,
        summary: args?.summary,
      });
      return seeded;
    }

    async function publishFresh(args?: {
      userId?: string;
      afterSummary?: string;
    }) {
      const seeded = await createCanonicalProposal(args);
      const published = await publishExploreMovementProposal({
        userId: args?.userId ?? userId,
        proposalId: seeded.proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({ status: "published", idempotent: false });
      if (typeof published === "string") throw new Error("expected publish ok");
      return { ...seeded, published };
    }

    /**
     * Insert-time corrupt rev2 fixture: proposal stays the semantic authority,
     * while revision 2 fields are intentionally mismatched. ModelUpdate text
     * matches the inserted revision so ModelUpdate↔revision identity can pass
     * and assertExactCanonicalResultingRevision is the fail-closed gate.
     */
    async function installCorruptCanonicalRev2(args: {
      proposal: {
        id: string;
        userId: string;
        conversationId: string;
        assistantMessageId: string;
        userMessageId: string;
        afterSummary: string;
        rationale: string;
        userFacingSummary: string;
        expectedCurrentRevisionId: string | null;
        canonicalConceptId: string | null;
      };
      rev2: {
        summary?: string;
        rationale?: string | null;
        title?: string;
        status?:
          | "hypothesis"
          | "tentative"
          | "emerging"
          | "supported"
          | "disputed";
        confidenceScore?: number;
        confidenceLevel?: UserMapConfidenceLevel;
      };
    }) {
      const rev1 = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: args.proposal.expectedCurrentRevisionId! },
      });
      const summary = args.rev2.summary ?? args.proposal.afterSummary;
      const rationale =
        args.rev2.rationale === undefined
          ? args.proposal.rationale
          : args.rev2.rationale;
      const title = args.rev2.title ?? rev1.title;
      const status = args.rev2.status ?? rev1.status;
      const confidenceScore =
        args.rev2.confidenceScore ?? rev1.confidenceScore;
      const confidenceLevel =
        args.rev2.confidenceLevel ?? rev1.confidenceLevel;

      const rev2 = await prisma.canonicalConceptRevision.create({
        data: {
          id: id("rev2_corrupt"),
          userId: args.proposal.userId,
          conceptId: args.proposal.canonicalConceptId!,
          version: 2,
          title,
          summary,
          status,
          confidenceScore,
          confidenceLevel,
          evidenceCount: 0,
          rationale,
          operation: CanonicalRevisionOperation.strengthen,
          decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
          acceptedAt: new Date(),
          registrationSnapshotHash: null,
          previousRevisionId: rev1.id,
          createdFromProposalId: args.proposal.id,
        },
      });

      const modelUpdateId = deriveExploreMovementModelUpdateId(args.proposal.id);
      const internalNotes = buildExploreMovementModelUpdateLineageNotes({
        proposalId: args.proposal.id,
        conversationId: args.proposal.conversationId,
        assistantMessageId: args.proposal.assistantMessageId,
        userMessageId: args.proposal.userMessageId,
        rationale: args.proposal.rationale,
      });

      await prisma.modelUpdate.create({
        data: {
          id: modelUpdateId,
          userId: args.proposal.userId,
          updateType: ModelUpdateType.conclusion_strengthened,
          visibility: ModelUpdateVisibility.user_visible,
          isMeaningful: true,
          affectedObjectType:
            UnderstandingLinkTargetType.canonical_concept_revision,
          affectedObjectId: rev2.id,
          userFacingSummary: args.proposal.userFacingSummary,
          beforeSummary: rev1.summary,
          afterSummary: summary,
          internalNotes,
          confidenceDelta: null,
          canonicalConceptId: args.proposal.canonicalConceptId!,
          previousRevisionId: rev1.id,
          resultingRevisionId: rev2.id,
          exploreProposalId: args.proposal.id,
        },
      });

      await prisma.exploreMovementProposal.update({
        where: { id: args.proposal.id },
        data: {
          status: ExploreMovementProposalStatus.published,
          modelUpdateId,
        },
      });
      await prisma.canonicalConcept.update({
        where: { id: args.proposal.canonicalConceptId! },
        data: { currentRevisionId: rev2.id },
      });

      return { rev1, rev2, modelUpdateId };
    }

    it("1. revision-1 concept projects correctly", async () => {
      const { umc, proposal } = await registerOnly();
      const conceptId = proposal.canonicalConceptId!;
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;

      expect(projection.authorityType).toBe("canonical_concept_revision");
      expect(projection.concept.id).toBe(conceptId);
      expect(projection.concept.registrationKey).toBe(
        buildLegacyUserMapConclusionRegistrationKey(umc.id),
      );
      expect(projection.revisionHistory).toHaveLength(1);
      expect(projection.currentRevision.version).toBe(1);
      expect(projection.currentRevision.operation).toBe(
        CanonicalRevisionOperation.registered,
      );
      expect(projection.currentRevision.decisionSource).toBe(
        CanonicalRevisionDecisionSource.legacy_registration,
      );
      expect(projection.movementHistory).toEqual([]);
      expect(projection.capabilities.supportedWriteOperations).toEqual([
        CanonicalRevisionOperation.strengthen,
      ]);
    });

    it("2. revision-2 concept projects correctly", async () => {
      const { proposal, decision } = await publishFresh();
      const conceptId = proposal.canonicalConceptId!;
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;

      expect(projection.revisionHistory).toHaveLength(2);
      expect(projection.currentRevision.version).toBe(2);
      expect(projection.currentRevision.summary).toBe(decision.afterSummary);
      expect(projection.currentRevision.operation).toBe(
        CanonicalRevisionOperation.strengthen,
      );
      expect(projection.capabilities.supportedWriteOperations).toEqual([]);
    });

    it("3. current revision equals history tail", async () => {
      const { proposal } = await publishFresh();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.currentRevision).toEqual(
        projection.revisionHistory[projection.revisionHistory.length - 1],
      );
    });

    it("4. rev2 summary/rationale/title/status/confidence are exact", async () => {
      const { proposal, decision } = await publishFresh({
        afterSummary:
          "Exact strengthened summary for projection field identity proof.",
      });
      const rev1 = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: proposal.expectedCurrentRevisionId! },
      });
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      const current = projection.currentRevision;
      expect(current.summary).toBe(decision.afterSummary);
      expect(current.rationale).toBe(decision.rationale);
      expect(current.title).toBe(rev1.title);
      expect(current.status).toBe(rev1.status);
      expect(current.confidenceScore).toBe(rev1.confidenceScore);
      expect(current.confidenceLevel).toBe(rev1.confidenceLevel);
    });

    it("5. projected summary ignores later UMC mutation", async () => {
      const { umc, proposal } = await publishFresh({
        afterSummary: "Canonical summary must survive UMC mutation.",
      });
      const before = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(before).not.toBe("not_found");
      if (before === "not_found") return;

      await prisma.userMapConclusion.update({
        where: { id: umc.id },
        data: {
          summary: "MUTATED UMC SUMMARY MUST NOT APPEAR IN PROJECTION",
          title: "MUTATED TITLE",
          status: UserMapConclusionStatus.supported,
          confidenceScore: 0.99,
          confidenceLevel: UserMapConfidenceLevel.high,
        },
      });

      const after = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(after).toEqual(before);
      expect(JSON.stringify(after)).not.toContain(
        "MUTATED UMC SUMMARY MUST NOT APPEAR IN PROJECTION",
      );
    });

    it("6. source binding identifies the owned legacy seed", async () => {
      const { umc, proposal } = await registerOnly();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      const seed = projection.sourceBindings.find(
        (binding) => binding.bindingRole === "legacy_seed",
      );
      expect(seed).toMatchObject({
        sourceType: "usermap_conclusion",
        sourceId: umc.id,
        bindingRole: "legacy_seed",
      });
      expect(projection.concept.registrationKey).toBe(
        buildLegacyUserMapConclusionRegistrationKey(umc.id),
      );
    });

    it("7. rev1 evidence is projected exactly", async () => {
      const { proposal } = await registerOnly();
      const rev1Id = proposal.expectedCurrentRevisionId!;
      const links = await prisma.understandingEvidenceLink.findMany({
        where: {
          userId,
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: rev1Id,
        },
      });
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.currentRevision.evidence).toHaveLength(links.length);
      for (const link of links) {
        expect(
          projection.currentRevision.evidence.some(
            (row) =>
              row.id === link.id &&
              row.sourceType === link.sourceType &&
              row.sourceId === link.sourceId &&
              row.role === link.role &&
              row.summary === link.summary,
          ),
        ).toBe(true);
      }
    });

    it("8. rev2 evidence is projected exactly", async () => {
      const { proposal, journalId, lineage } = await publishFresh();
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      const links = await prisma.understandingEvidenceLink.findMany({
        where: {
          userId,
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: rev2.id,
        },
      });
      expect(links.length).toBeGreaterThan(0);
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.currentRevision.evidence).toHaveLength(links.length);
      expect(
        projection.currentRevision.evidence.some(
          (row) =>
            row.sourceType === UnderstandingLinkSourceType.journal_entry &&
            row.sourceId === journalId &&
            row.role === UnderstandingLinkRole.supports,
        ),
      ).toBe(true);
      expect(
        projection.currentRevision.evidence.some(
          (row) =>
            row.sourceType === UnderstandingLinkSourceType.message &&
            row.sourceId === lineage.assistantMessageId &&
            row.role === UnderstandingLinkRole.context,
        ),
      ).toBe(true);
      for (const link of links) {
        const projected = projection.currentRevision.evidence.find(
          (row) => row.id === link.id,
        );
        expect(projected?.createdAt).toBe(link.createdAt.toISOString());
      }
    });

    it("9. evidence count equals supports links", async () => {
      const { proposal } = await publishFresh();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      for (const revision of projection.revisionHistory) {
        const supports = revision.evidence.filter(
          (row) => row.role === UnderstandingLinkRole.supports,
        ).length;
        expect(revision.evidenceCount).toBe(supports);
      }
    });

    it("10. assistant message is context only", async () => {
      const { proposal, lineage } = await publishFresh();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      const assistantLinks = projection.currentRevision.evidence.filter(
        (row) => row.sourceId === lineage.assistantMessageId,
      );
      expect(assistantLinks.length).toBeGreaterThan(0);
      for (const link of assistantLinks) {
        expect(link.role).toBe(UnderstandingLinkRole.context);
      }
    });

    it("11. movement history matches exact ModelUpdate lineage", async () => {
      const { proposal, published } = await publishFresh();
      if (typeof published === "string") throw new Error("expected publish");
      const modelUpdate = await prisma.modelUpdate.findUniqueOrThrow({
        where: { id: published.modelUpdateId },
      });
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.movementHistory).toHaveLength(1);
      expect(projection.movementHistory[0]).toMatchObject({
        modelUpdateId: modelUpdate.id,
        exploreProposalId: proposal.id,
        canonicalConceptId: proposal.canonicalConceptId,
        previousRevisionId: proposal.expectedCurrentRevisionId,
        resultingRevisionId: rev2.id,
        beforeSummary: modelUpdate.beforeSummary,
        afterSummary: modelUpdate.afterSummary,
        userFacingSummary: modelUpdate.userFacingSummary,
      });
      expect(projection.currentRevision.summary).toBe(rev2.summary);
      expect(projection.currentRevision.summary).toBe(modelUpdate.afterSummary);
    });

    it("12. rev1 has empty movement history", async () => {
      const { proposal } = await registerOnly();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.movementHistory).toEqual([]);
    });

    it("13. repeated reads are deeply equal", async () => {
      const { proposal } = await publishFresh();
      const a = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      const b = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("14. user-wide concept order is deterministic", async () => {
      const owner = id("order_user");
      const first = await publishFresh({
        userId: owner,
        afterSummary: "Order proof concept A strengthened summary.",
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      const second = await publishFresh({
        userId: owner,
        afterSummary: "Order proof concept B strengthened summary.",
      });

      const model = await readCanonicalModelProjection({
        userId: owner,
        db: prisma,
      });
      expect(model.projectionVersion).toBe(CANONICAL_MODEL_PROJECTION_VERSION);
      expect(model.userId).toBe(owner);
      expect(model.concepts.length).toBeGreaterThanOrEqual(2);

      const ids = model.concepts.map((row) => row.concept.id);
      expect(ids).toContain(first.proposal.canonicalConceptId);
      expect(ids).toContain(second.proposal.canonicalConceptId);

      for (let i = 1; i < model.concepts.length; i += 1) {
        const prev = model.concepts[i - 1]!;
        const cur = model.concepts[i]!;
        if (prev.currentRevision.acceptedAt === cur.currentRevision.acceptedAt) {
          expect(prev.concept.id <= cur.concept.id).toBe(true);
        } else {
          expect(prev.currentRevision.acceptedAt > cur.currentRevision.acceptedAt).toBe(
            true,
          );
        }
      }
    });

    it("15. cross-user concept returns not_found", async () => {
      const { proposal } = await registerOnly();
      const result = await readCanonicalConceptProjection({
        userId: otherUserId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(result).toBe("not_found");
    });

    it("16. cross-user concepts are excluded from model projection", async () => {
      const owned = await registerOnly({ userId });
      await registerOnly({ userId: otherUserId });
      const model = await readCanonicalModelProjection({
        userId,
        db: prisma,
      });
      expect(
        model.concepts.every((row) => row.concept.id !== undefined),
      ).toBe(true);
      expect(
        model.concepts.some(
          (row) => row.concept.id === owned.proposal.canonicalConceptId,
        ),
      ).toBe(true);
      for (const concept of model.concepts) {
        const row = await prisma.canonicalConcept.findUniqueOrThrow({
          where: { id: concept.concept.id },
        });
        expect(row.userId).toBe(userId);
      }
    });

    it("17. null or missing current pointer fails closed", async () => {
      const { proposal } = await registerOnly();
      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = NULL WHERE id = $1`,
        proposal.canonicalConceptId!,
      );
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("18. pointer to an older revision fails closed", async () => {
      const { proposal } = await publishFresh();
      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = $1 WHERE id = $2`,
        proposal.expectedCurrentRevisionId!,
        proposal.canonicalConceptId!,
      );
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("19. broken revision chain fails closed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary: "Broken-chain insert-time non-contiguous versions.",
      });
      const rev1Id = proposal.expectedCurrentRevisionId!;
      // Insert-valid strengthen shape at version 3 (skips 2) — no trigger disable.
      await prisma.canonicalConceptRevision.create({
        data: {
          id: id("rev_gap"),
          userId,
          conceptId: proposal.canonicalConceptId!,
          version: 3,
          title: "gap title",
          summary: "non-contiguous strengthen revision",
          status: "emerging",
          confidenceScore: 0.55,
          confidenceLevel: UserMapConfidenceLevel.medium,
          evidenceCount: 0,
          rationale: "gap",
          operation: CanonicalRevisionOperation.strengthen,
          decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
          acceptedAt: new Date(),
          registrationSnapshotHash: null,
          previousRevisionId: rev1Id,
          createdFromProposalId: proposal.id,
        },
      });
      const gap = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      await prisma.canonicalConcept.update({
        where: { id: proposal.canonicalConceptId! },
        data: { currentRevisionId: gap.id },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("20. evidence-count mismatch fails closed", async () => {
      const { proposal } = await publishFresh();
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      const support = await prisma.understandingEvidenceLink.findFirstOrThrow({
        where: {
          userId,
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: rev2.id,
          role: UnderstandingLinkRole.supports,
        },
      });
      await prisma.understandingEvidenceLink.delete({ where: { id: support.id } });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("21. missing evidence source fails closed", async () => {
      const { proposal, journalId } = await publishFresh();
      await prisma.journalEntry.delete({ where: { id: journalId } });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("22. cross-user evidence fails closed", async () => {
      const { proposal } = await publishFresh();
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      const foreignJournal = await seedJournal({ userId: otherUserId });
      await prisma.understandingEvidenceLink.create({
        data: {
          userId,
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: rev2.id,
          sourceType: UnderstandingLinkSourceType.journal_entry,
          sourceId: foreignJournal,
          role: UnderstandingLinkRole.supports,
          summary: "cross-user should fail",
          snippet: "x",
          quote: "x",
        },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("23. unsupported evidence pair fails closed", async () => {
      const { proposal } = await publishFresh();
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      // timeline_aggregation is an enum value but not a supported writer pair.
      await prisma.$executeRawUnsafe(
        `INSERT INTO "UnderstandingEvidenceLink"
          (id, "userId", "targetType", "targetId", "sourceType", "sourceId", role, summary, snippet, quote, "createdAt")
         VALUES
          ($1, $2, 'canonical_concept_revision'::"UnderstandingLinkTargetType", $3,
           'timeline_aggregation'::"UnderstandingLinkSourceType", $4,
           'context'::"UnderstandingLinkRole", 'bad', 'bad', 'bad', NOW())`,
        id("uel"),
        userId,
        rev2.id,
        id("timeline_src"),
      );
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("24. corrupt semantic ModelUpdate fails closed", async () => {
      const { proposal, published } = await publishFresh();
      if (typeof published === "string") throw new Error("expected publish");
      await prisma.modelUpdate.update({
        where: { id: published.modelUpdateId },
        data: { afterSummary: "CORRUPT AFTER SUMMARY FOR PROJECTION" },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("revision2.summary differing from proposal.afterSummary fails closed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary: "Proposal afterSummary that revision must preserve.",
      });
      await installCorruptCanonicalRev2({
        proposal,
        rev2: { summary: "CORRUPT REVISION SUMMARY NOT ON PROPOSAL" },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("revision2.rationale differing from proposal.rationale fails closed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary: "Rationale mismatch projection proof summary.",
      });
      await installCorruptCanonicalRev2({
        proposal,
        rev2: { rationale: "CORRUPT REVISION RATIONALE" },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("revision2.title differing from revision1.title fails closed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary: "Title mismatch projection proof summary.",
        title: "Original revision-1 title",
      });
      await installCorruptCanonicalRev2({
        proposal,
        rev2: { title: "CORRUPT REVISION TITLE" },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("revision2 confidence differing from revision1 fails closed", async () => {
      const { proposal } = await createCanonicalProposal({
        afterSummary: "Confidence mismatch projection proof summary.",
      });
      await installCorruptCanonicalRev2({
        proposal,
        rev2: {
          confidenceScore: 0.11,
          confidenceLevel: UserMapConfidenceLevel.low,
        },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("25. missing movement receipt fails closed; duplicate receipt is DB-rejected", async () => {
      const missing = await publishFresh({
        afterSummary: "Missing movement receipt projection proof summary.",
      });
      if (typeof missing.published === "string") throw new Error("expected publish");
      await prisma.$executeRawUnsafe(
        `UPDATE "ExploreMovementProposal" SET "modelUpdateId" = NULL WHERE id = $1`,
        missing.proposal.id,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "ModelUpdate" WHERE id = $1`,
        missing.published.modelUpdateId,
      );
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: missing.proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );

      const dup = await publishFresh({
        afterSummary: "Duplicate movement receipt projection proof summary.",
      });
      if (typeof dup.published === "string") throw new Error("expected publish");
      const rev1Id = dup.proposal.expectedCurrentRevisionId!;
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: dup.proposal.id },
      });

      let duplicateRejected = false;
      try {
        await prisma.modelUpdate.create({
          data: {
            id: id("mu_dup"),
            userId,
            updateType: ModelUpdateType.conclusion_strengthened,
            visibility: ModelUpdateVisibility.user_visible,
            isMeaningful: true,
            affectedObjectType:
              UnderstandingLinkTargetType.canonical_concept_revision,
            affectedObjectId: rev2.id,
            userFacingSummary: dup.proposal.userFacingSummary,
            beforeSummary: rev2.summary,
            afterSummary: rev2.summary,
            internalNotes: "duplicate-attempt",
            confidenceDelta: null,
            canonicalConceptId: dup.proposal.canonicalConceptId!,
            previousRevisionId: rev1Id,
            resultingRevisionId: rev2.id,
            exploreProposalId: dup.proposal.id,
          },
        });
      } catch (error) {
        duplicateRejected = true;
        const message =
          error instanceof Error ? error.message : String(error);
        expect(
          /Unique constraint|unique|exploreProposalId|resultingRevisionId|model_update_/i.test(
            message,
          ),
        ).toBe(true);
      }
      expect(duplicateRejected).toBe(true);

      const coherent = await readCanonicalConceptProjection({
        userId,
        conceptId: dup.proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(coherent).not.toBe("not_found");
      if (coherent === "not_found") return;
      expect(coherent.currentRevision.version).toBe(2);
      expect(coherent.movementHistory).toHaveLength(1);
      expect(coherent.movementHistory[0]?.modelUpdateId).toBe(
        dup.published.modelUpdateId,
      );
    });

    it("26. feature flag disabled still reads canonical history", async () => {
      const { proposal } = await publishFresh();
      clearCanonicalGateEnv();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.currentRevision.version).toBe(2);
    });

    it("27. no legacy fallback when canonical rows are corrupt", async () => {
      const { umc, proposal } = await publishFresh({
        afterSummary: "No legacy fallback when pointer is corrupt.",
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = NULL WHERE id = $1`,
        proposal.canonicalConceptId!,
      );
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      const umcStill = await prisma.userMapConclusion.findUniqueOrThrow({
        where: { id: umc.id },
      });
      expect(umcStill.summary.length).toBeGreaterThan(0);
    });

    it("28. reader emits no database writes", async () => {
      const { proposal } = await publishFresh({
        afterSummary: "Read-only SQL emission proof summary.",
      });
      const conceptId = proposal.canonicalConceptId!;
      const beforeConcept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: conceptId },
      });
      const beforeCounts = {
        concepts: await prisma.canonicalConcept.count({ where: { userId } }),
        revisions: await prisma.canonicalConceptRevision.count({
          where: { userId },
        }),
        bindings: await prisma.canonicalConceptSourceBinding.count({
          where: { userId },
        }),
        links: await prisma.understandingEvidenceLink.count({ where: { userId } }),
        modelUpdates: await prisma.modelUpdate.count({ where: { userId } }),
      };

      const queries: string[] = [];
      const onQuery = (event: { query: string }) => {
        queries.push(event.query);
      };
      // Prisma event typing varies by client generation; cast for the test hook.
      (prisma as unknown as { $on: (e: "query", cb: typeof onQuery) => void }).$on(
        "query",
        onQuery,
      );

      await readCanonicalConceptProjection({
        userId,
        conceptId,
        db: prisma,
      });

      const mutating = queries.filter((query) => {
        const normalized = query.replace(/\s+/g, " ").trim();
        if (/^(BEGIN|COMMIT|ROLLBACK|SET TRANSACTION)\b/i.test(normalized)) {
          return false;
        }
        if (/\bSET\s+TRANSACTION\b/i.test(normalized)) return false;
        return /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(
          normalized,
        );
      });
      expect(mutating).toEqual([]);

      const afterConcept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: conceptId },
      });
      expect(afterConcept.updatedAt.toISOString()).toBe(
        beforeConcept.updatedAt.toISOString(),
      );
      expect({
        concepts: await prisma.canonicalConcept.count({ where: { userId } }),
        revisions: await prisma.canonicalConceptRevision.count({
          where: { userId },
        }),
        bindings: await prisma.canonicalConceptSourceBinding.count({
          where: { userId },
        }),
        links: await prisma.understandingEvidenceLink.count({ where: { userId } }),
        modelUpdates: await prisma.modelUpdate.count({ where: { userId } }),
      }).toEqual(beforeCounts);
    });

    it("29. repeatable-read snapshot cannot mix publication states", async () => {
      const seeded = await createCanonicalProposal({
        afterSummary:
          "Concurrency snapshot must stay coherent at revision 1 or 2.",
      });
      const conceptId = seeded.proposal.canonicalConceptId!;

      let releasePublish!: () => void;
      const publishGate = new Promise<void>((resolve) => {
        releasePublish = resolve;
      });
      let snapshotReady!: () => void;
      const snapshotReadyGate = new Promise<void>((resolve) => {
        snapshotReady = resolve;
      });

      const snapshotPromise = prisma.$transaction(
        async (tx) =>
          readCanonicalConceptProjectionInTransaction({
            userId,
            conceptId,
            tx: tx as never,
            afterConceptRowLoaded: async () => {
              snapshotReady();
              await publishGate;
            },
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: 60_000,
          maxWait: 60_000,
        },
      );

      await snapshotReadyGate;
      const published = await publishExploreMovementProposal({
        userId,
        proposalId: seeded.proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({ status: "published", idempotent: false });
      releasePublish();

      const snapshot = await snapshotPromise;
      expect(snapshot).not.toBe("not_found");
      if (snapshot === "not_found") return;
      expect(snapshot.currentRevision.version).toBe(1);
      expect(snapshot.revisionHistory).toHaveLength(1);
      expect(snapshot.movementHistory).toEqual([]);
      expect(snapshot.currentRevision.summary).toBe(seeded.umc.summary);

      const fresh = await readCanonicalConceptProjection({
        userId,
        conceptId,
        db: prisma,
      });
      expect(fresh).not.toBe("not_found");
      if (fresh === "not_found") return;
      expect(fresh.currentRevision.version).toBe(2);
      expect(fresh.revisionHistory).toHaveLength(2);
      expect(fresh.movementHistory).toHaveLength(1);
      expect(fresh.currentRevision.summary).toBe(seeded.decision.afterSummary);
    });

    it("30. version greater than 2 fails closed in V1", async () => {
      const { proposal, lineage, umc } = await publishFresh({
        afterSummary: "Version>2 projection fail-closed proof.",
      });
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      const fakeProposalId = id("v3_prop");
      await prisma.exploreMovementProposal.create({
        data: {
          id: fakeProposalId,
          userId,
          conversationId: lineage.conversationId,
          assistantMessageId: lineage.assistantMessageId,
          userMessageId: lineage.userMessageId,
          status: ExploreMovementProposalStatus.published,
          authorityMode: ExploreMovementAuthorityMode.canonical_v1,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: umc.id,
          beforeSummary: rev2.summary,
          afterSummary: "rev3 decoy",
          rationale: "rev3",
          userFacingSummary: "rev3",
          sourcesJson: proposal.sourcesJson as Prisma.InputJsonValue,
          expectedCurrentRevisionId: rev2.id,
          canonicalConceptId: proposal.canonicalConceptId,
          revisionOperation: CanonicalRevisionOperation.strengthen,
        },
      });
      const rev3 = await prisma.canonicalConceptRevision.create({
        data: {
          id: id("rev3"),
          userId,
          conceptId: proposal.canonicalConceptId!,
          version: 3,
          title: rev2.title,
          summary: "rev3 summary",
          status: rev2.status,
          confidenceScore: rev2.confidenceScore,
          confidenceLevel: rev2.confidenceLevel,
          evidenceCount: 0,
          rationale: "rev3",
          operation: CanonicalRevisionOperation.strengthen,
          decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
          acceptedAt: new Date(),
          registrationSnapshotHash: null,
          previousRevisionId: rev2.id,
          createdFromProposalId: fakeProposalId,
        },
      });
      await prisma.canonicalConcept.update({
        where: { id: proposal.canonicalConceptId! },
        data: { currentRevisionId: rev3.id },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("31. current rev1 capability advertises only strengthen", async () => {
      const { proposal } = await registerOnly();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.capabilities).toEqual({
        inspectEvidence: true,
        inspectMovementHistory: true,
        supportedWriteOperations: [CanonicalRevisionOperation.strengthen],
      });
    });

    it("32. current rev2 advertises no write operation", async () => {
      const { proposal } = await publishFresh();
      const projection = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(projection).not.toBe("not_found");
      if (projection === "not_found") return;
      expect(projection.capabilities).toEqual({
        inspectEvidence: true,
        inspectMovementHistory: true,
        supportedWriteOperations: [],
      });
    });

    it("ModelUpdate.afterSummary does not independently define current meaning", async () => {
      const { proposal, published } = await publishFresh({
        afterSummary: "Revision owns meaning; ModelUpdate is receipt only.",
      });
      if (typeof published === "string") throw new Error("expected publish");
      const before = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(before).not.toBe("not_found");
      if (before === "not_found") return;
      const rev2Summary = before.currentRevision.summary;

      // Corrupt ModelUpdate.afterSummary while leaving revision intact — projection must fail,
      // not silently adopt the ModelUpdate text or fall back to UMC.
      await prisma.modelUpdate.update({
        where: { id: published.modelUpdateId },
        data: { afterSummary: "MODEL_UPDATE_ONLY_MEANING" },
      });
      await expectCode(
        () =>
          readCanonicalConceptProjection({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      const rev2 = await prisma.canonicalConceptRevision.findFirstOrThrow({
        where: { createdFromProposalId: proposal.id },
      });
      expect(rev2.summary).toBe(rev2Summary);
      expect(rev2.summary).not.toBe("MODEL_UPDATE_ONLY_MEANING");
    });

    it("authority triggers remain armed after the projection suite", async () => {
      const rows = await prisma.$queryRaw<
        Array<{ tgname: string; tgenabled: string }>
      >`
        SELECT t.tgname, t.tgenabled::text AS tgenabled
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND t.tgname IN (
            'canonical_revision_immutable_guard_trg',
            'model_update_canonical_lineage_guard_trg'
          )
        ORDER BY t.tgname
      `;
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        // 'O' = origin/normal enabled; 'D' would mean disabled.
        expect(row.tgenabled).toBe("O");
      }
      expect(rows.map((row) => row.tgname).sort()).toEqual([
        "canonical_revision_immutable_guard_trg",
        "model_update_canonical_lineage_guard_trg",
      ]);
    });
  },
);
