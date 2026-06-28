import type { InspectorEvidenceLinkItem } from "./inspector-object-api";
import type { RealityTrackingEvidenceRef } from "./reality-tracking-output-contract";
import {
  PUBLIC_EVIDENCE_LINKED_LABEL,
  PUBLIC_OBJECT_LINK_HREF_PREFIXES,
} from "./public-continuity-registry";

const GENERIC_EVIDENCE_LABELS = new Set([
  PUBLIC_EVIDENCE_LINKED_LABEL.toLowerCase(),
  "related pattern",
  "related signal",
  "reference item",
  "linked receipt",
]);

export type InspectorEvidenceCardView = {
  dedupeKey: string;
  title: string;
  sourceKind: string;
  linkRoleLabel: string | null;
  createdAt: string;
  href: string;
};

export function isGenericInspectorEvidenceLabel(
  value: string | null | undefined
): boolean {
  if (!value) {
    return true;
  }

  return GENERIC_EVIDENCE_LABELS.has(value.trim().toLowerCase());
}

export function parseInspectorEvidenceSourceFromHref(
  href: string
): { sourceType: string; sourceId: string } | null {
  for (const [sourceType, prefix] of Object.entries(PUBLIC_OBJECT_LINK_HREF_PREFIXES)) {
    if (!href.startsWith(`${prefix}/`)) {
      continue;
    }

    const sourceId = href.slice(prefix.length + 1).trim();
    if (!sourceId) {
      return null;
    }

    return { sourceType, sourceId };
  }

  return null;
}

export function inspectorEvidenceDedupeKey(item: InspectorEvidenceLinkItem): string {
  if (item.sourceType && item.sourceId) {
    return `${item.sourceType}:${item.sourceId}`;
  }

  const parsed = parseInspectorEvidenceSourceFromHref(item.sourceObjectHref);
  if (parsed) {
    return `${parsed.sourceType}:${parsed.sourceId}`;
  }

  return `${item.sourceObjectHref}:${item.createdAt}`;
}

export function dedupeInspectorEvidenceLinks(
  items: InspectorEvidenceLinkItem[]
): InspectorEvidenceLinkItem[] {
  const byKey = new Map<string, InspectorEvidenceLinkItem>();

  for (const item of items) {
    const key = inspectorEvidenceDedupeKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const existingTime = new Date(existing.createdAt).getTime();
    const nextTime = new Date(item.createdAt).getTime();
    if (nextTime >= existingTime) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function formatInspectorEvidenceSourceKind(sourceType: string | null | undefined): string {
  switch (sourceType) {
    case "pattern_claim":
      return "Pattern";
    case "contradiction_node":
      return "Signal";
    default:
      return "Evidence";
  }
}

export function fallbackInspectorEvidenceTitle(
  sourceType: string | null | undefined
): string {
  switch (sourceType) {
    case "pattern_claim":
      return "Linked pattern evidence";
    case "contradiction_node":
      return "Linked signal evidence";
    default:
      return "Linked evidence";
  }
}

export function formatInspectorEvidenceLinkRole(
  role: string | null | undefined
): string | null {
  if (!role) {
    return null;
  }

  return role.replace(/_/g, " ");
}

export function resolveInspectorEvidenceTitle(item: InspectorEvidenceLinkItem): string {
  const objectTitle = item.objectTitle?.trim();
  if (objectTitle) {
    return objectTitle;
  }

  if (!isGenericInspectorEvidenceLabel(item.evidenceSummaryLabel)) {
    return item.evidenceSummaryLabel.trim();
  }

  const parsed = parseInspectorEvidenceSourceFromHref(item.sourceObjectHref);
  return fallbackInspectorEvidenceTitle(item.sourceType ?? parsed?.sourceType ?? null);
}

export function projectInspectorEvidenceCard(
  item: InspectorEvidenceLinkItem
): InspectorEvidenceCardView {
  const parsed = parseInspectorEvidenceSourceFromHref(item.sourceObjectHref);
  const sourceType = item.sourceType ?? parsed?.sourceType ?? null;

  return {
    dedupeKey: inspectorEvidenceDedupeKey(item),
    title: resolveInspectorEvidenceTitle(item),
    sourceKind: formatInspectorEvidenceSourceKind(sourceType),
    linkRoleLabel: formatInspectorEvidenceLinkRole(item.linkRole),
    createdAt: item.createdAt,
    href: item.sourceObjectHref,
  };
}

export function isUnresolvedEvidenceRefDisplay(ref: RealityTrackingEvidenceRef): boolean {
  const label = ref.label.trim().toLowerCase();
  const typeLabel = ref.sourceTypeLabel.trim().toLowerCase();

  if (!label) {
    return true;
  }

  if (label === typeLabel) {
    return true;
  }

  return GENERIC_EVIDENCE_LABELS.has(label);
}

export function filterResolvableEvidenceRefs(
  refs: RealityTrackingEvidenceRef[]
): RealityTrackingEvidenceRef[] {
  return refs.filter((ref) => !isUnresolvedEvidenceRefDisplay(ref));
}

export function formatEvidenceRefDisplay(ref: RealityTrackingEvidenceRef): string {
  const label = ref.label.trim();
  const typeLabel = ref.sourceTypeLabel.trim();

  if (label && label !== typeLabel) {
    return `${typeLabel} · ${label}`;
  }

  return label || typeLabel;
}

export const UNRESOLVED_DUPLICATE_EVIDENCE_REF_DISPLAY = "Reference item · Reference item";
