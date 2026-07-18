import { describe, expect, it } from "vitest"

import type {
  InspectorEvidenceLinkItem,
  InspectorModelUpdateDetail,
} from "../inspector-object-api"
import type { OrvekObject } from "../orvek-v0/orvek-types"
import {
  composeProductionModelUpdateCanonicalViewModel,
  isFalseUnavailableAffectedCopy,
} from "../orvek-v0/production/model-update-inspector-presentation"
import type { RealityTrackingModelMovementReport } from "../reality-tracking-output-contract"

function emptySection(label: string) {
  return {
    key: label,
    label,
    items: [] as Array<{
      text: string
      evidenceRefs: []
    }>,
    emptyState: null,
  }
}

function buildReport(
  overrides: Partial<RealityTrackingModelMovementReport> = {},
): RealityTrackingModelMovementReport {
  return {
    reportId: "mu-test",
    generatedAt: "2026-07-17T19:38:00.000Z",
    evidencePacketSummary: {
      receiptCount: 1,
      sourceTypeCount: 1,
      linkedObjectCount: 1,
      linkedDecisionCount: 0,
      fieldworkCount: 0,
      dateRangeLabel: "17 Jul 2026 → 17 Jul 2026",
      targetLabel: "Energy drops after meetings without a stop point.",
    },
    facts: {
      key: "facts",
      label: "Facts",
      items: [
        {
          text: "This movement is recorded as link detected on related pattern.",
          evidenceRefs: [],
        },
      ],
      emptyState: null,
    },
    stronglySupportedClaims: {
      key: "stronglySupportedClaims",
      label: "Strong",
      items: [
        {
          text: "Connects evening overwork to the missing stop point before commitments lock.",
          evidenceRefs: [],
        },
      ],
      emptyState: null,
    },
    inferences: emptySection("inferences"),
    speculations: {
      key: "speculations",
      label: "Speculations",
      items: [
        {
          text: "One thin counter-example remains unresolved.",
          evidenceRefs: [],
        },
      ],
      emptyState: null,
    },
    overreachGuardrails: emptySection("overreachGuardrails"),
    loopPatternDetection: {
      key: "loopPatternDetection",
      label: "Loop",
      items: [
        {
          text: "A linked pattern claim is already part of the evidence behind this movement.",
          evidenceRefs: [],
        },
      ],
      emptyState: null,
    },
    modelMovement: {
      key: "modelMovement",
      label: "Movement",
      before: "Pattern treated as tentative only.",
      after: "Energy drops after meetings without a stop point.",
      confidenceShift: null,
      items: [],
      emptyState: null,
    },
    realityGate: emptySection("realityGate"),
    fieldworkWatchFor: emptySection("fieldworkWatchFor"),
    reentryAction: emptySection("reentryAction"),
    whatWouldChangeThisConclusion: {
      key: "whatWouldChangeThisConclusion",
      label: "Change",
      items: [
        {
          text: "A week of evenings without the drop would weaken this read.",
          evidenceRefs: [],
        },
      ],
      emptyState: null,
    },
    ...overrides,
  } as RealityTrackingModelMovementReport
}

function buildDetail(
  overrides: Partial<InspectorModelUpdateDetail["item"]> = {},
): InspectorModelUpdateDetail {
  return {
    item: {
      id: "mu-test",
      createdAt: "2026-07-17T19:38:00.000Z",
      updateTypeLabel: "Link Detected",
      affectedObjectType: "pattern_claim",
      affectedObjectTypeLabel: "Related pattern",
      affectedObjectId: "pattern-1",
      affectedObjectHref: "/patterns/pattern-1",
      userFacingSummary: "There is early evidence that energy drops after meetings.",
      ...overrides,
    },
    report: buildReport(),
  }
}

describe("model-update inspector presentation composer", () => {
  it("maps live ModelUpdate detail into a canonical OrvekObject for ObjectDetail", () => {
    const obj: OrvekObject = {
      id: "mu-test",
      type: "model-update",
      title: "Link Detected · Related pattern",
      summary: "Link Detected · Related pattern",
      before: "Pattern treated as tentative only.",
      after: "Energy drops after meetings without a stop point.",
      canonicalReportId: "mu-test",
      inspectorObjectType: "model_update",
      inspectorObjectId: "mu-test",
    }

    const evidence: InspectorEvidenceLinkItem[] = [
      {
        createdAt: "2026-07-17T19:38:00.000Z",
        sourceType: "reference_item",
        sourceId: "ref-1",
        sourceTypeLabel: "Reference item",
        objectTitle: "Reference item",
        evidenceSummaryLabel: "I notice energy collapses after long meetings.",
        linkRole: "supports",
        sourceObjectHref: "/references/ref-1",
        hasEvidence: true,
      },
      {
        createdAt: "2026-07-17T19:38:00.000Z",
        sourceType: "pattern_claim",
        sourceId: "pattern-1",
        sourceTypeLabel: "Related pattern",
        objectTitle: "Energy drops after meetings without a stop point.",
        evidenceSummaryLabel: "Related pattern",
        linkRole: "supports",
        sourceObjectHref: "/patterns/pattern-1",
        hasEvidence: true,
      },
    ]

    const { object, satellites, reportId } = composeProductionModelUpdateCanonicalViewModel({
      obj,
      detail: buildDetail(),
      modelUpdateEvidence: evidence,
      affectedContext: {
        userMap: null,
        pattern: {
          id: "pattern-1",
          summary: "Energy drops after meetings without a stop point.",
          status: "active",
          strengthLevel: "emerging",
          patternType: "trigger_response",
          evidenceCount: 1,
          supportContainerSpread: 1,
          journalDaySpread: 1,
        } as never,
        contradiction: null,
        affectedEvidence: [],
      },
      resolveSelectionId: (objectType, objectId) => {
        if (objectType === "pattern_claim" && objectId === "pattern-1") {
          return "pattern-pattern-1"
        }
        if (objectType === "reference_item" && objectId === "ref-1") {
          return "receipt-ref-1"
        }
        return null
      },
      getObjectTitle: () => undefined,
    })

    expect(object.title).toBe(
      "There is early evidence that energy drops after meetings.",
    )
    expect(object.title).not.toMatch(/Related pattern/i)
    expect(object.summary).toBeUndefined()
    expect(object.summary).not.toBe("Related pattern movement")
    expect(JSON.stringify({ object, satellites })).not.toMatch(/Related pattern movement/i)
    expect(object.whyItMatters).toContain("missing stop point")
    expect(object.receiptIds?.length).toBeGreaterThan(0)
    expect(object.receiptIds?.some((id) => satellites[id]?.title.includes("energy collapses"))).toBe(
      true,
    )
    expect(Object.values(satellites).some((s) => /Reference item/i.test(s.title))).toBe(false)
    expect(object.relatedIds).toContain("pattern-pattern-1")
    expect(satellites["pattern-pattern-1"]?.title).toBe(
      "Energy drops after meetings without a stop point.",
    )
    expect(reportId).toBe("mu-test")
    expect(JSON.stringify(object)).not.toContain(
      "Full affected-object detail is not exposed",
    )
  })

  it("does not repeat the same evidence under multiple false identities", () => {
    const evidence: InspectorEvidenceLinkItem[] = [
      {
        createdAt: "2026-07-17T19:38:00.000Z",
        sourceType: "reference_item",
        sourceId: "ref-1",
        sourceTypeLabel: "Reference item",
        objectTitle: "I notice energy collapses after long meetings.",
        evidenceSummaryLabel: "I notice energy collapses after long meetings.",
        linkRole: "supports",
        sourceObjectHref: "/references/ref-1",
        hasEvidence: true,
      },
      {
        createdAt: "2026-07-17T19:38:00.000Z",
        sourceType: "reference_item",
        sourceId: "ref-1",
        sourceTypeLabel: "Reference item",
        objectTitle: "I notice energy collapses after long meetings.",
        evidenceSummaryLabel: "I notice energy collapses after long meetings.",
        linkRole: "supports",
        sourceObjectHref: "/references/ref-1",
        hasEvidence: true,
      },
    ]

    const { object, satellites } = composeProductionModelUpdateCanonicalViewModel({
      obj: {
        id: "mu-test",
        type: "model-update",
        title: "There is early evidence that energy drops after meetings.",
      },
      detail: buildDetail(),
      modelUpdateEvidence: evidence,
      affectedContext: {
        userMap: null,
        pattern: null,
        contradiction: null,
        affectedEvidence: evidence,
      },
      resolveSelectionId: () => "receipt-ref-1",
      getObjectTitle: () => undefined,
    })

    const quotes = (object.receiptIds ?? []).map(
      (id) => satellites[id]?.title?.toLowerCase() ?? id,
    )
    expect(new Set(quotes).size).toBe(quotes.length)
  })

  it("composes movement fields onto the canonical object", () => {
    const { object, reportId } = composeProductionModelUpdateCanonicalViewModel({
      obj: {
        id: "mu-test",
        type: "model-update",
        title: "Link Detected · Related pattern",
        before: "Pattern treated as tentative only.",
        after: "Energy drops after meetings without a stop point.",
        canonicalReportId: "mu-test",
      },
      detail: buildDetail(),
      modelUpdateEvidence: [],
      affectedContext: {
        userMap: null,
        pattern: null,
        contradiction: null,
        affectedEvidence: [],
      },
      resolveSelectionId: () => null,
      getObjectTitle: () => undefined,
    })

    expect(object.title).toBe(
      "There is early evidence that energy drops after meetings.",
    )
    expect(object.before).toContain("tentative")
    expect(object.after).toContain("Energy drops")
    expect(reportId).toBe("mu-test")
    expect(object.canonicalReportId).toBe("mu-test")
  })

  it("detects the false unavailable affected-object copy", () => {
    expect(
      isFalseUnavailableAffectedCopy(
        "Full affected-object detail is not exposed in this selection yet.",
      ),
    ).toBe(true)
    expect(isFalseUnavailableAffectedCopy("Affected-object context is still resolving")).toBe(
      false,
    )
  })
})
