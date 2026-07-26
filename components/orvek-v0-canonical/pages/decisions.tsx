"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useCanonicalData } from "@/components/orvek-v0-canonical/canonical-data-context"
import { minimumPermanentSlots } from "@/components/orvek-v0-canonical/permanent-presentation"
import { useWorkbench } from "@/components/orvek-v0/store"
import { Chip, SectionLabel } from "@/components/orvek-v0/primitives"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { ArrowRight, Check, GitBranch, MessageSquare, Scale, Send } from "lucide-react"

const STAGES = ["Active", "Chosen", "Outcome due", "Reviewed", "Model update"]
const DECISION_GROUP_SHELLS = [
  { heading: "Active", minimumRows: 3 },
  { heading: "Chosen", minimumRows: 1 },
  { heading: "Outcome due", minimumRows: 1, tone: "action" as const },
  { heading: "Reviewed", minimumRows: 3 },
]

export function DecisionsPage() {
  const { select, setPage, openReport, setInspectorTab } = useWorkbench()
  const { getObject, getObjects, decisionListGroups, decisionsDefaultId } = useCanonicalData()
  const data = useOrvekData()
  const [workspaceId, setWorkspaceId] = useState(decisionsDefaultId)
  const [draft, setDraft] = useState("")

  const decision = getObject(workspaceId)
  const receipts = decision ? getObjects(decision.receiptIds) : []
  const contexts = decision ? getObjects(decision.contextIds) : []
  const isLoading = data.decisionsIsLoading === true
  const options = minimumPermanentSlots(decision?.options, 3)
  const decisionContexts = minimumPermanentSlots(decision?.decisionContext, 4)
  const contextSlots = minimumPermanentSlots(contexts, 3)
  const receiptSlots = minimumPermanentSlots(receipts, 3)
  const permanentGroups = [
    ...DECISION_GROUP_SHELLS.map((shell) => {
      const live = decisionListGroups.find((group) => group.heading === shell.heading)
      return {
        ...shell,
        tone: live?.tone ?? shell.tone,
        liveCount: live?.ids.length ?? 0,
        ids: minimumPermanentSlots(live?.ids, shell.minimumRows),
      }
    }),
    ...decisionListGroups
      .filter(
        (group) => !DECISION_GROUP_SHELLS.some((shell) => shell.heading === group.heading),
      )
      .map((group) => ({
        ...group,
        minimumRows: 0,
        liveCount: group.ids.length,
        ids: minimumPermanentSlots(group.ids, 0),
      })),
  ]
  const decisionCount = decisionListGroups.reduce((n, g) => n + g.ids.length, 0)
  const outcomesDue =
    decisionListGroups.find((g) => /due|outcome/i.test(g.heading))?.ids.length ?? 0
  const dueId =
    decisionListGroups.find((group) => /due|outcome/i.test(group.heading))?.ids[0] ??
    decisionListGroups[0]?.ids[0] ??
    null
  const reportId = decision?.canonicalReportId
  const reportAvailable = Boolean(reportId && getObject(reportId))

  useEffect(() => {
    if (!decision && decisionsDefaultId && getObject(decisionsDefaultId)) {
      setWorkspaceId(decisionsDefaultId)
    }
  }, [decision, decisionsDefaultId, getObject])

  function openDecision(id: string) {
    setWorkspaceId(id)
    select(id)
  }

  // crude stage detection for the progression strip
  const stageIndex = !decision
    ? 0
    : decision.actualOutcome
      ? 4
      : /outcome due/i.test(decision.tags?.join(" ") ?? "")
        ? 2
        : decision.outcomeWindow
          ? 1
          : 0

  return (
    <div className="flex h-full min-h-0 flex-col" data-shell-page="decisions">
      {/* header + entry module */}
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Decisions</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Enter a decision, see what to choose, record what happened, and learn what it
              reveals.
            </p>
          </div>
          <span className="hidden text-sm text-muted-foreground sm:block">
            <span className="font-medium text-action-foreground">{outcomesDue}</span> outcomes
            due · <span className="font-medium text-foreground">{decisionCount}</span> in list
          </span>
        </div>

        {/* entry module */}
        <div className="rounded-2xl bg-evidence-muted/50 p-3 ring-1 ring-inset ring-primary/15">
          <div className="o-material flex items-center gap-2 rounded-[9px] px-3 py-2">
            <GitBranch className="size-4 shrink-0 text-primary" aria-hidden />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What are you deciding?"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setPage("explore")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Send className="size-3.5" aria-hidden />
              Talk it through
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "Compare options", icon: Scale },
              { label: "Add outcome", icon: Check },
              { label: "Review due decision", icon: ArrowRight },
            ].map((action) => {
              const interactive =
                action.label === "Review due decision" && Boolean(dueId && getObject(dueId))
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    if (action.label === "Review due decision" && dueId) {
                      openDecision(dueId)
                    }
                  }}
                  disabled={!interactive}
                  data-shell-item="decision-entry-action"
                  data-live-object-id={interactive ? dueId ?? undefined : undefined}
                  className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.12)] hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
                >
                  <action.icon className="size-3.5 text-primary" aria-hidden />
                  {action.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* master-detail */}
      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]"
        data-shell-slot="decisions-master-detail"
      >
        {/* left list — soft embedded rail */}
        <div
          className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-3 py-4 lg:mr-1.5"
          data-shell-slot="decisions-list-rail"
        >
          {permanentGroups.map((group) => (
            <div key={group.heading} className="mb-4" data-shell-item="decision-group">
              <div className="flex items-center gap-1.5 px-2">
                <SectionLabel
                  className={group.tone === "action" ? "text-action-foreground" : ""}
                >
                  {group.heading}
                </SectionLabel>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {group.liveCount}
                </span>
              </div>
              <div className="mt-1.5 space-y-0.5">
                {group.ids.map((id, index) => {
                  const item = id ? getObject(id) : undefined
                  const active = Boolean(item && workspaceId === item.id)
                  return (
                    <button
                      key={item?.id ?? `${group.heading}-empty-${index}`}
                      type="button"
                      onClick={item ? () => openDecision(item.id) : undefined}
                      disabled={!item}
                      data-shell-item="decision-rail-row"
                      data-live-object-id={item?.id}
                      className={cn(
                        "o-calm flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] leading-snug disabled:cursor-default disabled:opacity-70",
                        active
                          ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                          : "text-foreground hover:bg-card/60",
                      )}
                    >
                      {active && (
                        <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {item?.title ||
                          (isLoading
                            ? `Loading ${group.heading.toLowerCase()} decision…`
                            : `No ${group.heading.toLowerCase()} decision is available.`)}
                      </span>
                      {group.tone === "action" && item && (
                        <span className="size-1.5 shrink-0 rounded-full bg-action" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* center workspace */}
        <div
          className="min-h-0 overflow-y-auto px-6 py-6 lg:px-8"
          data-shell-slot="decisions-workspace"
        >
          <div className="mx-auto max-w-2xl">
            {/* lifecycle stepper */}
            <div
              className="o-material mb-5 flex items-center rounded-[10px] px-3 py-2.5"
              data-shell-slot="decision-lifecycle"
            >
              {STAGES.map((s, i) => {
                const done = i < stageIndex
                const current = i === stageIndex
                return (
                  <div
                    key={s}
                    className="flex flex-1 items-center last:flex-none"
                    data-shell-item="decision-stage"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "o-calm flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          done && "bg-primary text-primary-foreground",
                          current && "bg-action text-action-foreground ring-2 ring-action/30",
                          !done && !current && "border border-border bg-secondary text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="size-3" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "whitespace-nowrap text-[11px] font-medium",
                          current
                            ? "text-action-foreground"
                            : done
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {s}
                      </span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <span
                        className={cn(
                          "mx-2 h-px flex-1",
                          done ? "bg-primary/50" : "bg-border",
                        )}
                        aria-hidden
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-foreground text-balance">
              {decision?.title ||
                (isLoading ? "Loading current decision…" : "No decision is available.")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {decision?.summary ||
                (isLoading ? "Loading decision context…" : "Not enough information yet.")}
            </p>

            <div
              className="mt-4 rounded-lg border-l-2 border-primary bg-evidence-muted/40 px-4 py-3"
              data-shell-slot="decision-recommendation"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                What Orvek would choose
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground">
                {decision?.recommendation ||
                  (isLoading ? "Loading supported guidance…" : "Not enough information yet.")}
              </p>
            </div>

            <WSBlock label="Options">
              <div
                className="o-material grid divide-y divide-border overflow-hidden rounded-[10px] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
                data-shell-slot="decision-options"
              >
                {options.map((option, index) => (
                  <div
                    key={option?.label ?? `empty-option-${index}`}
                    className="p-3.5"
                    data-shell-item="decision-option"
                  >
                    <p className="text-[13px] font-medium text-foreground">
                      <span className="mr-1 inline-flex size-4 items-center justify-center rounded-[5px] bg-evidence-muted text-[10px] font-bold text-primary">
                        {option?.label ?? String.fromCharCode(65 + index)}
                      </span>
                      {option?.text ||
                        (isLoading ? "Loading option…" : "No option is available.")}
                    </p>
                    {option?.pros && (
                      <ul className="mt-2 space-y-0.5">
                        {option.pros.map((pro) => (
                          <li key={pro} className="flex gap-1 text-xs text-foreground">
                            <span className="text-primary">+</span>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    )}
                    {option?.cons && (
                      <ul className="mt-1 space-y-0.5">
                        {option.cons.map((con) => (
                          <li key={con} className="flex gap-1 text-xs text-muted-foreground">
                            <span className="text-destructive">−</span>
                            {con}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </WSBlock>

            <WSBlock label="Constraints, wants & fears">
              <dl
                className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2"
                data-shell-slot="decision-context"
              >
                {decisionContexts.map((context, index) => (
                  <div
                    key={context?.label ?? `empty-decision-context-${index}`}
                    className="flex gap-2 text-[13px]"
                    data-shell-item="decision-context-row"
                  >
                    <dt className="w-24 shrink-0 text-muted-foreground">
                      {context?.label || `Context ${index + 1}`}
                    </dt>
                    <dd className="text-foreground">
                      {context?.value ||
                        (isLoading ? "Loading context…" : "Not enough information yet.")}
                    </dd>
                  </div>
                ))}
              </dl>
            </WSBlock>

            <WSBlock label="Relevant background / context">
              <div
                className="flex flex-wrap gap-1.5"
                data-shell-slot="decision-related-context"
              >
                {contextSlots.map((context, index) => (
                  <button
                    key={context?.id ?? `empty-context-${index}`}
                    type="button"
                    onClick={context ? () => select(context.id) : undefined}
                    disabled={!context}
                    data-shell-item="decision-context-chip"
                    data-live-object-id={context?.id}
                    className="disabled:cursor-default disabled:opacity-70"
                  >
                    <Chip
                      tone="neutral"
                      className={context ? "cursor-pointer hover:opacity-80" : ""}
                    >
                      {context?.title ||
                        (isLoading ? "Loading background…" : "No background item available")}
                    </Chip>
                  </button>
                ))}
              </div>
            </WSBlock>

            <WSBlock label="Related receipts">
              <div className="space-y-1.5" data-shell-slot="decision-receipts">
                {receiptSlots.map((receipt, index) => (
                  <button
                    key={receipt?.id ?? `empty-receipt-${index}`}
                    type="button"
                    onClick={receipt ? () => select(receipt.id) : undefined}
                    disabled={!receipt}
                    data-shell-item="decision-receipt-row"
                    data-live-object-id={receipt?.id}
                    className="o-calm block w-full rounded-[9px] rounded-l-sm border-l-2 border-primary/50 bg-secondary/50 px-2.5 py-1.5 text-left text-[13px] italic text-foreground hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
                  >
                    “
                    {receipt?.title ||
                      (isLoading ? "Loading receipt…" : "No related receipt is available.")}
                    ”
                  </button>
                ))}
              </div>
            </WSBlock>

            <WSBlock label="Projection">
              <p>
                {decision?.projection ||
                  (isLoading ? "Loading projection…" : "No projection is available.")}
              </p>
              <p className="mt-1 text-xs">
                <span className="text-muted-foreground">Confidence: </span>
                <span className="font-medium text-foreground">
                  {decision?.confidence || (isLoading ? "Loading" : "Unavailable")}
                </span>
              </p>
            </WSBlock>

            {/* outcome / reveal */}
            <div
              className="o-material mt-5 rounded-[10px] p-4"
              data-shell-slot="decision-outcome"
            >
              <SectionLabel>Outcome &amp; what it reveals</SectionLabel>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {decision?.outcomeWindow ||
                  (isLoading ? "Loading review window…" : "No review window is available.")}
              </p>
              {decision?.actualOutcome ? (
                <p className="mt-1.5 text-[13px]">
                  <span className="text-muted-foreground">What happened: </span>
                  {decision.actualOutcome}
                </p>
              ) : (
                <button
                  type="button"
                  disabled
                  data-shell-item="decision-outcome-action"
                  className="mt-2 inline-flex cursor-default items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground opacity-70"
                >
                  Add outcome
                </button>
              )}
            </div>

            {/* actions */}
            <div className="mt-5 flex flex-wrap gap-1.5" data-shell-slot="decision-actions">
              <button
                type="button"
                onClick={() => setPage("explore")}
                data-shell-item="decision-workspace-action"
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
              >
                <MessageSquare className="size-3.5 text-primary" aria-hidden />
                Talk through in Explore
              </button>
              <button
                type="button"
                onClick={
                  decision
                    ? () => {
                        select(decision.id)
                        setInspectorTab("movement")
                      }
                    : undefined
                }
                disabled={!decision}
                data-shell-item="decision-workspace-action"
                data-live-object-id={decision?.id}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
              >
                What this reveals
              </button>
              <button
                type="button"
                onClick={
                  reportAvailable && reportId ? () => openReport(reportId) : undefined
                }
                disabled={!reportAvailable}
                data-shell-item="decision-workspace-action"
                data-live-object-id={reportAvailable ? reportId : undefined}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
              >
                Generate Decision Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WSBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  )
}
