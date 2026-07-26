"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"
import { useOrvekData, useOrvekObjectGraph } from "@/lib/orvek-v0/data-provider"
import { isProductionDisplay } from "@/lib/orvek-v0/display-contract"
import { minimumPermanentSlots } from "@/components/orvek-v0-canonical/permanent-presentation"
import {
  DurableCorrectionControls,
  DurableDecisionOutcomeControls,
  DurableFieldworkCheckInControls,
  supportsDurableCorrection,
} from "@/components/orvek-v0/durable-user-action-controls"
import { ContradictionDualSourceView } from "@/components/contradiction/ContradictionDualSourceView"
import { hasLiveExploreChatFromProvider } from "@/lib/orvek-v0/production/free-explore-chat-presentation"
import { EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY } from "@/lib/explore-surface"
import {
  beginContradictionInspectorDetailLoad,
  createEmptyContradictionInspectorDetailState,
  failContradictionInspectorDetailLoad,
  resolveContradictionInspectorDetailLoad,
  selectRenderableContradictionInspectorDetail,
} from "@/lib/contradiction-inspector-detail-state"
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
  type InspectorContradictionProjection,
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
    page,
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
  const inspectorIsLoading =
    page === "today"
      ? data.todayIsLoading === true
      : page === "map"
        ? data.mapIsLoading === true
        : page === "decisions"
          ? data.decisionsIsLoading === true
          : page === "timeline"
            ? data.timelineIsLoading === true
            : data.exploreIsLoading === true ||
              data.activeQuestionsIsLoading === true ||
              data.investigationsIsLoading === true ||
              data.experimentIsLoading === true
  const headerTitle = displayObj?.title ?? "No object is selected"
  const productionHydrating =
    Boolean(selectedModelUpdateId) &&
    (productionModelUpdate.isLoading || productionModelUpdate.isResolving)
  const hasLiveExploreChat = hasLiveExploreChatFromProvider(data)
  const exploreMovementActive =
    exploreActive &&
    !hasLiveExploreChat &&
    (data.exploreMovement?.length ?? 0) > 0

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
    <aside
      className="flex h-full w-[392px] shrink-0 flex-col"
      data-shell-slot="inspector"
    >
      <div className="o-float flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <header className="flex items-center gap-2 px-5 pt-4">
          <PanelRight className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold leading-tight text-foreground">Inspector</h2>
          {exploreActive ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-semibold text-action-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full bg-action",
                  exploreMovementActive && "o-breathe",
                )}
                data-inspector-explore-activity={
                  exploreMovementActive ? "active" : "idle"
                }
              />
              Live
            </span>
          ) : displayObj ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Synced
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/60" />
              No selection
            </span>
          )}
        </header>
        <p className="truncate px-5 pt-1 text-[12px] leading-tight text-muted-foreground">
          {headerTitle}
        </p>
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
          data-shell-slot="inspector-body"
        >
          <InspectorObjectOverlayProvider objects={overlayObjects}>
            {inspectorTab === "evidence" ? (
              displayObj ? (
                <div
                  data-testid={
                    selectedModelUpdateId ? "authority-model-update-evidence" : undefined
                  }
                >
                  <ObjectDetail obj={displayObj} isLoading={productionHydrating} />
                </div>
              ) : (
                <EmptyEvidenceScaffold isLoading={inspectorIsLoading} />
              )
            ) : (
              <div
                data-testid={
                  selectedModelUpdateId ? "authority-model-update-movement" : undefined
                }
              >
                <MovementView
                  obj={displayObj}
                  isLoading={productionHydrating || (!displayObj && inspectorIsLoading)}
                />
              </div>
            )}
          </InspectorObjectOverlayProvider>
        </div>
      </div>
    </aside>
  )
}

function EmptyEvidenceScaffold({ isLoading }: { isLoading: boolean }) {
  return (
    <div
      className="pb-6"
      data-shell-view="inspector-evidence"
      data-shell-state={isLoading ? "loading" : "empty"}
    >
      <InspectorIdentity isLoading={isLoading} />
      <InspectorSummarySections isLoading={isLoading} />
      <InspectorEvidenceSections isLoading={isLoading} />
    </div>
  )
}

/* ─────────────────────────── Model Movement tab ─────────────────────────── */

function MovementView({
  obj,
  isLoading = false,
}: {
  obj: OrvekObject | undefined
  isLoading?: boolean
}) {
  const { exploreActive, extractions, setExtraction, pushSelection, openReport } =
    useWorkbench()
  const { getObject, getObjects } = useOrvekObjectGraph()
  const data = useOrvekData()
  const hasLiveExploreChat = hasLiveExploreChatFromProvider(data)
  const referenceConversationMovement = data.exploreMovement ?? []
  const showReferenceConversationMovement = exploreActive && !hasLiveExploreChat &&
    referenceConversationMovement.length > 0
  const showLiveConversationMovementEmpty =
    (exploreActive && hasLiveExploreChat) ||
    (exploreActive && referenceConversationMovement.length === 0)
  const referenceRecent = getObjects(["mu-1", "mu-2", "mu-3"])
  const productionRecent = getObjects(
    (data.today?.movements ?? []).slice(0, 3).map((movement) => movement.id),
  )
  const recent = referenceRecent.length > 0 ? referenceRecent : productionRecent
  const recentSlots = minimumPermanentSlots(recent, 3)
  const isProduction = isProductionDisplay(data)
  const reportId =
    obj?.canonicalReportId ??
    (!isProduction && referenceRecent.length > 0 ? "rep-weekly" : null)
  const selectedTitle = obj?.title ?? "Selected object movement"

  return (
    <div
      className="pb-6"
      data-shell-view="inspector-movement"
      data-shell-state={isLoading ? "loading" : obj ? "selected" : "empty"}
    >
      {showReferenceConversationMovement && (
        <section
          className="mx-4 mt-4 rounded-2xl bg-action-muted/40 px-4 py-3.5 ring-1 ring-inset ring-action/15"
          data-shell-slot="inspector-conversation-movement"
        >
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
        <section
          className="mx-4 mt-4 rounded-2xl bg-muted/30 px-4 py-3.5 ring-1 ring-inset ring-border/40"
          data-shell-slot="inspector-conversation-movement"
        >
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
      <section
        className="px-5 pt-4"
        data-testid="model-update-movement-top"
        data-shell-slot="inspector-selected-movement"
        data-live-object-id={obj?.id}
      >
        <SectionLabel>{selectedTitle}</SectionLabel>
        <BeforeAfter before={obj?.before} after={obj?.after} isLoading={isLoading} />
        <p className="mt-2 text-xs" data-shell-slot="inspector-movement-confidence">
          <span className="text-muted-foreground">Confidence: </span>
          <span className="font-medium text-foreground">
            {obj?.confidence || (isLoading ? "Loading…" : "Unavailable")}
          </span>
        </p>
        {!obj && (
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Select an object to inspect its recorded movement.
          </p>
        )}
      </section>

      {/* recent global movement */}
      <section className="px-5 pt-5" data-testid="model-update-recent-movement">
        <div className="flex items-center gap-1.5">
          <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
          <SectionLabel>Recent model movement</SectionLabel>
        </div>
        <div className="mt-2.5 space-y-2.5">
          {recentSlots.map((m, index) => (
            <button
              key={m?.id ?? `empty-movement-${index}`}
              type="button"
              onClick={
                m
                  ? () => pushSelection(m.id, "movement", "Viewing recent model movement")
                  : undefined
              }
              disabled={!m}
              data-shell-item="inspector-recent-movement"
              data-live-object-id={m?.id}
              className="o-calm block w-full rounded-[10px] bg-card p-2.5 text-left shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)] hover:bg-accent/40 disabled:cursor-default disabled:opacity-70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground">
                  {m?.title ||
                    (isLoading ? "Loading recent movement…" : "No recent movement is available.")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {m?.lastUpdated || (isLoading ? "Loading" : "Unavailable")}
                </span>
              </div>
              <BeforeAfter
                before={m?.before}
                after={m?.after}
                compact
                isLoading={isLoading}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reportId ? () => openReport(reportId) : undefined}
          disabled={!reportId}
          data-shell-slot="inspector-movement-report-action"
          data-live-object-id={reportId ?? undefined}
          className="o-calm mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
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
  isLoading = false,
}: {
  before?: string
  after?: string
  compact?: boolean
  isLoading?: boolean
}) {
  return (
    <div
      className={cn("space-y-1.5", compact ? "mt-1.5" : "mt-2")}
      data-shell-slot="inspector-before-after"
    >
      <div
        className="rounded-[9px] bg-muted/70 px-2.5 py-1.5"
        data-shell-item="inspector-before"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Before
        </p>
        <p className="mt-0.5 text-[13px] text-foreground">
          {before || (isLoading ? "Loading prior state…" : "No prior state is available.")}
        </p>
      </div>
      <div
        className="rounded-[9px] bg-evidence-muted/70 px-2.5 py-1.5 ring-1 ring-inset ring-primary/15"
        data-shell-item="inspector-after"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">After</p>
        <p className="mt-0.5 text-[13px] text-foreground">
          {after || (isLoading ? "Loading updated state…" : "No updated state is available.")}
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────── Evidence / Context tab ─────────────────────────── */

function Block({
  label,
  children,
  testId,
  shellSlot,
}: {
  label: string
  children: React.ReactNode
  testId?: string
  shellSlot?: string
}) {
  return (
    <section className="px-5 pt-4" data-testid={testId} data-shell-slot={shellSlot}>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  )
}

function InspectorIdentity({
  obj,
  isLoading = false,
}: {
  obj?: OrvekObject
  isLoading?: boolean
}) {
  return (
    <div
      className="px-5 pt-4"
      data-shell-slot="inspector-object-identity"
      data-live-object-id={obj?.id}
      data-testid={obj?.type === "model-update" ? "model-update-evidence-top" : undefined}
    >
      {obj ? (
        <TypeBadge type={obj.type} />
      ) : (
        <span className="inline-flex rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {isLoading ? "Loading selection" : "No selection"}
        </span>
      )}
      <h3 className="mt-2 text-base font-semibold leading-snug text-foreground text-pretty">
        {obj?.title || (isLoading ? "Loading selected object…" : "No object is selected")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {obj
          ? `${obj.subtype ? `${obj.subtype} · ` : ""}${
              obj.lastUpdated ?? obj.date ?? "Update unavailable"
            }`
          : isLoading
            ? "Loading object status…"
            : "Type and update unavailable"}
      </p>
    </div>
  )
}

function InspectorSummarySections({
  obj,
  isLoading = false,
}: {
  obj?: OrvekObject
  isLoading?: boolean
}) {
  return (
    <>
      <Block
        label="Summary"
        shellSlot="inspector-summary"
        testId={obj?.type === "model-update" ? "model-update-summary" : undefined}
      >
        {obj?.summary ||
          (isLoading
            ? "Loading the current summary…"
            : obj
              ? "No current summary is available."
              : "Select an object to inspect its current summary.")}
      </Block>
      <Block
        label="Why it matters"
        shellSlot="inspector-why-it-matters"
        testId={obj?.type === "model-update" ? "model-update-why-it-matters" : undefined}
      >
        {obj?.whyItMatters ||
          (isLoading
            ? "Loading why this matters…"
            : obj
              ? "No evidence-backed significance is available."
              : "Select an object to review why it matters to the current model read.")}
      </Block>
    </>
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
  shellItem,
  emptyLabel,
  isLoading = false,
}: {
  obj?: OrvekObject | null
  trailLabel?: string
  shellItem:
    | "inspector-receipt-row"
    | "inspector-context-row"
    | "inspector-related-row"
  emptyLabel: string
  isLoading?: boolean
}) {
  const { pushSelection } = useWorkbench()
  const Icon = obj ? TYPE_META[obj.type].icon : ScrollText
  return (
    <button
      type="button"
      onClick={obj ? () => pushSelection(obj.id, "evidence", trailLabel) : undefined}
      disabled={!obj}
      data-shell-item={shellItem}
      data-live-object-id={obj?.id}
      className="o-calm flex w-full items-center gap-2 rounded-[9px] bg-secondary/50 px-2.5 py-2 text-left hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
    >
      <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="flex-1 truncate text-[13px] text-foreground">
        {obj?.title || (isLoading ? "Loading linked object…" : emptyLabel)}
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

function CorrectionCard({
  obj,
  isLoading = false,
  disabled = false,
}: {
  obj?: OrvekObject
  isLoading?: boolean
  disabled?: boolean
}) {
  const { applyCorrection, corrections } = useWorkbench()
  const unavailable = disabled || !obj
  const correction = obj && !unavailable ? corrections[obj.id] : undefined

  return (
    <section
      className="mx-4 mt-5 rounded-2xl bg-secondary/40 px-4 py-3.5"
      data-shell-slot="inspector-corrections"
    >
      <SectionLabel>Correct the model</SectionLabel>
      {correction && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-evidence-muted px-2 py-1 text-xs font-medium text-primary">
          <Check className="size-3.5" />
          Recorded: “{correction}”
        </p>
      )}
      {!correction && unavailable && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          {isLoading
            ? "Loading correction availability…"
            : obj
              ? "Model correction is not available for this object."
              : "Select a correctable object to record a model correction."}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CORRECTIONS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={
              obj && !unavailable ? () => applyCorrection(obj.id, label) : undefined
            }
            disabled={unavailable}
            data-shell-item="inspector-correction-action"
            data-live-object-id={obj && !unavailable ? obj.id : undefined}
            className={cn(
              "o-calm rounded-full px-2.5 py-1 text-xs font-medium disabled:cursor-default disabled:opacity-70",
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
  )
}

function InspectorEvidenceSections({
  obj,
  isLoading = false,
  correctionsEnabled = true,
}: {
  obj?: OrvekObject
  isLoading?: boolean
  correctionsEnabled?: boolean
}) {
  const { getObjects } = useOrvekObjectGraph()
  const { setPage } = useWorkbench()
  const data = useOrvekData()
  const isProduction = isProductionDisplay(data)
  const receipts = obj ? getObjects(obj.receiptIds) : []
  const related = obj ? getObjects(obj.relatedIds) : []
  const context = obj ? getObjects(obj.contextIds) : []
  const receiptSlots = minimumPermanentSlots(receipts, 2)
  const supportingSlots = minimumPermanentSlots(obj?.supporting, 1)
  const conflictingSlots = minimumPermanentSlots(obj?.conflicting, 1)
  const contextSlots = minimumPermanentSlots(context, 2)
  const relatedSlots = minimumPermanentSlots(related, 2)
  const changeSlots = minimumPermanentSlots(obj?.whatWouldChange, 2)
  const askInExploreEnabled = Boolean(obj && obj.type !== "report")
  const durableCorrectionsEnabled = Boolean(
    obj &&
      correctionsEnabled &&
      isProduction &&
      supportsDurableCorrection(obj),
  )

  return (
    <>
      <Block
        label={`Receipts · ${receipts.length}`}
        shellSlot="inspector-receipts"
        testId={obj?.type === "model-update" ? "model-update-receipts" : undefined}
      >
        <div className="space-y-1.5">
          {receiptSlots.map((receipt, index) => (
            <LinkedRow
              key={receipt?.id ?? `empty-receipt-${index}`}
              obj={receipt}
              trailLabel="Viewing supporting receipt"
              shellItem="inspector-receipt-row"
              emptyLabel="No supporting receipt is available."
              isLoading={isLoading}
            />
          ))}
        </div>
      </Block>

      <Block
        label="Supporting & conflicting"
        shellSlot="inspector-signals"
        testId={
          obj?.type === "model-update" ? "model-update-supporting-conflicting" : undefined
        }
      >
        <div className="rounded-[10px] bg-secondary/40 px-3 py-2.5">
          <ul className="space-y-1">
            {supportingSlots.map((signal, index) => (
              <li
                key={signal ?? `empty-supporting-${index}`}
                className="flex gap-1.5 text-[13px]"
                data-shell-item="inspector-supporting-signal"
              >
                <span className="text-primary">+</span>
                {signal ||
                  (isLoading
                    ? "Loading supporting signals…"
                    : "No supporting signal is available.")}
              </li>
            ))}
          </ul>
          <ul className="mt-1.5 space-y-1">
            {conflictingSlots.map((signal, index) => (
              <li
                key={signal ?? `empty-conflicting-${index}`}
                className="flex gap-1.5 text-[13px] text-muted-foreground"
                data-shell-item="inspector-conflicting-signal"
              >
                <span className="text-destructive">−</span>
                {signal ||
                  (isLoading
                    ? "Loading conflicting signals…"
                    : "No conflicting signal is available.")}
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block
        label="Relevant background / context"
        shellSlot="inspector-context"
        testId={obj?.type === "model-update" ? "model-update-context" : undefined}
      >
        <div className="space-y-1.5">
          {contextSlots.map((item, index) => (
            <LinkedRow
              key={item?.id ?? `empty-context-${index}`}
              obj={item}
              trailLabel="Viewing background context"
              shellItem="inspector-context-row"
              emptyLabel="No relevant background is available."
              isLoading={isLoading}
            />
          ))}
        </div>
      </Block>

      <Block
        label="Related objects"
        shellSlot="inspector-related"
        testId={obj?.type === "model-update" ? "model-update-related-objects" : undefined}
      >
        <div className="space-y-1.5">
          {relatedSlots.map((item, index) => (
            <LinkedRow
              key={item?.id ?? `empty-related-${index}`}
              obj={item}
              trailLabel="Viewing related object"
              shellItem="inspector-related-row"
              emptyLabel="No related object is available."
              isLoading={isLoading}
            />
          ))}
        </div>
      </Block>

      <Block label="What would change this" shellSlot="inspector-what-would-change">
        <ul className="space-y-1">
          {changeSlots.map((item, index) => (
            <li
              key={item ?? `empty-change-${index}`}
              className="flex gap-1.5 text-[13px] text-muted-foreground"
              data-shell-item="inspector-change-condition"
            >
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-action-foreground" />
              {item ||
                (isLoading
                  ? "Loading change conditions…"
                  : "No change condition is available.")}
            </li>
          ))}
        </ul>
      </Block>

      <section className="px-5 pt-4" data-shell-slot="inspector-ask-explore">
        <button
          type="button"
          onClick={askInExploreEnabled ? () => setPage("explore") : undefined}
          disabled={!askInExploreEnabled}
          data-shell-item="inspector-ask-explore-action"
          data-live-object-id={askInExploreEnabled ? obj?.id : undefined}
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
        >
          <MessageSquare className="size-3.5 text-primary" />
          Ask in Explore
        </button>
      </section>

      {durableCorrectionsEnabled && obj ? (
        <div data-shell-slot="inspector-corrections">
          <DurableCorrectionControls object={obj} />
        </div>
      ) : (
        <CorrectionCard
          obj={obj}
          isLoading={isLoading}
          disabled={!obj || isProduction || !correctionsEnabled}
        />
      )}
    </>
  )
}

function ObjectDetail({
  obj,
  isLoading = false,
}: {
  obj: OrvekObject
  isLoading?: boolean
}) {
  const { openReport, setInspectorTab } = useWorkbench()
  const data = useOrvekData()
  const isProduction = isProductionDisplay(data)
  const [outcomeAdded, setOutcomeAdded] = useState(false)
  const [checkin, setCheckin] = useState("")
  const [checkedIn, setCheckedIn] = useState(false)
  const currentContradictionId =
    obj.inspectorObjectType === "contradiction_node" ? obj.inspectorObjectId ?? obj.id : null
  const [contradictionDetailState, setContradictionDetailState] = useState(
    createEmptyContradictionInspectorDetailState,
  )
  const contradictionDetail: InspectorContradictionProjection | null =
    selectRenderableContradictionInspectorDetail(
      contradictionDetailState,
      currentContradictionId,
    )
  const correctionsEnabled =
    obj.type === "map-object" ||
    obj.type === "model-goal" ||
    obj.type === "context" ||
    obj.type === "receipt" ||
    obj.type === "model-update" ||
    obj.type === "active-question" ||
    obj.type === "decision" ||
    obj.type === "investigation"
  const decisionOptions = minimumPermanentSlots(obj.options, 3)
  const decisionContext = minimumPermanentSlots(obj.decisionContext, 4)
  const hypotheses = minimumPermanentSlots(obj.hypotheses, 2)
  const missingEvidence = minimumPermanentSlots(obj.missingEvidence, 2)
  const hasExistingDecisionOutcomeCapability = Boolean(
    obj.outcomeWindow || obj.expectedOutcome || obj.actualOutcome,
  )
  const canWriteDecisionOutcome =
    hasExistingDecisionOutcomeCapability &&
    obj.outcomeState !== "recorded" &&
    !obj.actualOutcome

  useEffect(() => {
    setContradictionDetailState(beginContradictionInspectorDetailLoad(currentContradictionId))

    if (!currentContradictionId) {
      return
    }

    let cancelled = false

    void fetchInspectorContradiction(currentContradictionId)
      .then((detail) => {
        if (!cancelled) {
          setContradictionDetailState((state) =>
            resolveContradictionInspectorDetailLoad(state, currentContradictionId, detail),
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContradictionDetailState((state) =>
            failContradictionInspectorDetailLoad(state, currentContradictionId),
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentContradictionId])

  return (
    <div
      className="pb-6"
      data-shell-view="inspector-evidence"
      data-shell-state={isLoading ? "loading" : "selected"}
    >
      <InspectorReturnBanner className="mx-5 mt-4" />
      <InspectorIdentity obj={obj} isLoading={isLoading} />

      {currentContradictionId ? (
        <Block label="Active signal" shellSlot="inspector-contradiction-signal">
          {contradictionDetail ? (
            <>
              <p className="text-[13px] text-muted-foreground">
                {`${contradictionDetail.status.replace(/_/g, " ")} · ${contradictionDetail.evidenceCount} evidence`}
              </p>
              <div className="mt-2">
                <ContradictionDualSourceView
                  interpretationA={contradictionDetail.sideA}
                  interpretationB={contradictionDetail.sideB}
                  dualSource={contradictionDetail.dualSource}
                />
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Raw message evidence stays on the signal detail surface. Use the full page for
                deeper review.
              </p>
            </>
          ) : (
            <div className="rounded-[10px] bg-secondary/40 px-3 py-2.5 text-[13px] text-muted-foreground">
              Contradiction detail is loading or unavailable.
            </div>
          )}
        </Block>
      ) : null}

      {obj.type === "receipt" ? (
        <Block label="Source text" shellSlot="inspector-receipt-source">
          <blockquote className="rounded-md border-l-2 border-primary bg-evidence-muted/50 px-3 py-2 text-[13px] italic text-foreground">
            {obj.sourceText ? `“${obj.sourceText}”` : "No source text is available."}
          </blockquote>
          <p className="mt-2 text-xs text-muted-foreground">
            {[obj.sourceOrigin, obj.date].filter(Boolean).join(" · ") ||
              "Source details unavailable"}
          </p>
        </Block>
      ) : null}

      {obj.whyResurfaced ? (
        <Block
          label="Why it resurfaced"
          testId={obj.type === "model-update" ? "model-update-why-it-resurfaced" : undefined}
        >
          {obj.whyResurfaced}
        </Block>
      ) : null}

      <InspectorSummarySections obj={obj} isLoading={isLoading} />

      {obj.type === "decision" ? (
        <>
          <Block label="Current model read" shellSlot="inspector-decision-recommendation">
            {obj.recommendation ||
              (isLoading
                ? "Loading the current model read…"
                : "No recommendation is available.")}
          </Block>
          <Block label="Options" shellSlot="inspector-decision-options">
            <div className="space-y-2.5">
              {decisionOptions.map((option, index) => (
                <div
                  key={option?.label ?? `empty-option-${index}`}
                  className="rounded-[9px] bg-secondary/50 p-2.5"
                  data-shell-item="inspector-decision-option"
                >
                  <p className="text-[13px] font-medium text-foreground">
                    <span className="text-primary">
                      {option?.label ?? String.fromCharCode(65 + index)}.
                    </span>{" "}
                    {option?.text ||
                      (isLoading ? "Loading option…" : "No option is available.")}
                  </p>
                  {option?.pros?.map((item) => (
                    <p key={item} className="mt-1 text-xs text-foreground">
                      <span className="text-primary">+</span> {item}
                    </p>
                  ))}
                  {option?.cons?.map((item) => (
                    <p key={item} className="mt-1 text-xs text-muted-foreground">
                      <span className="text-destructive">−</span> {item}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </Block>
          <Block label="Context" shellSlot="inspector-decision-context">
            <dl className="space-y-1.5">
              {decisionContext.map((item, index) => (
                <div
                  key={item?.label ?? `empty-decision-context-${index}`}
                  className="flex gap-2 text-[13px]"
                  data-shell-item="inspector-decision-context-row"
                >
                  <dt className="w-28 shrink-0 text-muted-foreground">
                    {item?.label ?? `Context ${index + 1}`}
                  </dt>
                  <dd className="text-foreground">
                    {item?.value ||
                      (isLoading
                        ? "Loading context…"
                        : "No context value is available.")}
                  </dd>
                </div>
              ))}
            </dl>
          </Block>
          <Block label="Projection" shellSlot="inspector-decision-projection">
            <p>{obj.projection || (isLoading ? "Loading projection…" : "No projection is available.")}</p>
            <p className="mt-1.5 text-xs">
              <span className="text-muted-foreground">Confidence: </span>
              <span className="font-medium text-foreground">
                {obj.confidence || (isLoading ? "Loading…" : "Unavailable")}
              </span>
            </p>
          </Block>
          <Block label="Outcome" shellSlot="inspector-decision-outcome">
            <p className="text-[13px] text-muted-foreground">
              {obj.outcomeWindow ||
                (isLoading ? "Loading outcome window…" : "No outcome window is available.")}
            </p>
            <p className="mt-1.5 text-[13px]">
              <span className="text-muted-foreground">Expected: </span>
              {obj.expectedOutcome || "Unavailable"}
            </p>
            <p className="mt-1 text-[13px]">
              <span className="text-muted-foreground">Actual: </span>
              {obj.actualOutcome || "Not recorded"}
            </p>
            {obj.outcomeState !== "recorded" && !obj.actualOutcome ? (
              isProduction ? (
                canWriteDecisionOutcome ? (
                  <DurableDecisionOutcomeControls object={obj} className="mt-2.5" />
                ) : (
                  <DisabledDecisionOutcomeControls isLoading={isLoading} />
                )
              ) : (
                canWriteDecisionOutcome ? (
                  <button
                    type="button"
                    onClick={() => setOutcomeAdded(true)}
                    disabled={outcomeAdded}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-action px-2.5 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {outcomeAdded ? <Check className="size-3.5" /> : null}
                    {outcomeAdded ? "Outcome recorded" : "Add outcome"}
                  </button>
                ) : (
                  <DisabledDecisionOutcomeControls isLoading={isLoading} />
                )
              )
            ) : null}
          </Block>
        </>
      ) : null}

      {obj.type === "report" ? (
        <Block label="Report" shellSlot="inspector-report">
          <p className="text-[13px] text-muted-foreground">
            {[obj.reportType, obj.period].filter(Boolean).join(" · ") ||
              "Report details unavailable"}
          </p>
          <p className="mt-1.5 text-[13px]">
            {obj.reportSummary || "No report summary is available."}
          </p>
          <button
            type="button"
            onClick={() => openReport(obj.id)}
            data-shell-item="inspector-open-report"
            data-live-object-id={obj.id}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open report
            <ArrowRight className="size-3.5" />
          </button>
        </Block>
      ) : null}

      {obj.type === "fieldwork" ? (
        <>
          <Block label="Purpose" shellSlot="inspector-fieldwork-purpose">
            {obj.purpose || "No fieldwork purpose is available."}
          </Block>
          <Block label="Expected signal" shellSlot="inspector-fieldwork-signal">
            {obj.expectedSignal || "No expected signal is available."}
          </Block>
          <Block label="What to observe" shellSlot="inspector-fieldwork-observation">
            {obj.whatToObserve || "No observation guidance is available."}
          </Block>
          <Block label="Calibration" shellSlot="inspector-fieldwork-calibration">
            <p className="text-[13px]">
              <span className="text-primary">Confirms if: </span>
              {obj.confirmIf || "No confirmation condition is available."}
            </p>
            <p className="mt-1 text-[13px]">
              <span className="text-destructive">Weakens if: </span>
              {obj.weakenIf || "No weakening condition is available."}
            </p>
          </Block>
          <Block label="Check in" shellSlot="inspector-fieldwork-checkin">
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
                  onChange={(event) => setCheckin(event.target.value)}
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
      ) : null}

      {obj.type === "investigation" ? (
        <>
          <Block label="Hypotheses" shellSlot="inspector-investigation-hypotheses">
            <ul className="space-y-1">
              {hypotheses.map((item, index) => (
                <li
                  key={item ?? `empty-hypothesis-${index}`}
                  className="flex gap-1.5 text-[13px]"
                  data-shell-item="inspector-investigation-hypothesis"
                >
                  <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {item || "No hypothesis is available."}
                </li>
              ))}
            </ul>
          </Block>
          <Block label="Missing evidence" shellSlot="inspector-investigation-missing">
            <ul className="space-y-1">
              {missingEvidence.map((item, index) => (
                <li
                  key={item ?? `empty-missing-evidence-${index}`}
                  className="flex gap-1.5 text-[13px] text-muted-foreground"
                  data-shell-item="inspector-investigation-missing-row"
                >
                  <span className="text-action-foreground">?</span>
                  {item || "No missing-evidence note is available."}
                </li>
              ))}
            </ul>
          </Block>
        </>
      ) : null}

      {obj.type === "model-update" || obj.before || obj.after ? (
        <Block
          label="Model movement"
          shellSlot="inspector-object-movement"
          testId={obj.type === "model-update" ? "model-update-before-after" : undefined}
        >
          <BeforeAfter before={obj.before} after={obj.after} isLoading={isLoading} />
          <button
            type="button"
            onClick={() => setInspectorTab("movement")}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            See full movement
            <ArrowRight className="size-3" />
          </button>
        </Block>
      ) : null}

      <InspectorEvidenceSections
        obj={obj}
        isLoading={isLoading}
        correctionsEnabled={correctionsEnabled}
      />
    </div>
  )
}

function DisabledDecisionOutcomeControls({
  isLoading = false,
}: {
  isLoading?: boolean
}) {
  return (
    <div
      className="mt-2.5 space-y-2"
      data-shell-slot="inspector-decision-outcome-unavailable"
    >
      <textarea
        value=""
        readOnly
        disabled
        rows={2}
        placeholder={
          isLoading
            ? "Loading outcome availability…"
            : "Outcome recording is not available for this decision."
        }
        data-shell-item="inspector-decision-outcome-input"
        data-testid="neutral-outcome-input"
        className="w-full resize-none rounded-[9px] bg-secondary/60 px-2.5 py-2 text-[13px] text-foreground outline-none ring-1 ring-inset ring-transparent disabled:cursor-default disabled:opacity-70"
      />
      <button
        type="button"
        disabled
        data-shell-item="inspector-decision-outcome-action"
        data-testid="neutral-outcome-submit"
        className="inline-flex items-center gap-1.5 rounded-md bg-action px-2.5 py-1.5 text-xs font-semibold text-action-foreground transition-opacity disabled:cursor-default disabled:opacity-50"
      >
        Outcome unavailable
      </button>
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
