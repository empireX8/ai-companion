/**
 * DEL-005 — Intelligence object authority runtime guards.
 *
 * Full matrix (human + machine):
 * - docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.md
 * - docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.json
 *
 * Runtime code keeps only the small safe guards needed without schema changes.
 * Do not silently merge distinct semantic types. Do not invent Decision/Outcome rows.
 */

export const INTELLIGENCE_OBJECT_AUTHORITY_CONTRACT_ID =
  "ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001" as const;

export const SEMANTIC_AUTHORITY_ROLES = [
  "RAW_EVIDENCE",
  "EXPLICIT_MEMORY",
  "PATTERN_INTELLIGENCE",
  "CANONICAL_CURRENT_MODEL",
  "CONTRADICTION_OR_CONFLICT",
  "OPEN_INQUIRY",
  "FIELDWORK_OR_OBSERVATION",
  "INTERNAL_CANDIDATE_OR_PROPOSAL",
  "ACTION_PROJECTION",
  "DECISION",
  "OUTCOME",
  "MODEL_MOVEMENT_LEDGER",
  "USER_FACING_PROJECTION",
  "LEGACY_OR_TRANSLATION_INPUT",
] as const;

export type SemanticAuthorityRole = (typeof SEMANTIC_AUTHORITY_ROLES)[number];

export const PATTERN_TYPE_FAMILIES = [
  "trigger_condition",
  "inner_critic",
  "repetitive_loop",
  "contradiction_drift",
  "recovery_stabilizer",
] as const;

/** Objects that may independently serve as governed current-model truth. */
export const CANONICAL_CURRENT_TRUTH_OBJECTS = [
  "UserMapConclusion",
  "ContradictionNode",
  "ReferenceItem",
] as const;

/**
 * Objects that must never be treated as canonical current truth by themselves.
 * ModelUpdate is movement ledger; SurfacedAction is action projection; etc.
 */
export const NEVER_CANONICAL_CURRENT_TRUTH_OBJECTS = [
  "ModelUpdate",
  "ExploreMovementProposal",
  "SurfacedAction",
  "ProfileArtifact",
  "UnderstandingEvidenceLink",
  "SurfacedEvidencePointer",
  "CanonicalTodayComposition",
  "CanonicalModelMovementReport",
  "Decision",
  "Outcome",
  "FieldworkAssignment",
  "Investigation",
  "Session",
  "Message",
  "JournalEntry",
  "QuickCheckIn",
  "EvidenceSpan",
  "PatternClaimEvidence",
  "ContradictionEvidence",
] as const;

/**
 * Supported UnderstandingEvidenceLink source→target pairs.
 * "Supported" means the current writer can ownership-verify both ends for an
 * owned persisted row. It does not independently prove a semantic claim is true.
 * `timeline_aggregation` and `user_correction` remain Prisma enum values but are
 * not writer-eligible (no verifiable persisted source object).
 */
export const SUPPORTED_EVIDENCE_LINK_PAIRS: ReadonlyArray<{
  sourceType: string;
  targetType: string;
}> = [
  { sourceType: "pattern_claim", targetType: "usermap_conclusion" },
  { sourceType: "pattern_claim", targetType: "investigation" },
  { sourceType: "pattern_claim", targetType: "model_update" },
  { sourceType: "pattern_claim", targetType: "fieldwork_assignment" },
  { sourceType: "pattern_claim", targetType: "surfaced_action" },
  { sourceType: "pattern_claim", targetType: "pattern_claim" },
  { sourceType: "pattern_claim", targetType: "contradiction_node" },
  { sourceType: "pattern_claim", targetType: "canonical_concept_revision" },
  { sourceType: "pattern_claim_evidence", targetType: "usermap_conclusion" },
  { sourceType: "pattern_claim_evidence", targetType: "investigation" },
  { sourceType: "pattern_claim_evidence", targetType: "model_update" },
  { sourceType: "pattern_claim_evidence", targetType: "fieldwork_assignment" },
  { sourceType: "pattern_claim_evidence", targetType: "surfaced_action" },
  { sourceType: "pattern_claim_evidence", targetType: "pattern_claim" },
  { sourceType: "pattern_claim_evidence", targetType: "contradiction_node" },
  {
    sourceType: "pattern_claim_evidence",
    targetType: "canonical_concept_revision",
  },
  { sourceType: "contradiction_node", targetType: "usermap_conclusion" },
  { sourceType: "contradiction_node", targetType: "investigation" },
  { sourceType: "contradiction_node", targetType: "model_update" },
  { sourceType: "contradiction_node", targetType: "fieldwork_assignment" },
  { sourceType: "contradiction_node", targetType: "surfaced_action" },
  { sourceType: "contradiction_node", targetType: "pattern_claim" },
  { sourceType: "contradiction_node", targetType: "contradiction_node" },
  {
    sourceType: "contradiction_node",
    targetType: "canonical_concept_revision",
  },
  { sourceType: "contradiction_evidence", targetType: "usermap_conclusion" },
  { sourceType: "contradiction_evidence", targetType: "investigation" },
  { sourceType: "contradiction_evidence", targetType: "model_update" },
  { sourceType: "contradiction_evidence", targetType: "fieldwork_assignment" },
  { sourceType: "contradiction_evidence", targetType: "surfaced_action" },
  { sourceType: "contradiction_evidence", targetType: "pattern_claim" },
  { sourceType: "contradiction_evidence", targetType: "contradiction_node" },
  {
    sourceType: "contradiction_evidence",
    targetType: "canonical_concept_revision",
  },
  { sourceType: "profile_artifact", targetType: "usermap_conclusion" },
  { sourceType: "profile_artifact", targetType: "investigation" },
  { sourceType: "profile_artifact", targetType: "model_update" },
  { sourceType: "profile_artifact", targetType: "fieldwork_assignment" },
  { sourceType: "profile_artifact", targetType: "surfaced_action" },
  { sourceType: "profile_artifact", targetType: "pattern_claim" },
  { sourceType: "profile_artifact", targetType: "contradiction_node" },
  {
    sourceType: "profile_artifact",
    targetType: "canonical_concept_revision",
  },
  { sourceType: "evidence_span", targetType: "usermap_conclusion" },
  { sourceType: "evidence_span", targetType: "investigation" },
  { sourceType: "evidence_span", targetType: "model_update" },
  { sourceType: "evidence_span", targetType: "fieldwork_assignment" },
  { sourceType: "evidence_span", targetType: "surfaced_action" },
  { sourceType: "evidence_span", targetType: "pattern_claim" },
  { sourceType: "evidence_span", targetType: "contradiction_node" },
  { sourceType: "evidence_span", targetType: "canonical_concept_revision" },
  { sourceType: "reference_item", targetType: "usermap_conclusion" },
  { sourceType: "reference_item", targetType: "investigation" },
  { sourceType: "reference_item", targetType: "model_update" },
  { sourceType: "reference_item", targetType: "fieldwork_assignment" },
  { sourceType: "reference_item", targetType: "surfaced_action" },
  { sourceType: "reference_item", targetType: "pattern_claim" },
  { sourceType: "reference_item", targetType: "contradiction_node" },
  { sourceType: "reference_item", targetType: "canonical_concept_revision" },
  { sourceType: "surfaced_action", targetType: "usermap_conclusion" },
  { sourceType: "surfaced_action", targetType: "investigation" },
  { sourceType: "surfaced_action", targetType: "model_update" },
  { sourceType: "surfaced_action", targetType: "fieldwork_assignment" },
  { sourceType: "surfaced_action", targetType: "surfaced_action" },
  { sourceType: "surfaced_action", targetType: "pattern_claim" },
  { sourceType: "surfaced_action", targetType: "contradiction_node" },
  {
    sourceType: "surfaced_action",
    targetType: "canonical_concept_revision",
  },
  { sourceType: "journal_entry", targetType: "usermap_conclusion" },
  { sourceType: "journal_entry", targetType: "investigation" },
  { sourceType: "journal_entry", targetType: "model_update" },
  { sourceType: "journal_entry", targetType: "fieldwork_assignment" },
  { sourceType: "journal_entry", targetType: "surfaced_action" },
  { sourceType: "journal_entry", targetType: "pattern_claim" },
  { sourceType: "journal_entry", targetType: "contradiction_node" },
  { sourceType: "journal_entry", targetType: "canonical_concept_revision" },
  { sourceType: "quick_check_in", targetType: "usermap_conclusion" },
  { sourceType: "quick_check_in", targetType: "investigation" },
  { sourceType: "quick_check_in", targetType: "model_update" },
  { sourceType: "quick_check_in", targetType: "fieldwork_assignment" },
  { sourceType: "quick_check_in", targetType: "surfaced_action" },
  { sourceType: "quick_check_in", targetType: "pattern_claim" },
  { sourceType: "quick_check_in", targetType: "contradiction_node" },
  { sourceType: "quick_check_in", targetType: "canonical_concept_revision" },
  { sourceType: "session", targetType: "usermap_conclusion" },
  { sourceType: "session", targetType: "investigation" },
  { sourceType: "session", targetType: "model_update" },
  { sourceType: "session", targetType: "fieldwork_assignment" },
  { sourceType: "session", targetType: "surfaced_action" },
  { sourceType: "session", targetType: "pattern_claim" },
  { sourceType: "session", targetType: "contradiction_node" },
  { sourceType: "session", targetType: "canonical_concept_revision" },
  { sourceType: "message", targetType: "usermap_conclusion" },
  { sourceType: "message", targetType: "investigation" },
  { sourceType: "message", targetType: "model_update" },
  { sourceType: "message", targetType: "fieldwork_assignment" },
  { sourceType: "message", targetType: "surfaced_action" },
  { sourceType: "message", targetType: "pattern_claim" },
  { sourceType: "message", targetType: "contradiction_node" },
  { sourceType: "message", targetType: "canonical_concept_revision" },
  { sourceType: "import_record", targetType: "usermap_conclusion" },
  { sourceType: "import_record", targetType: "investigation" },
  { sourceType: "import_record", targetType: "model_update" },
  { sourceType: "import_record", targetType: "fieldwork_assignment" },
  { sourceType: "import_record", targetType: "surfaced_action" },
  { sourceType: "import_record", targetType: "pattern_claim" },
  { sourceType: "import_record", targetType: "contradiction_node" },
  { sourceType: "import_record", targetType: "canonical_concept_revision" },
];

/**
 * Source types that currently have an ownership-verification branch capable of
 * returning true for an owned persisted row. `timeline_aggregation` and
 * `user_correction` remain Prisma enum values but are not writer-eligible.
 */
export const OWNERSHIP_VERIFIABLE_SOURCE_TYPES = [
  "pattern_claim",
  "pattern_claim_evidence",
  "contradiction_node",
  "contradiction_evidence",
  "profile_artifact",
  "evidence_span",
  "reference_item",
  "surfaced_action",
  "quick_check_in",
  "journal_entry",
  "session",
  "message",
  "import_record",
] as const;

/** Reserved enum sources that are not currently ownership-verifiable writers. */
export const RESERVED_NON_WRITABLE_SOURCE_TYPES = [
  "timeline_aggregation",
  "user_correction",
] as const;

export function canServeAsCanonicalCurrentTruth(objectName: string): boolean {
  if (
    (NEVER_CANONICAL_CURRENT_TRUTH_OBJECTS as readonly string[]).includes(
      objectName,
    )
  ) {
    return false;
  }
  return (CANONICAL_CURRENT_TRUTH_OBJECTS as readonly string[]).includes(
    objectName,
  );
}

/**
 * ProfileArtifact may supply evidence/candidate input but must not outrank a
 * governed canonical current object (UserMapConclusion / qualifying ReferenceItem /
 * ContradictionNode) where one exists for the same concept.
 */
export function profileArtifactMayOutrankCanonicalCurrent(): false {
  return false;
}

export function assertCanonicalCurrentTruthObject(objectName: string): void {
  if (!canServeAsCanonicalCurrentTruth(objectName)) {
    throw new Error(
      `Object "${objectName}" is not canonical current-model truth under ${INTELLIGENCE_OBJECT_AUTHORITY_CONTRACT_ID}`,
    );
  }
}

export function isSupportedEvidenceLinkPair(args: {
  sourceType: string;
  targetType: string;
}): boolean {
  return SUPPORTED_EVIDENCE_LINK_PAIRS.some(
    (pair) =>
      pair.sourceType === args.sourceType && pair.targetType === args.targetType,
  );
}

export class EvidenceLinkPairValidationError extends Error {
  readonly sourceType: string;
  readonly targetType: string;

  constructor(args: { sourceType: string; targetType: string }) {
    super(
      `Unsupported evidence-link pair ${args.sourceType} → ${args.targetType}`,
    );
    this.name = "EvidenceLinkPairValidationError";
    this.sourceType = args.sourceType;
    this.targetType = args.targetType;
  }
}

export function assertSupportedEvidenceLinkPair(args: {
  sourceType: string;
  targetType: string;
}): void {
  if (!isSupportedEvidenceLinkPair(args)) {
    throw new EvidenceLinkPairValidationError(args);
  }
}

export type CanonicalSourceTypeTag =
  | "Session"
  | "Message"
  | "JournalEntry"
  | "QuickCheckIn"
  | "ImportUploadSession"
  | "EvidenceSpan"
  | "ReferenceItem"
  | "ProfileArtifact"
  | "PatternClaim"
  | "PatternClaimEvidence"
  | "ContradictionNode"
  | "ContradictionEvidence"
  | "UserMapConclusion"
  | "Investigation"
  | "FieldworkAssignment"
  | "ExploreMovementProposal"
  | "SurfacedAction"
  | "ModelUpdate"
  | "UnderstandingEvidenceLink"
  | "SurfacedEvidencePointer"
  | "CanonicalTodayComposition"
  | "CanonicalModelMovementReport"
  | "Decision"
  | "Outcome"
  | "UserFacingProjection";

export function withCanonicalSourceType<T extends object>(
  object: T,
  canonicalSourceType: CanonicalSourceTypeTag,
): T & { canonicalSourceType: CanonicalSourceTypeTag } {
  return {
    ...object,
    canonicalSourceType,
  };
}

export function isReferenceOrFixtureAuthoritySource(
  canonicalSourceType: string | null | undefined,
): boolean {
  return (
    canonicalSourceType === "CanonicalTodayComposition" ||
    canonicalSourceType === "CanonicalModelMovementReport"
  );
}

/**
 * Map recognised inspector object types to authority object names.
 * Intentionally omits ambiguous projections (context_profile, model_goal, receipt).
 */
export function canonicalSourceTypeFromInspectorType(
  inspectorObjectType: string | null | undefined,
): CanonicalSourceTypeTag | null {
  switch (inspectorObjectType) {
    case "usermap_conclusion":
      return "UserMapConclusion";
    case "contradiction_node":
      return "ContradictionNode";
    case "pattern_claim":
      return "PatternClaim";
    case "model_update":
      return "ModelUpdate";
    case "investigation":
      return "Investigation";
    case "fieldwork_assignment":
      return "FieldworkAssignment";
    case "surfaced_action":
    case "reference_decision":
      return "SurfacedAction";
    case "reference_item":
      return "ReferenceItem";
    case "explore_movement_proposal":
      return "ExploreMovementProposal";
    default:
      return null;
  }
}

/** @deprecated Prefer canonicalSourceTypeFromInspectorType */
export function canonicalObjectNameFromInspectorType(
  inspectorObjectType: string | null | undefined,
): string | null {
  return canonicalSourceTypeFromInspectorType(inspectorObjectType);
}

/**
 * Resolve canonicalSourceType only when the projection's typed identity is
 * unambiguous. Does not invent tags for mixed mind-context / goal / receipt
 * satellites.
 */
export function resolveCanonicalSourceType(object: {
  canonicalSourceType?: string | null;
  inspectorObjectType?: string | null;
  type?: string | null;
}): CanonicalSourceTypeTag | undefined {
  if (object.canonicalSourceType) {
    return object.canonicalSourceType as CanonicalSourceTypeTag;
  }

  // Prefer unambiguous OrvekObject.type projections (row identity).
  switch (object.type) {
    case "investigation":
      return "Investigation";
    case "fieldwork":
      return "FieldworkAssignment";
    case "decision":
      return "SurfacedAction";
    case "model-update":
      return "ModelUpdate";
    default:
      break;
  }

  return canonicalSourceTypeFromInspectorType(object.inspectorObjectType) ?? undefined;
}

export function withResolvedCanonicalSourceType<
  T extends {
    canonicalSourceType?: string | null;
    inspectorObjectType?: string | null;
    type?: string | null;
  },
>(object: T): T {
  const resolved = resolveCanonicalSourceType(object);
  if (!resolved || object.canonicalSourceType === resolved) {
    return object;
  }
  return {
    ...object,
    canonicalSourceType: resolved,
  };
}
