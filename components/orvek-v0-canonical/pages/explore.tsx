"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useCanonicalData } from "@/components/orvek-v0-canonical/canonical-data-context"
import { minimumPermanentSlots } from "@/components/orvek-v0-canonical/permanent-presentation"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { useOrvekPageHandlers } from "@/lib/orvek-v0/page-handlers"
import {
  formatCanonicalCorrectionContextCopy,
} from "@/lib/canonical-correction-handoff"
import { useWorkbench } from "@/components/orvek-v0/store"
import { Chip, SectionLabel } from "@/components/orvek-v0/primitives"
import { ArrowRight, PanelRight, Send, Sparkles } from "lucide-react"

export type CanonicalExploreTab = "free" | "investigations" | "questions" | "fieldwork"

const TABS: { id: CanonicalExploreTab; label: string }[] = [
  { id: "free", label: "Free Explore" },
  { id: "investigations", label: "Investigations" },
  { id: "questions", label: "Active Questions" },
  { id: "fieldwork", label: "Fieldwork Bridge" },
]

export function ExplorePage({
  initialTab = "free",
}: {
  initialTab?: CanonicalExploreTab
} = {}) {
  const {
    select,
    setExploreActive,
    canonicalCorrectionHandoff,
    setCanonicalCorrectionHandoff,
  } = useWorkbench()
  const [tab, setTab] = useState<CanonicalExploreTab>(initialTab)

  // Explore is "live": the inspector surfaces possible movement only while here.
  useEffect(() => {
    setExploreActive(true)
    return () => setExploreActive(false)
  }, [setExploreActive])

  return (
    <div className="flex h-full min-h-0 flex-col" data-shell-page="explore">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Explore</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ask, investigate, and turn conversation into model movement. Possible updates appear in
          the inspector.
        </p>
        {canonicalCorrectionHandoff ? (
          <div
            className="mt-4 rounded-2xl bg-secondary/40 px-4 py-3.5"
            data-testid="explore-canonical-correction-context"
            data-concept-id={canonicalCorrectionHandoff.conceptId}
            data-current-revision-id={canonicalCorrectionHandoff.currentRevisionId}
            data-version={String(canonicalCorrectionHandoff.version)}
          >
            <SectionLabel>Correction context</SectionLabel>
            <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">
              {formatCanonicalCorrectionContextCopy(canonicalCorrectionHandoff)
                .split("\n")
                .slice(1)
                .join("\n")}
            </p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              No proposal has been created yet. Describe what is wrong or missing below.
            </p>
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-primary hover:underline"
              data-testid="explore-canonical-correction-dismiss"
              onClick={() => {
                setCanonicalCorrectionHandoff(null)
              }}
            >
              Dismiss correction context
            </button>
          </div>
        ) : null}
        {/* segmented control */}
        <div
          className="o-sunken mt-3 inline-flex flex-wrap gap-0.5 rounded-[9px] p-1"
          data-shell-slot="explore-tabs"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "o-calm rounded-[6px] px-3 py-1.5 text-[13px] font-medium",
                tab === t.id
                  ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.16)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-shell-item="explore-tab"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {tab === "free" && <FreeExplore />}
          {tab === "investigations" && <Investigations />}
          {tab === "questions" && <Questions />}
          {tab === "fieldwork" && <FieldworkBridge onSelect={select} />}
        </div>
      </div>
    </div>
  )
}

function FreeExplore() {
  const { select, setInspectorTab } = useWorkbench()
  const { getObjects, exploreGroundingIds } = useCanonicalData()
  const data = useOrvekData()
  const exploreHandlers = useOrvekPageHandlers().explore
  const grounding = getObjects(exploreGroundingIds)

  const referenceSurface = data.referenceSurface === true
  const liveMessages = data.exploreMessages ?? []
  const hasLiveExploreChat = liveMessages.length > 0
  const sendAvailable =
    data.freeExploreSendHandlerAvailable === true && Boolean(exploreHandlers?.onSend)
  const useFixtureConversation = referenceSurface && !hasLiveExploreChat && !sendAvailable
  const isLoading = data.exploreIsLoading === true
  const bootstrapError =
    typeof data.explore?.errorMessage === "string" && data.explore.errorMessage.trim()
      ? data.explore.errorMessage.trim()
      : null
  const conversationSlots = minimumPermanentSlots(liveMessages, 2)
  const groundingSlots = minimumPermanentSlots(grounding, 5)
  const movementAvailable =
    useFixtureConversation ||
    Boolean(exploreHandlers?.onOpenInspector) ||
    (data.exploreMovement?.length ?? 0) > 0

  const detectionCopy =
    data.exploreLiveDetectionCopy ??
    (referenceSurface
      ? "Orvek is reading the model · 1 receipt extracted · 1 question detected"
      : isLoading
        ? "Loading model activity…"
        : "No model activity is ready for review.")
  const detectionActive =
    referenceSurface || Boolean(data.exploreLiveDetectionCopy) || isLoading

  const draft = data.explore?.composerDraft ?? ""

  return (
    <div data-shell-slot="explore-free">
      <div className="space-y-3" data-shell-slot="explore-conversation">
        {useFixtureConversation ? (
          <>
            <Bubble role="user">
              Why do I feel like we need to see the architecture visually before locking design?
            </Bubble>
            <Bubble role="orvek">
              You seem to trust decisions more once the system can express itself visually. This
              connects to a broader pattern: you reject abstract strategy when it feels untested, but
              you also resist shallow visual polish. The useful move may be an{" "}
              <span className="font-medium">architecture prototype</span>, not a design prototype.
            </Bubble>
          </>
        ) : (
          conversationSlots.map((message, index) => (
            <Bubble
              key={message?.id ?? `empty-conversation-${index}`}
              role={message?.role ?? (index === 0 ? "user" : "orvek")}
            >
              {message?.content ||
                (isLoading
                  ? "Loading conversation…"
                  : index === 0
                    ? "No conversation has started."
                    : "No grounded response is available yet.")}
            </Bubble>
          ))
        )}
      </div>
      {!useFixtureConversation && bootstrapError ? (
        <p
          className="mt-2 text-[12px] text-destructive"
          data-shell-slot="explore-bootstrap-error"
          data-testid="explore-bootstrap-error"
        >
          {bootstrapError}
        </p>
      ) : null}

      {/* grounded in */}
      <div className="mt-3">
        <SectionLabel>Grounded in</SectionLabel>
        <div
          className="mt-2 flex flex-wrap gap-1.5"
          data-shell-slot="explore-grounding"
        >
          {groundingSlots.map((item, index) => (
            <button
              key={item?.id ?? `empty-grounding-${index}`}
              type="button"
              onClick={item ? () => select(item.id) : undefined}
              disabled={!item}
              data-shell-item="explore-grounding-chip"
              data-live-object-id={item?.id}
              className="disabled:cursor-default disabled:opacity-70"
            >
              <Chip
                tone="evidence"
                className={item ? "cursor-pointer hover:opacity-80" : ""}
              >
                {item?.title ||
                  (isLoading ? "Loading grounding…" : "No grounding item available")}
              </Chip>
            </button>
          ))}
        </div>
      </div>

      {/* live detection line */}
      <div
        className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground"
        data-shell-slot="explore-detection"
      >
        <span className="relative flex size-2 items-center justify-center">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full bg-action/40",
              detectionActive && "animate-ping",
            )}
          />
          <span
            className={cn(
              "relative inline-flex size-1.5 rounded-full bg-action",
              detectionActive && "o-breathe",
            )}
            data-explore-activity={detectionActive ? "active" : "idle"}
          />
        </span>
        {detectionCopy}
      </div>

      {/* end-of-turn movement note → inspector */}
      <button
        type="button"
        onClick={() => {
          exploreHandlers?.onOpenInspector?.()
          setInspectorTab("movement")
        }}
        disabled={!movementAvailable}
        data-shell-slot="explore-movement-note"
        className="o-calm mt-2.5 flex w-full items-center gap-2.5 rounded-2xl bg-action-muted/50 px-4 py-3 text-left ring-1 ring-inset ring-action/15 hover:bg-action-muted/70 disabled:cursor-default disabled:opacity-70"
      >
        <Sparkles className="size-4 shrink-0 text-action-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
          {useFixtureConversation ? (
            <>
              This may update your model in <span className="font-medium">4 places</span>. Review and
              confirm in the inspector.
            </>
          ) : (
            <>
              {isLoading
                ? "Loading possible model updates…"
                : "No model update is ready for review."}
            </>
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-action-foreground">
          <PanelRight className="size-3.5" aria-hidden />
          Open
        </span>
      </button>

      {/* composer */}
      <div
        className="o-material mt-4 flex items-center gap-2 rounded-2xl p-2"
        data-shell-slot="explore-composer"
        data-free-explore-send-handler={sendAvailable ? "true" : "false"}
        data-has-live-explore-chat={hasLiveExploreChat ? "true" : "false"}
        data-explore-booting={isLoading ? "true" : "false"}
        data-has-send-handler={exploreHandlers?.onSend ? "true" : "false"}
        data-explore-error={bootstrapError ?? ""}
      >
        {useFixtureConversation ? (
          <input
            placeholder="Ask the model anything…"
            onFocus={() => setInspectorTab("movement")}
            className="flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <input
            placeholder="Ask the model anything…"
            value={draft}
            onChange={(event) => exploreHandlers?.onDraftChange?.(event.target.value)}
            onFocus={() => {
              exploreHandlers?.onComposerFocus?.()
              setInspectorTab("movement")
            }}
            disabled={!exploreHandlers?.onDraftChange}
            className="flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        )}
        <button
          type="button"
          onClick={() => {
            if (sendAvailable) {
              exploreHandlers?.onSend?.()
              return
            }
            setInspectorTab("movement")
          }}
          disabled={!useFixtureConversation && !sendAvailable}
          data-shell-item="explore-send-action"
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98] disabled:cursor-default disabled:opacity-70"
        >
          <Send className="size-3.5" />
          Ask
        </button>
      </div>

      {/* quick prompts */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          "Explore a pattern",
          "Talk through a decision",
          "Start an investigation",
          "Inspect a conflict",
        ].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              if (!useFixtureConversation && exploreHandlers?.onQuickPrompt) {
                exploreHandlers.onQuickPrompt(q)
                return
              }
              setInspectorTab("movement")
            }}
            disabled={!useFixtureConversation && !exploreHandlers?.onQuickPrompt}
            data-shell-item="explore-quick-prompt"
            className="o-calm rounded-full bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-70"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({ role, children }: { role: "user" | "orvek"; children: React.ReactNode }) {
  const isUser = role === "user"
  return (
    <div
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
      data-shell-item="explore-message"
    >
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-[14px] rounded-br-[5px] bg-primary text-primary-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.25)]"
            : "o-material rounded-[14px] rounded-bl-[5px] text-foreground",
        )}
      >
        {!isUser && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Orvek
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

function Questions() {
  const { select, setInspectorTab } = useWorkbench()
  const { getObject, exploreQuestionIds } = useCanonicalData()
  const data = useOrvekData()
  const ids = exploreQuestionIds
  const [activeId, setActiveId] = useState(ids[0] ?? "")
  const q = getObject(activeId)
  const isLoading = data.activeQuestionsIsLoading === true || data.exploreIsLoading === true
  const questionSlots = minimumPermanentSlots(ids, 4)
  const supporting = minimumPermanentSlots(q?.supporting, 1)
  const conflicting = minimumPermanentSlots(q?.conflicting, 1)
  const related = minimumPermanentSlots(
    (q?.relatedIds ?? [])
      .map((id) => getObject(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    3,
  )

  useEffect(() => {
    if (!ids.includes(activeId)) {
      setActiveId(ids[0] ?? "")
    }
  }, [activeId, ids])

  return (
    <div
      className="grid gap-5 lg:grid-cols-[290px_1fr]"
      data-shell-slot="explore-questions"
    >
      {/* inquiry list */}
      <div>
        <SectionLabel>Open questions</SectionLabel>
        <div
          className="o-material mt-2 divide-y divide-border overflow-hidden rounded-[10px]"
          data-shell-slot="question-list"
        >
          {questionSlots.map((id, index) => {
            const item = id ? getObject(id) : undefined
            const active = Boolean(item && activeId === item.id)
            return (
              <button
                key={item?.id ?? `empty-question-${index}`}
                type="button"
                onClick={
                  item
                    ? () => {
                        setActiveId(item.id)
                        select(item.id)
                      }
                    : undefined
                }
                disabled={!item}
                data-shell-item="question-row"
                data-live-object-id={item?.id}
                className={cn(
                  "o-calm flex w-full items-start gap-2.5 px-3 py-2.5 text-left disabled:cursor-default disabled:opacity-70",
                  active ? "bg-accent/50" : "hover:bg-accent/30",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 size-1.5 shrink-0 rounded-full",
                    active ? "bg-action" : "bg-muted-foreground/40",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug text-foreground text-pretty">
                    {item?.title ||
                      (isLoading
                        ? "Loading active question…"
                        : "No active question is available.")}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {item
                      ? `${item.evidenceCount ?? 0} receipts · ${item.status ?? "current"}`
                      : isLoading
                        ? "Loading status"
                        : "0 receipts · unavailable"}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* selected question detail */}
      <div className="min-w-0" data-shell-slot="question-detail">
        <Chip tone="action">
          Active question · {q?.status || (isLoading ? "loading" : "unavailable")}
        </Chip>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
          {q?.title ||
            (isLoading ? "Loading current question…" : "No active question is available.")}
        </h2>
        <InvBlock label="Why this is open">
          {q?.whyItMatters ||
            (isLoading ? "Loading why this is open…" : "Not enough information yet.")}
        </InvBlock>
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2"
          data-shell-slot="question-signal-pair"
        >
          <div
            className="o-material rounded-[10px] p-3.5"
            data-shell-item="question-signal-card"
          >
            <SectionLabel className="text-primary">Would resolve toward yes if</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {supporting.map((item, index) => (
                <li
                  key={item ?? `empty-question-support-${index}`}
                  className="flex gap-2 text-[13px] text-foreground"
                >
                  <span className="mt-0.5 text-primary">+</span>
                  {item ||
                    (isLoading
                      ? "Loading supporting signal…"
                      : "No supporting signals yet.")}
                </li>
              ))}
            </ul>
          </div>
          <div
            className="o-material rounded-[10px] p-3.5"
            data-shell-item="question-signal-card"
          >
            <SectionLabel className="text-destructive/80">Would resolve toward no if</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {conflicting.map((item, index) => (
                <li
                  key={item ?? `empty-question-conflict-${index}`}
                  className="flex gap-2 text-[13px] text-muted-foreground"
                >
                  <span className="mt-0.5 text-destructive">−</span>
                  {item ||
                    (isLoading
                      ? "Loading conflicting signal…"
                      : "No conflicting signals yet.")}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <InvBlock label="What this question touches">
          <div className="flex flex-wrap gap-1.5" data-shell-slot="question-related">
            {related.map((item, index) => (
              <button
                key={item?.id ?? `empty-question-related-${index}`}
                type="button"
                onClick={item ? () => select(item.id) : undefined}
                disabled={!item}
                data-shell-item="question-related-chip"
                data-live-object-id={item?.id}
                className="disabled:cursor-default disabled:opacity-70"
              >
                <Chip className={item ? "cursor-pointer hover:opacity-80" : ""}>
                  {item?.title ||
                    (isLoading ? "Loading related item…" : "No related item available")}
                </Chip>
              </button>
            ))}
          </div>
        </InvBlock>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={
              q
                ? () => {
                    select(q.id)
                    setInspectorTab("evidence")
                  }
                : undefined
            }
            disabled={!q}
            data-shell-item="question-action"
            data-live-object-id={q?.id}
            className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98] disabled:cursor-default disabled:opacity-70"
          >
            See evidence
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
          {["Explore this", "Propose fieldwork", "Mark resolved"].map((a) => (
            <button
              key={a}
              type="button"
              disabled
              data-shell-item="question-action"
              className="o-calm cursor-default rounded-[8px] bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground opacity-70"
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Investigations() {
  const { select } = useWorkbench()
  const { getObject, exploreInvestigationIds } = useCanonicalData()
  const data = useOrvekData()
  const [activeId, setActiveId] = useState(exploreInvestigationIds[0] ?? "")
  const inv = getObject(activeId)
  const isLoading = data.investigationsIsLoading === true || data.exploreIsLoading === true
  const threadSlots = minimumPermanentSlots(exploreInvestigationIds, 3)
  const hypotheses = minimumPermanentSlots(inv?.hypotheses, 2)
  const missingEvidence = minimumPermanentSlots(inv?.missingEvidence, 2)
  const linkedObjects = minimumPermanentSlots(
    (inv?.relatedIds ?? [])
      .map((id) => getObject(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    3,
  )

  useEffect(() => {
    if (!exploreInvestigationIds.includes(activeId)) {
      setActiveId(exploreInvestigationIds[0] ?? "")
    }
  }, [exploreInvestigationIds, activeId])

  return (
    <div
      className="grid gap-5 lg:grid-cols-[230px_1fr]"
      data-shell-slot="explore-investigations"
    >
      <div>
        <SectionLabel>Threads</SectionLabel>
        <div className="mt-2 space-y-1.5" data-shell-slot="investigation-list">
          {threadSlots.map((id, index) => {
            const item = id ? getObject(id) : undefined
            return (
              <button
                key={item?.id ?? `empty-investigation-${index}`}
                type="button"
                data-testid="investigation-row"
                onClick={
                  item
                    ? () => {
                        setActiveId(item.id)
                        select(item.id)
                      }
                    : undefined
                }
                disabled={!item}
                data-shell-item="investigation-row"
                data-live-object-id={item?.id}
                className={cn(
                  "o-calm w-full rounded-[10px] px-2.5 py-2 text-left text-[13px] leading-snug disabled:cursor-default disabled:opacity-70",
                  item && activeId === item.id
                    ? "bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(30,41,59,0.16)] ring-1 ring-inset ring-primary/20"
                    : "bg-secondary/50 text-foreground hover:bg-secondary",
                )}
              >
                {item?.title ||
                  (isLoading
                    ? "Loading investigation…"
                    : "No investigation is available.")}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item
                    ? item.evidenceCount != null
                      ? `${item.evidenceCount} linked · ${item.status ?? "current"}`
                      : item.status
                    : isLoading
                      ? "Loading status"
                      : "0 linked · unavailable"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="min-w-0"
        data-testid="canonical-investigation-detail"
        data-shell-slot="investigation-detail"
      >
        <Chip tone="evidence">
          Investigation · {inv?.status || (isLoading ? "loading" : "unavailable")}
        </Chip>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
          {inv?.title ||
            (isLoading ? "Loading current investigation…" : "No investigation is available.")}
        </h2>
        <InvBlock label="Why it matters">
          {inv?.whyItMatters ||
            (isLoading ? "Loading why this matters…" : "Not enough information yet.")}
        </InvBlock>
        <InvBlock label="Hypotheses">
          <ul className="space-y-1" data-shell-slot="investigation-hypotheses">
            {hypotheses.map((item, index) => (
              <li
                key={item ?? `empty-hypothesis-${index}`}
                className="flex gap-1.5 text-[13px]"
                data-shell-item="investigation-hypothesis"
              >
                <span className="text-primary">·</span>
                {item ||
                  (isLoading ? "Loading hypothesis…" : "No hypothesis is available.")}
              </li>
            ))}
          </ul>
        </InvBlock>
        <InvBlock label="Missing evidence">
          <ul className="space-y-1" data-shell-slot="investigation-missing-evidence">
            {missingEvidence.map((item, index) => (
              <li
                key={item ?? `empty-missing-evidence-${index}`}
                className="flex gap-1.5 text-[13px] text-muted-foreground"
                data-shell-item="investigation-missing-row"
              >
                <span className="text-action-foreground">?</span>
                {item ||
                  (isLoading ? "Loading evidence gap…" : "No evidence gap is available.")}
              </li>
            ))}
          </ul>
        </InvBlock>
        <InvBlock label="Linked objects">
          <div
            className="flex flex-wrap gap-1.5"
            data-shell-slot="investigation-linked-objects"
          >
            {linkedObjects.map((item, index) => (
              <button
                key={item?.id ?? `empty-investigation-link-${index}`}
                type="button"
                onClick={item ? () => select(item.id) : undefined}
                disabled={!item}
                data-shell-item="investigation-linked-chip"
                data-live-object-id={item?.id}
                className="disabled:cursor-default disabled:opacity-70"
              >
                <Chip className={item ? "cursor-pointer hover:opacity-80" : ""}>
                  {item?.title ||
                    (isLoading ? "Loading linked item…" : "No linked item available")}
                </Chip>
              </button>
            ))}
          </div>
        </InvBlock>
        <div
          className="mt-4 rounded-[12px] rounded-l-sm border-l-2 border-l-primary/50 bg-secondary/50 p-3 text-[13px] italic text-muted-foreground"
          data-shell-slot="investigation-conversation-excerpt"
        >
          {inv?.sourceText ||
            (isLoading
              ? "Loading linked conversation context…"
              : "No linked conversation excerpt is available.")}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["Add hypothesis", "Suggest fieldwork", "Possible report", "Ask in Explore"].map(
            (a) => (
              <button
                key={a}
                type="button"
                disabled
                data-shell-item="investigation-action"
                className="o-calm cursor-default rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground opacity-70"
              >
                {a}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function InvBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  )
}

function FieldworkBridge({ onSelect }: { onSelect: (id: string) => void }) {
  const { getObject, exploreFieldworkIds } = useCanonicalData()
  const data = useOrvekData()
  const ids = exploreFieldworkIds
  const [activeId, setActiveId] = useState(ids[0] ?? "")
  const fw = getObject(activeId)
  const isLoading = data.experimentIsLoading === true || data.exploreIsLoading === true
  const linked = fw?.relatedIds?.[0] ? getObject(fw.relatedIds[0]) : undefined

  const fields = [
    { label: "Expected signal", value: fw?.expectedSignal },
    { label: "What to observe", value: fw?.whatToObserve },
    { label: "What would confirm", value: fw?.confirmIf },
    { label: "What would weaken", value: fw?.weakenIf },
    { label: "Due / review window", value: fw?.reviewWindow ?? fw?.outcomeWindow },
  ]

  useEffect(() => {
    if (!ids.includes(activeId)) {
      setActiveId(ids[0] ?? "")
    }
  }, [activeId, ids])

  return (
    <div data-shell-slot="explore-fieldwork">
      <Chip tone="action">Fieldwork Bridge</Chip>
      <h2 className="mt-2 text-base font-semibold text-foreground">
        {fw?.title ||
          (isLoading ? "Loading current fieldwork…" : "No fieldwork is available.")}
      </h2>
      <dl
        className="o-material mt-4 divide-y divide-border overflow-hidden rounded-[10px]"
        data-shell-slot="fieldwork-fields"
      >
        {fields.map((field) => (
          <div
            key={field.label}
            className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[180px_1fr]"
            data-shell-item="fieldwork-field"
          >
            <dt className="text-[13px] font-medium text-muted-foreground">
              {field.label}
            </dt>
            <dd className="text-[13px] text-foreground">
              {field.value ||
                (isLoading ? "Loading fieldwork detail…" : "Not enough information yet.")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex gap-1.5">
        <button
          type="button"
          onClick={
            fw
              ? () => {
                  setActiveId(fw.id)
                  onSelect(fw.id)
                }
              : undefined
          }
          disabled={!fw}
          data-shell-item="fieldwork-action"
          data-live-object-id={fw?.id}
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground hover:brightness-[1.03] active:scale-[0.98] disabled:cursor-default disabled:opacity-70"
        >
          Open fieldwork
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={linked ? () => onSelect(linked.id) : undefined}
          disabled={!linked}
          data-shell-item="fieldwork-action"
          data-live-object-id={linked?.id}
          className="o-calm rounded-[8px] bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
        >
          {linked
            ? `Linked: ${linked.title}`
            : isLoading
              ? "Loading linked item…"
              : "No linked item available"}
        </button>
      </div>
    </div>
  )
}
