/**
 * Write-time contract for live Evidence Pointer inspector-depth parity.
 *
 * Durable spec: docs/live-evidence-depth-write-contract.md
 * Read/linkage spec: docs/live-evidence-depth-linkage-contract.md
 *
 * This module defines validation rules for stored surfacing rationale and
 * link writes. It does NOT persist data, map to OrvekObject, or touch UI.
 */

import type {
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

/** Stable public receipt namespace ids used as pointer ids when surfacing from pattern/tension. */
export const SURFACED_POINTER_ID_PREFIXES = [
  "receipt-pattern",
  "receipt-tension",
] as const;

export type SurfacedPointerKind = "pattern" | "tension" | "journal";

export type EvidencePointerGraphSlot = "related" | "context";

/**
 * Write input for a persisted Today Evidence Pointer record.
 * Requires a new storage table or equivalent — not satisfied by read-time
 * buildTodaySurfacingCards() alone. See docs/live-evidence-depth-write-contract.md.
 */
export type SurfacedEvidencePointerWriteInput = {
  /** Stable pointer id, e.g. receipt-pattern-{claimId} */
  id: string;
  userId: string;
  pointerKind: SurfacedPointerKind;
  /** Durable source object this pointer quotes/surfaces */
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  sourceText: string;
  sourceOrigin: string;
  surfacedAt: Date;
  /** Stored at write time — never generic filler */
  whyItMatters: string;
  whyResurfaced?: string;
  libraryReceiptId?: string;
  detailHref?: string;
};

/**
 * Write input for a durable edge from a surfaced pointer source to a target.
 * May be persisted via UnderstandingEvidenceLink and/or embedded link rows on
 * the pointer record. graphSlot is required for ObjectDetail section mapping.
 */
export type SurfacedEvidencePointerLinkWriteInput = {
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  role: UnderstandingLinkRole;
  graphSlot: EvidencePointerGraphSlot;
  summary?: string;
  /** When true at write time, link passed public-eligibility checks */
  publicEligible: boolean;
};

/** Exact generic strings forbidden as stored whyItMatters / whyResurfaced (PR #112 §7). */
export const GENERIC_SURFACING_RATIONALE_DENYLIST: readonly RegExp[] = [
  /^surfaced from your recent material\.?$/i,
  /^receipt$/i,
  /^\d+ evidence receipts in recent material\.?$/i,
  /^early signal from recent material\.?$/i,
  /^your mind model shifted based on recent evidence\.?$/i,
  /^an active observation prompt from your evidence\.?$/i,
  /^an open investigation that may reshape your map\.?$/i,
  /^an invitation connected to recent patterns or goals\.?$/i,
  /^a supported conclusion on your current understanding map\.?$/i,
];

export type SurfacedEvidencePointerWriteBlocker =
  | "missing_id"
  | "missing_user_id"
  | "missing_source_text"
  | "missing_source_origin"
  | "missing_why_it_matters"
  | "generic_why_it_matters"
  | "generic_why_resurfaced"
  | "why_resurfaced_equals_source_text"
  | "why_it_matters_equals_source_text"
  | "no_eligible_links"
  | "link_missing_target"
  | "link_not_public_eligible"
  | "invalid_graph_slot";

export type SurfacedEvidencePointerWriteAssessment = {
  writeReady: boolean;
  blockers: SurfacedEvidencePointerWriteBlocker[];
};

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isGenericSurfacingRationale(value: string | undefined): boolean {
  const collapsed = value?.trim();
  if (!collapsed) {
    return true;
  }

  return GENERIC_SURFACING_RATIONALE_DENYLIST.some((pattern) => pattern.test(collapsed));
}

export function isAllowedSurfacedPointerId(id: string): boolean {
  const trimmed = id.trim();
  return SURFACED_POINTER_ID_PREFIXES.some((prefix) =>
    trimmed.startsWith(`${prefix}-`),
  );
}

export function assessSurfacedEvidencePointerWrite(
  pointer: SurfacedEvidencePointerWriteInput,
  links: SurfacedEvidencePointerLinkWriteInput[],
): SurfacedEvidencePointerWriteAssessment {
  const blockers: SurfacedEvidencePointerWriteBlocker[] = [];

  if (!hasText(pointer.id)) {
    blockers.push("missing_id");
  }
  if (!hasText(pointer.userId)) {
    blockers.push("missing_user_id");
  }
  if (!hasText(pointer.sourceText)) {
    blockers.push("missing_source_text");
  }
  if (!hasText(pointer.sourceOrigin)) {
    blockers.push("missing_source_origin");
  }
  if (!hasText(pointer.whyItMatters)) {
    blockers.push("missing_why_it_matters");
  } else if (isGenericSurfacingRationale(pointer.whyItMatters)) {
    blockers.push("generic_why_it_matters");
  } else if (
    pointer.whyItMatters.trim() === pointer.sourceText.trim()
  ) {
    blockers.push("why_it_matters_equals_source_text");
  }

  if (pointer.whyResurfaced) {
    if (isGenericSurfacingRationale(pointer.whyResurfaced)) {
      blockers.push("generic_why_resurfaced");
    } else if (
      pointer.whyResurfaced.trim() === pointer.sourceText.trim()
    ) {
      blockers.push("why_resurfaced_equals_source_text");
    }
  }

  const eligibleLinks = links.filter((link) => link.publicEligible);
  if (eligibleLinks.length === 0) {
    blockers.push("no_eligible_links");
  }

  for (const link of eligibleLinks) {
    if (!hasText(link.targetId)) {
      blockers.push("link_missing_target");
    }
    if (!link.publicEligible) {
      blockers.push("link_not_public_eligible");
    }
    if (link.graphSlot !== "related" && link.graphSlot !== "context") {
      blockers.push("invalid_graph_slot");
    }
  }

  return {
    writeReady: blockers.length === 0,
    blockers,
  };
}

/**
 * UEL rows do not carry graphSlot today. When using UnderstandingEvidenceLink,
 * persist graphSlot in meta per docs/live-evidence-depth-write-contract.md §B.2.
 */
export function uelMetaWithGraphSlot(
  graphSlot: EvidencePointerGraphSlot,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { graphSlot, ...extra };
}

export function graphSlotFromUelMeta(
  meta: unknown,
): EvidencePointerGraphSlot | null {
  if (!meta || typeof meta !== "object") {
    return null;
  }
  const slot = (meta as { graphSlot?: unknown }).graphSlot;
  return slot === "related" || slot === "context" ? slot : null;
}
