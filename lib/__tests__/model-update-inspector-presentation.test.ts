import { readFileSync } from "node:fs"
import path from "node:path"
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

  it("uses the server-verified canonical projection without reconstructing lineage", () => {
    const { object, satellites, reportId } =
      composeProductionModelUpdateCanonicalViewModel({
        obj: {
          id: "mu-canonical",
          type: "model-update",
          title: "I like tea again now",
          summary: "I like tea again now",
          before: "Client stale before",
          after: "Client stale after",
        },
        detail: {
          item: {
            id: "mu-canonical",
            createdAt: "2026-07-28T12:00:00.000Z",
            updateTypeLabel: "Conclusion Strengthened",
            affectedObjectType: "canonical_concept_revision" as never,
            affectedObjectTypeLabel: "Canonical model revision",
            affectedObjectId: null,
            affectedObjectHref: null,
            userFacingSummary: "I like tea again now",
          },
          report: buildReport({
            stronglySupportedClaims: {
              items: [
                {
                  text: "Fallback report prose must not become Why it matters.",
                  classification: "supported_claim",
                  evidenceStatus: "VERIFIED",
                  evidenceRefs: [],
                },
              ],
              emptyState: null,
            },
            whatWouldChangeThisConclusion: {
              items: [
                {
                  text: "Fallback change condition must stay out.",
                  classification: "change_condition",
                  evidenceStatus: "INFERRED",
                  evidenceRefs: [],
                },
              ],
              emptyState: null,
            },
          }),
          canonicalInspectorProjection: {
            projectionType: "canonical_model_update_inspector",
            modelUpdateId: "mu-canonical",
            updateLabel: "Conclusion Strengthened",
            displayedTitle: "I like tea again now",
            distinctSummary: null,
            createdAt: "2026-07-28T12:00:00.000Z",
            rationale: "The user explicitly corrected the previous tea preference.",
            before: "I don't like tea anymore",
            after: "I like tea again now",
            resultingStateAtPublication: {
              title: "I like tea again now",
              summary: "I like tea again now",
              version: 2,
              acceptedAt: "2026-07-28T12:00:00.000Z",
            },
            currentUnderstandingNow: {
              title: "I like green tea but not black tea",
              summary: "I like green tea but not black tea",
              version: 3,
              acceptedAt: "2026-07-29T12:00:00.000Z",
            },
            directMovementEvidence: [
              {
                id: "uel-direct",
                sourceTypeLabel: "Conversation message",
                evidenceSummaryLabel: "The user said they like tea again now.",
                sourceObjectHref: null,
                createdAt: "2026-07-28T12:01:00.000Z",
                hasEvidence: true,
                sourceType: "message",
                sourceId: "msg-1",
                linkRole: "supports",
                evidenceTarget: "direct_movement",
                evidenceTargetLabel: "Movement evidence",
              },
            ],
            resultingRevisionEvidence: [
              {
                id: "uel-revision",
                sourceTypeLabel: "Conversation message",
                evidenceSummaryLabel: "Linked evidence",
                sourceObjectHref: null,
                createdAt: null,
                hasEvidence: true,
                sourceType: "message",
                sourceId: undefined,
                objectTitle: "Resulting revision evidence",
                linkRole: "contradicts",
                evidenceTarget: "resulting_revision",
                evidenceTargetLabel: "Resulting revision evidence",
              },
            ],
            relatedObjects: [
              {
                selectionId: "opaque-canonical-selection",
                title: "I like green tea but not black tea",
                inspectorObjectType: "canonical_concept",
              },
            ],
          },
        },
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

    expect(object.title).toBe("I like tea again now")
    expect(object.summary).toBeUndefined()
    expect(object.whyItMatters).toBe(
      "The user explicitly corrected the previous tea preference.",
    )
    expect(object.before).toBe("I don't like tea anymore")
    expect(object.after).toBe("I like tea again now")
    expect(object.whatWouldChange).toBeUndefined()
    expect(JSON.stringify(object)).not.toContain("Fallback report prose")
    expect(JSON.stringify(object)).not.toContain("Fallback change condition")
    expect(object.supporting?.[0]).toContain("Movement evidence")
    expect(object.conflicting?.[0]).toContain("Resulting revision evidence")
    expect(object.receiptIds?.map((id) => satellites[id]?.title)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Movement evidence"),
        expect.stringContaining("Resulting revision evidence"),
      ]),
    )
    expect(object.relatedIds).toEqual(["opaque-canonical-selection"])
    expect(satellites["opaque-canonical-selection"]?.inspectorObjectType).toBe(
      "canonical_concept",
    )
    expect(reportId).toBe("mu-canonical")
  })

  it("keeps browser composer source free of raw canonical lineage fields", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "lib/orvek-v0/production/model-update-inspector-presentation.ts",
      ),
      "utf8",
    )

    expect(source).not.toContain("canonicalConceptId")
    expect(source).not.toContain("previousRevisionId")
    expect(source).not.toContain("resultingRevisionId")
    expect(source).not.toContain("exploreProposalId")
    expect(source).not.toContain("internalNotes")
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
