/**
 * Shared current-understanding product contract for Today and Your Map.
 *
 * Merges committed canonical concepts with unregistered legacy conclusions
 * inside one PostgreSQL REPEATABLE READ snapshot.
 */

import {
  Prisma,
  UserMapConclusionVisibility,
  type PrismaClient,
  type UserMapConclusionArea,
  type UserMapConclusionStatus,
  type UserMapConfidenceLevel,
} from "@prisma/client";

import { mapCanonicalDomainToUserMapArea } from "./canonical-domain-mappings";
import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import {
  CANONICAL_PRODUCT_PROJECTION_VERSION,
  toCanonicalProductConceptV1,
  type CanonicalProductConceptV1,
} from "./canonical-model-product-projection";
import {
  readCanonicalConceptProjectionInTransaction,
  readCanonicalModelProjectionInTransaction,
  type ProjectionTx,
} from "./canonical-model-projection";
import { projectCanonicalEvidenceForPublic } from "./canonical-product-public-evidence";
import { toUserMapConclusionPublicApiListItem } from "./public-intelligence-safe-slice";

export type LegacyUnregisteredConclusionProductItem = {
  authorityType: "legacy_unregistered_usermap_conclusion";
  id: string;
  title: string;
  summary: string;
  area: UserMapConclusionArea;
  status: UserMapConclusionStatus;
  confidenceLevel: UserMapConfidenceLevel;
  evidenceCount: number;
  updatedAt: string;
  lastUserCorrectionLabel?: string | null;
  lastUserCorrectionAt?: string | null;
  correctionCount?: number;
};

export type CurrentUnderstandingProductItem =
  | CanonicalProductConceptV1
  | LegacyUnregisteredConclusionProductItem;

export type CurrentUnderstandingProductProjectionV1 = {
  projectionVersion: typeof CANONICAL_PRODUCT_PROJECTION_VERSION;
  userId: string;
  items: CurrentUnderstandingProductItem[];
};

export function mergeCurrentUnderstandingProductItems(args: {
  canonicalConcepts: CanonicalProductConceptV1[];
  legacyConclusions: LegacyUnregisteredConclusionProductItem[];
}): CurrentUnderstandingProductItem[] {
  const boundSeedIds = new Set(
    args.canonicalConcepts.map((concept) => concept.legacySeed.objectId),
  );
  const conceptIds = new Set<string>();
  const revisionIds = new Set<string>();

  for (const concept of args.canonicalConcepts) {
    if (conceptIds.has(concept.conceptId)) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Duplicate canonical conceptId in product merge",
      );
    }
    if (revisionIds.has(concept.currentRevisionId)) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Duplicate currentRevisionId in product merge",
      );
    }
    conceptIds.add(concept.conceptId);
    revisionIds.add(concept.currentRevisionId);
  }

  const unregistered = args.legacyConclusions.filter(
    (item) => !boundSeedIds.has(item.id),
  );

  for (const item of unregistered) {
    if (boundSeedIds.has(item.id)) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Bound legacy seed leaked into unregistered branch",
      );
    }
  }

  const canonicalSorted = [...args.canonicalConcepts].sort((a, b) => {
    if (a.acceptedAt !== b.acceptedAt) {
      return a.acceptedAt < b.acceptedAt ? 1 : -1;
    }
    return a.conceptId < b.conceptId ? -1 : a.conceptId > b.conceptId ? 1 : 0;
  });

  const legacySorted = [...unregistered].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt < b.updatedAt ? 1 : -1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return [...canonicalSorted, ...legacySorted];
}

async function loadLegacyUnregisteredConclusionsInTransaction(args: {
  userId: string;
  tx: ProjectionTx;
}): Promise<LegacyUnregisteredConclusionProductItem[]> {
  const rows = await args.tx.userMapConclusion.findMany({
    where: {
      userId: args.userId,
      visibility: UserMapConclusionVisibility.user_visible,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      area: true,
      status: true,
      confidenceLevel: true,
      evidenceCount: true,
      updatedAt: true,
      lastUserCorrectionLabel: true,
      lastUserCorrectionAt: true,
      correctionCount: true,
    },
  });

  const out: LegacyUnregisteredConclusionProductItem[] = [];
  for (const row of rows) {
    const publicItem = toUserMapConclusionPublicApiListItem(row);
    if (!publicItem) continue;
    out.push({
      authorityType: "legacy_unregistered_usermap_conclusion",
      id: publicItem.id,
      title: publicItem.title,
      summary: publicItem.summary,
      area: publicItem.area,
      status: publicItem.status,
      confidenceLevel: publicItem.confidenceLevel,
      evidenceCount: publicItem.evidenceCount,
      updatedAt: publicItem.updatedAt,
      lastUserCorrectionLabel: publicItem.lastUserCorrectionLabel ?? null,
      lastUserCorrectionAt: publicItem.lastUserCorrectionAt ?? null,
      correctionCount: publicItem.correctionCount ?? 0,
    });
  }
  return out;
}

async function toPublicProductConceptInTransaction(args: {
  userId: string;
  concept: Parameters<typeof toCanonicalProductConceptV1>[0];
  tx: ProjectionTx;
}): Promise<CanonicalProductConceptV1> {
  const publicEvidence = await projectCanonicalEvidenceForPublic({
    userId: args.userId,
    evidence: args.concept.currentRevision.evidence,
    db: args.tx,
  });
  return toCanonicalProductConceptV1(args.concept, {
    evidenceOverride: publicEvidence,
  });
}

/**
 * Optional concurrency hook for REPEATABLE READ proofs.
 * Invoked after the canonical model rows are loaded, before legacy UMC load.
 */
export async function readCurrentUnderstandingProductProjectionInTransaction(args: {
  userId: string;
  tx: ProjectionTx;
  afterCanonicalLoaded?: () => Promise<void>;
}): Promise<CurrentUnderstandingProductProjectionV1> {
  const canonical = await readCanonicalModelProjectionInTransaction({
    userId: args.userId,
    tx: args.tx,
  });
  if (args.afterCanonicalLoaded) {
    await args.afterCanonicalLoaded();
  }

  const productConcepts: CanonicalProductConceptV1[] = [];
  for (const concept of canonical.concepts) {
    productConcepts.push(
      await toPublicProductConceptInTransaction({
        userId: args.userId,
        concept,
        tx: args.tx,
      }),
    );
  }

  const legacy = await loadLegacyUnregisteredConclusionsInTransaction({
    userId: args.userId,
    tx: args.tx,
  });
  const items = mergeCurrentUnderstandingProductItems({
    canonicalConcepts: productConcepts,
    legacyConclusions: legacy,
  });

  return {
    projectionVersion: CANONICAL_PRODUCT_PROJECTION_VERSION,
    userId: args.userId,
    items,
  };
}

export async function readCurrentUnderstandingProductProjection(args: {
  userId: string;
  db: PrismaClient;
  afterCanonicalLoaded?: () => Promise<void>;
}): Promise<CurrentUnderstandingProductProjectionV1> {
  return args.db.$transaction(
    async (tx) =>
      readCurrentUnderstandingProductProjectionInTransaction({
        userId: args.userId,
        tx: tx as unknown as ProjectionTx,
        afterCanonicalLoaded: args.afterCanonicalLoaded,
      }),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60_000,
      maxWait: 60_000,
    },
  );
}

export async function readCanonicalProductConceptForUser(args: {
  userId: string;
  conceptId: string;
  db: PrismaClient;
}): Promise<CanonicalProductConceptV1 | "not_found"> {
  return args.db.$transaction(
    async (tx) => {
      const projection = await readCanonicalConceptProjectionInTransaction({
        userId: args.userId,
        conceptId: args.conceptId,
        tx: tx as unknown as ProjectionTx,
      });
      if (projection === "not_found") return "not_found";
      return toPublicProductConceptInTransaction({
        userId: args.userId,
        concept: projection,
        tx: tx as unknown as ProjectionTx,
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30_000,
    },
  );
}

/**
 * Surface-compatible list row for Today/Map adapters.
 * Canonical rows use conceptId as `id` and never copy bound UMC wording.
 */
export type CurrentUnderstandingSurfaceListItem = {
  id: string;
  title: string;
  summary: string;
  area: UserMapConclusionArea;
  status: UserMapConclusionStatus;
  confidenceLevel: UserMapConfidenceLevel;
  confidenceScore?: number;
  evidenceCount: number;
  updatedAt: string;
  /** Defaults to legacy when omitted (compat with pre-Phase-5 fixtures). */
  authorityType?:
    | "canonical_concept_revision"
    | "legacy_unregistered_usermap_conclusion";
  currentRevisionId?: string;
  version?: number;
  conceptId?: string;
  domain?: CanonicalProductConceptV1["domain"];
  lastUserCorrectionLabel?: string | null;
  lastUserCorrectionAt?: string | null;
  correctionCount?: number;
};

function revisionStatusToUmcStatus(
  status: string,
): UserMapConclusionStatus {
  switch (status) {
    case "hypothesis":
    case "tentative":
    case "emerging":
    case "supported":
    case "disputed":
      return status;
    default:
      return "emerging";
  }
}

export function toCurrentUnderstandingSurfaceListItem(
  item: CurrentUnderstandingProductItem,
): CurrentUnderstandingSurfaceListItem {
  if (item.authorityType === "canonical_concept_revision") {
    return {
      id: item.conceptId,
      title: item.title,
      summary: item.summary,
      area: mapCanonicalDomainToUserMapArea(item.domain),
      status: revisionStatusToUmcStatus(item.status),
      confidenceLevel: item.confidenceLevel,
      confidenceScore: item.confidenceScore,
      evidenceCount: item.evidenceCount,
      updatedAt: item.acceptedAt,
      authorityType: "canonical_concept_revision",
      currentRevisionId: item.currentRevisionId,
      version: item.version,
      conceptId: item.conceptId,
      domain: item.domain,
    };
  }

  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    area: item.area,
    status: item.status,
    confidenceLevel: item.confidenceLevel,
    evidenceCount: item.evidenceCount,
    updatedAt: item.updatedAt,
    authorityType: "legacy_unregistered_usermap_conclusion",
    lastUserCorrectionLabel: item.lastUserCorrectionLabel ?? null,
    lastUserCorrectionAt: item.lastUserCorrectionAt ?? null,
    correctionCount: item.correctionCount ?? 0,
  };
}

export function isCanonicalSurfaceListItem(
  item: CurrentUnderstandingSurfaceListItem,
): boolean {
  return item.authorityType === "canonical_concept_revision";
}

export function resolveSurfaceAuthorityType(
  item: CurrentUnderstandingSurfaceListItem,
):
  | "canonical_concept_revision"
  | "legacy_unregistered_usermap_conclusion" {
  return item.authorityType ?? "legacy_unregistered_usermap_conclusion";
}

export { Prisma };
