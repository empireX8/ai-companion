/**
 * Lazy UserMapConclusion → CanonicalConcept registration (revision 1).
 *
 * Must be invoked inside an existing interactive Prisma transaction.
 * Does not open its own transaction.
 */

import {
  CanonicalConceptBindingRole,
  CanonicalConceptLifecycleStatus,
  CanonicalConceptSourceType,
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import {
  buildLegacyUserMapConclusionRegistrationKey,
  mapUserMapAreaToCanonicalDomain,
  mapUserMapStatusToCanonicalRevisionStatus,
  requireCandidateLifecycleStatusOrNull,
  requireUserMapConclusionStatus,
  requireUserMapConclusionVisibility,
  requireUserMapConfidenceLevel,
} from "./canonical-domain-mappings";
import {
  prepareCanonicalRegistrationEvidence,
  type CanonicalRevisionEvidenceDb,
  type PreparedCanonicalRevisionEvidence,
} from "./canonical-revision-evidence";
import { deriveCanonicalUmcSnapshotHash } from "./canonical-umc-snapshot-hash";
import { isQualifyingExploreUserMapConclusion } from "./explore-movement-semantic-adjudicator";
import {
  createUnderstandingEvidenceLinkForUser,
  type UnderstandingEvidenceLinkWriterDb,
} from "./understanding-evidence-link-writer";

export type CanonicalAuthorityTransactionClient = Omit<
  CanonicalRevisionEvidenceDb,
  | "userMapConclusion"
  | "canonicalConceptRevision"
  | "understandingEvidenceLink"
> & {
  userMapConclusion: PrismaClient["userMapConclusion"];
  canonicalConcept: PrismaClient["canonicalConcept"];
  canonicalConceptRevision: PrismaClient["canonicalConceptRevision"];
  canonicalConceptSourceBinding: PrismaClient["canonicalConceptSourceBinding"];
  understandingEvidenceLink: PrismaClient["understandingEvidenceLink"];
  $queryRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

export type ResolveOrRegisterCanonicalConceptResult = {
  conceptId: string;
  currentRevisionId: string;
  revisionVersion: number;
  registered: boolean;
};

type LockedUserMapConclusionRawRow = {
  id: string;
  userId: string;
  area: unknown;
  status: unknown;
  visibility: unknown;
  candidateLifecycleStatus: unknown;
  title: string;
  summary: string;
  confidenceScore: unknown;
  confidenceLevel: unknown;
  supersededById: string | null;
  updatedAt: Date;
};

type ParsedLockedUserMapConclusion = {
  id: string;
  userId: string;
  area: string;
  status: ReturnType<typeof requireUserMapConclusionStatus>;
  visibility: ReturnType<typeof requireUserMapConclusionVisibility>;
  candidateLifecycleStatus: ReturnType<
    typeof requireCandidateLifecycleStatusOrNull
  >;
  title: string;
  summary: string;
  confidenceScore: number;
  confidenceLevel: ReturnType<typeof requireUserMapConfidenceLevel>;
  supersededById: string | null;
  updatedAt: Date;
};

function parseLockedUserMapConclusion(
  raw: LockedUserMapConclusionRawRow,
): ParsedLockedUserMapConclusion {
  return {
    id: raw.id,
    userId: raw.userId,
    area: typeof raw.area === "string" ? raw.area : String(raw.area),
    status: requireUserMapConclusionStatus(raw.status),
    visibility: requireUserMapConclusionVisibility(raw.visibility),
    candidateLifecycleStatus: requireCandidateLifecycleStatusOrNull(
      raw.candidateLifecycleStatus,
    ),
    title: raw.title,
    summary: raw.summary,
    confidenceScore: Number(raw.confidenceScore),
    confidenceLevel: requireUserMapConfidenceLevel(raw.confidenceLevel),
    supersededById: raw.supersededById,
    updatedAt: new Date(raw.updatedAt),
  };
}

async function lockOwnedUserMapConclusion(args: {
  tx: CanonicalAuthorityTransactionClient;
  userId: string;
  userMapConclusionId: string;
}): Promise<ParsedLockedUserMapConclusion> {
  // Narrow cast only at the Prisma raw-query boundary.
  const locked = (await args.tx.$queryRaw`
    SELECT
      id,
      "userId",
      area,
      status,
      visibility,
      "candidateLifecycleStatus",
      title,
      summary,
      "confidenceScore",
      "confidenceLevel",
      "supersededById",
      "updatedAt"
    FROM "UserMapConclusion"
    WHERE id = ${args.userMapConclusionId} AND "userId" = ${args.userId}
    FOR UPDATE
  `) as LockedUserMapConclusionRawRow[];

  if (locked[0]) {
    return parseLockedUserMapConclusion(locked[0]);
  }

  const any = await args.tx.userMapConclusion.findFirst({
    where: { id: args.userMapConclusionId },
    select: { id: true, userId: true },
  });
  if (!any) {
    throw new CanonicalModelAuthorityError(
      "NOT_FOUND",
      `UserMapConclusion not found: ${args.userMapConclusionId}`,
    );
  }
  throw new CanonicalModelAuthorityError(
    "WRONG_OWNER",
    `UserMapConclusion ownership mismatch: ${args.userMapConclusionId}`,
  );
}

async function insertPreparedEvidenceLinks(args: {
  tx: CanonicalAuthorityTransactionClient;
  userId: string;
  revisionId: string;
  evidence: PreparedCanonicalRevisionEvidence;
}): Promise<void> {
  for (const link of args.evidence.links) {
    await createUnderstandingEvidenceLinkForUser({
      userId: args.userId,
      // Writer Db uses EntityLookupModel; Prisma tx delegates are compatible at runtime.
      db: args.tx as unknown as UnderstandingEvidenceLinkWriterDb,
      input: {
        targetType: UnderstandingLinkTargetType.canonical_concept_revision,
        targetId: args.revisionId,
        sourceType: link.sourceType,
        sourceId: link.sourceId,
        role: link.role,
        summary: link.summary,
        snippet: link.snippet,
        quote: link.quote,
      },
    });
  }
}

export async function resolveOrRegisterCanonicalConceptFromUserMapConclusion(args: {
  userId: string;
  userMapConclusionId: string;
  expectedLegacySnapshotHash: string;
  tx: CanonicalAuthorityTransactionClient;
}): Promise<ResolveOrRegisterCanonicalConceptResult> {
  const umc = await lockOwnedUserMapConclusion({
    tx: args.tx,
    userId: args.userId,
    userMapConclusionId: args.userMapConclusionId,
  });

  if (
    !isQualifyingExploreUserMapConclusion({
      visibility: umc.visibility,
      status: umc.status,
      supersededById: umc.supersededById,
      candidateLifecycleStatus: umc.candidateLifecycleStatus,
      summary: umc.summary,
    })
  ) {
    throw new CanonicalModelAuthorityError(
      "NOT_QUALIFYING_CONCLUSION",
      `UserMapConclusion is not qualifying for canonical registration: ${umc.id}`,
    );
  }

  const liveHash = deriveCanonicalUmcSnapshotHash({
    id: umc.id,
    title: umc.title,
    summary: umc.summary,
    status: umc.status,
    confidenceScore: umc.confidenceScore,
    confidenceLevel: umc.confidenceLevel,
    updatedAt: umc.updatedAt,
  });

  if (liveHash !== args.expectedLegacySnapshotHash) {
    throw new CanonicalModelAuthorityError(
      "STALE_CURRENT_REVISION",
      "UserMapConclusion snapshot hash does not match expectedLegacySnapshotHash",
    );
  }

  const expectedRegistrationKey =
    buildLegacyUserMapConclusionRegistrationKey(umc.id);

  const binding = await args.tx.canonicalConceptSourceBinding.findFirst({
    where: {
      userId: args.userId,
      sourceType: CanonicalConceptSourceType.usermap_conclusion,
      sourceId: umc.id,
    },
  });

  if (binding) {
    if (binding.bindingRole !== CanonicalConceptBindingRole.legacy_seed) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Canonical UMC binding role is not legacy_seed",
      );
    }

    const concept = await args.tx.canonicalConcept.findFirst({
      where: { id: binding.conceptId, userId: args.userId },
    });
    if (!concept || !concept.currentRevisionId) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Canonical binding exists without a resolvable current revision",
      );
    }

    if (concept.registrationKey !== expectedRegistrationKey) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Canonical concept registrationKey does not match legacy UMC identity",
      );
    }

    if (concept.lifecycleStatus !== CanonicalConceptLifecycleStatus.active) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Canonical concept lifecycleStatus is not active",
      );
    }

    const current = await args.tx.canonicalConceptRevision.findFirst({
      where: {
        id: concept.currentRevisionId,
        conceptId: concept.id,
        userId: args.userId,
      },
    });
    if (!current) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Canonical current revision pointer is broken",
      );
    }

    if (current.version !== 1) {
      throw new CanonicalModelAuthorityError(
        "STALE_CURRENT_REVISION",
        "Canonical concept has moved beyond registration revision 1",
      );
    }

    if (
      current.operation !== CanonicalRevisionOperation.registered ||
      current.decisionSource !==
        CanonicalRevisionDecisionSource.legacy_registration ||
      current.registrationSnapshotHash !== args.expectedLegacySnapshotHash
    ) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Canonical registration revision shape is inconsistent",
      );
    }

    return {
      conceptId: concept.id,
      currentRevisionId: current.id,
      revisionVersion: current.version,
      registered: false,
    };
  }

  const evidence = await prepareCanonicalRegistrationEvidence({
    userId: args.userId,
    userMapConclusionId: umc.id,
    // Evidence Db uses EntityLookupModel; Prisma tx delegates are compatible at runtime.
    db: args.tx as unknown as CanonicalRevisionEvidenceDb,
  });

  const acceptedAt = new Date();
  const domain = mapUserMapAreaToCanonicalDomain(umc.area);
  const revisionStatus = mapUserMapStatusToCanonicalRevisionStatus(umc.status);

  const concept = await args.tx.canonicalConcept.create({
    data: {
      userId: args.userId,
      registrationKey: expectedRegistrationKey,
      domain,
      lifecycleStatus: CanonicalConceptLifecycleStatus.active,
      currentRevisionId: null,
    },
  });

  const revision = await args.tx.canonicalConceptRevision.create({
    data: {
      userId: args.userId,
      conceptId: concept.id,
      version: 1,
      title: umc.title,
      summary: umc.summary,
      status: revisionStatus,
      confidenceScore: umc.confidenceScore,
      confidenceLevel: umc.confidenceLevel,
      evidenceCount: evidence.supportingLinkCount,
      rationale: null,
      operation: CanonicalRevisionOperation.registered,
      decisionSource: CanonicalRevisionDecisionSource.legacy_registration,
      acceptedAt,
      registrationSnapshotHash: args.expectedLegacySnapshotHash,
      previousRevisionId: null,
      createdFromProposalId: null,
    },
  });

  await insertPreparedEvidenceLinks({
    tx: args.tx,
    userId: args.userId,
    revisionId: revision.id,
    evidence,
  });

  const pointerUpdate = await args.tx.canonicalConcept.updateMany({
    where: { id: concept.id, currentRevisionId: null },
    data: { currentRevisionId: revision.id },
  });
  if (pointerUpdate.count !== 1) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_LEGACY_REGISTRATION",
      "Failed to set CanonicalConcept.currentRevisionId from null to revision 1",
    );
  }

  await args.tx.canonicalConceptSourceBinding.create({
    data: {
      userId: args.userId,
      conceptId: concept.id,
      sourceType: CanonicalConceptSourceType.usermap_conclusion,
      sourceId: umc.id,
      bindingRole: CanonicalConceptBindingRole.legacy_seed,
    },
  });

  return {
    conceptId: concept.id,
    currentRevisionId: revision.id,
    revisionVersion: 1,
    registered: true,
  };
}
