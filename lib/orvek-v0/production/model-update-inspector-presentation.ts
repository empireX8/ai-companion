/**
 * Composes live ModelUpdate detail into a canonical OrvekObject view model
 * for shared ObjectDetail / MovementView presentation.
 */

import {
  dedupeInspectorEvidenceLinks,
  filterResolvableEvidenceRefs,
  projectInspectorEvidenceCard,
  sanitizeInspectorDisplayText,
} from "../../inspector-evidence-presentation"
import type {
  CanonicalModelUpdateEvidenceClass,
  CanonicalModelUpdateEvidenceDrilldownProjection,
  InspectorEvidenceLinkItem,
  InspectorModelUpdateDetail,
} from "../../inspector-object-api"
import type { PatternClaimView } from "../../patterns-api"
import type { UserMapConclusionPublicApiDetailItem } from "../../public-intelligence-safe-slice"
import type { RealityTrackingClaimSection } from "../../reality-tracking-output-contract"
import type { OrvekObject, OrvekObjectType } from "../orvek-types"
import {
  firstMeaningfulModelUpdateText,
  isGenericModelUpdateIdentity,
  resolveModelUpdateDisplayTitle,
  resolveModelUpdateShellLabel,
} from "../../model-update-identity"

export type AffectedObjectPresentationContext = {
  userMap: UserMapConclusionPublicApiDetailItem | null
  pattern: PatternClaimView | null
  contradiction: {
    title: string
    status: string
    evidenceCount: number
    sideA: string
    sideB: string
  } | null
  affectedEvidence: InspectorEvidenceLinkItem[]
}

export type ProductionModelUpdateCanonicalViewModel = {
  object: OrvekObject
  satellites: Record<string, OrvekObject>
  reportId: string
}

function sectionTexts(section: RealityTrackingClaimSection | undefined): string[] {
  if (!section) return []
  return section.items
    .map((item) => sanitizeInspectorDisplayText(item.text) ?? item.text.trim())
    .filter((item) => item.length > 0)
}

function pickPrimarySectionText(
  section: RealityTrackingClaimSection | undefined,
  fallback: string | null = null,
): string | null {
  return firstMeaningfulModelUpdateText([...sectionTexts(section), fallback])
}

function formatRecordedLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return sanitizeInspectorDisplayText(value)
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date)
}

function resolveAffectedObjectTitle(context: AffectedObjectPresentationContext): string | null {
  if (context.userMap) {
    return firstMeaningfulModelUpdateText([context.userMap.title, context.userMap.summary])
  }
  if (context.pattern) {
    return firstMeaningfulModelUpdateText([context.pattern.summary])
  }
  if (context.contradiction) {
    return firstMeaningfulModelUpdateText([context.contradiction.title])
  }
  return null
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}

function isProceduralPacketSummary(text: string): boolean {
  return (
    /\brelated pattern\b/i.test(text) ||
    /\breceipts across\b/i.test(text) ||
    /\bsource type\b/i.test(text) ||
    /\bthis movement is recorded as\b/i.test(text) ||
    isGenericModelUpdateIdentity(text)
  )
}

/**
 * Direct-movement and resulting-revision evidence are the two genuine canonical
 * evidence classes, and each one reaches the browser as an accepted server
 * projection, so both are selectable through this single adapter. An absent
 * projection, an unrecognised class, or a blank selection id is not server
 * authority and fails closed.
 */
const SELECTABLE_EVIDENCE_CLASSES: ReadonlySet<CanonicalModelUpdateEvidenceClass> = new Set([
  "direct_movement_evidence",
  "resulting_revision_evidence",
])

function acceptedEvidenceDrilldown(
  item: InspectorEvidenceLinkItem,
): CanonicalModelUpdateEvidenceDrilldownProjection | null {
  const drilldown = item.canonicalEvidenceDrilldown
  if (!drilldown || !SELECTABLE_EVIDENCE_CLASSES.has(drilldown.evidenceClass)) {
    return null
  }
  return drilldown.selectionId.trim() ? drilldown : null
}

/**
 * Adapts one accepted browser-safe projection into the permanent Inspector
 * object shape. Nothing is inferred: an absent projected field stays absent so
 * the shell keeps its honest neutral state, and summary or snippet text is
 * carried only while the server marks the source disclosure as available.
 */
function canonicalEvidenceSelectionObject(
  drilldown: CanonicalModelUpdateEvidenceDrilldownProjection,
): OrvekObject {
  const disclosed = drilldown.sourceDisclosure === "available"
  const provenance = dedupeStrings([
    drilldown.provenanceLabel,
    drilldown.sourceTypeLabel,
    drilldown.roleLabel,
  ])

  return {
    id: drilldown.selectionId,
    type: "receipt",
    title: drilldown.title,
    subtype: provenance.length > 0 ? provenance.join(" · ") : undefined,
    summary: disclosed ? drilldown.summary ?? undefined : undefined,
    sourceText: disclosed ? drilldown.snippet ?? undefined : undefined,
    sourceOrigin: sanitizeInspectorDisplayText(drilldown.sourceTypeLabel) ?? undefined,
    lastUpdated: drilldown.recordedLabel ?? undefined,
    date: drilldown.recordedLabel ?? undefined,
  }
}

function buildCanonicalProjectionViewModel(input: {
  obj: OrvekObject
  detail: InspectorModelUpdateDetail
}): ProductionModelUpdateCanonicalViewModel | null {
  const projection = input.detail.canonicalInspectorProjection
  if (!projection) return null

  const satellites: Record<string, OrvekObject> = {}
  const receiptIds: string[] = []
  const selectedEvidenceIds = new Set<string>()

  // Only the two explicit projection collections are read, and only an accepted
  // projection inside them is selectable. One accepted relationship becomes
  // exactly one receipt, and the server keeps each relationship's selection id
  // distinct, so two relationships to the same source stay two separate rows.
  // Related canonical concepts, and any item whose accepted projection is
  // absent or carries a blank selection id, fail closed: no receipt id, no
  // satellite, and no positional fallback identity.
  for (const item of [
    ...projection.directMovementEvidence,
    ...projection.resultingRevisionEvidence,
  ]) {
    const drilldown = acceptedEvidenceDrilldown(item)
    if (!drilldown || selectedEvidenceIds.has(drilldown.selectionId)) continue
    selectedEvidenceIds.add(drilldown.selectionId)
    receiptIds.push(drilldown.selectionId)
    satellites[drilldown.selectionId] = canonicalEvidenceSelectionObject(drilldown)
  }

  const recorded = formatRecordedLabel(projection.createdAt)
  const object: OrvekObject = {
    ...input.obj,
    type: "model-update",
    title: projection.displayedTitle,
    summary: projection.distinctSummary ?? undefined,
    whyItMatters: projection.rationale ?? undefined,
    whyResurfaced: undefined,
    before: projection.before ?? undefined,
    after: projection.after ?? undefined,
    subtype: resolveModelUpdateShellLabel({
      updateTypeLabel: projection.updateLabel,
      affectedObjectTypeLabel: input.detail.item.affectedObjectTypeLabel,
    }) ?? projection.updateLabel,
    lastUpdated: recorded ?? input.obj.lastUpdated,
    receiptIds: receiptIds.length > 0 ? receiptIds : undefined,
    // An explicit evidence relationship is a receipt and nothing else. These
    // pathways carry no explicit projection in this slice, so they stay empty
    // rather than being derived from link role, shared wording, report prose or
    // the flat evidence collection.
    supporting: undefined,
    conflicting: undefined,
    contextIds: undefined,
    relatedIds: undefined,
    whatWouldChange: undefined,
    canonicalReportId: projection.modelUpdateId,
    inspectorObjectType: "model_update",
    inspectorObjectId: projection.modelUpdateId,
  }

  return { object, satellites, reportId: projection.modelUpdateId }
}

/**
 * @deprecated Presentation-only helper retained for existing unit tests while
 * the canonical OrvekObject composer is the active production path.
 */
export function composeProductionModelUpdateEvidencePresentation(input: {
  obj: OrvekObject
  detail: InspectorModelUpdateDetail
  modelUpdateEvidence: InspectorEvidenceLinkItem[]
  affectedContext: AffectedObjectPresentationContext
  resolveSelectionId: (
    objectType: string | null | undefined,
    objectId: string | null | undefined,
  ) => string | null
  getObjectTitle: (id: string) => string | undefined
}) {
  const canonical = composeProductionModelUpdateCanonicalViewModel(input)
  return {
    title: canonical.object.title,
    subtype: canonical.object.subtype ?? null,
    recordedLabel: canonical.object.lastUpdated ?? null,
    summary: canonical.object.summary ?? null,
    whyItMatters: canonical.object.whyItMatters ?? null,
    whyResurfaced: canonical.object.whyResurfaced ?? null,
    before: canonical.object.before ?? null,
    after: canonical.object.after ?? null,
    receipts: (canonical.object.receiptIds ?? []).map((id) => ({
      selectionId: id,
      quote: canonical.satellites[id]?.title ?? id,
    })),
    supporting: canonical.object.supporting ?? [],
    conflicting: canonical.object.conflicting ?? [],
    contextLinks: (canonical.object.contextIds ?? []).map((id) => ({
      selectionId: id,
      title: canonical.satellites[id]?.title ?? input.getObjectTitle(id) ?? id,
      type: (canonical.satellites[id]?.type ?? "context") as OrvekObjectType,
      trailLabel: "Viewing background context",
    })),
    relatedLinks: (canonical.object.relatedIds ?? []).map((id) => ({
      selectionId: id,
      title: canonical.satellites[id]?.title ?? input.getObjectTitle(id) ?? id,
      type: (canonical.satellites[id]?.type ?? "map-object") as OrvekObjectType,
      trailLabel: "Viewing related object",
    })),
    whatWouldChange: canonical.object.whatWouldChange ?? [],
    reportId: canonical.reportId,
  }
}

export function composeProductionModelUpdateCanonicalViewModel(input: {
  obj: OrvekObject
  detail: InspectorModelUpdateDetail
  modelUpdateEvidence: InspectorEvidenceLinkItem[]
  affectedContext: AffectedObjectPresentationContext
  resolveSelectionId: (
    objectType: string | null | undefined,
    objectId: string | null | undefined,
  ) => string | null
  getObjectTitle: (id: string) => string | undefined
}): ProductionModelUpdateCanonicalViewModel {
  const canonicalProjection = buildCanonicalProjectionViewModel(input)
  if (canonicalProjection) {
    return canonicalProjection
  }

  const { obj, detail, modelUpdateEvidence, affectedContext, resolveSelectionId, getObjectTitle } =
    input

  const affectedTitle = resolveAffectedObjectTitle(affectedContext)
  const packetTarget = sanitizeInspectorDisplayText(
    detail.report.evidencePacketSummary?.targetLabel,
  )
  const title = resolveModelUpdateDisplayTitle({
    userFacingSummary: detail.item.userFacingSummary,
    affectedObjectTitle: affectedTitle,
    packetTargetLabel: packetTarget,
    existingTitle: obj.title,
    updateTypeLabel: detail.item.updateTypeLabel,
    affectedObjectTypeLabel: detail.item.affectedObjectTypeLabel,
  })

  const summaryCandidate = firstMeaningfulModelUpdateText([
    detail.item.userFacingSummary,
    affectedTitle,
    obj.summary,
  ])
  const summary =
    summaryCandidate && summaryCandidate.toLowerCase() !== title.toLowerCase()
      ? summaryCandidate
      : undefined

  const whyItMatters =
    pickPrimarySectionText(
      detail.report.stronglySupportedClaims,
      firstMeaningfulModelUpdateText([obj.whyItMatters, obj.movementRationale]),
    ) ?? undefined

  const whyResurfacedRaw = pickPrimarySectionText(
    detail.report.loopPatternDetection,
    firstMeaningfulModelUpdateText([obj.whyResurfaced]),
  )
  const whyResurfaced =
    whyResurfacedRaw &&
    whyItMatters &&
    whyResurfacedRaw.toLowerCase() === whyItMatters.toLowerCase()
      ? undefined
      : whyResurfacedRaw ?? undefined

  const before =
    firstMeaningfulModelUpdateText([
      obj.before,
      detail.report.modelMovement?.before,
    ]) ?? undefined
  const after =
    firstMeaningfulModelUpdateText([
      obj.after,
      detail.report.modelMovement?.after,
    ]) ?? undefined

  const evidencePool = dedupeInspectorEvidenceLinks([
    ...modelUpdateEvidence,
    ...affectedContext.affectedEvidence,
  ])

  const satellites: Record<string, OrvekObject> = {}
  const receiptIds: string[] = []
  const seenQuotes = new Set<string>()

  evidencePool.forEach((item, index) => {
    const card = projectInspectorEvidenceCard(item)
    const quote = firstMeaningfulModelUpdateText([
      card.summary,
      card.title,
      item.evidenceSummaryLabel,
      item.objectTitle,
    ])
    if (!quote) return
    const key = quote.toLowerCase()
    if (seenQuotes.has(key)) return
    seenQuotes.add(key)

    const selectionId = `mu-receipt-${obj.id}-${index}`
    const navigationId =
      resolveSelectionId(item.sourceType, item.sourceId) ?? selectionId
    receiptIds.push(selectionId)
    satellites[selectionId] = {
      id: selectionId,
      type: "receipt",
      title: quote,
      sourceText: quote,
      inspectorObjectType: item.sourceType ?? undefined,
      inspectorObjectId: item.sourceId ?? undefined,
      // Preserve navigable target when the graph already owns the source object.
      ...(navigationId !== selectionId
        ? { relatedIds: [navigationId] }
        : {}),
    }
    if (navigationId !== selectionId && !satellites[navigationId]) {
      const navTitle =
        firstMeaningfulModelUpdateText([item.objectTitle, getObjectTitle(navigationId)]) ??
        quote
      satellites[navigationId] = {
        id: navigationId,
        type: item.sourceType === "pattern_claim" ? "map-object" : "receipt",
        title: navTitle,
        inspectorObjectType: item.sourceType ?? undefined,
        inspectorObjectId: item.sourceId ?? undefined,
      }
    }
  })

  for (const receiptId of obj.receiptIds ?? []) {
    const titleFromGraph = firstMeaningfulModelUpdateText([getObjectTitle(receiptId)])
    if (!titleFromGraph) continue
    const key = titleFromGraph.toLowerCase()
    if (seenQuotes.has(key)) continue
    seenQuotes.add(key)
    receiptIds.push(receiptId)
  }

  const supportingFromFacts = sectionTexts(detail.report.facts).filter(
    (text) => !isProceduralPacketSummary(text),
  )
  const supportingFromCards = evidencePool
    .map((item) => {
      const card = projectInspectorEvidenceCard(item)
      return firstMeaningfulModelUpdateText([card.summary, card.title])
    })
    .filter((value): value is string => Boolean(value))
    .filter((text) => !isProceduralPacketSummary(text))

  const supporting = dedupeStrings(
    supportingFromFacts.length > 0 ? supportingFromFacts : supportingFromCards,
  ).slice(0, 4)

  const conflicting = dedupeStrings(sectionTexts(detail.report.speculations))
    .filter((text) => !isProceduralPacketSummary(text))
    .slice(0, 3)

  const contextIds: string[] = []
  const relatedIds: string[] = []
  const usedSelectionIds = new Set<string>(receiptIds)

  const pushLinked = (
    bucket: string[],
    selectionId: string | null,
    titleValue: string | null,
    type: OrvekObjectType,
  ) => {
    if (!selectionId || usedSelectionIds.has(selectionId)) return
    const resolvedTitle =
      firstMeaningfulModelUpdateText([titleValue, getObjectTitle(selectionId)]) ?? null
    if (!resolvedTitle) return
    usedSelectionIds.add(selectionId)
    bucket.push(selectionId)
    if (!satellites[selectionId]) {
      satellites[selectionId] = {
        id: selectionId,
        type,
        title: resolvedTitle,
      }
    }
  }

  const affectedSelectionId = resolveSelectionId(
    detail.item.affectedObjectType,
    detail.item.affectedObjectId,
  )
  pushLinked(relatedIds, affectedSelectionId, affectedTitle, "map-object")

  for (const contextId of obj.contextIds ?? []) {
    pushLinked(contextIds, contextId, getObjectTitle(contextId) ?? null, "context")
  }
  for (const relatedId of obj.relatedIds ?? []) {
    pushLinked(relatedIds, relatedId, getObjectTitle(relatedId) ?? null, "map-object")
  }

  for (const ref of filterResolvableEvidenceRefs(
    (detail.report.facts?.items ?? []).flatMap((item) => item.evidenceRefs ?? []),
  )) {
    const selectionId = resolveSelectionId(ref.sourceType, ref.sourceId)
    const label = firstMeaningfulModelUpdateText([ref.label, getObjectTitle(selectionId ?? "")])
    pushLinked(relatedIds, selectionId, label, "receipt")
  }

  const whatWouldChange = dedupeStrings(
    sectionTexts(detail.report.whatWouldChangeThisConclusion).length > 0
      ? sectionTexts(detail.report.whatWouldChangeThisConclusion)
      : obj.whatWouldChange ?? [],
  ).slice(0, 4)

  const shell = resolveModelUpdateShellLabel({
    updateTypeLabel: detail.item.updateTypeLabel,
    affectedObjectTypeLabel: detail.item.affectedObjectTypeLabel,
  })
  const recorded = formatRecordedLabel(detail.item.createdAt)
  const reportId = obj.canonicalReportId ?? obj.id

  const object: OrvekObject = {
    ...obj,
    type: "model-update",
    title,
    summary,
    whyItMatters,
    whyResurfaced,
    before,
    after,
    subtype: shell ?? detail.item.updateTypeLabel,
    lastUpdated: recorded ?? obj.lastUpdated,
    receiptIds: receiptIds.length > 0 ? receiptIds : undefined,
    supporting: supporting.length > 0 ? supporting : undefined,
    conflicting: conflicting.length > 0 ? conflicting : undefined,
    contextIds: contextIds.length > 0 ? contextIds : undefined,
    relatedIds: relatedIds.length > 0 ? relatedIds : undefined,
    whatWouldChange: whatWouldChange.length > 0 ? whatWouldChange : undefined,
    canonicalReportId: reportId,
    inspectorObjectType: "model_update",
    inspectorObjectId: obj.inspectorObjectId ?? obj.id,
  }

  return { object, satellites, reportId }
}

export function composeProductionModelUpdateMovementPresentation(input: {
  obj: OrvekObject
  detail: InspectorModelUpdateDetail
}) {
  const before =
    firstMeaningfulModelUpdateText([
      input.obj.before,
      input.detail.report.modelMovement?.before,
    ]) ?? null
  const after =
    firstMeaningfulModelUpdateText([
      input.obj.after,
      input.detail.report.modelMovement?.after,
    ]) ?? null
  const title = resolveModelUpdateDisplayTitle({
    userFacingSummary: input.detail.item.userFacingSummary,
    packetTargetLabel: input.detail.report.evidencePacketSummary?.targetLabel,
    existingTitle: input.obj.title,
  })
  return {
    title,
    before,
    after,
    confidence: firstMeaningfulModelUpdateText([input.obj.confidence]),
    reportId: input.obj.canonicalReportId ?? input.obj.id,
    hasRecordedMovement: Boolean(before || after),
  }
}

export function isFalseUnavailableAffectedCopy(copy: string | null | undefined): boolean {
  if (!copy) return false
  return /full affected-object detail is not exposed/i.test(copy)
}
