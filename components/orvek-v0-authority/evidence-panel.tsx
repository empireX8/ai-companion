"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"
import { useOrvekData, useOrvekObjectGraph } from "@/lib/orvek-v0/data-provider"
import { isProductionDisplay } from "@/lib/orvek-v0/display-contract"
import {
  DurableCorrectionControls,
  DurableDecisionOutcomeControls,
  DurableFieldworkCheckInControls,
  supportsDurableCorrection,
} from "@/components/orvek-v0/durable-user-action-controls"
import { hasLiveExploreChatFromProvider } from "@/lib/orvek-v0/production/free-explore-chat-presentation"
import { EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY } from "@/lib/explore-surface"
import {
  composeProductionModelUpdateCanonicalViewModel,
  type AffectedObjectPresentationContext,
} from "@/lib/orvek-v0/production/model-update-inspector-presentation"
import { InspectorObjectOverlayProvider } from "@/lib/orvek-v0/inspector-object-overlay"
import {
  fetchInspectorContradiction,
  fetchInspectorEvidenceLinks,
  fetchInspectorModelUpdateDetail,
  fetchInspectorPatternClaim,
  fetchInspectorUserMapDetail,
  INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorEvidenceLinkItem,
  type InspectorModelUpdateDetail,
} from "@/lib/inspector-object-api"
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice"
import { useWorkbench, type InspectorTab } from "@/components/orvek-v0/store"
import { Chip, SectionLabel, TYPE_META, TypeBadge } from "@/components/orvek-v0/primitives"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CornerDownRight,
  GitCompareArrows,
  MessageSquare,
  Pencil,
  PanelRight,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react"

// Shared Inspector presentation authority. Frozen desktop reference workbench and
// authenticated production workbench both render this chrome.

const CORRECTIONS = [
  "Confirm",
  "This is wrong",
  "Missing context",
  "Only true in this situation",
  "Used to be true",
  "Do not use this assumption",
]
const PRODUCTION_MODEL_UPDATE_DETAIL_RETRY_DELAYS_MS = [
  0,
  250,
  500,
  1000,
  1500,
  2000,
  3000,
  4000,
  5000,
  6000,
  8000,
  10000,
] as const

export function EvidencePanel() {
  const data = useOrvekData()
  const {
    selectedId,
    inspectorTab,
    setInspectorTab,
    exploreActive,
    setInspectorScrollTopCapture,
    pendingInspectorScrollTop,
    consumePendingInspectorScrollTop,
    canGoBack,
  } = useWorkbench()
  const { getObject } = useOrvekObjectGraph()
  const stickyInspectorOverlayRef = useRef<Record<string, OrvekObject>>({})
  const graphObj = selectedId ? getObject(selectedId) : undefined
  const stickyObj = selectedId ? stickyInspectorOverlayRef.current[selectedId] : undefined
  const obj =
    stickyObj && graphObj ? { ...graphObj, ...stickyObj } : (stickyObj ?? graphObj)
  // Hydrate ModelUpdate Inspector depth for production + canonical live.
  // Depth comes from owned inspector APIs; presentation pages stay unchanged.
  const selectedModelUpdateId =
    obj && obj.type === "model-update" && isProductionDisplay(data)
      ? obj.inspectorObjectId ?? obj.id
      : null
  const productionModelUpdate = useProductionModelUpdateInspector(selectedModelUpdateId)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const productionCanonical =
    selectedModelUpdateId && productionModelUpdate.detail && obj
      ? (() => {
          try {
            return composeProductionModelUpdateCanonicalViewModel({
              obj,
              detail: productionModelUpdate.detail,
              modelUpdateEvidence: productionModelUpdate.modelUpdateEvidence,
              affectedContext: productionModelUpdate.affectedContext,
              resolveSelectionId: (objectType, objectId) => {
                const fromSticky = stickyInspectorOverlayRef.current
                return resolveWorkbenchSelectionId(
                  (id) => {
                    const graph = getObject(id)
                    const sticky = id ? fromSticky[id] : undefined
                    return sticky && graph ? { ...graph, ...sticky } : sticky ?? graph
                  },
                  objectType,
                  objectId,
                )
              },
              getObjectTitle: (id) => {
                const graph = getObject(id)
                const sticky = stickyInspectorOverlayRef.current[id]
                return (sticky && graph ? { ...graph, ...sticky } : sticky ?? graph)?.title
              },
            })
          } catch {
            return null
          }
        })()
      : null

  if (productionCanonical) {
    const nextOverlay = {
      ...productionCanonical.satellites,
      [productionCanonical.object.id]: productionCanonical.object,
    }
    stickyInspectorOverlayRef.current = canGoBack
      ? { ...stickyInspectorOverlayRef.current, ...nextOverlay }
      : nextOverlay
  } else if (!selectedId) {
    stickyInspectorOverlayRef.current = {}
  }

  const displayObj = productionCanonical?.object ?? obj
  // Keep composed satellites available while navigating receipt/related links and Back,
  // so production ModelUpdates do not lose ObjectDetail continuity outside the MU id.
  const overlayObjects = stickyInspectorOverlayRef.current
  const headerTitle = displayObj?.title
  const productionHydrating =
    Boolean(selectedModelUpdateId) &&
    (productionModelUpdate.isLoading || productionModelUpdate.isResolving)
  const productionUnavailable =
    Boolean(selectedModelUpdateId) &&
    !productionHydrating &&
    !productionModelUpdate.detail

  useEffect(() => {
    setInspectorScrollTopCapture(() => bodyRef.current?.scrollTop ?? 0)
    return () => setInspectorScrollTopCapture(null)
  }, [setInspectorScrollTopCapture])

  useEffect(() => {
    if (pendingInspectorScrollTop === null) {
      return
    }
    const top = consumePendingInspectorScrollTop()
    if (top === null) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = top
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pendingInspectorScrollTop, consumePendingInspectorScrollTop, selectedId, inspectorTab])

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: "evidence", label: "Evidence / Context" },
    { id: "movement", label: "Model Movement" },
  ]

  return (
    <aside className="flex h-full w-[392px] shrink-0 flex-col">
      <div className="o-float flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <header className="flex items-center gap-2 px-5 pt-4">
          <PanelRight className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold leading-tight text-foreground">Inspector</h2>
          {exploreActive ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-semibold text-action-foreground">
              <span className="o-breathe size-1.5 rounded-full bg-action" />
              Live
            </span>
          ) : displayObj ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Synced
            </span>
          ) : null}
        </header>
        {displayObj && (
          <p className="truncate px-5 pt-1 text-[12px] leading-tight text-muted-foreground">
            {headerTitle}
          </p>
        )}
        {displayObj?.type === "model-update" ? (
          <p className="sr-only" data-testid="inspector-model-update-id">
            {displayObj.id}
          </p>
        ) : null}
        <div className="o-sunken mx-4 mt-3 inline-flex rounded-[10px] p-1">
          {tabs.map((t) => {
            const active = inspectorTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setInspectorTab(t.id)}
                className={cn(
                  "o-calm flex-1 rounded-[7px] px-2.5 py-1.5 text-xs font-medium",
                  active
                    ? "bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(30,41,59,0.18)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <div
          ref={bodyRef}
          key={inspectorTab}
          className="o-inspector-body min-h-0 flex-1 overflow-y-auto"
        >
          <InspectorObjectOverlayProvider objects={overlayObjects}>
            {productionUnavailable ? (
              <ModelUpdateUnavailableState
                mode={inspectorTab === "movement" ? "movement" : "evidence"}
                isResolving={false}
              />
            ) : productionHydrating && !displayObj ? (
              <ModelUpdateSkeleton />
            ) : inspectorTab === "evidence" ? (
              displayObj ? (
                <div
                  data-testid={
                    selectedModelUpdateId ? "authority-model-update-evidence" : undefined
                  }
                >
                  <ObjectDetail obj={displayObj} />
                </div>
              ) : (
                <EmptyState />
              )
            ) : (
              <div
                data-testid={
                  selectedModelUpdateId ? "authority-model-update-movement" : undefined
                }
              >
                <MovementView obj={displayObj} />
              </div>
            )}
          </InspectorObjectOverlayProvider>
        </div>
      </div>
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <ScrollText className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">Nothing selected</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Select any object to inspect its evidence, supporting and conflicting signals, related
        objects, and what would change Orvek&apos;s read.
      </p>
    </div>
  )
}

/* ─────────────────────────── Model Movement tab ─────────────────────────── */

function MovementView({ obj }: { obj: OrvekObject | undefined }) {
  const { exploreActive, extractions, setExtraction, pushSelection, openReport } =
    useWorkbench()
  const { getObject, getObjects } = useOrvekObjectGraph()
  const data = useOrvekData()
  const hasLiveExploreChat = hasLiveExploreChatFromProvider(data)
  const referenceConversationMovement = data.exploreMovement ?? []
  const showReferenceConversationMovement = exploreActive && !hasLiveExploreChat
  const showLiveConversationMovementEmpty =
    exploreActive && hasLiveExploreChat && referenceConversationMovement.length === 0
  const referenceRecent = getObjects(["mu-1", "mu-2", "mu-3"])
  const productionRecent = getObjects(
    (data.today?.movements ?? []).slice(0, 3).map((movement) => movement.id),
  )
  const recent = referenceRecent.length > 0 ? referenceRecent : productionRecent
  const reportId =
    obj?.canonicalReportId ??
    (referenceRecent.length > 0 ? "rep-weekly" : obj?.id ?? null)

  return (
    <div className="pb-6">
      {showReferenceConversationMovement && (
        <section className="mx-4 mt-4 rounded-2xl bg-action-muted/40 px-4 py-3.5 ring-1 ring-inset ring-action/15">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-action-foreground" aria-hidden />
            <SectionLabel className="text-action-foreground">
              From this conversation
            </SectionLabel>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
            This may update your model in {referenceConversationMovement.length} places. Confirm
            what is true.
          </p>
          <div className="mt-3 space-y-2">
            {referenceConversationMovement.map((ex) => {
              const state = extractions[ex.id]
              const rejected = state === "Rejected"
              return (
                <div
                  key={ex.id}
                  className={cn(
                    "o-calm rounded-[10px] bg-card p-2.5 shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)]",
                    rejected
                      ? "opacity-50"
                      : state
                        ? "ring-1 ring-inset ring-primary/30"
                        : "",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Chip tone="evidence">{ex.kind}</Chip>
                    {state && !rejected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Check className="size-3" /> {state}
                      </span>
                    )}
                    {rejected && (
                      <span className="text-[11px] text-muted-foreground">Rejected</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{ex.text}</p>
                  {ex.linkId && (
                    <button
                      type="button"
                      onClick={() =>
                        pushSelection(ex.linkId!, "evidence", "Viewing linked grounding")
                      }
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <CornerDownRight className="size-3" /> attaches to{" "}
                      {getObject(ex.linkId)?.title}
                    </button>
                  )}
                  {!state && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        { label: "Confirm", icon: Check, val: "Confirmed" },
                        { label: "Edit", icon: Pencil, val: "Edited" },
                        { label: "Reject", icon: X, val: "Rejected" },
                      ].map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          onClick={() => setExtraction(ex.id, a.val)}
                          className={cn(
                            "o-calm inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11px] font-medium",
                            a.label === "Confirm"
                              ? "bg-evidence-muted text-primary hover:brightness-[0.97]"
                              : a.label === "Reject"
                                ? "text-destructive hover:bg-destructive/10"
                                : "bg-secondary/70 text-foreground hover:bg-accent/60",
                          )}
                        >
                          <a.icon className="size-3" />
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3">
            <SectionLabel>Grounded in</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {getObjects(data.exploreGrounding ?? []).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pushSelection(g.id, "evidence", "Viewing grounding evidence")}
                >
                  <Chip tone="neutral" className="cursor-pointer hover:opacity-80">
                    {g.title}
                  </Chip>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {showLiveConversationMovementEmpty ? (
        <section className="mx-4 mt-4 rounded-2xl bg-muted/30 px-4 py-3.5 ring-1 ring-inset ring-border/40">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY}
          </p>
        </section>
      ) : null}

      <InspectorReturnBanner
        className="mx-4 mt-4"
        fallbackTrailLabel="Viewing related movement"
      />

      {/* selected object movement */}
      {obj && (obj.before || obj.after) ? (
        <section className="px-5 pt-4" data-testid="model-update-movement-top">
          <SectionLabel>{obj.title}</SectionLabel>
          <BeforeAfter before={obj.before} after={obj.after} />
          {obj.confidence && (
            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">Confidence: </span>
              <span className="font-medium text-foreground">{obj.confidence}</span>
            </p>
          )}
        </section>
      ) : obj && !exploreActive ? (
        <section className="px-5 pt-4" data-testid="model-update-movement-top">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{obj.title}</span> has no recorded
            before/after movement yet. Recent movement across the model is shown below.
          </p>
        </section>
      ) : null}

      {/* recent global movement */}
      <section className="px-5 pt-5" data-testid="model-update-recent-movement">
        <div className="flex items-center gap-1.5">
          <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
          <SectionLabel>Recent model movement</SectionLabel>
        </div>
        <div className="mt-2.5 space-y-2.5">
          {recent.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pushSelection(m.id, "movement", "Viewing recent model movement")}
              className="o-calm block w-full rounded-[10px] bg-card p-2.5 text-left shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)] hover:bg-accent/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground">{m.title}</span>
                <span className="text-[11px] text-muted-foreground">{m.lastUpdated}</span>
              </div>
              <BeforeAfter before={m.before} after={m.after} compact />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openReport(reportId)}
          className="o-calm mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
          data-testid="model-update-open-report"
        >
          Open Model Movement report
          <ArrowRight className="size-3.5" />
        </button>
      </section>
    </div>
  )
}

function BeforeAfter({
  before,
  after,
  compact,
}: {
  before?: string
  after?: string
  compact?: boolean
}) {
  if (!before && !after) return null
  return (
    <div className={cn("space-y-1.5", compact ? "mt-1.5" : "mt-2")}>
      {before && (
        <div className="rounded-[9px] bg-muted/70 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Before
          </p>
          <p className="mt-0.5 text-[13px] text-foreground">{before}</p>
        </div>
      )}
      {after && (
        <div className="rounded-[9px] bg-evidence-muted/70 px-2.5 py-1.5 ring-1 ring-inset ring-primary/15">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">After</p>
          <p className="mt-0.5 text-[13px] text-foreground">{after}</p>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Evidence / Context tab ─────────────────────────── */

function Block({
  label,
  children,
  testId,
}: {
  label: string
  children: React.ReactNode
  testId?: string
}) {
  return (
    <section className="px-5 pt-4" data-testid={testId}>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  )
}

function InspectorReturnBanner({
  className,
  fallbackTrailLabel,
}: {
  className?: string
  fallbackTrailLabel?: string
}) {
  const { canGoBack, backTarget, goBack } = useWorkbench()
  const { getObject } = useOrvekObjectGraph()

  if (!canGoBack || !backTarget) {
    return null
  }

  const backTitle = getObject(backTarget.selectedId)?.title ?? backTarget.selectedId

  return (
    <div className={cn("rounded-[10px] bg-secondary/50 px-2.5 py-2", className)}>
      <button
        type="button"
        onClick={goBack}
        className="o-calm inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to {backTitle}
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {backTarget.trailLabel ?? fallbackTrailLabel ?? "Viewing linked evidence"}
      </p>
    </div>
  )
}

function LinkedRow({
  obj,
  trailLabel,
}: {
  obj: OrvekObject
  trailLabel?: string
}) {
  const { pushSelection } = useWorkbench()
  const Icon = TYPE_META[obj.type].icon
  return (
    <button
      type="button"
      onClick={() => pushSelection(obj.id, "evidence", trailLabel)}
      className="o-calm flex w-full items-center gap-2 rounded-[9px] bg-secondary/50 px-2.5 py-2 text-left hover:bg-accent/60"
    >
      <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="flex-1 truncate text-[13px] text-foreground">{obj.title}</span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

function ObjectDetail({ obj }: { obj: OrvekObject }) {
  const {
    openReport,
    pushSelection,
    setPage,
    setInspectorTab,
    applyCorrection,
    corrections,
  } = useWorkbench()
  const { getObjects } = useOrvekObjectGraph()
  const data = useOrvekData()
  const isProduction = isProductionDisplay(data)
  const [outcomeAdded, setOutcomeAdded] = useState(false)
  const [checkin, setCheckin] = useState("")
  const [checkedIn, setCheckedIn] = useState(false)

  const receipts = getObjects(obj.receiptIds)
  const related = getObjects(obj.relatedIds)
  const context = getObjects(obj.contextIds)
  const correction = corrections[obj.id]

  const showCorrections =
    obj.type === "map-object" ||
    obj.type === "model-goal" ||
    obj.type === "context" ||
    obj.type === "receipt" ||
    obj.type === "model-update" ||
    obj.type === "active-question" ||
    obj.type === "decision" ||
    obj.type === "investigation"

  return (
    <div className="pb-6">
      <InspectorReturnBanner className="mx-5 mt-4" />

      {/* header */}
      <div
        className="px-5 pt-4"
        data-testid={obj.type === "model-update" ? "model-update-evidence-top" : undefined}
      >
        <TypeBadge type={obj.type} />
        <h3 className="mt-2 text-base font-semibold leading-snug text-foreground text-pretty">
          {obj.title}
        </h3>
        {(obj.lastUpdated || obj.date) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {obj.subtype ? `${obj.subtype} · ` : ""}
            {obj.lastUpdated ?? obj.date}
          </p>
        )}
      </div>

      {/* receipt source */}
      {obj.type === "receipt" && obj.sourceText && (
        <Block label="Source text">
          <blockquote className="rounded-md border-l-2 border-primary bg-evidence-muted/50 px-3 py-2 text-[13px] italic text-foreground">
            “{obj.sourceText}”
          </blockquote>
          <p className="mt-2 text-xs text-muted-foreground">
            {obj.sourceOrigin} · {obj.date}
          </p>
        </Block>
      )}

      {obj.whyResurfaced && (
        <Block
          label="Why it resurfaced"
          testId={obj.type === "model-update" ? "model-update-why-it-resurfaced" : undefined}
        >
          {obj.whyResurfaced}
        </Block>
      )}

      {obj.summary && (
        <Block
          label="Summary"
          testId={obj.type === "model-update" ? "model-update-summary" : undefined}
        >
          {obj.summary}
        </Block>
      )}

      {obj.whyItMatters && (
        <Block
          label="Why it matters"
          testId={obj.type === "model-update" ? "model-update-why-it-matters" : undefined}
        >
          {obj.whyItMatters}
        </Block>
      )}

      {/* decision recommendation */}
      {obj.recommendation && <Block label="Current model read">{obj.recommendation}</Block>}

      {/* decision options */}
      {obj.options && obj.options.length > 0 && (
        <Block label="Options">
          <div className="space-y-2.5">
            {obj.options.map((opt) => (
              <div key={opt.label} className="rounded-[9px] bg-secondary/50 p-2.5">
                <p className="text-[13px] font-medium text-foreground">
                  <span className="text-primary">{opt.label}.</span> {opt.text}
                </p>
                {opt.pros && (
                  <ul className="mt-1.5 space-y-0.5">
                    {opt.pros.map((p) => (
                      <li key={p} className="flex gap-1.5 text-xs text-foreground">
                        <span className="text-primary">+</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                {opt.cons && (
                  <ul className="mt-1 space-y-0.5">
                    {opt.cons.map((c) => (
                      <li key={c} className="flex gap-1.5 text-xs text-muted-foreground">
                        <span className="text-destructive">−</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {/* decision context */}
      {obj.decisionContext && obj.decisionContext.length > 0 && (
        <Block label="Context">
          <dl className="space-y-1.5">
            {obj.decisionContext.map((c) => (
              <div key={c.label} className="flex gap-2 text-[13px]">
                <dt className="w-28 shrink-0 text-muted-foreground">{c.label}</dt>
                <dd className="text-foreground">{c.value}</dd>
              </div>
            ))}
          </dl>
        </Block>
      )}

      {obj.projection && (
        <Block label="Projection">
          <p>{obj.projection}</p>
          {obj.confidence && (
            <p className="mt-1.5 text-xs">
              <span className="text-muted-foreground">Confidence: </span>
              <span className="font-medium text-foreground">{obj.confidence}</span>
            </p>
          )}
        </Block>
      )}

      {/* outcome */}
      {(obj.outcomeWindow || obj.expectedOutcome || obj.actualOutcome) && (
        <Block label="Outcome">
          {obj.outcomeWindow && (
            <p className="text-[13px] text-muted-foreground">{obj.outcomeWindow}</p>
          )}
          {obj.expectedOutcome && (
            <p className="mt-1.5 text-[13px]">
              <span className="text-muted-foreground">Expected: </span>
              {obj.expectedOutcome}
            </p>
          )}
          {obj.actualOutcome && (
            <p className="mt-1 text-[13px]">
              <span className="text-muted-foreground">Actual: </span>
              {obj.actualOutcome}
            </p>
          )}
          {obj.outcomeState !== "recorded" && !obj.actualOutcome && (
            isProduction ? (
              <DurableDecisionOutcomeControls object={obj} className="mt-2.5" />
            ) : (
              <button
                type="button"
                onClick={() => setOutcomeAdded(true)}
                disabled={outcomeAdded}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-action px-2.5 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {outcomeAdded ? <Check className="size-3.5" /> : null}
                {outcomeAdded ? "Outcome recorded" : "Add outcome"}
              </button>
            )
          )}
        </Block>
      )}

      {/* report meta */}
      {obj.type === "report" && (
        <Block label="Report">
          <p className="text-[13px] text-muted-foreground">
            {obj.reportType} · {obj.period}
          </p>
          {obj.reportSummary && <p className="mt-1.5 text-[13px]">{obj.reportSummary}</p>}
          <button
            type="button"
            onClick={() => openReport(obj.id)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open report
            <ArrowRight className="size-3.5" />
          </button>
        </Block>
      )}

      {/* fieldwork */}
      {obj.type === "fieldwork" && (
        <>
          {obj.purpose && <Block label="Purpose">{obj.purpose}</Block>}
          {obj.expectedSignal && <Block label="Expected signal">{obj.expectedSignal}</Block>}
          {obj.whatToObserve && <Block label="What to observe">{obj.whatToObserve}</Block>}
          {(obj.confirmIf || obj.weakenIf) && (
            <Block label="Calibration">
              {obj.confirmIf && (
                <p className="text-[13px]">
                  <span className="text-primary">Confirms if: </span>
                  {obj.confirmIf}
                </p>
              )}
              {obj.weakenIf && (
                <p className="mt-1 text-[13px]">
                  <span className="text-destructive">Weakens if: </span>
                  {obj.weakenIf}
                </p>
              )}
            </Block>
          )}
          <Block label="Check in">
            {isProduction ? (
              <DurableFieldworkCheckInControls object={obj} />
            ) : checkedIn ? (
              <p className="inline-flex items-center gap-1.5 text-[13px] text-primary">
                <Check className="size-4" /> Check-in saved as a receipt.
              </p>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={checkin}
                  onChange={(e) => setCheckin(e.target.value)}
                  rows={2}
                  placeholder="What happened in the field?"
                  className="w-full resize-none rounded-[9px] bg-secondary/60 px-2.5 py-2 text-[13px] text-foreground outline-none ring-1 ring-inset ring-transparent focus:bg-card focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setCheckedIn(true)}
                  disabled={!checkin.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-action px-2.5 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Save check-in
                </button>
              </div>
            )}
          </Block>
        </>
      )}

      {/* investigation */}
      {obj.hypotheses && obj.hypotheses.length > 0 && (
        <Block label="Hypotheses">
          <ul className="space-y-1">
            {obj.hypotheses.map((h) => (
              <li key={h} className="flex gap-1.5 text-[13px]">
                <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {h}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {obj.missingEvidence && obj.missingEvidence.length > 0 && (
        <Block label="Missing evidence">
          <ul className="space-y-1">
            {obj.missingEvidence.map((m) => (
              <li key={m} className="flex gap-1.5 text-[13px] text-muted-foreground">
                <span className="text-action-foreground">?</span>
                {m}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* before / after */}
      {(obj.before || obj.after) && (
        <Block
          label="Model movement"
          testId={obj.type === "model-update" ? "model-update-before-after" : undefined}
        >
          <BeforeAfter before={obj.before} after={obj.after} />
          <button
            type="button"
            onClick={() => setInspectorTab("movement")}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            See full movement
            <ArrowRight className="size-3" />
          </button>
        </Block>
      )}

      {/* receipts */}
      {receipts.length > 0 && (
        <Block
          label={`Receipts · ${receipts.length}`}
          testId={obj.type === "model-update" ? "model-update-receipts" : undefined}
        >
          <div className="space-y-1.5">
            {receipts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pushSelection(r.id, "evidence", "Viewing supporting receipt")}
                className="o-calm block w-full rounded-[9px] rounded-l-sm border-l-2 border-primary/50 bg-secondary/50 px-2.5 py-1.5 text-left text-[13px] italic text-foreground hover:bg-accent/60"
              >
                “{r.title}”
              </button>
            ))}
          </div>
        </Block>
      )}

      {/* supporting / conflicting */}
      {(obj.supporting?.length || obj.conflicting?.length) && (
        <Block
          label="Supporting & conflicting"
          testId={
            obj.type === "model-update" ? "model-update-supporting-conflicting" : undefined
          }
        >
          <div className="rounded-[10px] bg-secondary/40 px-3 py-2.5">
            {obj.supporting && (
              <ul className="space-y-1">
                {obj.supporting.map((s) => (
                  <li key={s} className="flex gap-1.5 text-[13px]">
                    <span className="text-primary">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {obj.conflicting && (
              <ul className="mt-1.5 space-y-1">
                {obj.conflicting.map((c) => (
                  <li key={c} className="flex gap-1.5 text-[13px] text-muted-foreground">
                    <span className="text-destructive">−</span>
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Block>
      )}

      {/* relevant context */}
      {context.length > 0 && (
        <Block
          label="Relevant background / context"
          testId={obj.type === "model-update" ? "model-update-context" : undefined}
        >
          <div className="space-y-1.5">
            {context.map((c) => (
              <LinkedRow key={c.id} obj={c} trailLabel="Viewing background context" />
            ))}
          </div>
        </Block>
      )}

      {/* related objects */}
      {related.length > 0 && (
        <Block
          label="Related objects"
          testId={obj.type === "model-update" ? "model-update-related-objects" : undefined}
        >
          <div className="space-y-1.5">
            {related.map((r) => (
              <LinkedRow key={r.id} obj={r} trailLabel="Viewing related object" />
            ))}
          </div>
        </Block>
      )}

      {/* what would change this */}
      {obj.whatWouldChange && obj.whatWouldChange.length > 0 && (
        <Block label="What would change this">
          <ul className="space-y-1">
            {obj.whatWouldChange.map((w) => (
              <li key={w} className="flex gap-1.5 text-[13px] text-muted-foreground">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-action-foreground" />
                {w}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* ask in explore */}
      {obj.type !== "report" && (
        <section className="px-5 pt-4">
          <button
            type="button"
            onClick={() => setPage("explore")}
            className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
          >
            <MessageSquare className="size-3.5 text-primary" />
            Ask in Explore
          </button>
        </section>
      )}

      {/* corrections */}
      {showCorrections &&
        (isProduction && supportsDurableCorrection(obj) ? (
          <DurableCorrectionControls object={obj} />
        ) : (
          <section className="mx-4 mt-5 rounded-2xl bg-secondary/40 px-4 py-3.5">
            <SectionLabel>Correct the model</SectionLabel>
            {correction && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-evidence-muted px-2 py-1 text-xs font-medium text-primary">
                <Check className="size-3.5" />
                Recorded: “{correction}”
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CORRECTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => applyCorrection(obj.id, label)}
                  className={cn(
                    "o-calm rounded-full px-2.5 py-1 text-xs font-medium",
                    label === "Confirm"
                      ? "bg-evidence-muted text-primary hover:brightness-[0.97]"
                      : label === "This is wrong" || label === "Do not use this assumption"
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                        : "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.12)] hover:bg-accent/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

type AffectedObjectContext = AffectedObjectPresentationContext

type ProductionModelUpdateInspectorState = {
  isLoading: boolean
  isResolving: boolean
  detail: InspectorModelUpdateDetail | null
  modelUpdateEvidence: InspectorEvidenceLinkItem[]
  affectedContext: AffectedObjectContext
}

type ProductionModelUpdateInspectorCacheEntry = {
  detail: InspectorModelUpdateDetail
  modelUpdateEvidence: InspectorEvidenceLinkItem[]
  affectedContext: AffectedObjectContext
}

const EMPTY_AFFECTED_OBJECT_CONTEXT: AffectedObjectContext = {
  userMap: null,
  pattern: null,
  contradiction: null,
  affectedEvidence: [],
}

function useProductionModelUpdateInspector(
  modelUpdateId: string | null,
): ProductionModelUpdateInspectorState {
  const cacheRef = useRef<Map<string, ProductionModelUpdateInspectorCacheEntry>>(new Map())
  const [state, setState] = useState<ProductionModelUpdateInspectorState>({
    isLoading: false,
    isResolving: false,
    detail: null,
    modelUpdateEvidence: [],
    affectedContext: EMPTY_AFFECTED_OBJECT_CONTEXT,
  })

  useEffect(() => {
    if (!modelUpdateId) {
      setState({
        isLoading: false,
        isResolving: false,
        detail: null,
        modelUpdateEvidence: [],
        affectedContext: EMPTY_AFFECTED_OBJECT_CONTEXT,
      })
      return
    }

    let cancelled = false
    const cached = cacheRef.current.get(modelUpdateId) ?? null

    setState(
      cached
        ? {
            isLoading: false,
            isResolving: false,
            detail: cached.detail,
            modelUpdateEvidence: cached.modelUpdateEvidence,
            affectedContext: cached.affectedContext,
          }
        : {
            isLoading: true,
            isResolving: false,
            detail: null,
            modelUpdateEvidence: [],
            affectedContext: EMPTY_AFFECTED_OBJECT_CONTEXT,
          },
    )

    void (async () => {
      let detail: InspectorModelUpdateDetail | null = null
      let enteredRetryState = cached === null

      for (const delayMs of PRODUCTION_MODEL_UPDATE_DETAIL_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delayMs))
        }

        detail = await fetchInspectorModelUpdateDetail(modelUpdateId)

        if (detail) {
          break
        }

        if (cancelled) {
          return
        }

        if (!enteredRetryState && cached === null) {
          enteredRetryState = true
          setState((prev) =>
            prev.detail
              ? prev
              : {
                  isLoading: true,
                  isResolving: true,
                  detail: null,
                  modelUpdateEvidence: [],
                  affectedContext: EMPTY_AFFECTED_OBJECT_CONTEXT,
                },
          )
        }
      }

      if (cancelled) {
        return
      }

      if (!detail) {
        if (cached) {
          return
        }

        setState({
          isLoading: false,
          isResolving: false,
          detail: null,
          modelUpdateEvidence: [],
          affectedContext: EMPTY_AFFECTED_OBJECT_CONTEXT,
        })
        return
      }

      setState((prev) => ({
        isLoading: false,
        isResolving: false,
        detail,
        // Keep prior/cached secondary reads while the linked evidence hydrates so
        // Back never flashes a false "unavailable" affected-object state.
        modelUpdateEvidence: cached?.modelUpdateEvidence ?? prev.modelUpdateEvidence,
        affectedContext: cached?.affectedContext ?? prev.affectedContext,
      }))

      try {
        const [modelUpdateEvidence, affectedContext] = await Promise.all([
          fetchInspectorEvidenceLinks(INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT(modelUpdateId)),
          loadAffectedObjectContext(detail.item),
        ])

        if (cancelled) {
          return
        }

        cacheRef.current.set(modelUpdateId, {
          detail,
          modelUpdateEvidence,
          affectedContext,
        })

        setState({
          isLoading: false,
          isResolving: false,
          detail,
          modelUpdateEvidence,
          affectedContext,
        })
      } catch {
        if (cancelled) {
          return
        }

        cacheRef.current.set(modelUpdateId, {
          detail,
          modelUpdateEvidence: [],
          affectedContext: EMPTY_AFFECTED_OBJECT_CONTEXT,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [modelUpdateId])

  return state
}

function resolveAffectedObjectEvidenceEndpoint(
  affectedObjectType: WhatChangedListItem["affectedObjectType"],
  affectedObjectId: string | null,
): string | null {
  if (!affectedObjectId) {
    return null
  }

  switch (affectedObjectType) {
    case "usermap_conclusion":
      return INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(affectedObjectId)
    case "investigation":
      return `/api/active-questions/${encodeURIComponent(affectedObjectId)}/evidence`
    case "fieldwork_assignment":
      return `/api/watch-for/${encodeURIComponent(affectedObjectId)}/evidence`
    default:
      return null
  }
}

async function loadAffectedObjectContext(item: WhatChangedListItem): Promise<AffectedObjectContext> {
  if (!item.affectedObjectId) {
    return EMPTY_AFFECTED_OBJECT_CONTEXT
  }

  const evidenceEndpoint = resolveAffectedObjectEvidenceEndpoint(
    item.affectedObjectType,
    item.affectedObjectId,
  )
  const evidencePromise = evidenceEndpoint
    ? fetchInspectorEvidenceLinks(evidenceEndpoint)
    : Promise.resolve([])

  switch (item.affectedObjectType) {
    case "usermap_conclusion": {
      const [userMap, affectedEvidence] = await Promise.all([
        fetchInspectorUserMapDetail(item.affectedObjectId),
        evidencePromise,
      ])
      return {
        userMap,
        pattern: null,
        contradiction: null,
        affectedEvidence,
      }
    }
    case "pattern_claim": {
      const [pattern, affectedEvidence] = await Promise.all([
        fetchInspectorPatternClaim(item.affectedObjectId),
        evidencePromise,
      ])
      return {
        userMap: null,
        pattern,
        contradiction: null,
        affectedEvidence,
      }
    }
    case "contradiction_node": {
      const [contradiction, affectedEvidence] = await Promise.all([
        fetchInspectorContradiction(item.affectedObjectId),
        evidencePromise,
      ])
      return {
        userMap: null,
        pattern: null,
        contradiction,
        affectedEvidence,
      }
    }
    case "investigation":
    case "fieldwork_assignment":
      return {
        userMap: null,
        pattern: null,
        contradiction: null,
        affectedEvidence: await evidencePromise,
      }
    default:
      return EMPTY_AFFECTED_OBJECT_CONTEXT
  }
}

function ModelUpdateSkeleton() {
  return (
    <div className="space-y-2 px-5 pt-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-16 animate-pulse rounded-[10px] bg-secondary/50" />
      ))}
    </div>
  )
}

function ModelUpdateUnavailableState({
  mode,
  isResolving,
}: {
  mode: "evidence" | "movement"
  isResolving: boolean
}) {
  if (isResolving) {
    return <ModelUpdateSkeleton />
  }

  return (
    <div className="px-8 py-10 text-center">
      <p className="text-sm font-medium text-foreground">
        {mode === "evidence"
          ? "Loading evidence-backed context"
          : "Loading model movement detail"}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        This published ModelUpdate did not return the detail contract required for the shared
        Inspector yet.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        If the published detail does not become available, only durable actions can remain
        available here.
      </p>
    </div>
  )
}

function resolveWorkbenchSelectionId(
  getObject: (id: string | null | undefined) => OrvekObject | undefined,
  objectType: string | null | undefined,
  objectId: string | null | undefined,
): string | null {
  const safeId = objectId?.trim()
  if (!safeId) {
    return null
  }

  const candidates = [safeId]

  switch (objectType) {
    case "usermap_conclusion":
      candidates.push(`conclusion-${safeId}`, `goal-${safeId}`)
      break
    case "pattern_claim":
      candidates.push(`pattern-${safeId}`)
      break
    case "contradiction_node":
      candidates.push(`contradiction-${safeId}`, `signal-${safeId}`)
      break
    case "investigation":
      candidates.push(`question-${safeId}`, `investigation-${safeId}`)
      break
    case "fieldwork_assignment":
      candidates.push(`fieldwork-${safeId}`)
      break
    case "model_update":
      candidates.push(`movement-${safeId}`)
      break
    case "context_profile":
      candidates.push(`context-${safeId}`)
      break
    case "model_goal":
      candidates.push(`goal-${safeId}`)
      break
  }

  const uniqueCandidates = [...new Set(candidates)]
  return uniqueCandidates.find((candidate) => Boolean(getObject(candidate))) ?? null
}
