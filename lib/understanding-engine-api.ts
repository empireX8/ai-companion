import {
  FieldworkStatus,
  InvestigationSeedType,
  InvestigationStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConfidenceLevel,
} from "@prisma/client";
import { z } from "zod";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type SortOrder = "asc" | "desc";

type ErrorDetail = {
  field?: string;
  message: string;
};

export function errorResponse(
  status: number,
  error: string,
  code: string,
  details?: ErrorDetail[]
) {
  return Response.json(
    {
      error,
      code,
      ...(details && details.length > 0 ? { details } : {}),
    },
    { status }
  );
}

export function listSuccess<T>(
  items: T[],
  limit: number,
  hasMore: boolean,
  nextCursor: string | null
) {
  return Response.json({
    items,
    pageInfo: {
      nextCursor,
      limit,
      hasMore,
    },
  });
}

export function detailSuccess<T>(item: T) {
  return Response.json({ item });
}

export function parseLimit(value: string | null): number | null {
  if (value === null) {
    return DEFAULT_LIMIT;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    return null;
  }
  return parsed;
}

export function parseSortOrder(value: string | null): SortOrder | null {
  if (value === null) {
    return "desc";
  }
  if (value === "asc" || value === "desc") {
    return value;
  }
  return null;
}

export function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function applyDateCursorFilter<T extends string>(
  field: T,
  cursorDate: Date | null,
  sortOrder: SortOrder
): Record<string, unknown> {
  if (!cursorDate) {
    return {};
  }
  return {
    [field]: {
      [sortOrder === "desc" ? "lt" : "gt"]: cursorDate,
    },
  };
}

export function ensureAtLeastOnePatchField(
  payload: Record<string, unknown>
): boolean {
  return Object.keys(payload).length > 0;
}

const nonEmptyStringSchema = z.string().trim().min(1);

export const userMapConclusionCreateSchema = z.object({
  area: z.nativeEnum(UserMapConclusionArea),
  status: z.nativeEnum(UserMapConclusionStatus),
  title: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  confidenceScore: z.number().min(0).max(1),
  confidenceLevel: z.nativeEnum(UserMapConfidenceLevel),
  evidenceCount: z.number().int().min(0).default(0),
  sourceDiversity: z.number().int().min(0).default(0),
  timeSpreadDays: z.number().int().min(0).default(0),
  version: z.number().int().min(1).default(1),
  supersededById: z.string().trim().min(1).optional(),
  supersedesId: z.string().trim().min(1).optional(),
  firstEvidenceAt: z.coerce.date().optional(),
  lastEvidenceAt: z.coerce.date().optional(),
  lastUserCorrectionAt: z.coerce.date().optional(),
  lastUserCorrectionLabel: z.string().trim().min(1).optional(),
  correctionCount: z.number().int().min(0).default(0),
  notes: z.string().trim().min(1).optional(),
});

export const userMapConclusionPatchSchema = z
  .object({
    area: z.nativeEnum(UserMapConclusionArea).optional(),
    status: z.nativeEnum(UserMapConclusionStatus).optional(),
    title: nonEmptyStringSchema.optional(),
    summary: nonEmptyStringSchema.optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    confidenceLevel: z.nativeEnum(UserMapConfidenceLevel).optional(),
    evidenceCount: z.number().int().min(0).optional(),
    sourceDiversity: z.number().int().min(0).optional(),
    timeSpreadDays: z.number().int().min(0).optional(),
    version: z.number().int().min(1).optional(),
    supersededById: z.string().trim().min(1).nullable().optional(),
    supersedesId: z.string().trim().min(1).nullable().optional(),
    firstEvidenceAt: z.coerce.date().nullable().optional(),
    lastEvidenceAt: z.coerce.date().nullable().optional(),
    lastUserCorrectionAt: z.coerce.date().nullable().optional(),
    lastUserCorrectionLabel: z.string().trim().min(1).nullable().optional(),
    correctionCount: z.number().int().min(0).optional(),
    notes: z.string().trim().min(1).nullable().optional(),
  })
  .refine((payload) => ensureAtLeastOnePatchField(payload), {
    message: "At least one field is required",
  });

const jsonArraySchema = z.array(z.unknown());

export const investigationCreateSchema = z.object({
  title: nonEmptyStringSchema,
  organizingQuestion: nonEmptyStringSchema,
  status: z.nativeEnum(InvestigationStatus),
  seedType: z.nativeEnum(InvestigationSeedType),
  competingTheories: jsonArraySchema,
  evidenceNeeded: jsonArraySchema,
  resolutionSummary: z.string().trim().min(1).optional(),
  resolvedAt: z.coerce.date().optional(),
  resolvedIntoUserMapConclusionId: z.string().trim().min(1).optional(),
  reopenedAt: z.coerce.date().optional(),
  reopenReason: z.string().trim().min(1).optional(),
  priority: z.number().int().optional(),
});

export const investigationPatchSchema = z
  .object({
    title: nonEmptyStringSchema.optional(),
    organizingQuestion: nonEmptyStringSchema.optional(),
    status: z.nativeEnum(InvestigationStatus).optional(),
    seedType: z.nativeEnum(InvestigationSeedType).optional(),
    competingTheories: jsonArraySchema.optional(),
    evidenceNeeded: jsonArraySchema.optional(),
    resolutionSummary: z.string().trim().min(1).nullable().optional(),
    resolvedAt: z.coerce.date().nullable().optional(),
    resolvedIntoUserMapConclusionId: z.string().trim().min(1).nullable().optional(),
    reopenedAt: z.coerce.date().nullable().optional(),
    reopenReason: z.string().trim().min(1).nullable().optional(),
    priority: z.number().int().nullable().optional(),
  })
  .refine((payload) => ensureAtLeastOnePatchField(payload), {
    message: "At least one field is required",
  });

export const modelUpdateCreateSchema = z.object({
  updateType: z.nativeEnum(ModelUpdateType),
  visibility: z.nativeEnum(ModelUpdateVisibility),
  affectedObjectType: z.nativeEnum(UnderstandingLinkTargetType),
  affectedObjectId: nonEmptyStringSchema,
  userFacingSummary: nonEmptyStringSchema,
  isMeaningful: z.boolean(),
  beforeSummary: z.string().trim().min(1).optional(),
  afterSummary: z.string().trim().min(1).optional(),
  confidenceDelta: z.number().optional(),
  meaningfulDeltaScore: z.number().optional(),
  sourceRunId: z.string().trim().min(1).optional(),
  internalNotes: z.string().trim().min(1).optional(),
});

export const modelUpdatePatchSchema = z
  .object({
    visibility: z.nativeEnum(ModelUpdateVisibility).optional(),
    userFacingSummary: nonEmptyStringSchema.optional(),
    isMeaningful: z.boolean().optional(),
    beforeSummary: z.string().trim().min(1).nullable().optional(),
    afterSummary: z.string().trim().min(1).nullable().optional(),
    confidenceDelta: z.number().nullable().optional(),
    meaningfulDeltaScore: z.number().nullable().optional(),
    sourceRunId: z.string().trim().min(1).nullable().optional(),
    internalNotes: z.string().trim().min(1).nullable().optional(),
  })
  .refine((payload) => ensureAtLeastOnePatchField(payload), {
    message: "At least one field is required",
  });

export const fieldworkCreateSchema = z.object({
  prompt: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
  status: z.nativeEnum(FieldworkStatus),
  linkedObjectType: z.nativeEnum(UnderstandingLinkTargetType),
  linkedObjectId: nonEmptyStringSchema,
  observationNote: z.string().trim().min(1).optional(),
  observationOutcome: z.string().trim().min(1).optional(),
  completedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  priority: z.number().int().optional(),
});

export const fieldworkPatchSchema = z
  .object({
    prompt: nonEmptyStringSchema.optional(),
    reason: nonEmptyStringSchema.optional(),
    status: z.nativeEnum(FieldworkStatus).optional(),
    linkedObjectType: z.nativeEnum(UnderstandingLinkTargetType).optional(),
    linkedObjectId: nonEmptyStringSchema.optional(),
    observationNote: z.string().trim().min(1).nullable().optional(),
    observationOutcome: z.string().trim().min(1).nullable().optional(),
    completedAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    priority: z.number().int().nullable().optional(),
  })
  .refine((payload) => ensureAtLeastOnePatchField(payload), {
    message: "At least one field is required",
  });

export const evidenceLinkCreateSchema = z.object({
  targetType: z.nativeEnum(UnderstandingLinkTargetType),
  targetId: nonEmptyStringSchema,
  sourceType: z.nativeEnum(UnderstandingLinkSourceType),
  sourceId: nonEmptyStringSchema,
  role: z.nativeEnum(UnderstandingLinkRole),
  summary: z.string().trim().min(1).optional(),
  snippet: z.string().trim().min(1).optional(),
  quote: z.string().trim().min(1).optional(),
  weight: z.number().nullable().optional(),
  confidenceContribution: z.number().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const USER_MAP_TRANSITIONS: Record<UserMapConclusionStatus, UserMapConclusionStatus[]> = {
  hypothesis: ["tentative", "disputed", "superseded"],
  tentative: ["emerging", "disputed", "superseded"],
  emerging: ["supported", "disputed", "superseded"],
  supported: ["disputed", "superseded"],
  disputed: ["disputed", "superseded", "tentative", "emerging"],
  superseded: [],
};

export function isAllowedUserMapTransition(
  current: UserMapConclusionStatus,
  next: UserMapConclusionStatus
): boolean {
  if (current === next) {
    return true;
  }
  return USER_MAP_TRANSITIONS[current].includes(next);
}

export function hasDisputedRecoveryRationale(args: {
  currentEvidenceCount: number;
  currentSourceDiversity: number;
  currentTimeSpreadDays: number;
  patchEvidenceCount?: number;
  patchSourceDiversity?: number;
  patchTimeSpreadDays?: number;
  notes?: string | null;
  lastUserCorrectionLabel?: string | null;
}): boolean {
  return (
    Boolean(args.notes?.trim()) ||
    Boolean(args.lastUserCorrectionLabel?.trim()) ||
    (typeof args.patchEvidenceCount === "number" &&
      args.patchEvidenceCount > args.currentEvidenceCount) ||
    (typeof args.patchSourceDiversity === "number" &&
      args.patchSourceDiversity > args.currentSourceDiversity) ||
    (typeof args.patchTimeSpreadDays === "number" &&
      args.patchTimeSpreadDays > args.currentTimeSpreadDays)
  );
}

const INVESTIGATION_TRANSITIONS: Record<InvestigationStatus, InvestigationStatus[]> = {
  open: ["gathering_evidence", "abandoned"],
  gathering_evidence: ["testing", "abandoned"],
  testing: ["resolving", "abandoned"],
  resolving: ["resolved", "abandoned"],
  resolved: ["reopened"],
  reopened: ["gathering_evidence", "testing", "resolving", "resolved", "abandoned"],
  abandoned: [],
};

export function isAllowedInvestigationTransition(
  current: InvestigationStatus,
  next: InvestigationStatus
): boolean {
  if (current === next) {
    return true;
  }
  return INVESTIGATION_TRANSITIONS[current].includes(next);
}

const FIELDWORK_TRANSITIONS: Record<FieldworkStatus, FieldworkStatus[]> = {
  assigned: ["active", "completed", "dismissed", "expired"],
  active: ["completed", "dismissed", "expired"],
  completed: [],
  dismissed: [],
  expired: [],
};

export function isAllowedFieldworkTransition(
  current: FieldworkStatus,
  next: FieldworkStatus
): boolean {
  if (current === next) {
    return true;
  }
  return FIELDWORK_TRANSITIONS[current].includes(next);
}

export function hasFieldworkObservationPayload(args: {
  observationNote?: string | null;
  observationOutcome?: string | null;
}): boolean {
  return (
    Boolean(args.observationNote?.trim()) ||
    Boolean(args.observationOutcome?.trim())
  );
}

const MODEL_UPDATE_VISIBILITY_TRANSITIONS: Record<
  ModelUpdateVisibility,
  ModelUpdateVisibility[]
> = {
  internal_only: ["candidate"],
  candidate: ["user_visible", "internal_only"],
  user_visible: ["internal_only"],
};

export function isAllowedModelUpdateVisibilityTransition(
  current: ModelUpdateVisibility,
  next: ModelUpdateVisibility
): boolean {
  if (current === next) {
    return true;
  }
  return MODEL_UPDATE_VISIBILITY_TRANSITIONS[current].includes(next);
}

export function zodIssuesToDetails(issues: z.ZodIssue[]): ErrorDetail[] {
  return issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
