import { describe, expect, it } from "vitest"

import type { OrvekObject } from "../../lib/orvek-v0/orvek-types"
import { resolveReceiptTrailLabel } from "./receipt-trail-label"

const CANONICAL_LABEL = "Viewing evidence receipt"
const LEGACY_LABEL = "Viewing supporting receipt"

function receipt(overrides: Partial<OrvekObject>): OrvekObject {
  return {
    id: "sel-opaque-1",
    type: "receipt",
    title: "Journal entry",
    ...overrides,
  }
}

describe("resolveReceiptTrailLabel", () => {
  it("uses the neutral canonical label for resulting-revision evidence in a Context role", () => {
    const contextEvidence = receipt({
      evidenceClass: "resulting_revision_evidence",
      evidenceClassLabel: "Resulting revision evidence",
      evidenceRole: "context",
      evidenceRoleLabel: "Context",
    })

    expect(resolveReceiptTrailLabel(contextEvidence)).toBe(CANONICAL_LABEL)
  })

  it("uses the same neutral canonical label for direct movement evidence in a Supporting role", () => {
    const supportingEvidence = receipt({
      evidenceClass: "direct_movement_evidence",
      evidenceClassLabel: "Movement evidence",
      evidenceRole: "supports",
      evidenceRoleLabel: "Supporting",
    })

    expect(resolveReceiptTrailLabel(supportingEvidence)).toBe(CANONICAL_LABEL)
  })

  it("keeps the legacy label for a noncanonical receipt without evidence metadata", () => {
    const legacyReceipt = receipt({
      title: "Legacy receipt",
      sourceText: "Recorded earlier.",
    })

    expect(legacyReceipt.evidenceClass).toBeUndefined()
    expect(resolveReceiptTrailLabel(legacyReceipt)).toBe(LEGACY_LABEL)
  })

  it("never describes Context evidence as supporting", () => {
    const contextEvidence = receipt({
      evidenceClass: "resulting_revision_evidence",
      evidenceRole: "context",
      evidenceRoleLabel: "Context",
    })

    expect(resolveReceiptTrailLabel(contextEvidence)).not.toBe(LEGACY_LABEL)
    expect(resolveReceiptTrailLabel(contextEvidence)).not.toMatch(/supporting/i)
  })
})
