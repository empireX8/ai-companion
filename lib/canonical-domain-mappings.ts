/**
 * Explicit domain mappings and raw-field enum guards for
 * Orvek Canonical Model Authority V1.
 */

import {
  CandidateLifecycleStatus,
  CanonicalConceptDomain,
  CanonicalRevisionStatus,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
} from "@prisma/client";

import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";

const AREA_VALUES = Object.values(UserMapConclusionArea);
const STATUS_VALUES = Object.values(UserMapConclusionStatus);
const VISIBILITY_VALUES = Object.values(UserMapConclusionVisibility);
const CONFIDENCE_VALUES = Object.values(UserMapConfidenceLevel);
const LIFECYCLE_VALUES = Object.values(CandidateLifecycleStatus);

const AREA_TO_DOMAIN: Readonly<
  Record<UserMapConclusionArea, CanonicalConceptDomain>
> = {
  [UserMapConclusionArea.operating_logic]: CanonicalConceptDomain.operating_logic,
  [UserMapConclusionArea.state_ecology]: CanonicalConceptDomain.state_ecology,
  [UserMapConclusionArea.tension_architecture]:
    CanonicalConceptDomain.tension_architecture,
  [UserMapConclusionArea.recovery_architecture]:
    CanonicalConceptDomain.recovery_architecture,
  [UserMapConclusionArea.meaning_system]: CanonicalConceptDomain.meaning_system,
  [UserMapConclusionArea.relational_field]:
    CanonicalConceptDomain.relational_field,
  [UserMapConclusionArea.developmental_vector]:
    CanonicalConceptDomain.developmental_vector,
  [UserMapConclusionArea.current_frontier]:
    CanonicalConceptDomain.current_frontier,
};

const STATUS_TO_REVISION: Readonly<
  Partial<Record<UserMapConclusionStatus, CanonicalRevisionStatus>>
> = {
  [UserMapConclusionStatus.hypothesis]: CanonicalRevisionStatus.hypothesis,
  [UserMapConclusionStatus.tentative]: CanonicalRevisionStatus.tentative,
  [UserMapConclusionStatus.emerging]: CanonicalRevisionStatus.emerging,
  [UserMapConclusionStatus.supported]: CanonicalRevisionStatus.supported,
  [UserMapConclusionStatus.disputed]: CanonicalRevisionStatus.disputed,
};

function isOneOf<T extends string>(
  values: readonly T[],
  raw: unknown,
): raw is T {
  return typeof raw === "string" && (values as readonly string[]).includes(raw);
}

/** Known UMC areas map 1:1; anything else becomes CanonicalConceptDomain.unknown. */
export function mapUserMapAreaToCanonicalDomain(
  area: UserMapConclusionArea | string,
): CanonicalConceptDomain {
  if (isOneOf(AREA_VALUES, area)) {
    return AREA_TO_DOMAIN[area];
  }
  return CanonicalConceptDomain.unknown;
}

export function requireUserMapConclusionStatus(
  raw: unknown,
): UserMapConclusionStatus {
  if (!isOneOf(STATUS_VALUES, raw)) {
    throw new CanonicalModelAuthorityError(
      "INVALID_UMC_FIELD",
      `Invalid UserMapConclusion.status: ${String(raw)}`,
    );
  }
  return raw;
}

export function requireUserMapConclusionVisibility(
  raw: unknown,
): UserMapConclusionVisibility {
  if (!isOneOf(VISIBILITY_VALUES, raw)) {
    throw new CanonicalModelAuthorityError(
      "INVALID_UMC_FIELD",
      `Invalid UserMapConclusion.visibility: ${String(raw)}`,
    );
  }
  return raw;
}

export function requireUserMapConfidenceLevel(
  raw: unknown,
): UserMapConfidenceLevel {
  if (!isOneOf(CONFIDENCE_VALUES, raw)) {
    throw new CanonicalModelAuthorityError(
      "INVALID_UMC_FIELD",
      `Invalid UserMapConclusion.confidenceLevel: ${String(raw)}`,
    );
  }
  return raw;
}

/** null is valid (legacy / unmanaged). Unknown non-null strings fail closed. */
export function requireCandidateLifecycleStatusOrNull(
  raw: unknown,
): CandidateLifecycleStatus | null {
  if (raw == null) return null;
  if (!isOneOf(LIFECYCLE_VALUES, raw)) {
    throw new CanonicalModelAuthorityError(
      "INVALID_UMC_FIELD",
      `Invalid UserMapConclusion.candidateLifecycleStatus: ${String(raw)}`,
    );
  }
  return raw;
}

export function mapUserMapStatusToCanonicalRevisionStatus(
  status: UserMapConclusionStatus,
): CanonicalRevisionStatus {
  const mapped = STATUS_TO_REVISION[status];
  if (!mapped) {
    throw new CanonicalModelAuthorityError(
      "INVALID_UMC_STATUS_MAPPING",
      `UserMapConclusion status "${status}" cannot map to CanonicalRevisionStatus`,
    );
  }
  return mapped;
}

export function buildLegacyUserMapConclusionRegistrationKey(
  userMapConclusionId: string,
): string {
  return `legacy:usermap_conclusion:${userMapConclusionId}`;
}
