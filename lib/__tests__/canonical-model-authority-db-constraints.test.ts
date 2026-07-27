/**
 * Orvek Canonical Model Authority V1 — Phase 1 database constraint proofs.
 *
 * Skipped unless CANONICAL_AUTHORITY_DB_TEST_URL is set and names an isolated
 * local database containing `canonical_authority`. Never falls back to DATABASE_URL.
 */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";

export const CANONICAL_AUTHORITY_DB_TEST_URL_ENV =
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
    blockers.push(
      `database name must include "canonical_authority" (got "${dbName}")`,
    );
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
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function expectConstraintFailure(
  error: unknown,
  ...needles: string[]
): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String(error);
  return needles.some((needle) => message.includes(needle));
}

function isConstraintError(error: unknown, needle: string): boolean {
  return expectConstraintFailure(error, needle);
}

describe("Canonical Model Authority V1 — DB URL safety", () => {
  it("documents the isolated URL gate without executing against an unsafe DB", () => {
    if (!rawTestUrl) {
      expect(safety.ok).toBe(false);
      expect(safety.blockers.join(" ")).toMatch(/blank or missing/);
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
  "Canonical Model Authority V1 — database constraints",
  () => {
    let prisma: PrismaClient;
    const userId = id("user");
    const otherUserId = id("other_user");

    beforeAll(async () => {
      execFileSync(
        "npx",
        ["prisma", "migrate", "deploy"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: rawTestUrl,
          },
          stdio: "pipe",
        },
      );

      prisma = new PrismaClient({
        datasources: { db: { url: rawTestUrl } },
      });
      await prisma.$connect();
    }, 120_000);

    afterAll(async () => {
      if (!prisma) return;
      // Isolated-DB cleanup only. TRUNCATE bypasses DELETE triggers, so the
      // production revision immutability trigger can stay armed.
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          "UnderstandingEvidenceLink",
          "ModelUpdate",
          "CanonicalConceptSourceBinding",
          "CanonicalConceptRevision",
          "CanonicalConcept",
          "ExploreMovementProposal"
        CASCADE
      `);
      await prisma.$disconnect();
    });

    async function insertLegacyProposal(proposalId: string) {
      await prisma.exploreMovementProposal.create({
        data: {
          id: proposalId,
          userId,
          conversationId: id("conv"),
          assistantMessageId: id("asst"),
          userMessageId: id("umsg"),
          status: "proposed",
          authorityMode: "legacy",
          affectedObjectType: "usermap_conclusion",
          affectedObjectId: id("umc"),
          beforeSummary: "before",
          afterSummary: "after",
          rationale: "reason",
          userFacingSummary: "summary",
          sourcesJson: [],
        },
      });
    }

    async function insertCanonicalProposal(args: {
      proposalId: string;
      expectedCurrentRevisionId?: string | null;
      expectedLegacySnapshotHash?: string | null;
      canonicalConceptId?: string | null;
    }) {
      await prisma.exploreMovementProposal.create({
        data: {
          id: args.proposalId,
          userId,
          conversationId: id("conv"),
          assistantMessageId: id("asst"),
          userMessageId: id("umsg"),
          status: "proposed",
          authorityMode: "canonical_v1",
          revisionOperation: "strengthen",
          affectedObjectType: "usermap_conclusion",
          affectedObjectId: id("umc"),
          beforeSummary: "before",
          afterSummary: "after",
          rationale: "reason",
          userFacingSummary: "summary",
          sourcesJson: [],
          expectedCurrentRevisionId: args.expectedCurrentRevisionId ?? null,
          expectedLegacySnapshotHash: args.expectedLegacySnapshotHash ?? null,
          canonicalConceptId: args.canonicalConceptId ?? null,
        },
      });
    }

    async function insertConcept(conceptId: string, registrationKey: string) {
      await prisma.canonicalConcept.create({
        data: {
          id: conceptId,
          userId,
          registrationKey,
          domain: "unknown",
          lifecycleStatus: "active",
        },
      });
    }

    async function insertRegisteredRevision(args: {
      revisionId: string;
      conceptId: string;
      snapshotHash: string;
    }) {
      await prisma.canonicalConceptRevision.create({
        data: {
          id: args.revisionId,
          userId,
          conceptId: args.conceptId,
          version: 1,
          title: "Title",
          summary: "Summary",
          status: "emerging",
          confidenceScore: 0.5,
          confidenceLevel: "medium",
          evidenceCount: 0,
          operation: "registered",
          decisionSource: "legacy_registration",
          acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
          registrationSnapshotHash: args.snapshotHash,
        },
      });
    }

    it("accepts existing-style legacy proposals", async () => {
      const proposalId = id("prop_legacy_ok");
      await insertLegacyProposal(proposalId);
      const row = await prisma.exploreMovementProposal.findUniqueOrThrow({
        where: { id: proposalId },
      });
      expect(row.authorityMode).toBe("legacy");
      expect(row.canonicalConceptId).toBeNull();
      expect(row.revisionOperation).toBeNull();
    });

    it("rejects malformed proposal authority-mode combinations", async () => {
      await expect(
        prisma.exploreMovementProposal.create({
          data: {
            id: id("prop_bad_mode"),
            userId,
            conversationId: id("conv"),
            assistantMessageId: id("asst"),
            userMessageId: id("umsg"),
            status: "proposed",
            authorityMode: "legacy",
            revisionOperation: "strengthen",
            affectedObjectType: "usermap_conclusion",
            affectedObjectId: id("umc"),
            beforeSummary: "before",
            afterSummary: "after",
            rationale: "reason",
            userFacingSummary: "summary",
            sourcesJson: [],
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "ExploreMovementProposal_authority_mode_check"),
      );

      await expect(
        prisma.exploreMovementProposal.create({
          data: {
            id: id("prop_mutex"),
            userId,
            conversationId: id("conv"),
            assistantMessageId: id("asst"),
            userMessageId: id("umsg"),
            status: "proposed",
            authorityMode: "canonical_v1",
            revisionOperation: "strengthen",
            expectedCurrentRevisionId: id("rev"),
            expectedLegacySnapshotHash: "umc_snap_v1:deadbeef",
            canonicalConceptId: id("concept"),
            affectedObjectType: "usermap_conclusion",
            affectedObjectId: id("umc"),
            beforeSummary: "before",
            afterSummary: "after",
            rationale: "reason",
            userFacingSummary: "summary",
            sourcesJson: [],
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "ExploreMovementProposal_expectation_mutex_check") ||
        isConstraintError(error, "ExploreMovementProposal_authority_mode_check") ||
        error instanceof Prisma.PrismaClientKnownRequestError,
      );
    });

    it("rejects cross-concept current revision pointers", async () => {
      const conceptA = id("concept_a");
      const conceptB = id("concept_b");
      const revB = id("rev_b");
      await insertConcept(conceptA, `legacy:usermap_conclusion:${id("umc_a")}`);
      await insertConcept(conceptB, `legacy:usermap_conclusion:${id("umc_b")}`);
      await insertRegisteredRevision({
        revisionId: revB,
        conceptId: conceptB,
        snapshotHash: "umc_snap_v1:bbbb",
      });

      await expect(
        prisma.canonicalConcept.update({
          where: { id: conceptA },
          data: { currentRevisionId: revB },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003",
      );
    });

    it("rejects cross-concept previous revision lineage", async () => {
      const conceptA = id("concept_line_a");
      const conceptB = id("concept_line_b");
      const revA = id("rev_line_a");
      const proposalId = id("prop_line");
      await insertConcept(conceptA, `legacy:usermap_conclusion:${id("umc_la")}`);
      await insertConcept(conceptB, `legacy:usermap_conclusion:${id("umc_lb")}`);
      await insertRegisteredRevision({
        revisionId: revA,
        conceptId: conceptA,
        snapshotHash: "umc_snap_v1:aaaa",
      });
      await insertCanonicalProposal({
        proposalId,
        expectedLegacySnapshotHash: "umc_snap_v1:aaaa",
      });

      await expect(
        prisma.canonicalConceptRevision.create({
          data: {
            id: id("rev_cross"),
            userId,
            conceptId: conceptB,
            version: 2,
            title: "Title",
            summary: "Summary",
            status: "emerging",
            confidenceScore: 0.5,
            confidenceLevel: "medium",
            evidenceCount: 1,
            operation: "strengthen",
            decisionSource: "explore_proposal",
            acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
            previousRevisionId: revA,
            createdFromProposalId: proposalId,
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003",
      );
    });

    it("rejects cross-user revision / proposal / ModelUpdate relations", async () => {
      const conceptId = id("concept_xuser");
      const revId = id("rev_xuser");
      await prisma.canonicalConcept.create({
        data: {
          id: conceptId,
          userId: otherUserId,
          registrationKey: `legacy:usermap_conclusion:${id("umc_x")}`,
        },
      });

      await expect(
        prisma.canonicalConceptRevision.create({
          data: {
            id: revId,
            userId,
            conceptId,
            version: 1,
            title: "Title",
            summary: "Summary",
            status: "emerging",
            confidenceScore: 0.4,
            confidenceLevel: "low",
            evidenceCount: 0,
            operation: "registered",
            decisionSource: "legacy_registration",
            acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
            registrationSnapshotHash: "umc_snap_v1:xuser",
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003",
      );
    });

    it("rejects revision UPDATE and DELETE", async () => {
      const conceptId = id("concept_imm");
      const revId = id("rev_imm");
      await insertConcept(conceptId, `legacy:usermap_conclusion:${id("umc_imm")}`);
      await insertRegisteredRevision({
        revisionId: revId,
        conceptId,
        snapshotHash: "umc_snap_v1:imm",
      });

      await expect(
        prisma.canonicalConceptRevision.update({
          where: { id: revId },
          data: { summary: "mutated" },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "canonical_concept_revision_is_immutable"),
      );

      await expect(
        prisma.canonicalConceptRevision.delete({ where: { id: revId } }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "canonical_concept_revision_is_immutable"),
      );
    });

    it("rejects malformed registered and strengthen revisions", async () => {
      const conceptId = id("concept_shape");
      const proposalId = id("prop_shape");
      await insertConcept(conceptId, `legacy:usermap_conclusion:${id("umc_shape")}`);
      await insertCanonicalProposal({
        proposalId,
        expectedLegacySnapshotHash: "umc_snap_v1:shape",
      });

      await expect(
        prisma.canonicalConceptRevision.create({
          data: {
            id: id("rev_bad_reg"),
            userId,
            conceptId,
            version: 1,
            title: "Title",
            summary: "Summary",
            status: "emerging",
            confidenceScore: 0.5,
            confidenceLevel: "medium",
            evidenceCount: 0,
            operation: "registered",
            decisionSource: "legacy_registration",
            acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
            registrationSnapshotHash: null,
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "CanonicalConceptRevision_shape_v1_check"),
      );

      const rev1 = id("rev_shape_1");
      await insertRegisteredRevision({
        revisionId: rev1,
        conceptId,
        snapshotHash: "umc_snap_v1:shape1",
      });

      await expect(
        prisma.canonicalConceptRevision.create({
          data: {
            id: id("rev_bad_str"),
            userId,
            conceptId,
            version: 2,
            title: "Title",
            summary: "Summary",
            status: "emerging",
            confidenceScore: 0.5,
            confidenceLevel: "medium",
            evidenceCount: 1,
            operation: "strengthen",
            decisionSource: "explore_proposal",
            acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
            previousRevisionId: rev1,
            createdFromProposalId: proposalId,
            registrationSnapshotHash: "should_be_null",
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "CanonicalConceptRevision_shape_v1_check"),
      );
    });

    it("rejects negative evidenceCount and confidence outside [0,1]", async () => {
      const conceptId = id("concept_num");
      await insertConcept(conceptId, `legacy:usermap_conclusion:${id("umc_num")}`);

      await expect(
        prisma.canonicalConceptRevision.create({
          data: {
            id: id("rev_neg_ev"),
            userId,
            conceptId,
            version: 1,
            title: "Title",
            summary: "Summary",
            status: "emerging",
            confidenceScore: 0.5,
            confidenceLevel: "medium",
            evidenceCount: -1,
            operation: "registered",
            decisionSource: "legacy_registration",
            acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
            registrationSnapshotHash: "umc_snap_v1:neg",
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(
          error,
          "CanonicalConceptRevision_evidenceCount_nonneg_check",
        ),
      );

      await expect(
        prisma.canonicalConceptRevision.create({
          data: {
            id: id("rev_conf_hi"),
            userId,
            conceptId,
            version: 1,
            title: "Title",
            summary: "Summary",
            status: "emerging",
            confidenceScore: 1.5,
            confidenceLevel: "high",
            evidenceCount: 0,
            operation: "registered",
            decisionSource: "legacy_registration",
            acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
            registrationSnapshotHash: "umc_snap_v1:conf",
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(
          error,
          "CanonicalConceptRevision_confidenceScore_range_check",
        ),
      );
    });

    it("rejects canonical ModelUpdate referencing a legacy proposal", async () => {
      const conceptId = id("concept_mu_legacy");
      const rev1 = id("rev_mu_legacy_1");
      const rev2 = id("rev_mu_legacy_2");
      const legacyProposalId = id("prop_mu_legacy");
      const canonicalProposalId = id("prop_mu_canon_for_rev");

      await insertConcept(conceptId, `legacy:usermap_conclusion:${id("umc_mul")}`);
      await insertRegisteredRevision({
        revisionId: rev1,
        conceptId,
        snapshotHash: "umc_snap_v1:mul1",
      });
      await insertLegacyProposal(legacyProposalId);
      await insertCanonicalProposal({
        proposalId: canonicalProposalId,
        expectedCurrentRevisionId: rev1,
        canonicalConceptId: conceptId,
      });
      await prisma.canonicalConcept.update({
        where: { id: conceptId },
        data: { currentRevisionId: rev1 },
      });
      await prisma.canonicalConceptRevision.create({
        data: {
          id: rev2,
          userId,
          conceptId,
          version: 2,
          title: "Title",
          summary: "Summary 2",
          status: "emerging",
          confidenceScore: 0.5,
          confidenceLevel: "medium",
          evidenceCount: 1,
          operation: "strengthen",
          decisionSource: "explore_proposal",
          acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
          previousRevisionId: rev1,
          createdFromProposalId: canonicalProposalId,
        },
      });

      await expect(
        prisma.modelUpdate.create({
          data: {
            id: id("mu_legacy_reject"),
            userId,
            updateType: "conclusion_strengthened",
            visibility: "user_visible",
            affectedObjectType: "canonical_concept_revision",
            affectedObjectId: rev2,
            userFacingSummary: "move",
            isMeaningful: true,
            canonicalConceptId: conceptId,
            previousRevisionId: rev1,
            resultingRevisionId: rev2,
            exploreProposalId: legacyProposalId,
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "model_update_explore_proposal_not_canonical"),
      );
    });

    it("rejects non-adjacent ModelUpdate revision lineage", async () => {
      const conceptId = id("concept_mu_adj");
      const rev1 = id("rev_mu_adj_1");
      const revJump = id("rev_mu_adj_jump");
      const proposalJump = id("prop_mu_adj_jump");

      await insertConcept(conceptId, `legacy:usermap_conclusion:${id("umc_adj")}`);
      await insertRegisteredRevision({
        revisionId: rev1,
        conceptId,
        snapshotHash: "umc_snap_v1:adj1",
      });
      await prisma.canonicalConcept.update({
        where: { id: conceptId },
        data: { currentRevisionId: rev1 },
      });
      await insertCanonicalProposal({
        proposalId: proposalJump,
        expectedCurrentRevisionId: rev1,
        canonicalConceptId: conceptId,
      });
      // Shape-valid strengthen row that skips version adjacency (v1 -> v3).
      await prisma.canonicalConceptRevision.create({
        data: {
          id: revJump,
          userId,
          conceptId,
          version: 3,
          title: "Title",
          summary: "Summary jump",
          status: "emerging",
          confidenceScore: 0.5,
          confidenceLevel: "medium",
          evidenceCount: 1,
          operation: "strengthen",
          decisionSource: "explore_proposal",
          acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
          previousRevisionId: rev1,
          createdFromProposalId: proposalJump,
        },
      });

      await expect(
        prisma.modelUpdate.create({
          data: {
            id: id("mu_non_adj"),
            userId,
            updateType: "conclusion_strengthened",
            visibility: "user_visible",
            affectedObjectType: "canonical_concept_revision",
            affectedObjectId: revJump,
            userFacingSummary: "move",
            isMeaningful: true,
            canonicalConceptId: conceptId,
            previousRevisionId: rev1,
            resultingRevisionId: revJump,
            exploreProposalId: proposalJump,
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "model_update_non_adjacent_versions"),
      );
    });

    it("rejects ModelUpdate referencing a revision produced by another proposal", async () => {
      const conceptId = id("concept_mu_prop");
      const rev1 = id("rev_mu_prop_1");
      const rev2 = id("rev_mu_prop_2");
      const producerProposal = id("prop_mu_producer");
      const otherProposal = id("prop_mu_other");

      await insertConcept(conceptId, `legacy:usermap_conclusion:${id("umc_prop")}`);
      await insertRegisteredRevision({
        revisionId: rev1,
        conceptId,
        snapshotHash: "umc_snap_v1:prop1",
      });
      await prisma.canonicalConcept.update({
        where: { id: conceptId },
        data: { currentRevisionId: rev1 },
      });
      await insertCanonicalProposal({
        proposalId: producerProposal,
        expectedCurrentRevisionId: rev1,
        canonicalConceptId: conceptId,
      });
      await insertCanonicalProposal({
        proposalId: otherProposal,
        expectedCurrentRevisionId: rev1,
        canonicalConceptId: conceptId,
      });
      await prisma.canonicalConceptRevision.create({
        data: {
          id: rev2,
          userId,
          conceptId,
          version: 2,
          title: "Title",
          summary: "Summary 2",
          status: "emerging",
          confidenceScore: 0.5,
          confidenceLevel: "medium",
          evidenceCount: 1,
          operation: "strengthen",
          decisionSource: "explore_proposal",
          acceptedAt: new Date("2026-07-27T00:00:00.000Z"),
          previousRevisionId: rev1,
          createdFromProposalId: producerProposal,
        },
      });

      await expect(
        prisma.modelUpdate.create({
          data: {
            id: id("mu_wrong_prop"),
            userId,
            updateType: "conclusion_strengthened",
            visibility: "user_visible",
            affectedObjectType: "canonical_concept_revision",
            affectedObjectId: rev2,
            userFacingSummary: "move",
            isMeaningful: true,
            canonicalConceptId: conceptId,
            previousRevisionId: rev1,
            resultingRevisionId: rev2,
            exploreProposalId: otherProposal,
          },
        }),
      ).rejects.toSatisfy((error: unknown) =>
        isConstraintError(error, "model_update_resulting_proposal_mismatch"),
      );
    });
  },
);
