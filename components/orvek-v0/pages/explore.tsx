"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { EXPLORE_GROUNDING } from "@/lib/orvek-v0/orvek-data"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { useOrvekPageHandlers } from "@/lib/orvek-v0/page-handlers"
import { ORVEK_DEFERRED_ACTION_CLASS, isProductionDisplay } from "@/lib/orvek-v0/display-contract"
import { DurableFieldworkCheckInControls } from "@/components/orvek-v0/durable-user-action-controls"
import { InvestigationCreateCard } from "@/components/investigations/InvestigationCreateCard"
import { ProductionInvestigationWorkbenchDetail } from "@/components/investigations/ProductionInvestigationWorkbenchDetail"
import { ExploreConversationReviewStrip } from "@/components/explore/ExploreConversationReviewStrip"
import { ExploreModelMovementStrip } from "@/components/explore/ExploreModelMovementStrip"
import { ExploreMovementProposalCard } from "@/components/explore/ExploreMovementProposalCard"
import { V0_EXPLORE_LIVE_DETECTION_COPY } from "@/lib/orvek-adapters/explore"
import {
  EXPLORE_GROUNDING_EMPTY_COPY,
  EXPLORE_NO_MOVEMENT_LABEL,
  type ExploreGroundingPayload,
} from "@/lib/explore-grounding-contract"
import { setExploreSelectedMessageGrounding } from "@/lib/explore-message-grounding-bridge"
import { resolveActiveQuestionsOpenSelectionId } from "@/lib/orvek-v0/production/active-questions-presentation"
import { resolveInvestigationsOpenSelectionId } from "@/lib/orvek-v0/production/investigations-presentation"
import { resolveExperimentOpenSelectionId } from "@/lib/orvek-v0/production/experiment-presentation"
import { hasLiveExploreChatFromProvider } from "@/lib/orvek-v0/production/free-explore-chat-presentation"
import type { OrvekExploreMessage } from "@/lib/orvek-v0/data-provider"
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"
import { useWorkbench } from "@/components/orvek-v0/store"
import { Chip, SectionLabel } from "@/components/orvek-v0/primitives"
import { ArrowRight, PanelRight, Send, Sparkles } from "lucide-react"

type Tab = "free" | "investigations" | "questions" | "fieldwork"

const TABS: { id: Tab; label: string }[] = [
  { id: "free", label: "Free Explore" },
  { id: "investigations", label: "Investigations" },
  { id: "questions", label: "Active Questions" },
  { id: "fieldwork", label: "Fieldwork Bridge" },
]

export function ExplorePage() {
  const { select, setExploreActive } = useWorkbench()
  const [tab, setTab] = useState<Tab>("free")

  // Explore is "live": the inspector surfaces possible movement only while here.
  useEffect(() => {
    setExploreActive(true)
    return () => setExploreActive(false)
  }, [setExploreActive])

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="orvek-v0-explore-page">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Explore</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ask, investigate, and turn conversation into model movement. Possible updates appear in
          the inspector.
        </p>
        <div className="mt-5 border-b border-border/40">
          <nav
            aria-label="Explore sections"
            className="-mb-px flex flex-wrap gap-x-5 sm:gap-x-7"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid={`explore-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "border-b pb-2 pt-0.5 text-[12px] leading-none tracking-tight focus-visible:outline-none",
                  tab === t.id
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent font-normal text-muted-foreground/85 hover:text-foreground/75",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
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

const REFERENCE_FREE_EXPLORE_MESSAGES: OrvekExploreMessage[] = [
  {
    id: "ref-user",
    role: "user",
    content:
      "Why do I feel like we need to see the architecture visually before locking design?",
  },
  {
    id: "ref-orvek",
    role: "orvek",
    content:
      "You seem to trust decisions more once the system can express itself visually. This connects to a broader pattern: you reject abstract strategy when it feels untested, but you also resist shallow visual polish. The useful move may be an architecture prototype, not a design prototype.",
  },
]

const REFERENCE_FREE_EXPLORE_LIVE_DETECTION_COPY =
  "Orvek is reading the model · 1 receipt extracted · 1 question detected"

const PENDING_USER_MESSAGE_ID = "pending-user-local"

function collapseDraft(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-1 py-1 text-[12px] text-muted-foreground/85"
    >
      <span
        aria-hidden="true"
        className="o-breathe h-2 w-2 rounded-full bg-current opacity-70"
      />
      <span>Thinking…</span>
    </div>
  )
}

function hasAssistantContentAfterLatestUser(messages: OrvekExploreMessage[]): boolean {
  let lastUserIndex = -1

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUserIndex = index
      break
    }
  }

  if (lastUserIndex === -1) {
    return false
  }

  return messages
    .slice(lastUserIndex + 1)
    .some((message) => message.role === "orvek" && message.content.trim().length > 0)
}

function FreeExplore() {
  const { select, setInspectorTab } = useWorkbench()
  const data = useOrvekData()
  const exploreHandlers = useOrvekPageHandlers().explore
  const {
    getObjects,
    exploreGrounding,
    exploreMessages,
    exploreLiveDetectionCopy,
    emptyCopyBySlot,
    freeExploreSendHandlerAvailable,
    exploreLatestGrounding,
    freeExploreChatSessionId,
    referenceSurface,
  } = data
  const [localDraft, setLocalDraft] = useState("")
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [selectedAssistantMessageId, setSelectedAssistantMessageId] = useState<string | null>(null)
  const [publishedModelUpdateId, setPublishedModelUpdateId] = useState<string | null>(null)
  const lastStableLiveMessagesRef = useRef<OrvekExploreMessage[]>([])
  const hasLiveExploreChat = hasLiveExploreChatFromProvider(data)
  const allowReferenceSample = referenceSurface === true
  const useReferenceGrounding = allowReferenceSample && !hasLiveExploreChat
  const exploreView = data.explore

  const selectedLiveGroundingRaw: ExploreGroundingPayload | null = (() => {
    if (!hasLiveExploreChat) return null
    if (selectedAssistantMessageId) {
      const selected = (exploreMessages ?? []).find(
        (message) => message.id === selectedAssistantMessageId,
      )
      if (selected?.grounding) return selected.grounding
    }
    return exploreLatestGrounding ?? null
  })()

  const selectedLiveGrounding: ExploreGroundingPayload | null =
    selectedLiveGroundingRaw && publishedModelUpdateId
      ? {
          ...selectedLiveGroundingRaw,
          movementProposal: {
            ...selectedLiveGroundingRaw.movementProposal,
            status: "published",
            modelUpdateId: publishedModelUpdateId,
          },
        }
      : selectedLiveGroundingRaw

  useEffect(() => {
    if (!hasLiveExploreChat) {
      setExploreSelectedMessageGrounding({ messageId: null, grounding: null })
      return
    }
    setExploreSelectedMessageGrounding({
      messageId: selectedLiveGrounding?.assistantMessageId ?? selectedAssistantMessageId,
      grounding: selectedLiveGrounding,
    })
  }, [hasLiveExploreChat, selectedAssistantMessageId, selectedLiveGrounding])

  const groundingIds = useReferenceGrounding ? EXPLORE_GROUNDING : exploreGrounding
  const grounding = useReferenceGrounding ? getObjects(groundingIds) : []
  const liveGroundingSources = selectedLiveGrounding?.sources ?? []
  const composerDraft =
    freeExploreSendHandlerAvailable === true && exploreView?.composerDraft !== undefined
      ? exploreView.composerDraft
      : localDraft
  const isBooting = Boolean(exploreView?.isBooting)
  const isSending = Boolean(exploreView?.isSending)
  const composerDisabled = isBooting || isSending
  const canSend =
    freeExploreSendHandlerAvailable === true &&
    Boolean(exploreHandlers?.onSend) &&
    !composerDisabled &&
    composerDraft.trim().length > 0
  const quickPrompts = exploreView?.quickPrompts ?? [
    "Explore a pattern",
    "Talk through a decision",
    "Start an investigation",
    "Inspect a conflict",
  ]
  const rawLiveMessages = exploreMessages ?? []
  const liveMessages = rawLiveMessages.filter((message) => message.content.trim().length > 0)

  if (hasLiveExploreChat && liveMessages.length > 0) {
    lastStableLiveMessagesRef.current = liveMessages
  }

  const preservedLiveMessages =
    hasLiveExploreChat
      ? liveMessages
      : freeExploreSendHandlerAvailable === true &&
          (isSending || lastStableLiveMessagesRef.current.length > 0)
        ? lastStableLiveMessagesRef.current
        : []

  const baseMessages =
    allowReferenceSample && !hasLiveExploreChat && preservedLiveMessages.length === 0
      ? REFERENCE_FREE_EXPLORE_MESSAGES
      : hasLiveExploreChat || preservedLiveMessages.length > 0
        ? preservedLiveMessages
        : []

  const pendingTrimmed = pendingUserMessage ? collapseDraft(pendingUserMessage) : ""
  const pendingAlreadyVisible =
    pendingTrimmed.length > 0 &&
    baseMessages.some(
      (message) => message.role === "user" && collapseDraft(message.content) === pendingTrimmed,
    )

  const messages =
    pendingTrimmed.length > 0 && !pendingAlreadyVisible
      ? [
          ...baseMessages,
          {
            id: PENDING_USER_MESSAGE_ID,
            role: "user" as const,
            content: pendingUserMessage ?? "",
          },
        ]
      : baseMessages

  const bubbleMessages = messages.filter(
    (message) => message.id === PENDING_USER_MESSAGE_ID || message.content.trim().length > 0,
  )
  const showThinkingRow =
    isSending && !hasAssistantContentAfterLatestUser(bubbleMessages)

  const showLiveEmptyState =
    (hasLiveExploreChat || freeExploreSendHandlerAvailable === true) &&
    messages.length === 0 &&
    !isSending &&
    !pendingTrimmed

  const handleSend = useCallback(() => {
    if (!canSend) {
      return
    }

    const outgoing = collapseDraft(composerDraft)
    if (!outgoing) {
      return
    }

    setPendingUserMessage(outgoing)
    exploreHandlers?.onSend?.()
  }, [canSend, composerDraft, exploreHandlers])

  useEffect(() => {
    if (!pendingTrimmed) {
      return
    }

    if (pendingAlreadyVisible) {
      setPendingUserMessage(null)
    }
  }, [pendingAlreadyVisible, pendingTrimmed])

  useEffect(() => {
    if (!pendingTrimmed || !hasLiveExploreChat) {
      return
    }

    if (
      exploreView?.errorMessage &&
      freeExploreSendHandlerAvailable === true &&
      exploreHandlers?.onDraftChange &&
      !collapseDraft(composerDraft)
    ) {
      exploreHandlers.onDraftChange(pendingUserMessage ?? "")
      setPendingUserMessage(null)
    }
  }, [
    composerDraft,
    exploreHandlers,
    exploreView?.errorMessage,
    freeExploreSendHandlerAvailable,
    hasLiveExploreChat,
    pendingTrimmed,
    pendingUserMessage,
  ])
  const liveDetectionCopy = hasLiveExploreChat
    ? V0_EXPLORE_LIVE_DETECTION_COPY
    : allowReferenceSample
      ? (exploreLiveDetectionCopy ?? REFERENCE_FREE_EXPLORE_LIVE_DETECTION_COPY)
      : isBooting
        ? (exploreView?.chatLoadingCopy ?? "Loading conversation…")
        : (exploreView?.errorMessage ??
          emptyCopyBySlot?.exploreChatEmpty ??
          "Ask the model anything to begin.")

  return (
    <div>
      <div className="space-y-3">
        {showLiveEmptyState ? (
          <div className="o-material rounded-[14px] p-4 text-[13px] leading-relaxed text-muted-foreground">
            {isBooting
              ? (exploreView?.chatLoadingCopy ?? "Loading conversation…")
              : (emptyCopyBySlot?.exploreChatEmpty ?? "Ask the model anything to begin.")}
          </div>
        ) : (
          <>
            {bubbleMessages.map((message) => {
              const isPendingUserBubble = message.id === PENDING_USER_MESSAGE_ID
              const isSelectableAssistant =
                hasLiveExploreChat && message.role === "orvek" && !isPendingUserBubble
              const isSelectedAssistant =
                isSelectableAssistant && selectedAssistantMessageId === message.id

              return (
                <button
                  key={message.id}
                  type="button"
                  data-testid={
                    isSelectableAssistant
                      ? `explore-assistant-message-${message.id}`
                      : undefined
                  }
                  data-message-id={message.id}
                  data-message-role={message.role === "orvek" ? "assistant" : "user"}
                  disabled={!isSelectableAssistant}
                  onClick={() => {
                    if (!isSelectableAssistant) return
                    setSelectedAssistantMessageId(message.id)
                    setInspectorTab("evidence")
                  }}
                  className={cn(
                    "block w-full text-left",
                    isSelectableAssistant ? "cursor-pointer" : "cursor-default",
                    isSelectedAssistant ? "ring-1 ring-inset ring-primary/40 rounded-[14px]" : "",
                  )}
                >
                  <Bubble role={message.role} pending={isPendingUserBubble}>
                    {message.content}
                  </Bubble>
                </button>
              )
            })}
            {showThinkingRow ? (
              <div className="flex justify-start">
                <ThinkingIndicator />
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* grounded in */}
      <div className="mt-3" data-testid="explore-grounding-section">
        <SectionLabel>Grounded in</SectionLabel>
        {hasLiveExploreChat ? (
          liveGroundingSources.length === 0 ? (
            <p
              className="mt-2 text-[13px] text-muted-foreground"
              data-testid="explore-grounding-empty"
            >
              {selectedLiveGrounding?.status === "insufficient_evidence"
                ? EXPLORE_NO_MOVEMENT_LABEL
                : (emptyCopyBySlot?.exploreGroundingEmpty ?? EXPLORE_GROUNDING_EMPTY_COPY)}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {liveGroundingSources.map((source) => (
                <div
                  key={source.sourceId}
                  data-testid={`explore-grounding-chip-${source.sourceId}`}
                  data-epistemic-status={source.epistemicStatus}
                  data-source-id={source.sourceId}
                >
                  <Chip tone="evidence" className="cursor-default">
                    {source.epistemicStatus}: {source.title}
                  </Chip>
                </div>
              ))}
            </div>
          )
        ) : useReferenceGrounding && grounding.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {grounding.map((c) => (
            <button key={c.id} type="button" onClick={() => select(c.id)}>
              <Chip tone="evidence" className="cursor-pointer hover:opacity-80">
                {c.title}
              </Chip>
            </button>
          ))}
        </div>
        ) : (
          <p
            className="mt-2 text-[13px] text-muted-foreground"
            data-testid="explore-grounding-empty"
          >
            {emptyCopyBySlot?.exploreGroundingEmpty ??
              "Grounding chips appear when linked evidence is available."}
          </p>
        )}
      </div>

      {hasLiveExploreChat && selectedLiveGrounding ? (
        <ExploreMovementProposalCard
          grounding={selectedLiveGrounding}
          sessionId={freeExploreChatSessionId ?? null}
          publishedModelUpdateId={publishedModelUpdateId}
          onPublished={(modelUpdateId) => setPublishedModelUpdateId(modelUpdateId)}
          onRejected={() => setPublishedModelUpdateId(null)}
        />
      ) : null}

      {hasLiveExploreChat ? (
        <div className="mt-3 space-y-3">
          <ExploreConversationReviewStrip />
          <ExploreModelMovementStrip />
        </div>
      ) : null}

      {/* live detection line */}
      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        {hasLiveExploreChat ? null : (
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-action/40" />
            <span className="o-breathe relative inline-flex size-1.5 rounded-full bg-action" />
          </span>
        )}
        {liveDetectionCopy}
      </div>

      {/* end-of-turn movement note → inspector */}
      <button
        type="button"
        onClick={() => setInspectorTab("movement")}
        className="o-calm mt-2.5 flex w-full items-center gap-2.5 rounded-2xl bg-action-muted/50 px-4 py-3 text-left ring-1 ring-inset ring-action/15 hover:bg-action-muted/70"
      >
        <Sparkles className="size-4 shrink-0 text-action-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
          {hasLiveExploreChat || !allowReferenceSample ? (
            <>Review possible model movement in the inspector.</>
          ) : (
            <>
              This may update your model in <span className="font-medium">4 places</span>. Review and
              confirm in the inspector.
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
        data-testid="explore-composer"
        data-free-explore-send-handler={
          freeExploreSendHandlerAvailable === true ? "true" : "false"
        }
        data-has-live-explore-chat={hasLiveExploreChat ? "true" : "false"}
        data-explore-booting={isBooting ? "true" : "false"}
        data-has-send-handler={exploreHandlers?.onSend ? "true" : "false"}
        data-explore-error={exploreView?.errorMessage ?? ""}
      >
        <input
          value={composerDraft}
          onChange={(event) => {
            const nextValue = event.target.value
            if (freeExploreSendHandlerAvailable === true && exploreHandlers?.onDraftChange) {
              exploreHandlers.onDraftChange(nextValue)
              return
            }
            setLocalDraft(nextValue)
          }}
          placeholder={exploreView?.composerPlaceholder ?? "Ask the model anything…"}
          onFocus={() => {
            if (freeExploreSendHandlerAvailable === true) {
              exploreHandlers?.onComposerFocus?.()
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) {
              return
            }
            event.preventDefault()
            if (!canSend) {
              return
            }
            handleSend()
          }}
          disabled={composerDisabled}
          className="flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          type="button"
          data-testid="explore-ask-button"
          data-can-send={canSend ? "true" : "false"}
          onClick={() => {
            handleSend()
          }}
          disabled={!canSend}
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-3.5" />
          Ask
        </button>
      </div>
      {hasLiveExploreChat && exploreView?.errorMessage ? (
        <p className="mt-2 text-[12px] text-destructive">{exploreView.errorMessage}</p>
      ) : null}

      {/* quick prompts */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {quickPrompts.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              if (composerDisabled) {
                return
              }
              if (freeExploreSendHandlerAvailable === true && exploreHandlers?.onQuickPrompt) {
                setPendingUserMessage(collapseDraft(q))
                exploreHandlers.onQuickPrompt(q)
                return
              }
              setLocalDraft(q)
            }}
            disabled={composerDisabled}
            className="o-calm rounded-full bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({
  role,
  children,
  pending = false,
}: {
  role: "user" | "orvek"
  children: React.ReactNode
  pending?: boolean
}) {
  const isUser = role === "user"
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? cn(
                "rounded-[14px] rounded-br-[5px] bg-primary text-primary-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.25)]",
                pending && "opacity-90",
              )
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
  const data = useOrvekData()
  const { getObject, exploreQuestionIds, exploreQuestionSelectedId, emptyCopyBySlot, referenceSurface } = data
  const questionIds = exploreQuestionIds ?? []
  const hasLiveQuestions = questionIds.length > 0
  const allowReferenceSample = referenceSurface === true
  const referenceQuestionIds = ["aq-1", "aq-2", "aq-3", "aq-4"] as const
  const ids = hasLiveQuestions ? questionIds : allowReferenceSample ? [...referenceQuestionIds] : []

  const [activeId, setActiveId] = useState(
    hasLiveQuestions
      ? (exploreQuestionSelectedId ?? questionIds[0] ?? referenceQuestionIds[1])
      : allowReferenceSample
        ? (referenceQuestionIds[0] ?? referenceQuestionIds[1])
        : null,
  )
  const [createdRow, setCreatedRow] = useState<{
    id: string
    title: string
    organizingQuestion: string
  } | null>(null)

  useEffect(() => {
    if (!hasLiveQuestions) {
      if (!allowReferenceSample) {
        setActiveId(null)
      }
      return
    }

    const nextId = exploreQuestionSelectedId ?? questionIds[0]
    if (nextId) {
      setActiveId(nextId)
    }
  }, [allowReferenceSample, exploreQuestionSelectedId, questionIds, hasLiveQuestions])

  useEffect(() => {
    if (!createdRow) {
      return
    }

    if (questionIds.includes(createdRow.id)) {
      setCreatedRow(null)
    }
  }, [createdRow, questionIds])

  const q = activeId ? getObject(activeId) : undefined
  const showEmptyList = ids.length === 0
  const showProductionDetail = !allowReferenceSample && Boolean(activeId)

  function resolveInspectorSelection(id: string) {
    return hasLiveQuestions ? resolveActiveQuestionsOpenSelectionId(id, getObject) : id
  }

  return (
    <div className="space-y-5">
      <InvestigationCreateCard
        onCreated={(created) => {
          setActiveId(created.id)
          setCreatedRow(created)
        }}
        useRouterRefresh={false}
      />

      <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
        <div>
          <SectionLabel>Open questions</SectionLabel>
          <div className="o-material mt-2 divide-y divide-border overflow-hidden rounded-[10px]">
            {showEmptyList ? (
              <p className="px-3 py-2.5 text-[13px] text-muted-foreground">
                {emptyCopyBySlot?.exploreQuestionsEmptyList ?? "No active questions are open yet."}
              </p>
            ) : (
              [
                ...(createdRow && !questionIds.includes(createdRow.id)
                  ? [createdRow.id]
                  : []),
                ...ids,
              ].map((id) => {
                if (createdRow?.id === id && !questionIds.includes(id)) {
                  const active = activeId === id

                  return (
                    <button
                      key={id}
                      type="button"
                      data-testid="active-question-row"
                      onClick={() => {
                        setActiveId(id)
                        select(id)
                      }}
                      className={cn(
                        "o-calm flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
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
                          {createdRow.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          Open
                        </span>
                        <span className="mt-1 block text-[11px] text-cyan/70">
                          Investigation ID {id}
                        </span>
                      </span>
                    </button>
                  )
                }

                const o = getObject(id)
                if (!o) return null
                const active = activeId === id
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid="active-question-row"
                    onClick={() => {
                      setActiveId(id)
                      select(resolveInspectorSelection(id))
                    }}
                    className={cn(
                      "o-calm flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
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
                        {o.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {hasLiveQuestions
                          ? (o.tags?.[1] ?? o.status ?? "Open")
                          : `${o.evidenceCount} receipts · ${o.status}`}
                      </span>
                      {hasLiveQuestions ? (
                        <span className="mt-1 block text-[11px] text-cyan/70">
                          Investigation ID {id}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="min-w-0">
          {showProductionDetail && activeId ? (
            <ProductionInvestigationWorkbenchDetail
              investigationId={activeId}
              fallbackTitle={q?.title}
            />
          ) : q && !showEmptyList ? (
            <>
              <Chip tone="action">Active question · {q.status}</Chip>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
                {q.title}
              </h2>
              <InvBlock label="Why this is open">{q.whyItMatters}</InvBlock>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="o-material rounded-[10px] p-3.5">
                  <SectionLabel className="text-primary">Would resolve toward yes if</SectionLabel>
                  <ul className="mt-2 space-y-1.5">
                    {(q.supporting ?? ["A narrow public test reduces felt uncertainty."]).map((s) => (
                      <li key={s} className="flex gap-2 text-[13px] text-foreground">
                        <span className="mt-0.5 text-primary">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="o-material rounded-[10px] p-3.5">
                  <SectionLabel className="text-destructive/80">Would resolve toward no if</SectionLabel>
                  <ul className="mt-2 space-y-1.5">
                    {(q.conflicting ?? ["Visual output creates false confidence."]).map((c) => (
                      <li key={c} className="flex gap-2 text-[13px] text-muted-foreground">
                        <span className="mt-0.5 text-destructive">−</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {q.relatedIds && q.relatedIds.length > 0 ? (
                <InvBlock label="What this question touches">
                  <div className="flex flex-wrap gap-1.5">
                    {q.relatedIds.map((id) => {
                      const o = getObject(id)
                      if (!o) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => select(resolveInspectorSelection(id))}
                        >
                          <Chip className="cursor-pointer hover:opacity-80">{o.title}</Chip>
                        </button>
                      )
                    })}
                  </div>
                </InvBlock>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!activeId) {
                      return
                    }
                    select(resolveInspectorSelection(activeId))
                    setInspectorTab("evidence")
                  }}
                  className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98]"
                >
                  See evidence
                  <ArrowRight className="size-3.5" aria-hidden />
                </button>
              </div>
            </>
          ) : (
            <>
              <Chip tone="action">Active question</Chip>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
                {emptyCopyBySlot?.exploreQuestionsEmptyDetail ??
                  "Select a question when one is available."}
              </h2>
              <InvBlock label="Why this is open">
                {emptyCopyBySlot?.exploreQuestionsEmptyDetail ??
                  "Question rationale appears when an active question is selected."}
              </InvBlock>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="o-material rounded-[10px] p-3.5">
                  <SectionLabel className="text-primary">Would resolve toward yes if</SectionLabel>
                  <p className="mt-2 text-[13px] text-muted-foreground">—</p>
                </div>
                <div className="o-material rounded-[10px] p-3.5">
                  <SectionLabel className="text-destructive/80">Would resolve toward no if</SectionLabel>
                  <p className="mt-2 text-[13px] text-muted-foreground">—</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Investigations() {
  const { select } = useWorkbench()
  const data = useOrvekData()
  const {
    getObject,
    exploreInvestigationIds,
    exploreInvestigationSelectedId,
    emptyCopyBySlot,
    referenceSurface,
  } = data
  const investigationIds = exploreInvestigationIds ?? []
  const hasLiveInvestigations = investigationIds.length > 0
  const allowReferenceSample = referenceSurface === true
  const referenceInvestigationIds = ["inv-1", "inv-2", "inv-3"] as const
  const ids = hasLiveInvestigations
    ? investigationIds
    : allowReferenceSample
      ? [...referenceInvestigationIds]
      : []

  const [activeId, setActiveId] = useState(
    hasLiveInvestigations
      ? (exploreInvestigationSelectedId ?? investigationIds[0] ?? referenceInvestigationIds[1])
      : allowReferenceSample
        ? (referenceInvestigationIds[0] ?? referenceInvestigationIds[1])
        : null,
  )

  useEffect(() => {
    if (!hasLiveInvestigations) {
      if (!allowReferenceSample) {
        setActiveId(null)
      }
      return
    }

    const nextId = exploreInvestigationSelectedId ?? investigationIds[0]
    if (nextId) {
      setActiveId(nextId)
    }
  }, [allowReferenceSample, exploreInvestigationSelectedId, investigationIds, hasLiveInvestigations])

  const inv = activeId ? getObject(activeId) : undefined
  const showEmptyList = ids.length === 0
  const showProductionDetail = !allowReferenceSample && Boolean(activeId)

  function resolveInspectorSelection(id: string) {
    return hasLiveInvestigations ? resolveInvestigationsOpenSelectionId(id, getObject) : id
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <div>
        <SectionLabel>Threads</SectionLabel>
        <div className="mt-2 space-y-1.5">
          {showEmptyList ? (
            <div className="o-material rounded-[10px] px-2.5 py-2 text-[13px] text-muted-foreground">
              {emptyCopyBySlot?.exploreInvestigationsEmptyList ??
                "No investigations are active yet."}
            </div>
          ) : (
          ids.map((id) => {
            const o = getObject(id)
            if (!o) return null
            return (
              <button
                key={id}
                type="button"
                data-testid="investigation-row"
                onClick={() => {
                  setActiveId(id)
                  select(resolveInspectorSelection(id))
                }}
                className={cn(
                  "o-calm w-full rounded-[10px] px-2.5 py-2 text-left text-[13px] leading-snug",
                  activeId === id
                    ? "bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(30,41,59,0.16)] ring-1 ring-inset ring-primary/20"
                    : "bg-secondary/50 text-foreground hover:bg-secondary",
                )}
              >
                {o.title}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {hasLiveInvestigations
                    ? (o.tags?.[1] ?? o.status ?? "Open")
                    : `${o.evidenceCount} linked · ${o.status}`}
                </span>
                {hasLiveInvestigations ? (
                  <span className="mt-1 block text-[11px] text-cyan/70">
                    Investigation ID {id}
                  </span>
                ) : null}
              </button>
            )
          })
          )}
        </div>
      </div>

      <div className="min-w-0">
        {showProductionDetail && activeId ? (
          <ProductionInvestigationWorkbenchDetail
            investigationId={activeId}
            fallbackTitle={inv?.title}
            showActions={false}
          />
        ) : inv && !showEmptyList ? (
          <>
        <Chip tone="evidence">Investigation · {inv.status}</Chip>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
          {inv.title}
        </h2>
        <InvBlock label="Why it matters">{inv.whyItMatters}</InvBlock>
        {inv.hypotheses && (
          <InvBlock label="Hypotheses">
            <ul className="space-y-1">
              {inv.hypotheses.map((h) => (
                <li key={h} className="flex gap-1.5 text-[13px]">
                  <span className="text-primary">·</span>
                  {h}
                </li>
              ))}
            </ul>
          </InvBlock>
        )}
        {inv.missingEvidence && (
          <InvBlock label="Missing evidence">
            <ul className="space-y-1">
              {inv.missingEvidence.map((m) => (
                <li key={m} className="flex gap-1.5 text-[13px] text-muted-foreground">
                  <span className="text-action-foreground">?</span>
                  {m}
                </li>
              ))}
            </ul>
          </InvBlock>
        )}
        <InvBlock label="Linked objects">
          <div className="flex flex-wrap gap-1.5">
            {(inv.relatedIds ?? []).map((id) => {
              const o = getObject(id)
              if (!o) return null
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => select(resolveInspectorSelection(id))}
                >
                  <Chip className="cursor-pointer hover:opacity-80">{o.title}</Chip>
                </button>
              )
            })}
          </div>
        </InvBlock>
        <div className="mt-4 rounded-[12px] rounded-l-sm border-l-2 border-l-primary/50 bg-secondary/50 p-3 text-[13px] italic text-muted-foreground">
          “Does seeing the system standing up actually lower the uncertainty, or just move it?” —
          continue this thread in Free Explore.
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["Add hypothesis", "Suggest fieldwork", "Possible report", "Ask in Explore"].map(
            (a) => (
              <button
                key={a}
                type="button"
                disabled={hasLiveInvestigations}
                className={cn(
                  "o-calm rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60",
                  hasLiveInvestigations && ORVEK_DEFERRED_ACTION_CLASS,
                )}
              >
                {a}
              </button>
            ),
          )}
        </div>
          </>
        ) : (
          <>
            <Chip tone="evidence">Investigation</Chip>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
              {emptyCopyBySlot?.exploreInvestigationsEmptyDetail ??
                "Select an investigation when one is available."}
            </h2>
            <InvBlock label="Why it matters">
              {emptyCopyBySlot?.exploreInvestigationsEmptyDetail ??
                "Investigation rationale appears when a thread is selected."}
            </InvBlock>
            <InvBlock label="Hypotheses">
              <p className="text-[13px] text-muted-foreground">—</p>
            </InvBlock>
            <InvBlock label="Missing evidence">
              <p className="text-[13px] text-muted-foreground">—</p>
            </InvBlock>
            <InvBlock label="Linked objects">
              <p className="text-[13px] text-muted-foreground">—</p>
            </InvBlock>
          </>
        )}
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
  const data = useOrvekData()
  const isProduction = isProductionDisplay(data)
  const { getObject, exploreFieldworkIds, exploreFieldworkSelectedId, emptyCopyBySlot } = data
  const fieldworkIds = exploreFieldworkIds ?? []
  const hasLiveFieldwork = fieldworkIds.length > 0
  const referenceFieldworkId = "f2"
  const referenceLinkedQuestionId = "aq-2"
  const referenceTitle =
    "Generate v0 architecture prototype and review against feature architecture."
  const referenceFields = [
    { label: "Expected signal", value: "Whether the prototype reduces uncertainty." },
    { label: "What to observe", value: "Which page overloads first; right-panel coverage." },
    { label: "What would confirm", value: "Missing flows become obvious; uncertainty drops." },
    { label: "What would weaken", value: "Prototype flattens the concept into a dashboard." },
    { label: "Due / review window", value: "Review after first prototype." },
  ] as const

  const [activeId, setActiveId] = useState(
    hasLiveFieldwork
      ? (exploreFieldworkSelectedId ?? fieldworkIds[0] ?? referenceFieldworkId)
      : referenceFieldworkId,
  )

  useEffect(() => {
    if (!hasLiveFieldwork) {
      return
    }

    const preferred =
      (exploreFieldworkSelectedId && fieldworkIds.includes(exploreFieldworkSelectedId)
        ? exploreFieldworkSelectedId
        : null) ?? fieldworkIds[0]
    if (!preferred) {
      return
    }

    // Always leave the reference shell id ("f2") once production rows exist.
    if (activeId === referenceFieldworkId || !fieldworkIds.includes(activeId)) {
      setActiveId(preferred)
    }
  }, [activeId, exploreFieldworkSelectedId, fieldworkIds, hasLiveFieldwork, referenceFieldworkId])

  const fieldwork = getObject(activeId)
  const showLiveDetail = hasLiveFieldwork && fieldwork?.type === "fieldwork"

  function resolveInspectorSelection(id: string) {
    return hasLiveFieldwork ? resolveExperimentOpenSelectionId(id, getObject) : id
  }

  function buildLiveFields(object: OrvekObject) {
    return [
      { label: "Expected signal", value: object.expectedSignal ?? object.summary ?? "—" },
      { label: "What to observe", value: object.whatToObserve ?? object.title ?? "—" },
      {
        label: "What would confirm",
        value: object.confirmIf ?? object.supporting?.[0] ?? "—",
      },
      {
        label: "What would weaken",
        value: object.weakenIf ?? object.conflicting?.[0] ?? "—",
      },
      {
        label: "Due / review window",
        value: object.reviewWindow ?? object.lastUpdated ?? "—",
      },
    ]
  }

  const title = showLiveDetail
    ? (fieldwork.summary ?? fieldwork.purpose ?? fieldwork.title ?? referenceTitle)
    : referenceTitle
  const fields = showLiveDetail ? buildLiveFields(fieldwork) : referenceFields
  const statusLabel = showLiveDetail ? fieldwork.tags?.[1] : undefined
  const linkedRelatedId = showLiveDetail ? fieldwork.relatedIds?.[0] : undefined

  return (
    <div>
      {hasLiveFieldwork && fieldworkIds.length > 1 ? (
        <div className="mb-4">
          <SectionLabel>Watch prompts</SectionLabel>
          <div className="o-material mt-2 divide-y divide-border overflow-hidden rounded-[10px]">
            {fieldworkIds.map((id) => {
              const row = getObject(id)
              if (!row) {
                return null
              }

              const active = activeId === id
              return (
                <button
                  key={id}
                  type="button"
                  data-testid="fieldwork-row"
                  onClick={() => {
                    setActiveId(id)
                    onSelect(resolveInspectorSelection(id))
                  }}
                  className={cn(
                    "o-calm flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
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
                      {row.title}
                    </span>
                    {row.summary ? (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {row.summary}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-cyan/70">
                      Fieldwork ID {id}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <Chip tone="action">
        Fieldwork Bridge{statusLabel ? ` · ${statusLabel}` : ""}
      </Chip>
      {showLiveDetail ? (
        <p className="label-meta mt-2 text-cyan/70" data-testid="watch-for-id">
          Fieldwork ID {activeId}
        </p>
      ) : null}
      <h2 className="mt-2 text-base font-semibold text-foreground">{title}</h2>
      <dl className="o-material mt-4 divide-y divide-border overflow-hidden rounded-[10px]">
        {fields.map((f) => (
          <div key={f.label} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[180px_1fr]">
            <dt className="text-[13px] font-medium text-muted-foreground">{f.label}</dt>
            <dd className="text-[13px] text-muted-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (showLiveDetail) {
              onSelect(resolveInspectorSelection(activeId))
              return
            }
            onSelect(referenceFieldworkId)
          }}
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground hover:brightness-[1.03] active:scale-[0.98]"
        >
          Open fieldwork
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (showLiveDetail && linkedRelatedId) {
              onSelect(resolveInspectorSelection(linkedRelatedId))
              return
            }
            if (!showLiveDetail) {
              onSelect(referenceLinkedQuestionId)
            }
          }}
          disabled={showLiveDetail && !linkedRelatedId}
          className={cn(
            "o-calm rounded-[8px] bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60",
            showLiveDetail && !linkedRelatedId && ORVEK_DEFERRED_ACTION_CLASS,
          )}
        >
          {showLiveDetail ? "Linked context" : "Linked question"}
        </button>
      </div>
      {showLiveDetail && fieldwork?.type === "fieldwork" ? (
        <div className="mt-5">
          <SectionLabel>Check in</SectionLabel>
          {isProduction ? (
            <DurableFieldworkCheckInControls object={fieldwork} className="mt-2" />
          ) : null}
        </div>
      ) : null}
      {showLiveDetail && !fieldwork.summary && !fieldwork.title ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {emptyCopyBySlot?.exploreFieldworkEmpty ?? "No fieldwork bridge is active yet."}
        </p>
      ) : null}
    </div>
  )
}
