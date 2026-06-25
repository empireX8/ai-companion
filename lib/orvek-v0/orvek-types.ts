export type OrvekObjectType =
  | "receipt"
  | "decision"
  | "report"
  | "fieldwork"
  | "map-object"
  | "timeline-event"
  | "investigation"
  | "context"
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

import type { InspectorSelectableObjectType } from "@/lib/inspector-selection"

export interface OrvekObject {
  id: string
  type: OrvekObjectType
  title: string
  /** Production inspector bridge — maps workbench select to real inspector. */
  inspectorObjectType?: InspectorSelectableObjectType
  inspectorObjectId?: string
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

  // report
  reportType?: string
  period?: string
  reportSummary?: string

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

  // investigation
  hypotheses?: string[]
  missingEvidence?: string[]
  status?: string
}
