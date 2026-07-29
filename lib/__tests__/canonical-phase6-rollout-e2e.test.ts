/**
 * Phase 6 — rollout matrix + E2E fixture proofs on disposable Postgres.
 *
 * Requires CANONICAL_AUTHORITY_DB_TEST_URL (must not equal DATABASE_URL).
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

const testPrismaRef: { current: PrismaClient | null } = { current: null };

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
  ExploreMovementAuthorityMode,
  PrismaClient,
  Role,
  SessionSurfaceType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
} from "@prisma/client";

import {
  enableCanonicalAiRequestCaptureForTests,
  disableCanonicalAiRequestCaptureForTests,
  getCanonicalAiRequestCaptureForTests,
  recordCanonicalAiRequestCapture,
} from "../canonical-ai-request-capture";
import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../canonical-model-authority-flag";
import { buildCanonicalModelPromptBlock } from "../canonical-model-ai-context";
import {
  extractCanonicalIdentityEnvelope,
  toCanonicalProductAuthoritySnapshotV1,
  toCanonicalProductConceptV1,
} from "../canonical-model-product-projection";
import {
  readCanonicalConceptProjection,
  readCanonicalModelProjection,
} from "../canonical-model-projection";
import { readCanonicalAndLegacyMovementList } from "../canonical-movement-list-merge";
import {
  assertCanonicalIdentityEnvelopeEqual,
  assertCanonicalMovementIdentityEqual,
  extractCanonicalMovementIdentityEnvelope,
} from "../canonical-phase6-identity";
import {
  buildCanonicalCorrectionHandoffFromProductConcept,
} from "../canonical-correction-handoff";
import {
  readCanonicalProductConceptForUser,
  readCurrentUnderstandingProductProjection,
} from "../current-understanding-product-projection";
import {
  createOrReuseSemanticExploreMovementProposal,
  publishExploreMovementProposal,
} from "../explore-movement-proposal";
import { buildExploreMovementProposalProvenance } from "../explore-movement-proposal-provenance";
import type { ExploreGroundingSource } from "../explore-grounding-contract";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "../explore-movement-semantic-contract";
import { buildWhatChangedInspectorDetail } from "../what-changed-reality-report";
import {
  completedPassReferee,
  validProposeDecision,
} from "./helpers/explore-movement-semantic-test-helpers";

const CANONICAL_AUTHORITY_DB_TEST_URL_ENV =
  "CANONICAL_AUTHORITY_DB_TEST_URL" as const;
const rawTestUrl = process.env[CANONICAL_AUTHORITY_DB_TEST_URL_ENV]?.trim() ?? "";

const LEGACY_SEED_TITLE = "LEGACY SEED TITLE";
const LEGACY_SEED_SUMMARY = "LEGACY SEED SUMMARY";
const REVISION_ONE = "REVISION ONE";
const REVISION_TWO = "REVISION TWO";
const MUTATED_LEGACY = "MUTATED LEGACY AFTER PUBLICATION";

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

describe("canonical Phase 6 — URL safety", () => {
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

describe.skipIf(!shouldAttemptRealDb)("canonical Phase 6 — rollout + e2e", () => {
  let prisma: PrismaClient;
  const userId = id("p6_user");
  const otherUserId = id("p6_other");

  beforeAll(async () => {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: rawTestUrl },
      stdio: "pipe",
    });
    prisma = new PrismaClient({
      datasources: { db: { url: rawTestUrl } },
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
    disableCanonicalAiRequestCaptureForTests();
  });

  afterEach(() => {
    clearCanonicalGateEnv();
    disableCanonicalAiRequestCaptureForTests();
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
        title: args?.title ?? LEGACY_SEED_TITLE,
        summary: args?.summary ?? LEGACY_SEED_SUMMARY,
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

  async function createProposal(args: {
    userId?: string;
    afterSummary: string;
    umcTitle?: string;
    umcSummary?: string;
  }) {
    const owner = args.userId ?? userId;
    const umc = await createUmc({
      userId: owner,
      title: args.umcTitle ?? LEGACY_SEED_TITLE,
      summary: args.umcSummary ?? LEGACY_SEED_SUMMARY,
    });
    const lineage = await seedExploreLineage({ userId: owner });
    const journalId = await seedJournal({ userId: owner });
    const { provenance, decision } = buildProvenance({
      umcId: umc.id,
      journalId,
      userId: owner,
      afterSummary: args.afterSummary,
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
    const proposal = await prisma.exploreMovementProposal.findUniqueOrThrow({
      where: { id: created.record.proposalId },
    });
    return { umc, proposal, lineage, journalId, created };
  }

  it("7. gate disabled + unallowlisted → legacy creation", async () => {
    clearCanonicalGateEnv();
    const { proposal } = await createProposal({ afterSummary: REVISION_TWO });
    expect(proposal.authorityMode).toBe(ExploreMovementAuthorityMode.legacy);
  });

  it("8. gate enabled + unallowlisted → legacy creation, no registration", async () => {
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "1";
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] = otherUserId;
    const { umc, proposal } = await createProposal({
      afterSummary: REVISION_TWO,
    });
    expect(proposal.authorityMode).toBe(ExploreMovementAuthorityMode.legacy);
    expect(proposal.canonicalConceptId).toBeNull();
    expect(
      await prisma.canonicalConcept.count({
        where: { userId, registrationKey: { contains: umc.id } },
      }),
    ).toBe(0);
  });

  it("9. gate enabled + allowlisted → canonical_v1", async () => {
    enableCanonicalGateFor(userId);
    const { proposal } = await createProposal({ afterSummary: REVISION_TWO });
    expect(proposal.authorityMode).toBe(ExploreMovementAuthorityMode.canonical_v1);
    expect(proposal.canonicalConceptId).toBeTruthy();
  });

  it("10. canonical proposal publishes after gate disabled (persisted authorityMode)", async () => {
    enableCanonicalGateFor(userId);
    const { proposal } = await createProposal({ afterSummary: REVISION_TWO });
    expect(proposal.authorityMode).toBe(ExploreMovementAuthorityMode.canonical_v1);
    clearCanonicalGateEnv();
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "0";

    const published = await publishExploreMovementProposal({
      userId,
      proposalId: proposal.id,
      db: prisma,
    });
    expect(published).toMatchObject({ status: "published", idempotent: false });
    if (typeof published === "string") throw new Error("expected publish ok");

    const mu = await prisma.modelUpdate.findUniqueOrThrow({
      where: { id: published.modelUpdateId },
    });
    const concept = await prisma.canonicalConcept.findUniqueOrThrow({
      where: { id: proposal.canonicalConceptId! },
    });
    const rev2 = await prisma.canonicalConceptRevision.findUniqueOrThrow({
      where: { id: mu.resultingRevisionId! },
    });
    expect(rev2.version).toBe(2);
    expect(rev2.summary).toBe(REVISION_TWO);
    expect(concept.currentRevisionId).toBe(rev2.id);
  });

  it("11. legacy proposal remains legacy after gate enabled", async () => {
    clearCanonicalGateEnv();
    const { umc, proposal } = await createProposal({ afterSummary: REVISION_TWO });
    expect(proposal.authorityMode).toBe(ExploreMovementAuthorityMode.legacy);
    enableCanonicalGateFor(userId);
    const published = await publishExploreMovementProposal({
      userId,
      proposalId: proposal.id,
      db: prisma,
    });
    expect(published).toMatchObject({ status: "published" });
    if (typeof published === "string") throw new Error("expected publish ok");
    const mu = await prisma.modelUpdate.findUniqueOrThrow({
      where: { id: published.modelUpdateId },
    });
    expect(mu.canonicalConceptId).toBeNull();
    expect(mu.affectedObjectId).toBe(umc.id);
  });

  it("12-28. Phase 6 fixture: publish rev2, mutate UMC, identity + AI + isolation + handoff no-write", async () => {
    enableCanonicalGateFor(userId);
    // Seed with REVISION ONE as UMC summary so registration creates rev1 = REVISION ONE
    const { umc, proposal } = await createProposal({
      afterSummary: REVISION_TWO,
      umcSummary: REVISION_ONE,
      umcTitle: LEGACY_SEED_TITLE,
    });
    expect(proposal.authorityMode).toBe(ExploreMovementAuthorityMode.canonical_v1);

    const published = await publishExploreMovementProposal({
      userId,
      proposalId: proposal.id,
      db: prisma,
    });
    expect(published).toMatchObject({ status: "published", idempotent: false });
    if (typeof published === "string") throw new Error("expected publish ok");

    const muRow = await prisma.modelUpdate.findUniqueOrThrow({
      where: { id: published.modelUpdateId },
    });
    const conceptId = proposal.canonicalConceptId!;
    const previousRevisionId = muRow.previousRevisionId!;
    const resultingRevisionId = muRow.resultingRevisionId!;
    const modelUpdateId = published.modelUpdateId;

    const rev1 = await prisma.canonicalConceptRevision.findUniqueOrThrow({
      where: { id: previousRevisionId },
    });
    const rev2 = await prisma.canonicalConceptRevision.findUniqueOrThrow({
      where: { id: resultingRevisionId },
    });
    expect(rev1.version).toBe(1);
    expect(rev1.summary).toBe(REVISION_ONE);
    expect(rev2.version).toBe(2);
    expect(rev2.summary).toBe(REVISION_TWO);

    await prisma.userMapConclusion.update({
      where: { id: umc.id },
      data: { title: MUTATED_LEGACY, summary: MUTATED_LEGACY },
    });

    // Gate-off history visibility
    clearCanonicalGateEnv();
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "0";

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
    expect(canonical.summary).toBe(REVISION_TWO);
    expect(canonical.summary).not.toBe(MUTATED_LEGACY);
    expect(canonical.summary).not.toBe(REVISION_ONE);
    expect(
      product.items.some(
        (item) =>
          item.authorityType === "legacy_unregistered_usermap_conclusion" &&
          item.id === umc.id,
      ),
    ).toBe(false);

    const envelopeImmediate = extractCanonicalIdentityEnvelope(canonical);
    const detail = await readCanonicalProductConceptForUser({
      userId,
      conceptId,
      db: prisma,
    });
    expect(detail).not.toBe("not_found");
    if (detail === "not_found") return;
    assertCanonicalIdentityEnvelopeEqual(
      envelopeImmediate,
      extractCanonicalIdentityEnvelope(detail),
    );

    const phase4 = await readCanonicalConceptProjection({
      userId,
      conceptId,
      db: prisma,
    });
    expect(phase4).not.toBe("not_found");
    if (phase4 === "not_found") return;
    assertCanonicalIdentityEnvelopeEqual(
      envelopeImmediate,
      extractCanonicalIdentityEnvelope(toCanonicalProductConceptV1(phase4)),
    );

    const movement = extractCanonicalMovementIdentityEnvelope(
      canonical,
      modelUpdateId,
    );
    expect(movement).toEqual({
      modelUpdateId,
      proposalId: proposal.id,
      previousRevisionId,
      resultingRevisionId,
      beforeSummary: REVISION_ONE,
      afterSummary: REVISION_TWO,
    });

    const { items: movements } = await readCanonicalAndLegacyMovementList({
      userId,
      db: prisma,
      limit: 50,
    });
    expect(
      movements.filter((row) => row.id === modelUpdateId),
    ).toHaveLength(1);

    const whatChanged = await buildWhatChangedInspectorDetail({
      userId,
      modelUpdateId,
      db: prisma as never,
    });
    expect(whatChanged).not.toBeNull();
    if (whatChanged) {
      expect(whatChanged.report.modelMovement.before).toBe(REVISION_ONE);
      expect(whatChanged.report.modelMovement.after).toBe(REVISION_TWO);
    }

    // AI request-path assembly (same order as /api/message — before reference memory)
    enableCanonicalAiRequestCaptureForTests();
    const model = await readCanonicalModelProjection({ userId, db: prisma });
    const productConcepts = model.concepts.map((concept) =>
      toCanonicalProductAuthoritySnapshotV1(concept),
    );
    const block = buildCanonicalModelPromptBlock({ projection: model });
    recordCanonicalAiRequestCapture({
      conceptIds: productConcepts.map((c) => c.conceptId),
      currentRevisionIds: productConcepts.map((c) => c.currentRevisionId),
      versions: productConcepts.map((c) => c.version),
      summaries: productConcepts.map((c) => c.summary),
      blockChars: block.length,
      assembledBeforeReferenceMemory: true,
      correlationId: "phase6-e2e-unit",
    });
    const capture = getCanonicalAiRequestCaptureForTests();
    expect(capture).not.toBeNull();
    expect(capture?.correlationId).toBe("phase6-e2e-unit");
    expect(capture?.conceptIds).toContain(conceptId);
    expect(capture?.currentRevisionIds).toContain(resultingRevisionId);
    expect(capture?.versions).toContain(2);
    expect(capture?.summaries).toContain(REVISION_TWO);
    expect(capture?.summaries).not.toContain(MUTATED_LEGACY);
    expect(capture?.canonicalBlockBeforeReferenceMemory).toBe(true);
    expect(capture?.canonicalBlockBeforeContradictions).toBe(true);
    expect(capture?.canonicalBlockBeforeTranscript).toBe(true);
    expect(block).toContain(REVISION_TWO);
    expect(block).not.toContain(MUTATED_LEGACY);
    expect(block).not.toContain("registrationSnapshotHash");
    expect(block).not.toContain("internalNotes");

    // Correction handoff no-write
    const beforeConcepts = await prisma.canonicalConcept.count({
      where: { userId },
    });
    const beforeRevisions = await prisma.canonicalConceptRevision.count({
      where: { concept: { userId } },
    });
    const handoff = buildCanonicalCorrectionHandoffFromProductConcept(canonical);
    expect(handoff.conceptId).toBe(conceptId);
    expect(handoff.currentRevisionId).toBe(resultingRevisionId);
    expect(await prisma.canonicalConcept.count({ where: { userId } })).toBe(
      beforeConcepts,
    );
    expect(
      await prisma.canonicalConceptRevision.count({
        where: { concept: { userId } },
      }),
    ).toBe(beforeRevisions);

    // Cross-user isolation
    const foreign = await readCanonicalProductConceptForUser({
      userId: otherUserId,
      conceptId,
      db: prisma,
    });
    expect(foreign).toBe("not_found");

    // Identity envelope deep equality after "gate disabled" re-read
    const productAgain = await readCurrentUnderstandingProductProjection({
      userId,
      db: prisma,
    });
    const canonicalAgain = productAgain.items.find(
      (item) => item.authorityType === "canonical_concept_revision",
    );
    expect(canonicalAgain).toBeDefined();
    if (
      !canonicalAgain ||
      canonicalAgain.authorityType !== "canonical_concept_revision"
    ) {
      return;
    }
    assertCanonicalIdentityEnvelopeEqual(
      envelopeImmediate,
      extractCanonicalIdentityEnvelope(canonicalAgain),
    );
    const movementAgain = extractCanonicalMovementIdentityEnvelope(
      canonicalAgain,
      modelUpdateId,
    );
    expect(movementAgain).not.toBeNull();
    if (!movementAgain || !movement) return;
    assertCanonicalMovementIdentityEqual(movement, movementAgain);
  });

  it("24. read-only projection creates no authority writes", async () => {
    enableCanonicalGateFor(userId);
    const { proposal } = await createProposal({
      afterSummary: REVISION_TWO,
      umcSummary: REVISION_ONE,
    });
    await publishExploreMovementProposal({
      userId,
      proposalId: proposal.id,
      db: prisma,
    });
    clearCanonicalGateEnv();

    const before = {
      concepts: await prisma.canonicalConcept.count({ where: { userId } }),
      revisions: await prisma.canonicalConceptRevision.count({
        where: { concept: { userId } },
      }),
      proposals: await prisma.exploreMovementProposal.count({ where: { userId } }),
      updates: await prisma.modelUpdate.count({ where: { userId } }),
      umcs: await prisma.userMapConclusion.count({ where: { userId } }),
    };

    await readCurrentUnderstandingProductProjection({ userId, db: prisma });
    await readCanonicalModelProjection({ userId, db: prisma });
    await readCanonicalAndLegacyMovementList({ userId, db: prisma, limit: 20 });
    if (proposal.canonicalConceptId) {
      await readCanonicalProductConceptForUser({
        userId,
        conceptId: proposal.canonicalConceptId,
        db: prisma,
      });
    }

    expect(await prisma.canonicalConcept.count({ where: { userId } })).toBe(
      before.concepts,
    );
    expect(
      await prisma.canonicalConceptRevision.count({
        where: { concept: { userId } },
      }),
    ).toBe(before.revisions);
    expect(
      await prisma.exploreMovementProposal.count({ where: { userId } }),
    ).toBe(before.proposals);
    expect(await prisma.modelUpdate.count({ where: { userId } })).toBe(
      before.updates,
    );
    expect(await prisma.userMapConclusion.count({ where: { userId } })).toBe(
      before.umcs,
    );
  });
});
