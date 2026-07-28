/**
 * Canonical concept registration — isolated DB proofs.
 *
 * Skipped unless CANONICAL_AUTHORITY_DB_TEST_URL passes the isolated-name gate.
 */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PrismaClient,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
  CanonicalRevisionOperation,
  CanonicalRevisionDecisionSource,
  CanonicalConceptSourceType,
  CanonicalConceptBindingRole,
  CanonicalConceptLifecycleStatus,
} from "@prisma/client";

import {
  isCanonicalModelAuthorityError,
  type CanonicalModelAuthorityError,
} from "../canonical-model-authority-errors";
import { resolveOrRegisterCanonicalConceptFromUserMapConclusion } from "../canonical-concept-registration";
import { buildLegacyUserMapConclusionRegistrationKey } from "../canonical-domain-mappings";
import { deriveCanonicalUmcSnapshotHash } from "../canonical-umc-snapshot-hash";

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

describe("canonical concept registration — URL safety", () => {
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
  "canonical concept registration — database",
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
      // Avoid shared-DB TRUNCATE while other canonical suites may still be running.
      // Revision immutability also blocks row DELETE; suites use unique user IDs.
      await prisma.$disconnect();
    });

    async function createUmc(args?: {
      userId?: string;
      title?: string;
      summary?: string;
      status?: UserMapConclusionStatus;
      confidenceScore?: number;
    }) {
      return prisma.userMapConclusion.create({
        data: {
          userId: args?.userId ?? userId,
          area: UserMapConclusionArea.operating_logic,
          status: args?.status ?? UserMapConclusionStatus.emerging,
          visibility: UserMapConclusionVisibility.user_visible,
          title: args?.title ?? "Working title",
          summary: args?.summary ?? "Working summary about conflict.",
          confidenceScore: args?.confidenceScore ?? 0.55,
          confidenceLevel: UserMapConfidenceLevel.medium,
        },
      });
    }

    function hashFor(umc: {
      id: string;
      title: string;
      summary: string;
      status: UserMapConclusionStatus;
      confidenceScore: number;
      confidenceLevel: UserMapConfidenceLevel;
      updatedAt: Date;
    }) {
      return deriveCanonicalUmcSnapshotHash({
        id: umc.id,
        title: umc.title,
        summary: umc.summary,
        status: umc.status,
        confidenceScore: umc.confidenceScore,
        confidenceLevel: umc.confidenceLevel,
        updatedAt: umc.updatedAt,
      });
    }

    async function register(args: {
      umcId: string;
      expectedHash: string;
      asUserId?: string;
    }) {
      return prisma.$transaction(async (tx) =>
        resolveOrRegisterCanonicalConceptFromUserMapConclusion({
          userId: args.asUserId ?? userId,
          userMapConclusionId: args.umcId,
          expectedLegacySnapshotHash: args.expectedHash,
          tx: tx as never,
        }),
      );
    }

    it("first registration creates exactly one concept and revision 1", async () => {
      const umc = await createUmc();
      const result = await register({
        umcId: umc.id,
        expectedHash: hashFor(umc),
      });
      expect(result.registered).toBe(true);
      expect(result.revisionVersion).toBe(1);

      const concepts = await prisma.canonicalConcept.findMany({
        where: { userId },
      });
      const revisions = await prisma.canonicalConceptRevision.findMany({
        where: { userId, conceptId: result.conceptId },
      });
      expect(concepts).toHaveLength(1);
      expect(revisions).toHaveLength(1);
      expect(revisions[0]?.version).toBe(1);
      expect(revisions[0]?.operation).toBe(
        CanonicalRevisionOperation.registered,
      );
      expect(revisions[0]?.decisionSource).toBe(
        CanonicalRevisionDecisionSource.legacy_registration,
      );
    });

    it("revision 1 stores final evidence count at insert and links are owned", async () => {
      const umc = await createUmc({ title: "With evidence" });
      const journal = await prisma.journalEntry.create({
        data: {
          id: id("journal"),
          userId,
          title: "J",
          body: "owned journal",
        },
      });
      await prisma.understandingEvidenceLink.create({
        data: {
          userId,
          targetType: UnderstandingLinkTargetType.usermap_conclusion,
          targetId: umc.id,
          sourceType: UnderstandingLinkSourceType.journal_entry,
          sourceId: journal.id,
          role: UnderstandingLinkRole.supports,
          summary: "supports",
          snippet: "owned journal",
          quote: "owned journal",
        },
      });
      await prisma.understandingEvidenceLink.create({
        data: {
          userId,
          targetType: UnderstandingLinkTargetType.usermap_conclusion,
          targetId: umc.id,
          sourceType: UnderstandingLinkSourceType.journal_entry,
          sourceId: journal.id,
          role: UnderstandingLinkRole.context,
          summary: "context",
          snippet: "ctx",
          quote: "ctx",
        },
      });

      const result = await register({
        umcId: umc.id,
        expectedHash: hashFor(umc),
      });
      const revision = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: result.currentRevisionId },
      });
      expect(revision.evidenceCount).toBe(1);

      const links = await prisma.understandingEvidenceLink.findMany({
        where: {
          userId,
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: revision.id,
        },
      });
      expect(links).toHaveLength(2);
      expect(
        links.every((link) => link.sourceId === journal.id),
      ).toBe(true);
    });

    it("no evidence produces count zero", async () => {
      const umc = await createUmc({ title: "No evidence" });
      const result = await register({
        umcId: umc.id,
        expectedHash: hashFor(umc),
      });
      const revision = await prisma.canonicalConceptRevision.findUniqueOrThrow({
        where: { id: result.currentRevisionId },
      });
      expect(revision.evidenceCount).toBe(0);
      const links = await prisma.understandingEvidenceLink.findMany({
        where: {
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: revision.id,
        },
      });
      expect(links).toHaveLength(0);
    });

    it("repeated registration returns the same concept/revision", async () => {
      const umc = await createUmc({ title: "Idempotent" });
      const hash = hashFor(umc);
      const first = await register({ umcId: umc.id, expectedHash: hash });
      const second = await register({ umcId: umc.id, expectedHash: hash });
      expect(second.registered).toBe(false);
      expect(second.conceptId).toBe(first.conceptId);
      expect(second.currentRevisionId).toBe(first.currentRevisionId);
      expect(
        await prisma.canonicalConceptRevision.count({
          where: { conceptId: first.conceptId },
        }),
      ).toBe(1);
    });

    it("UMC hash drift returns STALE_CURRENT_REVISION", async () => {
      const umc = await createUmc({ title: "Drift" });
      await expectCode(
        () =>
          register({
            umcId: umc.id,
            expectedHash: "umc_snap_v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          }),
        "STALE_CURRENT_REVISION",
      );
    });

    it("existing concept at revision 2 returns STALE_CURRENT_REVISION", async () => {
      const umc = await createUmc({ title: "Already strengthened" });
      const hash = hashFor(umc);
      const first = await register({ umcId: umc.id, expectedHash: hash });

      const proposal = await prisma.exploreMovementProposal.create({
        data: {
          userId,
          conversationId: id("conv"),
          assistantMessageId: id("asst"),
          userMessageId: id("umsg"),
          status: "proposed",
          authorityMode: "canonical_v1",
          revisionOperation: "strengthen",
          expectedLegacySnapshotHash: hash,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: umc.id,
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
          conceptId: first.conceptId,
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
          previousRevisionId: first.currentRevisionId,
          createdFromProposalId: proposal.id,
        },
      });
      await prisma.canonicalConcept.update({
        where: { id: first.conceptId },
        data: { currentRevisionId: rev2.id },
      });

      await expectCode(
        () => register({ umcId: umc.id, expectedHash: hash }),
        "STALE_CURRENT_REVISION",
      );
    });

    it("broken binding/current pointer returns BROKEN_LEGACY_REGISTRATION", async () => {
      const umc = await createUmc({ title: "Broken pointer" });
      const hash = hashFor(umc);
      const first = await register({ umcId: umc.id, expectedHash: hash });

      // Break the current pointer while leaving the binding intact.
      await prisma.$executeRawUnsafe(
        `UPDATE "CanonicalConcept" SET "currentRevisionId" = NULL WHERE id = $1`,
        first.conceptId,
      );

      await expectCode(
        () => register({ umcId: umc.id, expectedHash: hash }),
        "BROKEN_LEGACY_REGISTRATION",
      );
    });

    it("binding role related_interpretation returns BROKEN_LEGACY_REGISTRATION", async () => {
      const umc = await createUmc({ title: "Wrong binding role" });
      const hash = hashFor(umc);
      await register({ umcId: umc.id, expectedHash: hash });

      await prisma.canonicalConceptSourceBinding.updateMany({
        where: {
          userId,
          sourceType: CanonicalConceptSourceType.usermap_conclusion,
          sourceId: umc.id,
        },
        data: {
          bindingRole: CanonicalConceptBindingRole.related_interpretation,
        },
      });

      await expectCode(
        () => register({ umcId: umc.id, expectedHash: hash }),
        "BROKEN_LEGACY_REGISTRATION",
      );
    });

    it("mismatched registrationKey returns BROKEN_LEGACY_REGISTRATION", async () => {
      const umc = await createUmc({ title: "Wrong registration key" });
      const hash = hashFor(umc);
      const first = await register({ umcId: umc.id, expectedHash: hash });

      await prisma.canonicalConcept.update({
        where: { id: first.conceptId },
        data: {
          registrationKey: `legacy:usermap_conclusion:${id("other_umc")}`,
        },
      });

      await expectCode(
        () => register({ umcId: umc.id, expectedHash: hash }),
        "BROKEN_LEGACY_REGISTRATION",
      );
    });

    it("documents that non-active lifecycle cannot be constructed in V1", () => {
      // CanonicalConceptLifecycleStatus currently only permits `active`.
      expect(Object.values(CanonicalConceptLifecycleStatus)).toEqual([
        "active",
      ]);
    });

    it("cross-user UMC cannot register", async () => {
      const umc = await createUmc({ userId: otherUserId, title: "Other user" });
      await expectCode(
        () =>
          register({
            umcId: umc.id,
            expectedHash: hashFor(umc),
            asUserId: userId,
          }),
        "WRONG_OWNER",
      );
    });

    it("two concurrent registration attempts create one concept and one revision", async () => {
      const umc = await createUmc({ title: "Concurrent" });
      const hash = hashFor(umc);

      const [a, b] = await Promise.all([
        register({ umcId: umc.id, expectedHash: hash }),
        register({ umcId: umc.id, expectedHash: hash }),
      ]);

      expect(new Set([a.conceptId, b.conceptId]).size).toBe(1);
      expect(new Set([a.currentRevisionId, b.currentRevisionId]).size).toBe(1);
      expect([a.registered, b.registered].filter(Boolean)).toHaveLength(1);
      expect(
        await prisma.canonicalConcept.count({
          where: {
            userId,
            registrationKey: buildLegacyUserMapConclusionRegistrationKey(
              umc.id,
            ),
          },
        }),
      ).toBe(1);
      expect(
        await prisma.canonicalConceptRevision.count({
          where: { conceptId: a.conceptId },
        }),
      ).toBe(1);
    });

    it("revision 1 is not updated after insertion", async () => {
      const umc = await createUmc({ title: "Immutable" });
      const result = await register({
        umcId: umc.id,
        expectedHash: hashFor(umc),
      });
      await expect(
        prisma.canonicalConceptRevision.update({
          where: { id: result.currentRevisionId },
          data: { summary: "mutated" },
        }),
      ).rejects.toThrow(/canonical_concept_revision_is_immutable/);
    });

    it("registration key and source binding are deterministic", async () => {
      const umc = await createUmc({ title: "Binding shape" });
      const result = await register({
        umcId: umc.id,
        expectedHash: hashFor(umc),
      });
      const concept = await prisma.canonicalConcept.findUniqueOrThrow({
        where: { id: result.conceptId },
      });
      expect(concept.registrationKey).toBe(
        buildLegacyUserMapConclusionRegistrationKey(umc.id),
      );
      const binding = await prisma.canonicalConceptSourceBinding.findFirstOrThrow(
        {
          where: {
            userId,
            sourceType: CanonicalConceptSourceType.usermap_conclusion,
            sourceId: umc.id,
          },
        },
      );
      expect(binding.conceptId).toBe(result.conceptId);
      expect(binding.bindingRole).toBe(CanonicalConceptBindingRole.legacy_seed);
    });
  },
);
