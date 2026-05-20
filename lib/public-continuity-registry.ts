export const PUBLIC_LINKED_DETAIL_FALLBACK_COPY =
  "No linked detail available yet.";
export const PUBLIC_EVIDENCE_FALLBACK_COPY =
  "No linked evidence available yet.";

export const PUBLIC_OBJECT_LINK_TYPES = [
  "usermap_conclusion",
  "pattern_claim",
  "contradiction_node",
] as const;

export type PublicObjectLinkType = (typeof PUBLIC_OBJECT_LINK_TYPES)[number];

export const PUBLIC_OBJECT_LINK_HREF_PREFIXES: Record<PublicObjectLinkType, string> = {
  usermap_conclusion: "/your-map",
  pattern_claim: "/patterns",
  contradiction_node: "/contradictions",
};

export const PUBLIC_EVIDENCE_TARGET_TYPES = ["usermap_conclusion"] as const;
export type PublicEvidenceTargetType =
  (typeof PUBLIC_EVIDENCE_TARGET_TYPES)[number];

export const PUBLIC_EVIDENCE_SOURCE_TYPES = [
  "pattern_claim",
  "contradiction_node",
] as const;
export type PublicEvidenceSourceType =
  (typeof PUBLIC_EVIDENCE_SOURCE_TYPES)[number];

export const PUBLIC_RECEIPT_NAMESPACE_PREFIXES = [
  "receipt-pattern",
  "receipt-tension",
] as const;
export type PublicReceiptNamespacePrefix =
  (typeof PUBLIC_RECEIPT_NAMESPACE_PREFIXES)[number];

export const DEFERRED_RECEIPT_NAMESPACE_PREFIXES = [
  "receipt-action",
  "receipt-user-map",
  "receipt-investigation",
  "receipt-fieldwork",
  "receipt-model-update",
] as const;
export type DeferredReceiptNamespacePrefix =
  (typeof DEFERRED_RECEIPT_NAMESPACE_PREFIXES)[number];

export function toNonEmptyPublicId(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isPublicObjectLinkType(
  type: string | null | undefined
): type is PublicObjectLinkType {
  return PUBLIC_OBJECT_LINK_TYPES.includes(type as PublicObjectLinkType);
}

export function buildPublicObjectHref(input: {
  type: string | null | undefined;
  id: string | null | undefined;
}): string | null {
  if (!isPublicObjectLinkType(input.type)) {
    return null;
  }

  const safeId = toNonEmptyPublicId(input.id);
  if (!safeId) {
    return null;
  }

  return `${PUBLIC_OBJECT_LINK_HREF_PREFIXES[input.type]}/${safeId}`;
}

export function isPublicEvidenceTargetType(
  type: string | null | undefined
): type is PublicEvidenceTargetType {
  return PUBLIC_EVIDENCE_TARGET_TYPES.includes(type as PublicEvidenceTargetType);
}

export function isPublicEvidenceSourceType(
  type: string | null | undefined
): type is PublicEvidenceSourceType {
  return PUBLIC_EVIDENCE_SOURCE_TYPES.includes(type as PublicEvidenceSourceType);
}

function hasNamespacePrefix(id: string, prefix: string): boolean {
  const needle = `${prefix}-`;
  return id.startsWith(needle) && id.slice(needle.length).trim().length > 0;
}

export function isAllowedReceiptNamespace(
  id: string | null | undefined
): boolean {
  const safeId = toNonEmptyPublicId(id);
  if (!safeId) {
    return false;
  }

  return PUBLIC_RECEIPT_NAMESPACE_PREFIXES.some((prefix) =>
    hasNamespacePrefix(safeId, prefix)
  );
}

export function isDeferredReceiptNamespace(
  id: string | null | undefined
): boolean {
  const safeId = toNonEmptyPublicId(id);
  if (!safeId) {
    return false;
  }

  return DEFERRED_RECEIPT_NAMESPACE_PREFIXES.some((prefix) =>
    hasNamespacePrefix(safeId, prefix)
  );
}

export function buildPublicReceiptHref(input: {
  namespace: PublicReceiptNamespacePrefix;
  id: string | null | undefined;
}): string | null {
  const safeId = toNonEmptyPublicId(input.id);
  if (!safeId) {
    return null;
  }

  return `/library/${input.namespace}-${safeId}`;
}
