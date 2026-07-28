/**
 * Phase 5 — DB-backed product projection, fail-closed, read-only, and parity proofs.
 *
 * Isolated Postgres proofs use CANONICAL_AUTHORITY_DB_TEST_URL.
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

vi.mock("server-only", () => ({}));

let testPrismaRef: { current: PrismaClient | null } = { current: null };

vi.mock("@/lib/prismadb", () => ({
  get default() {
    if (!testPrismaRef.current) {
      throw new Error("test prisma not ready");
    }
    return testPrismaRef.current;
  },
}));

vi.mock("../prismadb", () => ({
  get default() {
    if (!testPrismaRef.current) {
      throw new Error("test prisma not ready");
    }
    return testPrismaRef.current;
  },
}));
import {
  ExploreMovementProposalStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
  Prisma,
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
import { buildCanonicalModelPromptBlock } from "../canonical-model-ai-context";
import {
  extractCanonicalIdentityEnvelope,
  toCanonicalProductConceptV1,
} from "../canonical-model-product-projection";
import {
  readCanonicalConceptProjection,
  readCanonicalModelProjection,
} from "../canonical-model-projection";
import { readCanonicalAndLegacyMovementList } from "../canonical-movement-list-merge";
import {
  readCanonicalProductConceptForUser,
  readCurrentUnderstandingProductProjection,
  toCurrentUnderstandingSurfaceListItem,
} from "../current-understanding-product-projection";
import {
  createOrReuseSemanticExploreMovementProposal,
  publishExploreMovementProposal,
} from "../explore-movement-proposal";
import { buildExploreMovementProposalProvenance } from "../explore-movement-proposal-provenance";
import type { ExploreGroundingSource } from "../explore-grounding-contract";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "../explore-movement-semantic-contract";
import { mapTodayDataToV0Props } from "../orvek-adapters/today";
import { TODAY_CURRENT_UNDERSTANDING_UNAVAILABLE_COPY } from "../today-reentry";
import { buildWhatChangedInspectorDetail } from "../what-changed-reality-report";
import {
  completedPassReferee,
  validProposeDecision,
} from "./helpers/explore-movement-semantic-test-helpers";

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

describe("canonical product DB integration — URL safety", () => {
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
  "canonical product DB integration",
  () => {
    let prisma: PrismaClient;
    const userId = id("p5_user");
    const otherUserId = id("p5_other");

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
      testPrismaRef.current = prisma;
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
      area?: UserMapConclusionArea;
    }) {
      return prisma.userMapConclusion.create({
        data: {
          userId: args?.userId ?? userId,
          area: args?.area ?? UserMapConclusionArea.operating_logic,
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

    async function seedJournal(args?: { userId?: string }) {
      const journalId = id("journal");
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

    async function publishFresh(args?: {
      userId?: string;
      afterSummary?: string;
      summary?: string;
      area?: UserMapConclusionArea;
    }) {
      const owner = args?.userId ?? userId;
      enableCanonicalGateFor(owner);
      const umc = await createUmc({
        userId: owner,
        summary: args?.summary,
        area: args?.area,
      });
      const lineage = await seedExploreLineage({ userId: owner });
      const journalId = await seedJournal({ userId: owner });
      const afterSummary = args?.afterSummary ?? "REVISION TWO";
      const sources: ExploreGroundingSource[] = [
        {
          sourceId: journalId,
          sourceType: "journal_entry",
          sourceFamily: "journal_entry",
          userId: owner,
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
        targetObjectId: umc.id,
        afterSummary,
        evidenceSourceIds: [journalId],
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
      const published = await publishExploreMovementProposal({
        userId: owner,
        proposalId: proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({ status: "published", idempotent: false });
      if (typeof published === "string") throw new Error("expected publish ok");
      return { umc, proposal, published, afterSummary, lineage, journalId };
    }

    async function createCanonicalProposal(args?: {
      userId?: string;
      afterSummary?: string;
      summary?: string;
      area?: UserMapConclusionArea;
    }) {
      const owner = args?.userId ?? userId;
      enableCanonicalGateFor(owner);
      const umc = await createUmc({
        userId: owner,
        summary: args?.summary,
        area: args?.area,
      });
      const lineage = await seedExploreLineage({ userId: owner });
      const journalId = await seedJournal({ userId: owner });
      const afterSummary =
        args?.afterSummary ??
        "Evening recovery boundary weakens more specifically when dense meetings stack.";
      const sources: ExploreGroundingSource[] = [
        {
          sourceId: journalId,
          sourceType: "journal_entry",
          sourceFamily: "journal_entry",
          userId: owner,
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
        targetObjectId: umc.id,
        afterSummary,
        evidenceSourceIds: [journalId],
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
      return { umc, proposal, afterSummary, lineage, journalId };
    }

    it("4-5 + 26. product merge uses REVISION TWO after UMC mutation; surface parity", async () => {
      const { umc, proposal, afterSummary } = await publishFresh({
        afterSummary: "REVISION TWO",
      });
      await prisma.userMapConclusion.update({
        where: { id: umc.id },
        data: { title: "MUTATED LEGACY", summary: "MUTATED LEGACY" },
      });
      await createUmc({
        summary: "Unregistered legacy remains visible.",
        title: "Unregistered",
      });

      const product = await readCurrentUnderstandingProductProjection({
        userId,
        db: prisma,
      });
      const canonical = product.items.find(
        (item) => item.authorityType === "canonical_concept_revision",
      );
      expect(canonical).toBeDefined();
      if (!canonical || canonical.authorityType !== "canonical_concept_revision") {
        return;
      }
      expect(canonical.summary).toBe(afterSummary);
      expect(canonical.summary).not.toBe("MUTATED LEGACY");
      expect(canonical.conceptId).toBe(proposal.canonicalConceptId);
      expect(
        product.items.some(
          (item) =>
            item.authorityType === "legacy_unregistered_usermap_conclusion" &&
            item.id === umc.id,
        ),
      ).toBe(false);
      expect(
        product.items.some(
          (item) =>
            item.authorityType === "legacy_unregistered_usermap_conclusion" &&
            item.summary === "Unregistered legacy remains visible.",
        ),
      ).toBe(true);

      const phase4 = await readCanonicalConceptProjection({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(phase4).not.toBe("not_found");
      if (phase4 === "not_found") return;
      const phase4Product = toCanonicalProductConceptV1(phase4);
      const detail = await readCanonicalProductConceptForUser({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(detail).not.toBe("not_found");
      if (detail === "not_found") return;
      const surface = toCurrentUnderstandingSurfaceListItem(canonical);
      const model = await readCanonicalModelProjection({ userId, db: prisma });
      const aiSource = toCanonicalProductConceptV1(model.concepts[0]!);
      const prompt = buildCanonicalModelPromptBlock({ projection: model });

      const envelope = extractCanonicalIdentityEnvelope(canonical);
      expect(extractCanonicalIdentityEnvelope(phase4Product)).toEqual(envelope);
      expect(extractCanonicalIdentityEnvelope(detail)).toEqual(envelope);
      expect({
        conceptId: surface.conceptId,
        currentRevisionId: surface.currentRevisionId,
        version: surface.version,
        domain: surface.domain,
        title: surface.title,
        summary: surface.summary,
        status: surface.status,
        confidenceScore: surface.confidenceScore,
        confidenceLevel: surface.confidenceLevel,
        evidenceCount: surface.evidenceCount,
      }).toEqual(envelope);
      expect(extractCanonicalIdentityEnvelope(aiSource)).toEqual(envelope);
      expect(prompt).toContain(`summary: ${afterSummary}`);
      expect(prompt).not.toContain("MUTATED LEGACY");

      const movement = canonical.movementHistory[0];
      expect(movement).toBeDefined();
      if (!movement) return;
      const mu = await prisma.modelUpdate.findUniqueOrThrow({
        where: { id: movement.modelUpdateId },
      });
      expect(mu.canonicalConceptId).toBe(envelope.conceptId);
      expect(mu.resultingRevisionId).toBe(envelope.currentRevisionId);
      expect(mu.afterSummary).toBe(afterSummary);
      expect(movement.beforeSummary).toBe(mu.beforeSummary);
      expect(movement.afterSummary).toBe(mu.afterSummary);
      expect(movement.exploreProposalId).toBe(mu.exploreProposalId);
    });

    it("8 + feature-gate independence: disabled gate still returns canonical product", async () => {
      const { proposal } = await publishFresh({
        afterSummary: "Gate-independent REVISION TWO",
      });
      clearCanonicalGateEnv();
      process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "0";
      delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];

      const product = await readCurrentUnderstandingProductProjection({
        userId,
        db: prisma,
      });
      expect(
        product.items.some(
          (item) =>
            item.authorityType === "canonical_concept_revision" &&
            item.conceptId === proposal.canonicalConceptId,
        ),
      ).toBe(true);
    });

    it("27. cross-user concepts never appear", async () => {
      const other = await publishFresh({
        userId: otherUserId,
        afterSummary: "Other user REVISION TWO",
      });
      const mine = await readCurrentUnderstandingProductProjection({
        userId,
        db: prisma,
      });
      expect(
        mine.items.some(
          (item) =>
            item.authorityType === "canonical_concept_revision" &&
            item.conceptId === other.proposal.canonicalConceptId,
        ),
      ).toBe(false);
      const cross = await readCanonicalProductConceptForUser({
        userId,
        conceptId: other.proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(cross).toBe("not_found");
    });

    it("11 fail-closed: broken pointer does not return legacy seed via product read", async () => {
      const { umc, proposal } = await publishFresh({
        afterSummary: "Broken pointer REVISION TWO",
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = NULL WHERE id = $1`,
        proposal.canonicalConceptId!,
      );
      await expectCode(
        () =>
          readCurrentUnderstandingProductProjection({
            userId,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      const seed = await prisma.userMapConclusion.findUniqueOrThrow({
        where: { id: umc.id },
      });
      expect(seed.summary.length).toBeGreaterThan(0);
    });

    it("19. what-changed canonical resolve fails closed on corruption", async () => {
      const { proposal } = await publishFresh({
        afterSummary: "Report corruption REVISION TWO",
      });
      const concept = await readCanonicalProductConceptForUser({
        userId,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(concept).not.toBe("not_found");
      if (concept === "not_found") return;
      const modelUpdateId = concept.movementHistory[0]?.modelUpdateId;
      expect(modelUpdateId).toBeTruthy();
      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = NULL WHERE id = $1`,
        proposal.canonicalConceptId!,
      );
      await expectCode(
        () =>
          readCanonicalProductConceptForUser({
            userId,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      const mu = await prisma.modelUpdate.findUniqueOrThrow({
        where: { id: modelUpdateId! },
      });
      // Receipt row still exists, but product/report authority path must not use it alone.
      expect(mu.afterSummary).toBe("Report corruption REVISION TWO");
      expect(mu.canonicalConceptId).toBe(proposal.canonicalConceptId);
      expect(proposal.status).not.toBe(ExploreMovementProposalStatus.rejected);
    });

    it("28. product + AI context reads emit no authority mutations", async () => {
      const owner = id("p5_ro");
      const { proposal } = await publishFresh({
        userId: owner,
        afterSummary: "Read-only product proof summary.",
      });
      const conceptId = proposal.canonicalConceptId!;
      const beforeConcept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: conceptId },
      });
      const beforeCounts = {
        concepts: await prisma.canonicalConcept.count({ where: { userId: owner } }),
        revisions: await prisma.canonicalConceptRevision.count({
          where: { userId: owner },
        }),
        bindings: await prisma.canonicalConceptSourceBinding.count({
          where: { userId: owner },
        }),
        links: await prisma.understandingEvidenceLink.count({
          where: { userId: owner },
        }),
        modelUpdates: await prisma.modelUpdate.count({ where: { userId: owner } }),
        proposals: await prisma.exploreMovementProposal.count({
          where: { userId: owner },
        }),
      };

      const queries: string[] = [];
      const onQuery = (event: { query: string }) => {
        queries.push(event.query);
      };
      (prisma as unknown as { $on: (e: "query", cb: typeof onQuery) => void }).$on(
        "query",
        onQuery,
      );

      const product = await readCurrentUnderstandingProductProjection({
        userId: owner,
        db: prisma,
      });
      await readCanonicalProductConceptForUser({
        userId: owner,
        conceptId,
        db: prisma,
      });
      const model = await readCanonicalModelProjection({
        userId: owner,
        db: prisma,
      });
      buildCanonicalModelPromptBlock({ projection: model });

      expect(product.items.length).toBeGreaterThan(0);

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
        concepts: await prisma.canonicalConcept.count({ where: { userId: owner } }),
        revisions: await prisma.canonicalConceptRevision.count({
          where: { userId: owner },
        }),
        bindings: await prisma.canonicalConceptSourceBinding.count({
          where: { userId: owner },
        }),
        links: await prisma.understandingEvidenceLink.count({
          where: { userId: owner },
        }),
        modelUpdates: await prisma.modelUpdate.count({ where: { userId: owner } }),
        proposals: await prisma.exploreMovementProposal.count({
          where: { userId: owner },
        }),
      }).toEqual(beforeCounts);
    });

    it("domain preservation: recovery_architecture concept lands on matching Map area", async () => {
      const owner = id("p5_domain");
      const { proposal } = await publishFresh({
        userId: owner,
        area: UserMapConclusionArea.recovery_architecture,
        afterSummary: "Recovery domain REVISION TWO",
      });
      const product = await readCurrentUnderstandingProductProjection({
        userId: owner,
        db: prisma,
      });
      const canonical = product.items.find(
        (item) =>
          item.authorityType === "canonical_concept_revision" &&
          item.conceptId === proposal.canonicalConceptId,
      );
      expect(canonical).toBeDefined();
      if (!canonical || canonical.authorityType !== "canonical_concept_revision") {
        return;
      }
      expect(canonical.domain).toBe("recovery_architecture");
      const surface = toCurrentUnderstandingSurfaceListItem(canonical);
      expect(surface.area).toBe("recovery_architecture");
      expect(surface.domain).toBe("recovery_architecture");
    });

    it("current-understanding snapshot stays coherent across concurrent registration", async () => {
      const owner = id("p5_snap");
      enableCanonicalGateFor(owner);
      const umc = await createUmc({
        userId: owner,
        summary: "Pre-registration legacy wording only.",
      });
      await createUmc({
        userId: owner,
        title: "Other",
        summary: "Unrelated unregistered.",
      });

      let releasePublish!: () => void;
      const publishGate = new Promise<void>((resolve) => {
        releasePublish = resolve;
      });
      let snapshotReady!: () => void;
      const snapshotReadyGate = new Promise<void>((resolve) => {
        snapshotReady = resolve;
      });

      const snapshotPromise = readCurrentUnderstandingProductProjection({
        userId: owner,
        db: prisma,
        afterCanonicalLoaded: async () => {
          snapshotReady();
          await publishGate;
        },
      });

      await snapshotReadyGate;

      const lineage = await seedExploreLineage({ userId: owner });
      const journalId = await seedJournal({ userId: owner });
      const afterSummary = "POST PUBLISH REVISION TWO";
      const sources: ExploreGroundingSource[] = [
        {
          sourceId: journalId,
          sourceType: "journal_entry",
          sourceFamily: "journal_entry",
          userId: owner,
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
        targetObjectId: umc.id,
        afterSummary,
        evidenceSourceIds: [journalId],
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
      await publishExploreMovementProposal({
        userId: owner,
        proposalId: created.record.proposalId,
        db: prisma,
      });
      // Mutate seed wording after it became canonical — must never appear as current meaning.
      await prisma.userMapConclusion.update({
        where: { id: umc.id },
        data: { summary: "MUTATED AFTER CANONICAL", title: "MUTATED AFTER CANONICAL" },
      });

      releasePublish();
      const first = await snapshotPromise;
      const firstJson = JSON.stringify(first);
      expect(firstJson).not.toContain("MUTATED AFTER CANONICAL");
      expect(firstJson).not.toContain("POST PUBLISH REVISION TWO");
      // Coherent pre-registration snapshot: no canonical items yet.
      expect(
        first.items.some(
          (item) => item.authorityType === "canonical_concept_revision",
        ),
      ).toBe(false);
      expect(
        first.items.some(
          (item) =>
            item.authorityType === "legacy_unregistered_usermap_conclusion" &&
            item.id === umc.id,
        ),
      ).toBe(true);

      const second = await readCurrentUnderstandingProductProjection({
        userId: owner,
        db: prisma,
      });
      const canonical = second.items.find(
        (item) => item.authorityType === "canonical_concept_revision",
      );
      expect(canonical).toBeDefined();
      if (!canonical || canonical.authorityType !== "canonical_concept_revision") {
        return;
      }
      expect(canonical.summary).toBe("POST PUBLISH REVISION TWO");
      expect(canonical.summary).not.toBe("MUTATED AFTER CANONICAL");
      expect(
        second.items.some(
          (item) =>
            item.authorityType === "legacy_unregistered_usermap_conclusion" &&
            item.id === umc.id,
        ),
      ).toBe(false);
    });

    it("movement list globally orders and retains exact canonical lineage once", async () => {
      const owner = id("p5_move");
      const { proposal } = await publishFresh({
        userId: owner,
        afterSummary: "Movement lineage REVISION TWO",
      });
      const concept = await readCanonicalProductConceptForUser({
        userId: owner,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(concept).not.toBe("not_found");
      if (concept === "not_found") return;
      const canonicalMuId = concept.movementHistory[0]!.modelUpdateId;
      const older = new Date("2026-01-01T00:00:00.000Z");
      const newer = new Date("2026-12-01T00:00:00.000Z");
      await prisma.modelUpdate.create({
        data: {
          id: id("mu_legacy_new"),
          userId: owner,
          updateType: ModelUpdateType.strategy_adjusted,
          visibility: ModelUpdateVisibility.user_visible,
          isMeaningful: true,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: id("umc_legacy_target"),
          userFacingSummary: "Newer legacy movement",
          createdAt: newer,
        },
      });
      await prisma.modelUpdate.update({
        where: { id: canonicalMuId },
        data: { createdAt: older },
      });

      const { items } = await readCanonicalAndLegacyMovementList({
        userId: owner,
        db: prisma,
        limit: 10,
      });
      expect(items[0]?.id).toBeTruthy();
      expect(items.map((item) => item.id).filter((id) => id === canonicalMuId)).toHaveLength(
        1,
      );
      const canonicalRow = items.find((item) => item.id === canonicalMuId);
      expect(canonicalRow?.authorityType).toBe("canonical_movement");
      if (canonicalRow?.authorityType === "canonical_movement") {
        expect(canonicalRow.conceptId).toBe(proposal.canonicalConceptId);
        expect(canonicalRow.previousRevisionId).toBeTruthy();
        expect(canonicalRow.resultingRevisionId).toBe(concept.currentRevisionId);
        expect(canonicalRow.beforeSummary).toBeTruthy();
        expect(canonicalRow.afterSummary).toBe("Movement lineage REVISION TWO");
        expect(canonicalRow.affectedObjectId).toBe(concept.currentRevisionId);
      }
      expect(items.some((item) => item.authorityType === "legacy_model_update")).toBe(
        true,
      );
      expect(items[0]?.id).not.toBe(canonicalMuId);
    });

    it("What Changed canonical identity fails closed on corruption cases", async () => {
      const owner = id("p5_wc");
      const { proposal } = await publishFresh({
        userId: owner,
        afterSummary: "What Changed REVISION TWO",
      });
      const concept = await readCanonicalProductConceptForUser({
        userId: owner,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(concept).not.toBe("not_found");
      if (concept === "not_found") return;
      const modelUpdateId = concept.movementHistory[0]!.modelUpdateId;

      const ok = await buildWhatChangedInspectorDetail({
        userId: owner,
        modelUpdateId,
        db: prisma as never,
      });
      expect(ok).not.toBeNull();
      expect(ok?.report.modelMovement.after).toBe("What Changed REVISION TWO");

      // afterSummary corruption
      await prisma.modelUpdate.update({
        where: { id: modelUpdateId },
        data: { afterSummary: "CORRUPTED AFTER" },
      });
      await expectCode(
        () =>
          buildWhatChangedInspectorDetail({
            userId: owner,
            modelUpdateId,
            db: prisma as never,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      await prisma.modelUpdate.update({
        where: { id: modelUpdateId },
        data: { afterSummary: "What Changed REVISION TWO" },
      });

      // affectedObjectType corruption
      await prisma.modelUpdate.update({
        where: { id: modelUpdateId },
        data: {
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: concept.legacySeed.objectId,
        },
      });
      await expectCode(
        () =>
          buildWhatChangedInspectorDetail({
            userId: owner,
            modelUpdateId,
            db: prisma as never,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      await prisma.modelUpdate.update({
        where: { id: modelUpdateId },
        data: {
          affectedObjectType:
            UnderstandingLinkTargetType.canonical_concept_revision,
          affectedObjectId: concept.currentRevisionId,
        },
      });

      // proposal.modelUpdateId changed to a decoy
      await prisma.exploreMovementProposal.update({
        where: { id: proposal.id },
        data: { modelUpdateId: id("decoy_mu") },
      });
      await expectCode(
        () =>
          buildWhatChangedInspectorDetail({
            userId: owner,
            modelUpdateId,
            db: prisma as never,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      await prisma.exploreMovementProposal.update({
        where: { id: proposal.id },
        data: { modelUpdateId },
      });

      // broken concept pointer
      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = NULL WHERE id = $1`,
        proposal.canonicalConceptId!,
      );
      await expectCode(
        () =>
          buildWhatChangedInspectorDetail({
            userId: owner,
            modelUpdateId,
            db: prisma as never,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("movement list stays coherent across concurrent revision-2 publication", async () => {
      const owner = id("p5_move_race");
      const afterSummary =
        "Movement concurrency REVISION TWO after dense meeting stacks.";
      const seeded = await createCanonicalProposal({
        userId: owner,
        afterSummary,
      });
      expect(seeded.proposal.canonicalConceptId).toBeTruthy();
      const conceptId = seeded.proposal.canonicalConceptId!;

      const preConcept = await readCanonicalProductConceptForUser({
        userId: owner,
        conceptId,
        db: prisma,
      });
      expect(preConcept).not.toBe("not_found");
      if (preConcept === "not_found") return;
      expect(preConcept.version).toBe(1);
      expect(preConcept.movementHistory).toEqual([]);

      let releasePublish!: () => void;
      const publishGate = new Promise<void>((resolve) => {
        releasePublish = resolve;
      });
      let snapshotReady!: () => void;
      const snapshotReadyGate = new Promise<void>((resolve) => {
        snapshotReady = resolve;
      });

      const firstPromise = readCanonicalAndLegacyMovementList({
        userId: owner,
        db: prisma,
        limit: 20,
        afterCanonicalLoaded: async () => {
          snapshotReady();
          await publishGate;
        },
      });

      await snapshotReadyGate;
      const published = await publishExploreMovementProposal({
        userId: owner,
        proposalId: seeded.proposal.id,
        db: prisma,
      });
      expect(published).toMatchObject({ status: "published", idempotent: false });
      releasePublish();

      const first = await firstPromise;
      const firstCanonical = first.items.filter(
        (item) => item.authorityType === "canonical_movement",
      );
      expect(firstCanonical).toHaveLength(0);
      const firstIds = first.items.map((item) => item.id);
      expect(new Set(firstIds).size).toBe(firstIds.length);
      expect(
        first.items.every((item) => item.authorityType === "legacy_model_update"),
      ).toBe(true);
      const firstJson = JSON.stringify(first.items);
      expect(firstJson).not.toContain(afterSummary);
      expect(first.canonicalConcepts.every((c) => c.version === 1)).toBe(true);
      expect(
        first.canonicalConcepts.every((c) => c.movementHistory.length === 0),
      ).toBe(true);

      const second = await readCanonicalAndLegacyMovementList({
        userId: owner,
        db: prisma,
        limit: 20,
      });
      const canonicalRows = second.items.filter(
        (item) => item.authorityType === "canonical_movement",
      );
      expect(canonicalRows).toHaveLength(1);
      const row = canonicalRows[0]!;
      expect(row.conceptId).toBe(conceptId);
      expect(row.previousRevisionId).toBeTruthy();
      expect(row.resultingRevisionId).toBeTruthy();
      expect(row.beforeSummary).toBe(seeded.umc.summary);
      expect(row.afterSummary).toBe(afterSummary);
      expect(row.affectedObjectId).toBe(row.resultingRevisionId);
      expect(
        second.items.filter((item) => item.id === row.id),
      ).toHaveLength(1);
      expect(
        second.items.some(
          (item) =>
            item.authorityType === "legacy_model_update" && item.id === row.id,
        ),
      ).toBe(false);
    });

    it("What Changed combined mutable-field corruption never downgrades to legacy", async () => {
      const owner = id("p5_wc_combo");
      const { umc, proposal } = await publishFresh({
        userId: owner,
        afterSummary: "Combined corruption REVISION TWO",
      });
      const concept = await readCanonicalProductConceptForUser({
        userId: owner,
        conceptId: proposal.canonicalConceptId!,
        db: prisma,
      });
      expect(concept).not.toBe("not_found");
      if (concept === "not_found") return;
      const modelUpdateId = concept.movementHistory[0]!.modelUpdateId;

      await prisma.exploreMovementProposal.update({
        where: { id: proposal.id },
        data: { modelUpdateId: id("decoy_combo_mu") },
      });
      await prisma.modelUpdate.update({
        where: { id: modelUpdateId },
        data: {
          canonicalConceptId: null,
          previousRevisionId: null,
          resultingRevisionId: null,
          exploreProposalId: null,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: umc.id,
        },
      });

      await expectCode(
        () =>
          buildWhatChangedInspectorDetail({
            userId: owner,
            modelUpdateId,
            db: prisma as never,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
    });

    it("unknown canonical domain fails closed at list, detail, movement, and AI boundaries", async () => {
      const owner = id("p5_unk_dom");
      const { proposal } = await publishFresh({
        userId: owner,
        afterSummary: "Unknown domain REVISION TWO",
      });
      await prisma.canonicalConcept.update({
        where: { id: proposal.canonicalConceptId! },
        data: { domain: "unknown" },
      });

      await expectCode(
        () =>
          readCurrentUnderstandingProductProjection({
            userId: owner,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      await expectCode(
        () =>
          readCanonicalProductConceptForUser({
            userId: owner,
            conceptId: proposal.canonicalConceptId!,
            db: prisma,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      await expectCode(
        () =>
          readCanonicalAndLegacyMovementList({
            userId: owner,
            db: prisma,
            limit: 10,
          }),
        "BROKEN_CANONICAL_PROJECTION",
      );
      await expectCode(async () => {
        const model = await readCanonicalModelProjection({
          userId: owner,
          db: prisma,
        });
        buildCanonicalModelPromptBlock({ projection: model });
      }, "BROKEN_CANONICAL_PROJECTION");
    });

    it("Today unavailable copy is not ordinary empty success copy", () => {
      const props = mapTodayDataToV0Props({
        snapshot: {
          surfacingCards: [],
          intelligenceUpdates: [],
          userMapConclusions: [],
          currentUnderstandingUnavailable: true,
          watchForItems: [],
          investigations: [],
          actions: [],
          timelineMovements: [],
        },
        isLoading: false,
        briefingDate: "Tuesday",
      });
      expect(props.briefingTitle).toBe(TODAY_CURRENT_UNDERSTANDING_UNAVAILABLE_COPY);
      expect(props.heroEmptyCopy).toBe(TODAY_CURRENT_UNDERSTANDING_UNAVAILABLE_COPY);
      expect(props.movementEmptyCopy).toBe(TODAY_CURRENT_UNDERSTANDING_UNAVAILABLE_COPY);
      expect(props.briefingTitle).not.toContain("No current state surfaced yet");
    });
  },
);
