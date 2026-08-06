export type OrvekObjectType =
  | "receipt"
  | "decision"
  | "report"
  | "fieldwork"
  | "map-object"
  | "timeline-event"
  | "investigation"
  | "context"
  | "model-goal"
  | "model-update"
  | "active-question"

export type MapSubtype =
  | "claim"
  | "conflict"
  | "loop"
  | "goal"
  | "active-question"
  | "model-update"
  | "context"

export interface DecisionOption {
  label: string
  text: string
  pros?: string[]
  cons?: string[]
}

export interface LabeledValue {
  label: string
  value: string
}

export interface OrvekObject {
  id: string
  type: OrvekObjectType
  title: string
  subtype?: MapSubtype | string
  summary?: string
  whyItMatters?: string
  /** ids of receipts that support this object */
  receiptIds?: string[]
  supporting?: string[]
  conflicting?: string[]
  /** ids of related objects */
  relatedIds?: string[]
  /** ids of relevant context-profile objects */
  contextIds?: string[]
  whatWouldChange?: string[]
  evidenceCount?: number
  lastUpdated?: string
  date?: string
  tags?: string[]
  detailHref?: string

  // receipt
  sourceText?: string
  sourceOrigin?: string
  whyResurfaced?: string

  // decision
  recommendation?: string
  options?: DecisionOption[]
  decisionContext?: LabeledValue[]
  projection?: string
  confidence?: string
  outcomeWindow?: string
  outcomeState?: "due" | "open" | "recorded"
  expectedOutcome?: string
  actualOutcome?: string

  /** Durable user correction — distinct from summary (original assertion). */
  userCorrectionLabel?: string
  userCorrectionAt?: string
  correctionCount?: number

  /** Durable fieldwork check-in observation. */
  checkInNote?: string
  checkInOutcome?: string
  checkInCompletedAt?: string

  // report
  reportType?: string
  period?: string
  reportSummary?: string
  /** Explicit overlay provenance — never infer live from styling alone. */
  reportProvenance?: "live_model_update" | "reference_sample"
  /** Cited evidence quotes for live ModelUpdate reports. */
  evidenceQuotes?: string[]

  // fieldwork
  purpose?: string
  expectedSignal?: string
  whatToObserve?: string
  confirmIf?: string
  weakenIf?: string
  reviewWindow?: string
  resultHistory?: string[]

  // timeline
  eventType?: string
  affectedObject?: string
  before?: string
  after?: string
  /** Stored movement rationale — distinct from summary and evidence text. */
  movementRationale?: string
  /** Shared production report identity (ModelUpdate id). */
  canonicalReportId?: string

  // investigation
  hypotheses?: string[]
  missingEvidence?: string[]
  status?: string

  /** Production inspector bridge — maps selection to stored evidence object. */
  inspectorObjectType?: string
  inspectorObjectId?: string

  /** SUBSYS-003 Slice A — selected evidence Receipt metadata (projection only). */
  evidenceClass?: string
  evidenceClassLabel?: string
  evidenceSourceType?: string
  evidenceSourceTypeLabel?: string
  evidenceRole?: string
  evidenceRoleLabel?: string
  evidenceProvenanceLabel?: string
  evidenceSourceDisclosure?: "available" | "redacted" | "unavailable"
  evidenceRecordedAt?: string
  /** Opaque Back target for the originating ModelUpdate selection. */
  returnSelectionId?: string

  /** SUBSYS-004 Slice B — selected canonical concept metadata (projection only). */
  conceptLabel?: string
  currentRevisionAcceptedAt?: string
  currentRevisionRecordedLabel?: string
  sourceProvenanceLabel?: string
  historicalSources?: Array<{ label: string }>

  /**
   * Canonical authority identity for correction handoff only.
   * Present when inspectorObjectType is canonical_concept.
   */
  currentRevisionId?: string
  canonicalVersion?: number

  /**
   * Canonical semantic source type for adapter provenance (DEL-005).
   * Identifies the governing object family without creating a parallel truth store.
   */
  canonicalSourceType?: import("@/lib/orvek-intelligence-object-authority").CanonicalSourceTypeTag

  /**
   * Accepted active ReferenceItems for Map profile sections
   * (e.g. Preferences / interests → KNOWN PREFERENCES).
   * Not ModelUpdates; not fabricated evidence links.
   */
  profileFacts?: import("@/lib/map-profile-facts").MapProfileFact[]
  profileFactsHeading?: string
  profileFactsEmptyCopy?: string
}
