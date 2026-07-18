"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useCanonicalData } from "@/components/orvek-v0-canonical/canonical-data-context"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { useOrvekPageHandlers } from "@/lib/orvek-v0/page-handlers"
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Explore</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ask, investigate, and turn conversation into model movement. Possible updates appear in
          the inspector.
        </p>
        {/* segmented control */}
        <div className="o-sunken mt-3 inline-flex flex-wrap gap-0.5 rounded-[9px] p-1">
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

  const detectionCopy =
    data.exploreLiveDetectionCopy ??
    (referenceSurface
      ? "Orvek is reading the model · 1 receipt extracted · 1 question detected"
      : null)

  const draft = data.explore?.composerDraft ?? ""

  return (
    <div>
      <div className="space-y-3">
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
        ) : liveMessages.length > 0 ? (
          liveMessages.map((message) => (
            <Bubble key={message.id} role={message.role}>
              {message.content}
            </Bubble>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.emptyCopyBySlot?.exploreFree ?? "Ask the model anything to begin."}
          </p>
        )}
      </div>

      {/* grounded in */}
      <div className="mt-3">
        <SectionLabel>Grounded in</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {grounding.map((c) => (
            <button key={c.id} type="button" onClick={() => select(c.id)}>
              <Chip tone="evidence" className="cursor-pointer hover:opacity-80">
                {c.title}
              </Chip>
            </button>
          ))}
        </div>
      </div>

      {/* live detection line */}
      {detectionCopy ? (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-action/40" />
            <span className="o-breathe relative inline-flex size-1.5 rounded-full bg-action" />
          </span>
          {detectionCopy}
        </div>
      ) : null}

      {/* end-of-turn movement note → inspector */}
      <button
        type="button"
        onClick={() => {
          exploreHandlers?.onOpenInspector?.()
          setInspectorTab("movement")
        }}
        className="o-calm mt-2.5 flex w-full items-center gap-2.5 rounded-2xl bg-action-muted/50 px-4 py-3 text-left ring-1 ring-inset ring-action/15 hover:bg-action-muted/70"
      >
        <Sparkles className="size-4 shrink-0 text-action-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
          {useFixtureConversation ? (
            <>
              This may update your model in <span className="font-medium">4 places</span>. Review and
              confirm in the inspector.
            </>
          ) : (
            <>Review possible model updates in the inspector.</>
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-action-foreground">
          <PanelRight className="size-3.5" aria-hidden />
          Open
        </span>
      </button>

      {/* composer */}
      <div className="o-material mt-4 flex items-center gap-2 rounded-2xl p-2">
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
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98]"
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
            className="o-calm rounded-full bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
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
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
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
  const ids = exploreQuestionIds
  const [activeId, setActiveId] = useState(ids[0] ?? "")
  const q = getObject(activeId)

  if (ids.length === 0 || !q) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-foreground">No active questions yet</p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Questions appear here when Orvek has live open inquiries for this model.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
      {/* inquiry list */}
      <div>
        <SectionLabel>Open questions</SectionLabel>
        <div className="o-material mt-2 divide-y divide-border overflow-hidden rounded-[10px]">
          {ids.map((id) => {
            const o = getObject(id)
            if (!o) return null
            const active = activeId === id
            return (
              <button
                key={id}
                type="button"
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
                    {o.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {o.evidenceCount} receipts · {o.status}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* selected question detail */}
      <div className="min-w-0">
        <Chip tone="action">Active question · {q.status}</Chip>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
          {q.title}
        </h2>
        <InvBlock label="Why this is open">{q.whyItMatters}</InvBlock>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="o-material rounded-[10px] p-3.5">
            <SectionLabel className="text-primary">Would resolve toward yes if</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {(q.supporting ?? []).map((s) => (
                <li key={s} className="flex gap-2 text-[13px] text-foreground">
                  <span className="mt-0.5 text-primary">+</span>
                  {s}
                </li>
              ))}
              {(q.supporting ?? []).length === 0 ? (
                <li className="text-[13px] text-muted-foreground">No supporting signals yet.</li>
              ) : null}
            </ul>
          </div>
          <div className="o-material rounded-[10px] p-3.5">
            <SectionLabel className="text-destructive/80">Would resolve toward no if</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {(q.conflicting ?? []).map((c) => (
                <li key={c} className="flex gap-2 text-[13px] text-muted-foreground">
                  <span className="mt-0.5 text-destructive">−</span>
                  {c}
                </li>
              ))}
              {(q.conflicting ?? []).length === 0 ? (
                <li className="text-[13px] text-muted-foreground">No conflicting signals yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
        {q.relatedIds && q.relatedIds.length > 0 && (
          <InvBlock label="What this question touches">
            <div className="flex flex-wrap gap-1.5">
              {q.relatedIds.map((id) => {
                const o = getObject(id)
                if (!o) return null
                return (
                  <button key={id} type="button" onClick={() => select(id)}>
                    <Chip className="cursor-pointer hover:opacity-80">{o.title}</Chip>
                  </button>
                )
              })}
            </div>
          </InvBlock>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              select(activeId)
              setInspectorTab("evidence")
            }}
            className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98]"
          >
            See evidence
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
          {["Explore this", "Propose fieldwork", "Mark resolved"].map((a) => (
            <button
              key={a}
              type="button"
              className="o-calm rounded-[8px] bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
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
  const [activeId, setActiveId] = useState(exploreInvestigationIds[0] ?? "")
  const inv = getObject(activeId)

  useEffect(() => {
    if (!exploreInvestigationIds.includes(activeId)) {
      setActiveId(exploreInvestigationIds[0] ?? "")
    }
  }, [exploreInvestigationIds, activeId])

  if (exploreInvestigationIds.length === 0 || !inv) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-foreground">No investigations yet</p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Investigation threads appear here when live evidence opens a sustained inquiry.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <div>
        <SectionLabel>Threads</SectionLabel>
        <div className="mt-2 space-y-1.5">
          {exploreInvestigationIds.map((id) => {
            const o = getObject(id)
            if (!o) return null
            return (
              <button
                key={id}
                type="button"
                data-testid="investigation-row"
                onClick={() => {
                  setActiveId(id)
                  select(id)
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
                  {o.evidenceCount != null
                    ? `${o.evidenceCount} linked · ${o.status}`
                    : o.status}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-w-0" data-testid="canonical-investigation-detail">
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
                <button key={id} type="button" onClick={() => select(id)}>
                  <Chip className="cursor-pointer hover:opacity-80">{o.title}</Chip>
                </button>
              )
            })}
          </div>
        </InvBlock>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["Add hypothesis", "Suggest fieldwork", "Possible report", "Ask in Explore"].map(
            (a) => (
              <button
                key={a}
                type="button"
                className="o-calm rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
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
  const ids = exploreFieldworkIds
  const [activeId, setActiveId] = useState(ids[0] ?? "")
  const fw = getObject(activeId)

  if (ids.length === 0 || !fw) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-foreground">No fieldwork yet</p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Fieldwork bridges appear here when live experiments define what to observe next.
        </p>
      </div>
    )
  }

  const fields = [
    { label: "Expected signal", value: fw.expectedSignal },
    { label: "What to observe", value: fw.whatToObserve },
    { label: "What would confirm", value: fw.confirmIf },
    { label: "What would weaken", value: fw.weakenIf },
    { label: "Due / review window", value: fw.reviewWindow ?? fw.outcomeWindow },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value))

  return (
    <div>
      <Chip tone="action">Fieldwork Bridge</Chip>
      <h2 className="mt-2 text-base font-semibold text-foreground">{fw.title}</h2>
      {fields.length > 0 ? (
        <dl className="o-material mt-4 divide-y divide-border overflow-hidden rounded-[10px]">
          {fields.map((f) => (
            <div key={f.label} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[180px_1fr]">
              <dt className="text-[13px] font-medium text-muted-foreground">{f.label}</dt>
              <dd className="text-[13px] text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-[13px] text-muted-foreground">
          {fw.summary || "Fieldwork details are not available yet."}
        </p>
      )}
      <div className="mt-4 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setActiveId(fw.id)
            onSelect(fw.id)
          }}
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground hover:brightness-[1.03] active:scale-[0.98]"
        >
          Open fieldwork
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
        {(fw.relatedIds ?? []).slice(0, 1).map((id) => {
          const linked = getObject(id)
          if (!linked) return null
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="o-calm rounded-[8px] bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
            >
              Linked: {linked.title}
            </button>
          )
        })}
      </div>
    </div>
  )
}
