/**
 * Write/materialization path for SurfacedEvidencePointer records and UEL graphSlot links.
 *
 * Durable spec: docs/live-evidence-depth-write-contract.md
 * Storage spec: docs/live-evidence-depth-storage-migration (#114)
 *
 * Does NOT read Today, map to OrvekObject, hydrate provider, or touch UI.
 */

import type {
  Prisma,
  PrismaClient,
  SurfacedEvidencePointerKind,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  assessSurfacedEvidencePointerWrite,
  isAllowedSurfacedPointerId,
  isGenericSurfacingRationale,
  uelMetaWithGraphSlot,
  SURFACED_POINTER_ID_PREFIXES,
  type EvidencePointerGraphSlot,
  type SurfacedEvidencePointerLinkWriteInput,
  type SurfacedEvidencePointerWriteAssessment,
  type SurfacedEvidencePointerWriteBlocker,
  type SurfacedEvidencePointerWriteInput,
  type SurfacedPointerKind,
} from "./live-evidence-depth-write-contract";
import type { UnderstandingEvidenceLinkWriteInput } from "./understanding-evidence-link-writer";
import { UnderstandingEvidenceLinkDuplicateError } from "./understanding-evidence-link-writer";

export type SurfacedEvidencePointerMaterializationLinkInput = {
  targetId: string;
  targetType: UnderstandingLinkTargetType;
  role: UnderstandingLinkRole;
  graphSlot: EvidencePointerGraphSlot;
  /** When omitted, resolved via deps.resolveLinkPublicEligibility */
  publicEligible?: boolean;
  summary?: string;
};

export type SurfacedEvidencePointerMaterializationInput = {
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  sourceText: string;
  sourceOrigin: string;
  surfacedAt?: Date;
  whyItMatters: string;
  whyResurfaced?: string;
  sourceEvidenceId?: string;
  libraryReceiptId?: string;
  detailHref?: string;
  materializedFrom: string;
  links: SurfacedEvidencePointerMaterializationLinkInput[];
};

export type SurfacedEvidencePointerMaterializationBlocker =
  | SurfacedEvidencePointerWriteBlocker
  | "unsupported_source_object_type"
  | "missing_source_object_type"
  | "missing_source_object_id"
  | "unstable_pointer_id"
  | "invalid_pointer_id"
  | "generic_source_text";

export type SurfacedEvidencePointerMaterializationAssessment = {
  materializationReady: boolean;
  blockers: SurfacedEvidencePointerMaterializationBlocker[];
  writeAssessment: SurfacedEvidencePointerWriteAssessment;
};

export type SurfacedEvidencePointerUpsertInput = {
  id: string;
  userId: string;
  pointerKind: SurfacedEvidencePointerKind;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  sourceText: string;
  sourceOrigin: string;
  whyItMatters: string;
  surfacedAt: Date;
  publicEligible: boolean;
  materializedFrom: string;
  whyResurfaced?: string;
  sourceEvidenceId?: string;
  libraryReceiptId?: string;
  detailHref?: string;
};

export type SurfacedEvidencePointerWriterDb = Pick<
  PrismaClient,
  "surfacedEvidencePointer"
>;

export type SurfacedEvidencePointerMaterializationDeps = {
  now?: () => Date;
  resolveLinkPublicEligibility?: (args: {
    userId: string;
    link: SurfacedEvidencePointerMaterializationLinkInput;
  }) => Promise<boolean>;
  upsertSurfacedEvidencePointer?: (args: {
    input: SurfacedEvidencePointerUpsertInput;
    db: SurfacedEvidencePointerWriterDb;
    now: Date;
  }) => Promise<{ id: string }>;
  createUnderstandingEvidenceLink?: (args: {
    userId: string;
    input: UnderstandingEvidenceLinkWriteInput;
  }) => Promise<{ id: string } | null>;
  db?: SurfacedEvidencePointerWriterDb;
};

export type SurfacedEvidencePointerMaterializationSuccess = {
  ok: true;
  pointerId: string;
  pointerKind: SurfacedPointerKind;
  pointer: SurfacedEvidencePointerUpsertInput;
  normalizedLinks: SurfacedEvidencePointerLinkWriteInput[];
  uelLinkPayloads: UnderstandingEvidenceLinkWriteInput[];
  persistedPointerId: string | null;
  uelLinksWritten: number;
  assessment: SurfacedEvidencePointerMaterializationAssessment;
};

export type SurfacedEvidencePointerMaterializationFailure = {
  ok: false;
  assessment: SurfacedEvidencePointerMaterializationAssessment;
};

export type SurfacedEvidencePointerMaterializationResult =
  | SurfacedEvidencePointerMaterializationSuccess
  | SurfacedEvidencePointerMaterializationFailure;

/** Additional generic sourceText strings rejected at materialization (#113 write path). */
export const GENERIC_SOURCE_TEXT_DENYLIST: readonly RegExp[] = [
  /^recent pattern\.?$/i,
  /^related evidence\.?$/i,
  /^evidence pointer\.?$/i,
  /^receipt$/i,
];

const INDEX_TITLE_POINTER_ID_PATTERN = /^receipt-\d+-/i;

const SUPPORTED_SOURCE_OBJECT_TYPES = new Set<UnderstandingLinkSourceType>([
  "pattern_claim",
  "contradiction_node",
]);

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isGenericSourceText(value: string | undefined): boolean {
  const collapsed = value?.trim();
  if (!collapsed) {
    return true;
  }

  if (isGenericSurfacingRationale(collapsed)) {
    return true;
  }

  return GENERIC_SOURCE_TEXT_DENYLIST.some((pattern) => pattern.test(collapsed));
}

export function isUnstableSurfacedPointerId(id: string): boolean {
  return INDEX_TITLE_POINTER_ID_PATTERN.test(id.trim());
}

export function resolveSurfacedPointerKind(
  sourceObjectType: UnderstandingLinkSourceType,
): SurfacedPointerKind | null {
  switch (sourceObjectType) {
    case "pattern_claim":
      return "pattern";
    case "contradiction_node":
      return "tension";
    default:
      return null;
  }
}

export function buildSurfacedEvidencePointerId(input: {
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
}): string | null {
  if (!SUPPORTED_SOURCE_OBJECT_TYPES.has(input.sourceObjectType)) {
    return null;
  }

  const safeSourceId = input.sourceObjectId.trim();
  if (!safeSourceId) {
    return null;
  }

  const prefix =
    input.sourceObjectType === "pattern_claim"
      ? SURFACED_POINTER_ID_PREFIXES[0]
      : SURFACED_POINTER_ID_PREFIXES[1];

  return `${prefix}-${safeSourceId}`;
}

export async function normalizeSurfacedEvidencePointerLinks(args: {
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  links: SurfacedEvidencePointerMaterializationLinkInput[];
  resolveLinkPublicEligibility?: SurfacedEvidencePointerMaterializationDeps["resolveLinkPublicEligibility"];
}): Promise<SurfacedEvidencePointerLinkWriteInput[]> {
  const normalized: SurfacedEvidencePointerLinkWriteInput[] = [];

  for (const link of args.links) {
    const eligibility =
      typeof link.publicEligible === "boolean"
        ? link.publicEligible
        : args.resolveLinkPublicEligibility
          ? await args.resolveLinkPublicEligibility({
              userId: args.userId,
              link,
            })
          : false;

    if (!eligibility) {
      continue;
    }

    normalized.push({
      sourceObjectType: args.sourceObjectType,
      sourceObjectId: args.sourceObjectId,
      targetType: link.targetType,
      targetId: link.targetId,
      role: link.role,
      graphSlot: link.graphSlot,
      summary: link.summary,
      publicEligible: true,
    });
  }

  return normalized;
}

export function assessSurfacedEvidencePointerMaterialization(args: {
  pointer: SurfacedEvidencePointerWriteInput;
  links: SurfacedEvidencePointerLinkWriteInput[];
}): SurfacedEvidencePointerMaterializationAssessment {
  const blockers: SurfacedEvidencePointerMaterializationBlocker[] = [];

  if (!hasText(args.pointer.sourceObjectType)) {
    blockers.push("missing_source_object_type");
  } else if (!SUPPORTED_SOURCE_OBJECT_TYPES.has(args.pointer.sourceObjectType)) {
    blockers.push("unsupported_source_object_type");
  }

  if (!hasText(args.pointer.sourceObjectId)) {
    blockers.push("missing_source_object_id");
  }

  if (!hasText(args.pointer.sourceText)) {
    blockers.push("missing_source_text");
  } else if (isGenericSourceText(args.pointer.sourceText)) {
    blockers.push("generic_source_text");
  }

  if (!hasText(args.pointer.id)) {
    blockers.push("missing_id");
  } else if (isUnstableSurfacedPointerId(args.pointer.id)) {
    blockers.push("unstable_pointer_id");
  } else if (!isAllowedSurfacedPointerId(args.pointer.id)) {
    blockers.push("invalid_pointer_id");
  } else {
    const expectedId = buildSurfacedEvidencePointerId({
      sourceObjectType: args.pointer.sourceObjectType,
      sourceObjectId: args.pointer.sourceObjectId,
    });
    if (expectedId && args.pointer.id !== expectedId) {
      blockers.push("unstable_pointer_id");
    }
  }

  const writeAssessment = assessSurfacedEvidencePointerWrite(args.pointer, args.links);
  blockers.push(...writeAssessment.blockers);

  const uniqueBlockers = [...new Set(blockers)];

  return {
    materializationReady: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    writeAssessment,
  };
}

export function buildUnderstandingEvidenceLinksForSurfacedPointer(args: {
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  links: SurfacedEvidencePointerLinkWriteInput[];
}): UnderstandingEvidenceLinkWriteInput[] {
  return args.links
    .filter((link) => link.publicEligible)
    .map((link) => ({
      targetType: link.targetType,
      targetId: link.targetId,
      sourceType: args.sourceObjectType,
      sourceId: args.sourceObjectId,
      role: link.role,
      summary: link.summary,
      meta: uelMetaWithGraphSlot(link.graphSlot, {
        surfacedPointerMaterialization: true,
      }),
    }));
}

export async function upsertSurfacedEvidencePointerRecord(args: {
  input: SurfacedEvidencePointerUpsertInput;
  db: SurfacedEvidencePointerWriterDb;
  now?: Date;
}): Promise<{ id: string }> {
  const now = args.now ?? new Date();
  const shared: Omit<
    Prisma.SurfacedEvidencePointerUncheckedCreateInput,
    "createdAt"
  > = {
    id: args.input.id,
    userId: args.input.userId,
    pointerKind: args.input.pointerKind,
    surface: "today_evidence_pointer",
    sourceObjectType: args.input.sourceObjectType,
    sourceObjectId: args.input.sourceObjectId,
    sourceText: args.input.sourceText,
    sourceOrigin: args.input.sourceOrigin,
    whyItMatters: args.input.whyItMatters,
    whyResurfaced: args.input.whyResurfaced ?? null,
    sourceEvidenceId: args.input.sourceEvidenceId ?? null,
    libraryReceiptId: args.input.libraryReceiptId ?? null,
    detailHref: args.input.detailHref ?? null,
    publicEligible: args.input.publicEligible,
    status: "active",
    materializedFrom: args.input.materializedFrom,
    surfacedAt: args.input.surfacedAt,
    updatedAt: now,
  };

  const row = await args.db.surfacedEvidencePointer.upsert({
    where: {
      userId_sourceObjectType_sourceObjectId: {
        userId: args.input.userId,
        sourceObjectType: args.input.sourceObjectType,
        sourceObjectId: args.input.sourceObjectId,
      },
    },
    create: {
      ...shared,
      createdAt: now,
    },
    update: shared,
    select: { id: true },
  });

  return row;
}

function buildPointerWriteInput(args: {
  input: SurfacedEvidencePointerMaterializationInput;
  pointerId: string;
  pointerKind: SurfacedPointerKind;
  surfacedAt: Date;
  publicEligible: boolean;
}): SurfacedEvidencePointerWriteInput {
  return {
    id: args.pointerId,
    userId: args.input.userId,
    pointerKind: args.pointerKind,
    sourceObjectType: args.input.sourceObjectType,
    sourceObjectId: args.input.sourceObjectId,
    sourceText: args.input.sourceText,
    sourceOrigin: args.input.sourceOrigin,
    surfacedAt: args.surfacedAt,
    whyItMatters: args.input.whyItMatters,
    whyResurfaced: args.input.whyResurfaced,
    libraryReceiptId: args.input.libraryReceiptId,
    detailHref: args.input.detailHref,
  };
}

function buildUpsertInput(args: {
  input: SurfacedEvidencePointerMaterializationInput;
  pointerId: string;
  pointerKind: SurfacedPointerKind;
  surfacedAt: Date;
}): SurfacedEvidencePointerUpsertInput {
  return {
    id: args.pointerId,
    userId: args.input.userId,
    pointerKind: args.pointerKind,
    sourceObjectType: args.input.sourceObjectType,
    sourceObjectId: args.input.sourceObjectId,
    sourceText: args.input.sourceText,
    sourceOrigin: args.input.sourceOrigin,
    whyItMatters: args.input.whyItMatters,
    surfacedAt: args.surfacedAt,
    publicEligible: true,
    materializedFrom: args.input.materializedFrom,
    whyResurfaced: args.input.whyResurfaced,
    sourceEvidenceId: args.input.sourceEvidenceId,
    libraryReceiptId: args.input.libraryReceiptId,
    detailHref: args.input.detailHref,
  };
}

export async function materializeSurfacedEvidencePointerForUser(
  input: SurfacedEvidencePointerMaterializationInput,
  deps: SurfacedEvidencePointerMaterializationDeps = {},
): Promise<SurfacedEvidencePointerMaterializationResult> {
  const now = deps.now?.() ?? new Date();
  const surfacedAt = input.surfacedAt ?? now;
  const pointerKind = resolveSurfacedPointerKind(input.sourceObjectType);
  const pointerId = buildSurfacedEvidencePointerId({
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
  });

  const normalizedLinks = await normalizeSurfacedEvidencePointerLinks({
    userId: input.userId,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    links: input.links,
    resolveLinkPublicEligibility: deps.resolveLinkPublicEligibility,
  });

  const pointerWriteInput = buildPointerWriteInput({
    input,
    pointerId: pointerId ?? "",
    pointerKind: pointerKind ?? "pattern",
    surfacedAt,
    publicEligible: false,
  });

  const assessment = assessSurfacedEvidencePointerMaterialization({
    pointer: pointerWriteInput,
    links: normalizedLinks,
  });

  if (!assessment.materializationReady || !pointerId || !pointerKind) {
    return { ok: false, assessment };
  }

  const pointer = buildUpsertInput({
    input,
    pointerId,
    pointerKind,
    surfacedAt,
  });

  const uelLinkPayloads = buildUnderstandingEvidenceLinksForSurfacedPointer({
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    links: normalizedLinks,
  });

  let persistedPointerId: string | null = null;
  let uelLinksWritten = 0;

  if (deps.upsertSurfacedEvidencePointer && deps.db) {
    const persisted = await deps.upsertSurfacedEvidencePointer({
      input: pointer,
      db: deps.db,
      now,
    });
    persistedPointerId = persisted.id;
  }

  if (deps.createUnderstandingEvidenceLink) {
    for (const linkInput of uelLinkPayloads) {
      try {
        const created = await deps.createUnderstandingEvidenceLink({
          userId: input.userId,
          input: linkInput,
        });
        if (created) {
          uelLinksWritten += 1;
        }
      } catch (error) {
        if (error instanceof UnderstandingEvidenceLinkDuplicateError) {
          continue;
        }
        throw error;
      }
    }
  }

  return {
    ok: true,
    pointerId,
    pointerKind,
    pointer,
    normalizedLinks,
    uelLinkPayloads,
    persistedPointerId,
    uelLinksWritten,
    assessment,
  };
}
