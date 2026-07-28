/**
 * Shared canonical → Map detail/evidence mapper for route Map and hybrid workbench.
 */

import type { CanonicalProductConceptV1 } from "./canonical-model-product-projection";
import {
  CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_ENDPOINT,
  fetchCanonicalProductConcept,
} from "./canonical-model-client";
import { mapCanonicalDomainToUserMapArea } from "./canonical-domain-mappings";
import type { CurrentUnderstandingSurfaceListItem } from "./current-understanding-product-projection";
import {
  fetchInspectorEvidenceLinks,
  fetchInspectorUserMapDetail,
  INSPECTOR_USER_MAP_DETAIL_ENDPOINT,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorEvidenceLinkItem,
} from "./inspector-object-api";
import {
  formatPublicEvidenceSourceTypeLabel,
  formatPublicEvidenceSummaryLabel,
} from "./public-continuity-registry";
import type { UserMapConclusionPublicApiDetailItem } from "./public-intelligence-safe-slice";
import type { UserMapConclusionStatus } from "@prisma/client";

function revisionStatusToUmcStatus(status: string): UserMapConclusionStatus {
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

/** Pure mapper: canonical product concept → Map detail + evidence rows. */
export function mapCanonicalProductConceptToMapDetail(args: {
  concept: CanonicalProductConceptV1;
}): {
  detail: UserMapConclusionPublicApiDetailItem;
  evidence: InspectorEvidenceLinkItem[];
} {
  const { concept } = args;
  return {
    detail: {
      id: concept.conceptId,
      title: concept.title,
      summary: concept.summary,
      area: mapCanonicalDomainToUserMapArea(concept.domain),
      status: revisionStatusToUmcStatus(concept.status),
      confidenceLevel: concept.confidenceLevel,
      evidenceCount: concept.evidenceCount,
      updatedAt: concept.acceptedAt,
      sourceDiversity: null,
      timeSpreadDays: null,
      createdAt: concept.acceptedAt,
      currentRevisionId: concept.currentRevisionId,
      version: concept.version,
      authorityType: "canonical_concept_revision",
    },
    evidence: concept.evidence.map((row) => ({
      id: row.id,
      sourceTypeLabel: formatPublicEvidenceSourceTypeLabel(row.sourceType),
      evidenceSummaryLabel:
        row.disclosure === "public"
          ? formatPublicEvidenceSummaryLabel()
          : row.summary || formatPublicEvidenceSummaryLabel(),
      sourceObjectHref: row.sourceObjectHref,
      createdAt: null,
      hasEvidence: true as const,
      sourceType: row.sourceType,
      sourceId: row.sourceId ?? undefined,
      linkRole: row.role,
    })),
  };
}

export type MapDetailAuthorityPath = "canonical" | "legacy" | "none";

/**
 * Authority-aware Map detail loader used by hybrid workbench (and testable without React).
 * Canonical selections never call legacy UMC detail/evidence routes.
 */
export async function loadMapDetailForSelectedConclusion(args: {
  selectedId: string;
  items: CurrentUnderstandingSurfaceListItem[];
  fetchCanonical?: typeof fetchCanonicalProductConcept;
  fetchLegacyDetail?: typeof fetchInspectorUserMapDetail;
  fetchLegacyEvidence?: (
    endpoint: string,
  ) => Promise<InspectorEvidenceLinkItem[]>;
}): Promise<{
  detail: UserMapConclusionPublicApiDetailItem | null;
  evidence: InspectorEvidenceLinkItem[];
  authorityPath: MapDetailAuthorityPath;
  canonicalEndpoint: string | null;
  legacyDetailEndpoint: string | null;
}> {
  const selected = args.items.find((item) => item.id === args.selectedId);
  if (!selected) {
    return {
      detail: null,
      evidence: [],
      authorityPath: "none",
      canonicalEndpoint: null,
      legacyDetailEndpoint: null,
    };
  }

  if (selected.authorityType === "canonical_concept_revision") {
    const conceptId = selected.conceptId ?? selected.id;
    const fetchCanonical =
      args.fetchCanonical ?? fetchCanonicalProductConcept;
    const concept = await fetchCanonical(conceptId);
    if (!concept || concept === "unavailable") {
      return {
        detail: null,
        evidence: [],
        authorityPath: "canonical",
        canonicalEndpoint: CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_ENDPOINT(conceptId),
        legacyDetailEndpoint: null,
      };
    }
    const mapped = mapCanonicalProductConceptToMapDetail({ concept });
    return {
      ...mapped,
      authorityPath: "canonical",
      canonicalEndpoint: CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_ENDPOINT(conceptId),
      legacyDetailEndpoint: null,
    };
  }

  const fetchLegacyDetail = args.fetchLegacyDetail ?? fetchInspectorUserMapDetail;
  const fetchLegacyEvidence =
    args.fetchLegacyEvidence ?? fetchInspectorEvidenceLinks;
  const [detail, evidence] = await Promise.all([
    fetchLegacyDetail(selected.id),
    fetchLegacyEvidence(INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(selected.id)),
  ]);
  return {
    detail,
    evidence,
    authorityPath: "legacy",
    canonicalEndpoint: null,
    legacyDetailEndpoint: INSPECTOR_USER_MAP_DETAIL_ENDPOINT(selected.id),
  };
}
