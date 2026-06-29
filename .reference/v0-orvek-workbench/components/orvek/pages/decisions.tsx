"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { getObject, getObjects } from "@/lib/orvek-data"
import { useWorkbench } from "../store"
import { Chip, SectionLabel } from "../primitives"
import { ArrowRight, Check, GitBranch, MessageSquare, Scale, Send } from "lucide-react"

const LISTS: { heading: string; ids: string[]; tone?: "action" }[] = [
  { heading: "Active", ids: ["d1", "d2", "d3"] },
  { heading: "Chosen", ids: ["d-public"] },
  { heading: "Outcome due", ids: ["d-nav"], tone: "action" },
  { heading: "Reviewed", ids: ["d-rev-1", "d-rev-2", "d-rev-3"] },
]

const STAGES = ["Active", "Chosen", "Outcome due", "Reviewed", "Model update"]

export function DecisionsPage() {
  const { select, setPage, openReport, setInspectorTab } = useWorkbench()
  const [workspaceId, setWorkspaceId] = useState("d1")
  const [outcomeAdded, setOutcomeAdded] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState("")

  const decision = getObject(workspaceId)!
  const receipts = getObjects(decision.receiptIds)
  const contexts = getObjects(decision.contextIds)

  function openDecision(id: string) {
    setWorkspaceId(id)
    select(id)
  }

  // crude stage detection for the progression strip
  const stageIndex = decision.actualOutcome
    ? 4
    : /outcome due/i.test(decision.tags?.join(" ") ?? "")
      ? 2
      : decision.outcomeWindow
        ? 1
        : 0

  return (
    <div className="flex h-full min-h-0 flex-col">
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
            <span className="font-medium text-action-foreground">2</span> outcomes due ·{" "}
            <span className="font-medium text-foreground">12</span> reviewed
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
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  if (a.label === "Review due decision") openDecision("d-nav")
                  if (a.label === "Add outcome")
                    setOutcomeAdded((p) => ({ ...p, [workspaceId]: true }))
                }}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.12)] hover:bg-accent/60"
              >
                <a.icon className="size-3.5 text-primary" aria-hidden />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* master-detail */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* left list — soft embedded rail */}
        <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-3 py-4 lg:mr-1.5">
          {LISTS.map((group) => (
            <div key={group.heading} className="mb-4">
              <div className="flex items-center gap-1.5 px-2">
                <SectionLabel className={group.tone === "action" ? "text-action-foreground" : ""}>
                  {group.heading}
                </SectionLabel>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {group.ids.length}
                </span>
              </div>
              <div className="mt-1.5 space-y-0.5">
                {group.ids.map((id) => {
                  const d = getObject(id)!
                  const active = workspaceId === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => openDecision(id)}
                      className={cn(
                        "o-calm flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] leading-snug",
                        active
                          ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                          : "text-foreground hover:bg-card/60",
                      )}
                    >
                      {active && <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" />}
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      {group.tone === "action" && (
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
        <div className="min-h-0 overflow-y-auto px-6 py-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            {/* lifecycle stepper */}
            <div className="o-material mb-5 flex items-center rounded-[10px] px-3 py-2.5">
              {STAGES.map((s, i) => {
                const done = i < stageIndex
                const current = i === stageIndex
                return (
                  <div key={s} className="flex flex-1 items-center last:flex-none">
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
              {decision.title}
            </h2>
            {decision.summary && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {decision.summary}
              </p>
            )}

            {decision.recommendation && (
              <div className="mt-4 rounded-lg border-l-2 border-primary bg-evidence-muted/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  What Orvek would choose
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-foreground">
                  {decision.recommendation}
                </p>
              </div>
            )}

            {decision.options && (
              <WSBlock label="Options">
                <div className="o-material grid divide-y divide-border overflow-hidden rounded-[10px] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {decision.options.map((opt) => (
                    <div key={opt.label} className="p-3.5">
                      <p className="text-[13px] font-medium text-foreground">
                        <span className="mr-1 inline-flex size-4 items-center justify-center rounded-[5px] bg-evidence-muted text-[10px] font-bold text-primary">
                          {opt.label}
                        </span>
                        {opt.text}
                      </p>
                      {opt.pros && (
                        <ul className="mt-2 space-y-0.5">
                          {opt.pros.map((p) => (
                            <li key={p} className="flex gap-1 text-xs text-foreground">
                              <span className="text-primary">+</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      )}
                      {opt.cons && (
                        <ul className="mt-1 space-y-0.5">
                          {opt.cons.map((c) => (
                            <li key={c} className="flex gap-1 text-xs text-muted-foreground">
                              <span className="text-destructive">−</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </WSBlock>
            )}

            {decision.decisionContext && (
              <WSBlock label="Constraints, wants & fears">
                <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {decision.decisionContext.map((c) => (
                    <div key={c.label} className="flex gap-2 text-[13px]">
                      <dt className="w-24 shrink-0 text-muted-foreground">{c.label}</dt>
                      <dd className="text-foreground">{c.value}</dd>
                    </div>
                  ))}
                </dl>
              </WSBlock>
            )}

            {contexts.length > 0 && (
              <WSBlock label="Relevant background / context">
                <div className="flex flex-wrap gap-1.5">
                  {contexts.map((c) => (
                    <button key={c.id} type="button" onClick={() => select(c.id)}>
                      <Chip tone="neutral" className="cursor-pointer hover:opacity-80">
                        {c.title}
                      </Chip>
                    </button>
                  ))}
                </div>
              </WSBlock>
            )}

            {receipts.length > 0 && (
              <WSBlock label="Related receipts">
                <div className="space-y-1.5">
                  {receipts.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => select(r.id)}
                      className="o-calm block w-full rounded-[9px] rounded-l-sm border-l-2 border-primary/50 bg-secondary/50 px-2.5 py-1.5 text-left text-[13px] italic text-foreground hover:bg-accent/60"
                    >
                      “{r.title}”
                    </button>
                  ))}
                </div>
              </WSBlock>
            )}

            {decision.projection && (
              <WSBlock label="Projection">
                <p>{decision.projection}</p>
                {decision.confidence && (
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">Confidence: </span>
                    <span className="font-medium text-foreground">{decision.confidence}</span>
                  </p>
                )}
              </WSBlock>
            )}

            {/* outcome / reveal */}
            <div className="o-material mt-5 rounded-[10px] p-4">
              <SectionLabel>Outcome &amp; what it reveals</SectionLabel>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {decision.outcomeWindow ?? "Reviewed."}
              </p>
              {decision.actualOutcome && (
                <p className="mt-1.5 text-[13px]">
                  <span className="text-muted-foreground">What happened: </span>
                  {decision.actualOutcome}
                </p>
              )}
              {!decision.actualOutcome &&
                (outcomeAdded[workspaceId] ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-primary">
                    <Check className="size-4" /> Outcome recorded — Orvek will fold it into the
                    model.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOutcomeAdded((p) => ({ ...p, [workspaceId]: true }))}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90"
                  >
                    Add outcome
                  </button>
                ))}
            </div>

            {/* actions */}
            <div className="mt-5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPage("explore")}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
              >
                <MessageSquare className="size-3.5 text-primary" aria-hidden />
                Talk through in Explore
              </button>
              <button
                type="button"
                onClick={() => {
                  select(workspaceId)
                  setInspectorTab("movement")
                }}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
              >
                What this reveals
              </button>
              <button
                type="button"
                onClick={() => openReport("rep-decision")}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
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
