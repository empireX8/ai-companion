import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"

/**
 * SUBSYS-003 Slice A — canonical evidence receipts carry projected evidence
 * metadata and their own role. A shared "supporting" trail label would restate
 * a Context receipt as Supporting, so canonical receipts use a neutral label.
 */
export const CANONICAL_RECEIPT_TRAIL_LABEL = "Viewing evidence receipt"

/** Preserved label for receipts without SUBSYS-003 evidence metadata. */
export const LEGACY_RECEIPT_TRAIL_LABEL = "Viewing supporting receipt"

export type ReceiptTrailLabelInput = Pick<OrvekObject, "evidenceClass">

export function resolveReceiptTrailLabel(
  receipt?: ReceiptTrailLabelInput | null,
): string {
  const evidenceClass = receipt?.evidenceClass
  const isCanonicalEvidenceReceipt =
    typeof evidenceClass === "string" && evidenceClass.trim().length > 0

  return isCanonicalEvidenceReceipt
    ? CANONICAL_RECEIPT_TRAIL_LABEL
    : LEGACY_RECEIPT_TRAIL_LABEL
}
