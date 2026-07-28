/**
 * Canonical Model Authority V1 — strict read projection.
 *
 * Server-side reusable projection over committed canonical concept/revision
 * history. Never reconstructs current meaning from mutable legacy rows
 * (UserMapConclusion, PatternClaim, ModelUpdate.afterSummary alone, etc.).
 *
 * Feature-gate env vars are intentionally ignored: committed history remains
 * readable after rollout flags are disabled.
 */

import {
  CanonicalConceptBindingRole,
  CanonicalConceptLifecycleStatus,
  CanonicalConceptSourceType,
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  Prisma,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type CanonicalConceptDomain,
  type CanonicalRevisionStatus,
  type ModelUpdateType,
  type PrismaClient,
  type UserMapConfidenceLevel,
} from "@prisma/client";

import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import {
  assertCanonicalProposalAuthorityShape,
  assertExactCanonicalModelUpdateIdentity,
  assertExactCanonicalResultingRevision,
  type CanonicalPublicationProposalIdentity,
} from "./canonical-publication-integrity";
import { buildLegacyUserMapConclusionRegistrationKey } from "./canonical-domain-mappings";
import { isSupportedEvidenceLinkPair } from "./orvek-intelligence-object-authority";
import { verifyUnderstandingEvidenceLinkSourceOwnership } from "./understanding-evidence-link-writer";

export const CANONICAL_MODEL_PROJECTION_VERSION =
  "canonical_model_projection:v1" as const;

export type CanonicalRevisionEvidenceProjectionV1 = {
  id: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  summary: string;
  snippet: string;
  quote: string;
};

export type CanonicalRevisionProjectionV1 = {
  id: string;
  conceptId: string;
  version: number;
  title: string;
  summary: string;
  status: CanonicalRevisionStatus;
  confidenceScore: number;
  confidenceLevel: UserMapConfidenceLevel;
  evidenceCount: number;
  rationale: string | null;
  operation: CanonicalRevisionOperation;
  decisionSource: CanonicalRevisionDecisionSource;
  acceptedAt: string;
  registrationSnapshotHash: string | null;
  previousRevisionId: string | null;
  createdFromProposalId: string | null;
  evidence: CanonicalRevisionEvidenceProjectionV1[];
};

export type CanonicalConceptProjectionV1 = {
  authorityType: "canonical_concept_revision";
  concept: {
    id: string;
    registrationKey: string;
    domain: CanonicalConceptDomain;
    lifecycleStatus: CanonicalConceptLifecycleStatus;
    currentRevisionId: string;
    createdAt: string;
    updatedAt: string;
  };
  currentRevision: CanonicalRevisionProjectionV1;
  revisionHistory: CanonicalRevisionProjectionV1[];
  sourceBindings: Array<{
    id: string;
    sourceType: CanonicalConceptSourceType;
    sourceId: string;
    bindingRole: CanonicalConceptBindingRole;
    createdAt: string;
  }>;
  movementHistory: Array<{
    modelUpdateId: string;
    exploreProposalId: string;
    canonicalConceptId: string;
    previousRevisionId: string;
    resultingRevisionId: string;
    updateType: ModelUpdateType;
    beforeSummary: string;
    afterSummary: string;
    userFacingSummary: string;
    createdAt: string;
  }>;
  capabilities: {
    inspectEvidence: true;
    inspectMovementHistory: true;
    supportedWriteOperations: CanonicalRevisionOperation[];
  };
};

export type CanonicalModelProjectionV1 = {
  projectionVersion: typeof CANONICAL_MODEL_PROJECTION_VERSION;
  userId: string;
  concepts: CanonicalConceptProjectionV1[];
};

type ProjectionTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

type ConceptRow = {
  id: string;
  userId: string;
  registrationKey: string;
  domain: CanonicalConceptDomain;
  lifecycleStatus: CanonicalConceptLifecycleStatus;
  currentRevisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RevisionRow = {
  id: string;
  userId: string;
  conceptId: string;
  version: number;
  title: string;
  summary: string;
  status: CanonicalRevisionStatus;
  confidenceScore: number;
  confidenceLevel: UserMapConfidenceLevel;
  evidenceCount: number;
  rationale: string | null;
  operation: CanonicalRevisionOperation;
  decisionSource: CanonicalRevisionDecisionSource;
  acceptedAt: Date;
  registrationSnapshotHash: string | null;
  previousRevisionId: string | null;
  createdFromProposalId: string | null;
};

type EvidenceLinkRow = {
  id: string;
  userId: string;
  targetId: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  summary: string;
  snippet: string;
  quote: string;
};

function broken(message: string): never {
  throw new CanonicalModelAuthorityError("BROKEN_CANONICAL_PROJECTION", message);
}

function toIso(value: Date): string {
  return value.toISOString();
}

function compareEvidence(
  a: CanonicalRevisionEvidenceProjectionV1,
  b: CanonicalRevisionEvidenceProjectionV1,
): number {
  if (a.role !== b.role) return a.role < b.role ? -1 : 1;
  if (a.sourceType !== b.sourceType) {
    return a.sourceType < b.sourceType ? -1 : 1;
  }
  if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function mapRevisionProjection(
  revision: RevisionRow,
  evidence: CanonicalRevisionEvidenceProjectionV1[],
): CanonicalRevisionProjectionV1 {
  return {
    id: revision.id,
    conceptId: revision.conceptId,
    version: revision.version,
    title: revision.title,
    summary: revision.summary,
    status: revision.status,
    confidenceScore: revision.confidenceScore,
    confidenceLevel: revision.confidenceLevel,
    evidenceCount: revision.evidenceCount,
    rationale: revision.rationale,
    operation: revision.operation,
    decisionSource: revision.decisionSource,
    acceptedAt: toIso(revision.acceptedAt),
    registrationSnapshotHash: revision.registrationSnapshotHash,
    previousRevisionId: revision.previousRevisionId,
    createdFromProposalId: revision.createdFromProposalId,
    evidence,
  };
}

function assertV1RevisionShapes(revisions: RevisionRow[]): void {
  if (revisions.length === 0) {
    broken("Canonical concept has no revisions");
  }
  if (revisions.length > 2) {
    broken("V1 projection does not support revision versions greater than 2");
  }

  for (let i = 0; i < revisions.length; i += 1) {
    const revision = revisions[i]!;
    if (revision.version !== i + 1) {
      broken("Canonical revision versions must start at 1 and be contiguous");
    }
    if (i === 0) {
      if (revision.previousRevisionId != null) {
        broken("Revision 1 previousRevisionId must be null");
      }
    } else {
      const prior = revisions[i - 1]!;
      if (revision.previousRevisionId !== prior.id) {
        broken("Revision previousRevisionId must equal prior revision id");
      }
    }
  }

  const rev1 = revisions[0]!;
  if (rev1.version !== 1) broken("First revision must be version 1");
  if (rev1.operation !== CanonicalRevisionOperation.registered) {
    broken("Revision 1 operation must be registered");
  }
  if (
    rev1.decisionSource !== CanonicalRevisionDecisionSource.legacy_registration
  ) {
    broken("Revision 1 decisionSource must be legacy_registration");
  }
  if (rev1.createdFromProposalId != null) {
    broken("Revision 1 createdFromProposalId must be null");
  }
  if (
    typeof rev1.registrationSnapshotHash !== "string" ||
    rev1.registrationSnapshotHash.length === 0
  ) {
    broken("Revision 1 registrationSnapshotHash must be non-empty");
  }

  if (revisions.length === 2) {
    const rev2 = revisions[1]!;
    if (rev2.version !== 2) broken("Second revision must be version 2");
    if (rev2.operation !== CanonicalRevisionOperation.strengthen) {
      broken("Revision 2 operation must be strengthen");
    }
    if (
      rev2.decisionSource !== CanonicalRevisionDecisionSource.explore_proposal
    ) {
      broken("Revision 2 decisionSource must be explore_proposal");
    }
    if (
      typeof rev2.createdFromProposalId !== "string" ||
      rev2.createdFromProposalId.length === 0
    ) {
      broken("Revision 2 createdFromProposalId must be non-empty");
    }
    if (rev2.registrationSnapshotHash != null) {
      broken("Revision 2 registrationSnapshotHash must be null");
    }
  }

  for (const revision of revisions) {
    if (revision.version > 2) {
      broken("V1 projection does not support revision versions greater than 2");
    }
  }
}

async function assertEvidenceLinkIntegrity(args: {
  userId: string;
  link: EvidenceLinkRow;
  tx: ProjectionTx;
}): Promise<void> {
  const { link, userId, tx } = args;

  if (
    !isSupportedEvidenceLinkPair({
      sourceType: link.sourceType,
      targetType: UnderstandingLinkTargetType.canonical_concept_revision,
    })
  ) {
    broken(
      `Unsupported evidence pair ${link.sourceType} → canonical_concept_revision`,
    );
  }

  const owned = await verifyUnderstandingEvidenceLinkSourceOwnership({
    userId,
    sourceType: link.sourceType,
    sourceId: link.sourceId,
    db: tx as never,
  });
  if (!owned) {
    broken(
      `Evidence source missing, cross-user, or wrong type: ${link.sourceType}:${link.sourceId}`,
    );
  }

  if (link.sourceType === UnderstandingLinkSourceType.message) {
    const message = await tx.message.findFirst({
      where: { id: link.sourceId, userId },
      select: { id: true, role: true },
    });
    if (!message) {
      broken(`Message evidence source missing: ${link.sourceId}`);
    }
    if (message.role === "assistant") {
      if (link.role !== UnderstandingLinkRole.context) {
        broken("Assistant message evidence may only use role=context");
      }
    } else if (message.role === "user") {
      if (
        link.role !== UnderstandingLinkRole.supports &&
        link.role !== UnderstandingLinkRole.context
      ) {
        broken("User message evidence role must be supports or context");
      }
    } else {
      broken(`Unsupported message role for evidence: ${message.role}`);
    }
  }
}

async function projectEvidenceForRevisions(args: {
  userId: string;
  revisions: RevisionRow[];
  tx: ProjectionTx;
}): Promise<Map<string, CanonicalRevisionEvidenceProjectionV1[]>> {
  const revisionIds = args.revisions.map((revision) => revision.id);
  const links =
    revisionIds.length === 0
      ? []
      : await args.tx.understandingEvidenceLink.findMany({
          where: {
            userId: args.userId,
            targetType: UnderstandingLinkTargetType.canonical_concept_revision,
            targetId: { in: revisionIds },
          },
        });

  const byRevision = new Map<string, CanonicalRevisionEvidenceProjectionV1[]>();
  for (const revision of args.revisions) {
    byRevision.set(revision.id, []);
  }

  for (const link of links as EvidenceLinkRow[]) {
    await assertEvidenceLinkIntegrity({
      userId: args.userId,
      link,
      tx: args.tx,
    });
    const bucket = byRevision.get(link.targetId);
    if (!bucket) {
      broken(`Evidence link targets unknown revision ${link.targetId}`);
    }
    bucket.push({
      id: link.id,
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      role: link.role,
      summary: link.summary,
      snippet: link.snippet,
      quote: link.quote,
    });
  }

  for (const revision of args.revisions) {
    const evidence = byRevision.get(revision.id) ?? [];
    evidence.sort(compareEvidence);
    byRevision.set(revision.id, evidence);
    const supportsCount = evidence.filter(
      (row) => row.role === UnderstandingLinkRole.supports,
    ).length;
    if (revision.evidenceCount !== supportsCount) {
      broken(
        `Revision ${revision.id} evidenceCount does not match supports links`,
      );
    }
  }

  return byRevision;
}

async function projectSourceBindings(args: {
  userId: string;
  concept: ConceptRow;
  tx: ProjectionTx;
}): Promise<CanonicalConceptProjectionV1["sourceBindings"]> {
  const bindings = await args.tx.canonicalConceptSourceBinding.findMany({
    where: {
      userId: args.userId,
      conceptId: args.concept.id,
    },
  });

  const legacySeeds = bindings.filter(
    (binding) =>
      binding.sourceType === CanonicalConceptSourceType.usermap_conclusion &&
      binding.bindingRole === CanonicalConceptBindingRole.legacy_seed,
  );
  if (legacySeeds.length < 1) {
    broken("Canonical concept requires a legacy_seed usermap_conclusion binding");
  }

  for (const seed of legacySeeds) {
    const umc = await args.tx.userMapConclusion.findFirst({
      where: { id: seed.sourceId, userId: args.userId },
      select: { id: true },
    });
    if (!umc) {
      broken(`Legacy seed UserMapConclusion missing or cross-user: ${seed.sourceId}`);
    }
    const expectedKey = buildLegacyUserMapConclusionRegistrationKey(seed.sourceId);
    if (args.concept.registrationKey !== expectedKey) {
      broken("Canonical concept registrationKey must match legacy seed binding");
    }
  }

  return bindings
    .map((binding) => ({
      id: binding.id,
      sourceType: binding.sourceType,
      sourceId: binding.sourceId,
      bindingRole: binding.bindingRole,
      createdAt: toIso(binding.createdAt),
    }))
    .sort((a, b) => {
      if (a.sourceType !== b.sourceType) {
        return a.sourceType < b.sourceType ? -1 : 1;
      }
      if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return 0;
    });
}

async function projectMovementHistory(args: {
  userId: string;
  conceptId: string;
  revisions: RevisionRow[];
  tx: ProjectionTx;
}): Promise<CanonicalConceptProjectionV1["movementHistory"]> {
  if (args.revisions.length === 1) {
    const stray = await args.tx.modelUpdate.findMany({
      where: {
        userId: args.userId,
        canonicalConceptId: args.conceptId,
      },
      select: { id: true },
    });
    if (stray.length > 0) {
      broken("Revision-1 concept must not have canonical ModelUpdate movement");
    }
    return [];
  }

  const rev1 = args.revisions[0]!;
  const rev2 = args.revisions[1]!;
  if (
    typeof rev2.createdFromProposalId !== "string" ||
    rev2.createdFromProposalId.length === 0
  ) {
    broken("Revision 2 missing createdFromProposalId for movement history");
  }

  const modelUpdates = await args.tx.modelUpdate.findMany({
    where: {
      userId: args.userId,
      canonicalConceptId: args.conceptId,
    },
  });

  if (modelUpdates.length !== 1) {
    broken(
      modelUpdates.length === 0
        ? "Missing canonical movement ModelUpdate for revision 2"
        : "Duplicate canonical movement ModelUpdate rows for concept",
    );
  }

  const modelUpdate = modelUpdates[0]!;
  if (
    modelUpdate.previousRevisionId !== rev1.id ||
    modelUpdate.resultingRevisionId !== rev2.id ||
    modelUpdate.exploreProposalId !== rev2.createdFromProposalId
  ) {
    broken("Canonical ModelUpdate lineage fields do not match revision chain");
  }

  const proposal = (await args.tx.exploreMovementProposal.findFirst({
    where: {
      id: rev2.createdFromProposalId,
      userId: args.userId,
    },
  })) as CanonicalPublicationProposalIdentity | null;

  if (!proposal) {
    broken("Movement Explore proposal missing or cross-user");
  }
  if (proposal.authorityMode !== ExploreMovementAuthorityMode.canonical_v1) {
    broken("Movement Explore proposal must be canonical_v1");
  }
  if (proposal.status !== ExploreMovementProposalStatus.published) {
    broken("Movement Explore proposal must be published");
  }
  if (proposal.modelUpdateId !== modelUpdate.id) {
    broken("Published proposal.modelUpdateId must equal movement ModelUpdate.id");
  }
  if (proposal.canonicalConceptId !== args.conceptId) {
    broken("Movement proposal canonicalConceptId mismatch");
  }

  assertCanonicalProposalAuthorityShape(proposal, "BROKEN_CANONICAL_PROJECTION");
  assertExactCanonicalResultingRevision({
    resultingRevision: rev2,
    previousRevision: rev1,
    proposal,
    failureCode: "BROKEN_CANONICAL_PROJECTION",
  });
  assertExactCanonicalModelUpdateIdentity({
    modelUpdate,
    proposal,
    previousRevision: rev1,
    resultingRevision: rev2,
    failureCode: "BROKEN_CANONICAL_PROJECTION",
  });

  if (
    typeof modelUpdate.beforeSummary !== "string" ||
    typeof modelUpdate.afterSummary !== "string"
  ) {
    broken("Canonical movement ModelUpdate summaries must be non-null strings");
  }

  const movement = [
    {
      modelUpdateId: modelUpdate.id,
      exploreProposalId: proposal.id,
      canonicalConceptId: args.conceptId,
      previousRevisionId: rev1.id,
      resultingRevisionId: rev2.id,
      updateType: modelUpdate.updateType,
      beforeSummary: modelUpdate.beforeSummary,
      afterSummary: modelUpdate.afterSummary,
      userFacingSummary: modelUpdate.userFacingSummary,
      createdAt: toIso(modelUpdate.createdAt),
    },
  ];

  movement.sort((a, b) => {
    const aVersion =
      args.revisions.find((revision) => revision.id === a.resultingRevisionId)
        ?.version ?? 0;
    const bVersion =
      args.revisions.find((revision) => revision.id === b.resultingRevisionId)
        ?.version ?? 0;
    if (aVersion !== bVersion) return aVersion - bVersion;
    if (a.modelUpdateId !== b.modelUpdateId) {
      return a.modelUpdateId < b.modelUpdateId ? -1 : 1;
    }
    return 0;
  });

  return movement;
}

function supportedWriteOperationsFor(
  currentVersion: number,
): CanonicalRevisionOperation[] {
  if (currentVersion === 1) return [CanonicalRevisionOperation.strengthen];
  if (currentVersion === 2) return [];
  broken("V1 projection does not support write capabilities beyond revision 2");
}

/**
 * Transaction-scoped concept projection. Caller must open REPEATABLE READ.
 * Optional afterConceptRowLoaded supports concurrency proofs without production sleeps.
 */
export async function readCanonicalConceptProjectionInTransaction(args: {
  userId: string;
  conceptId: string;
  tx: ProjectionTx;
  afterConceptRowLoaded?: () => Promise<void>;
}): Promise<CanonicalConceptProjectionV1 | "not_found"> {
  const concept = (await args.tx.canonicalConcept.findFirst({
    where: {
      id: args.conceptId,
      userId: args.userId,
      lifecycleStatus: CanonicalConceptLifecycleStatus.active,
    },
  })) as ConceptRow | null;

  if (!concept) return "not_found";

  if (args.afterConceptRowLoaded) {
    await args.afterConceptRowLoaded();
  }

  if (
    typeof concept.currentRevisionId !== "string" ||
    concept.currentRevisionId.length === 0
  ) {
    broken("Canonical concept currentRevisionId is null or empty");
  }

  const revisions = (await args.tx.canonicalConceptRevision.findMany({
    where: {
      conceptId: concept.id,
      userId: args.userId,
    },
    orderBy: [{ version: "asc" }, { id: "asc" }],
  })) as RevisionRow[];

  assertV1RevisionShapes(revisions);

  const highest = revisions[revisions.length - 1]!;
  if (concept.currentRevisionId !== highest.id) {
    broken(
      "Canonical concept currentRevisionId must point to the highest version",
    );
  }

  const currentRow = revisions.find(
    (revision) => revision.id === concept.currentRevisionId,
  );
  if (!currentRow) {
    broken("Canonical current revision row missing for pointer");
  }
  if (currentRow.userId !== args.userId || currentRow.conceptId !== concept.id) {
    broken("Canonical current revision ownership/concept mismatch");
  }

  const evidenceByRevision = await projectEvidenceForRevisions({
    userId: args.userId,
    revisions,
    tx: args.tx,
  });

  const revisionHistory = revisions.map((revision) =>
    mapRevisionProjection(revision, evidenceByRevision.get(revision.id) ?? []),
  );
  const currentRevision = revisionHistory[revisionHistory.length - 1]!;
  if (currentRevision.id !== concept.currentRevisionId) {
    broken("Projected currentRevision must equal history tail");
  }

  const sourceBindings = await projectSourceBindings({
    userId: args.userId,
    concept,
    tx: args.tx,
  });

  const movementHistory = await projectMovementHistory({
    userId: args.userId,
    conceptId: concept.id,
    revisions,
    tx: args.tx,
  });

  return {
    authorityType: "canonical_concept_revision",
    concept: {
      id: concept.id,
      registrationKey: concept.registrationKey,
      domain: concept.domain,
      lifecycleStatus: concept.lifecycleStatus,
      currentRevisionId: concept.currentRevisionId,
      createdAt: toIso(concept.createdAt),
      updatedAt: toIso(concept.updatedAt),
    },
    currentRevision,
    revisionHistory,
    sourceBindings,
    movementHistory,
    capabilities: {
      inspectEvidence: true,
      inspectMovementHistory: true,
      supportedWriteOperations: supportedWriteOperationsFor(currentRevision.version),
    },
  };
}

export async function readCanonicalConceptProjection(args: {
  userId: string;
  conceptId: string;
  db: PrismaClient;
}): Promise<CanonicalConceptProjectionV1 | "not_found"> {
  return args.db.$transaction(
    async (tx) =>
      readCanonicalConceptProjectionInTransaction({
        userId: args.userId,
        conceptId: args.conceptId,
        tx: tx as unknown as ProjectionTx,
      }),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30_000,
    },
  );
}

export async function readCanonicalModelProjection(args: {
  userId: string;
  db: PrismaClient;
}): Promise<CanonicalModelProjectionV1> {
  return args.db.$transaction(
    async (tx) => {
      const concepts = (await tx.canonicalConcept.findMany({
        where: {
          userId: args.userId,
          lifecycleStatus: CanonicalConceptLifecycleStatus.active,
        },
      })) as ConceptRow[];

      const projected: CanonicalConceptProjectionV1[] = [];
      for (const concept of concepts) {
        const one = await readCanonicalConceptProjectionInTransaction({
          userId: args.userId,
          conceptId: concept.id,
          tx: tx as unknown as ProjectionTx,
        });
        if (one === "not_found") {
          broken("Owned active concept disappeared during model projection");
        }
        projected.push(one);
      }

      projected.sort((a, b) => {
        if (a.currentRevision.acceptedAt !== b.currentRevision.acceptedAt) {
          return a.currentRevision.acceptedAt < b.currentRevision.acceptedAt
            ? 1
            : -1;
        }
        if (a.concept.id !== b.concept.id) {
          return a.concept.id < b.concept.id ? -1 : 1;
        }
        return 0;
      });

      return {
        projectionVersion: CANONICAL_MODEL_PROJECTION_VERSION,
        userId: args.userId,
        concepts: projected,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60_000,
    },
  );
}
