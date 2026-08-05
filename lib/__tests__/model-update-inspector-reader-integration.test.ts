import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  fetchInspectorModelUpdateDetail,
  type InspectorModelUpdateDetail,
} from "../inspector-object-api"
import type { OrvekObject } from "../orvek-v0/orvek-types"
import { composeProductionModelUpdateCanonicalViewModel } from "../orvek-v0/production/model-update-inspector-presentation"
import type { RealityTrackingModelMovementReport } from "../reality-tracking-output-contract"

function emptySection(label: string) {
  return {
    key: label,
    label,
    items: [],
    emptyState: null,
  }
}

function buildReport(
  overrides: Partial<RealityTrackingModelMovementReport> = {},
): RealityTrackingModelMovementReport {
  return {
    reportId: "mu-canonical",
    generatedAt: "2026-07-28T12:00:00.000Z",
    evidencePacketSummary: {
      receiptCount: 1,
      sourceTypeCount: 1,
      linkedObjectCount: 0,
      linkedDecisionCount: 0,
      activeQuestionCount: 0,
      fieldworkCount: 0,
      correctionCount: 0,
      recentMovementCount: 0,
      dateRangeLabel: "28 Jul 2026",
      targetLabel: "I like tea again now",
      targetObjectTypeLabel: "Canonical model revision",
    },
    facts: emptySection("facts"),
    stronglySupportedClaims: emptySection("stronglySupportedClaims"),
    inferences: emptySection("inferences"),
    speculations: emptySection("speculations"),
    overreachGuardrails: emptySection("overreachGuardrails"),
    loopPatternDetection: emptySection("loopPatternDetection"),
    modelMovement: {
      key: "modelMovement",
      label: "Movement",
      before: "I don't like tea anymore",
      after: "I like tea again now",
      confidenceShift: null,
      items: [],
      emptyState: null,
    },
    realityGate: emptySection("realityGate"),
    fieldworkWatchFor: emptySection("fieldworkWatchFor"),
    reentryAction: emptySection("reentryAction"),
    whatWouldChangeThisConclusion: emptySection("whatWouldChangeThisConclusion"),
    ...overrides,
  } as RealityTrackingModelMovementReport
}

function canonicalDetail(): InspectorModelUpdateDetail {
  return {
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
      speculations: {
        items: [
          {
            text:
              "The linked packet is still thin enough that this movement may change materially with more receipts.",
            classification: "speculation",
            evidenceStatus: "INFERRED",
            evidenceRefs: [],
          },
        ],
        emptyState: null,
      },
      whatWouldChangeThisConclusion: {
        items: [
          {
            text: "More receipts or a disconfirmation would change this generated read.",
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
      rationale: null,
      before: "I don't like tea anymore",
      after: "I like tea again now",
      resultingStateAtPublication: {
        title: "I like tea again now",
        summary: "I like tea again now",
        version: 2,
        acceptedAt: "2026-07-28T12:00:00.000Z",
      },
      currentUnderstandingNow: {
        title: "I like tea again now",
        summary: "I like tea again now",
        version: 2,
        acceptedAt: "2026-07-28T12:00:00.000Z",
      },
      directMovementEvidence: [
        {
          id: "canonical-evidence-direct-reader",
          sourceTypeLabel: "Conversation message",
          evidenceSummaryLabel: "Conversation message · 28 Jul 2026, 13:01",
          sourceObjectHref: null,
          createdAt: "2026-07-28T12:01:00.000Z",
          hasEvidence: true,
          sourceType: "message",
          linkRole: "supports",
          evidenceTarget: "direct_movement",
          evidenceTargetLabel: "Movement evidence",
          canonicalEvidenceDrilldown: {
            selectionId: "canonical-evidence-direct-reader",
            evidenceClass: "direct_movement_evidence",
            evidenceClassLabel: "Movement evidence",
            sourceType: "message",
            sourceTypeLabel: "Conversation message",
            role: "supports",
            roleLabel: "Supporting",
            title: "Conversation message · 28 Jul 2026, 13:01",
            summary: null,
            snippet: "The user said they like tea again now.",
            sourceOrigin:
              "Conversation message · Supporting · Movement evidence",
            recordedAt: "2026-07-28T12:01:00.000Z",
            recordedLabel: "28 Jul 2026, 13:01",
            provenanceLabel: "Movement evidence",
            sourceDisclosure: "available",
            returnSelectionId: "mu-canonical",
          },
        },
      ],
      resultingRevisionEvidence: [],
      relatedObjects: [
        {
          selectionId: "opaque-canonical-selection",
          title: "Related concept must stay unavailable",
          inspectorObjectType: "canonical_concept",
        },
      ],
    },
  }
}

function legacyDetail(): InspectorModelUpdateDetail {
  return {
    item: {
      id: "mu-legacy",
      createdAt: "2026-07-28T12:00:00.000Z",
      updateTypeLabel: "Link Detected",
      affectedObjectType: "pattern_claim" as never,
      affectedObjectTypeLabel: "Related pattern",
      affectedObjectId: "pattern-1",
      affectedObjectHref: "/patterns/pattern-1",
      userFacingSummary: "Meetings and energy dips are linked.",
    },
    report: buildReport({
      evidencePacketSummary: {
        receiptCount: 2,
        sourceTypeCount: 1,
        linkedObjectCount: 1,
        linkedDecisionCount: 0,
        activeQuestionCount: 0,
        fieldworkCount: 0,
        correctionCount: 0,
        recentMovementCount: 0,
        dateRangeLabel: "28 Jul 2026",
        targetLabel: "Meetings and energy dips are linked.",
        targetObjectTypeLabel: "Related pattern",
      },
      speculations: {
        items: [
          {
            text: "One counter-signal remains unresolved.",
            classification: "speculation",
            evidenceStatus: "INFERRED",
            evidenceRefs: [],
          },
        ],
        emptyState: null,
      },
      whatWouldChangeThisConclusion: {
        items: [
          {
            text: "A week without the dip would weaken this read.",
            classification: "change_condition",
            evidenceStatus: "INFERRED",
            evidenceRefs: [],
          },
        ],
        emptyState: null,
      },
    }),
  }
}

function mockFetchDetail(detail: InspectorModelUpdateDetail) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(detail), { status: 200 })),
  )
}

describe("ModelUpdate Inspector reader integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("carries canonical API projections into the permanent Inspector composer", async () => {
    const thinPacketWarning =
      "The linked packet is still thin enough that this movement may change materially with more receipts."
    const inheritedChange = "Legacy selected-object more-receipts condition."
    mockFetchDetail(canonicalDetail())

    const detail = await fetchInspectorModelUpdateDetail("mu-canonical")
    expect(detail?.canonicalInspectorProjection?.projectionType).toBe(
      "canonical_model_update_inspector",
    )

    const selected: OrvekObject = {
      id: "mu-canonical",
      type: "model-update",
      title: "Legacy selected title",
      conflicting: [thinPacketWarning],
      whatWouldChange: [inheritedChange],
    }
    const { object, satellites } = composeProductionModelUpdateCanonicalViewModel({
      obj: selected,
      detail: detail!,
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
    expect(object.supporting).toBeUndefined()
    expect(object.conflicting).toBeUndefined()
    expect(object.contextIds).toBeUndefined()
    expect(object.relatedIds).toBeUndefined()
    expect(object.whatWouldChange).toBeUndefined()
    expect(object.receiptIds).toEqual(["canonical-evidence-direct-reader"])
    expect(Object.keys(satellites)).toEqual(["canonical-evidence-direct-reader"])
    expect(satellites["canonical-evidence-direct-reader"]).toMatchObject({
      id: "canonical-evidence-direct-reader",
      type: "receipt",
      title: "Conversation message · 28 Jul 2026, 13:01",
      sourceText: "The user said they like tea again now.",
      sourceOrigin: expect.stringContaining("Conversation message"),
      date: "28 Jul 2026, 13:01",
      evidenceClass: "direct_movement_evidence",
      evidenceSourceDisclosure: "available",
      returnSelectionId: "mu-canonical",
    })
    expect(satellites["canonical-evidence-direct-reader"]?.summary).toBeUndefined()
    expect(satellites["opaque-canonical-selection"]).toBeUndefined()
    expect(JSON.stringify(object)).not.toContain(thinPacketWarning)
    expect(JSON.stringify(object)).not.toContain(inheritedChange)
    expect(JSON.stringify(object)).not.toContain("disconfirmation")
    expect(JSON.stringify(object)).not.toContain("msg-1")
    expect(JSON.stringify(satellites)).not.toContain("mu-receipt-")
    expect(JSON.stringify(satellites)).not.toContain("mu-context-")
  })

  it("preserves legacy report-derived fields for noncanonical ModelUpdates", async () => {
    mockFetchDetail(legacyDetail())

    const detail = await fetchInspectorModelUpdateDetail("mu-legacy")
    expect(detail?.canonicalInspectorProjection).toBeNull()

    const { object } = composeProductionModelUpdateCanonicalViewModel({
      obj: {
        id: "mu-legacy",
        type: "model-update",
        title: "Legacy movement",
      },
      detail: detail!,
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

    expect(object.conflicting).toEqual(["One counter-signal remains unresolved."])
    expect(object.whatWouldChange).toEqual([
      "A week without the dip would weaken this read.",
    ])
  })
})
