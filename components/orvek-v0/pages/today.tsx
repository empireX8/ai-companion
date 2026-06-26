"use client"

import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { isProductionDisplay } from "@/lib/orvek-v0/display-contract"
import { useWorkbench } from "@/components/orvek-v0/store"
import { SectionLabel } from "@/components/orvek-v0/primitives"
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CircleHelp,
  FileText,
  GitCompareArrows,
  Plus,
  ScrollText,
  Telescope,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/* primary re-entry actions */
const PRIMARY_ACTIONS: { label: string; primary?: boolean; icon?: LucideIcon }[] = [
  { label: "Continue from what changed", primary: true, icon: ArrowRight },
  { label: "Add what happened", icon: Plus },
  { label: "Review outcome", icon: FileText },
  { label: "Check in on fieldwork", icon: BellRing },
  { label: "Capture new signal", icon: Telescope },
]

interface NowRow {
  id: string
  kicker: string
  icon: LucideIcon
  title: string
  status: string
}

const NOW_ROWS: NowRow[] = [
  {
    id: "m-loop-1",
    kicker: "Watch For",
    icon: BellRing,
    title: "Scope-reopening pattern triggered again",
    status: "Active",
  },
  {
    id: "f1",
    kicker: "Fieldwork",
    icon: Telescope,
    title: "Small public test — narrow version before reopening",
    status: "Due today",
  },
  {
    id: "d1",
    kicker: "Outcome review",
    icon: FileText,
    title: "Ship prototype or keep refining architecture?",
    status: "Review due",
  },
  {
    id: "aq-3",
    kicker: "Open question",
    icon: CircleHelp,
    title: "Which features are essential for a first version?",
    status: "Needs input",
  },
]

/* recent model movement (previous → new evidence → updated) */
interface Movement {
  id: string
  previous: string
  evidence: string
  updated: string
}

const MOVEMENTS: Movement[] = [
  {
    id: "mu-1",
    previous: "Decision pressure was treated as an isolated state.",
    evidence: "6 receipts tied pressure to repeated scope reopening.",
    updated: "Pressure is now modeled as an output of the scope-reopening loop.",
  },
  {
    id: "mu-2",
    previous: "Background context was held as loose metadata.",
    evidence: "Recent captures referenced current build constraints directly.",
    updated: "Context Profile promoted to a first-class, correctable model layer.",
  },
  {
    id: "aq-1",
    previous: "Avoidance read as a general tendency under pressure.",
    evidence: "A decision review added social-consequence detail.",
    updated: "Avoidance appears strongest when social consequence is uncertain.",
  },
]

/* resurfaced receipts */
const RESURFACED = ["r6", "r5", "r2"]

export function TodayPage() {
  const data = useOrvekData()
  const { getObject, getObjects, todayCopy, todayResurfacedIds, today, emptyCopyBySlot, todayIsLoading } = data
  const isProduction = isProductionDisplay(data)
  const { select, openReport, setInspectorTab } = useWorkbench()

  const lead = isProduction ? undefined : getObject("d1")
  const resurfacedReceipts = getObjects(
    isProduction ? (todayResurfacedIds ?? []) : (todayResurfacedIds ?? RESURFACED),
  )

  function seeWhy(id: string) {
    select(id)
    setInspectorTab("movement")
  }

  return (
    <div className="px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* briefing header */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {todayCopy?.briefingLine ?? "Tuesday · since your last visit"}
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-foreground text-balance">
          {todayCopy?.briefingTitle ??
            (isProduction ? "Today" : "Your model moved in 3 places.")}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {todayCopy?.briefingMeta ??
            (isProduction
              ? emptyCopyBySlot?.todayHeroEmpty ?? "Nothing needs attention in this window yet."
              : "2 reviews are due and 1 report is ready. Start where the change is most consequential.")}
        </p>
        {isProduction && todayIsLoading && (
          <p className="mt-2 text-[13px] text-muted-foreground">Loading today…</p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* ── primary column ───────────────────────────── */}
          <div className="min-w-0">
        {/* dominant priority */}
        {(lead || isProduction) ? (
        <div className="o-raised overflow-hidden rounded-2xl ring-1 ring-inset ring-action/20">
          <div className="bg-action-muted/50 px-5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
              <BellRing className="size-3.5" aria-hidden />
              Most consequential now · decision outcome due
            </span>
          </div>
          <div className="p-5">
            {lead ? (
              <>
            <button
              type="button"
              onClick={() => select(lead.id)}
              className="text-left"
            >
              <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty hover:text-primary">
                {lead.title}
              </h2>
            </button>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              You set a review window after choosing to prototype the architecture first. Recording
              what happened is what lets Orvek tell whether the scope-reopening loop actually eased.
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 px-3 py-3">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  What changed
                </dt>
                <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                  Outcome window closed
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Linked receipts
                </dt>
                <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                  {lead.evidenceCount ?? 6} receipts
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Last evidence
                </dt>
                <dd className="mt-0.5 text-[13px] font-medium text-foreground">2 hours ago</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => select(lead.id)}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98]"
              >
                Add outcome
                <ArrowRight className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => seeWhy("mu-1")}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-3 py-2 text-sm font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)] hover:bg-accent/60"
              >
                <GitCompareArrows className="size-4 text-primary" aria-hidden />
                See why it moved
              </button>
            </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty">
                  {emptyCopyBySlot?.todayHeroEmpty ?? "Nothing needs attention in this window yet."}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Priority cards appear when a decision outcome or surfaced signal needs review.
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 px-3 py-3">
                  {["What changed", "Linked receipts", "Last evidence"].map((label) => (
                    <div key={label}>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">—</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>
        ) : null}

        {/* primary actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PRIMARY_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => select("d1")}
                className={
                  a.primary
                    ? "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:brightness-[1.05]"
                    : "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent/60"
                }
              >
                {Icon && (
                  <Icon
                    className={a.primary ? "size-3.5" : "size-3.5 text-primary"}
                    aria-hidden
                  />
                )}
                {a.label}
              </button>
            )
          })}
        </div>

        {/* Now */}
        <SectionLabel className="mb-2 mt-8">Now</SectionLabel>
        <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
          {isProduction ? (
            today?.nowRows.length ? (
              today.nowRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => select(row.id)}
                  className="o-calm group flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-accent/40"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                    <BellRing className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.kicker}
                    </span>
                    <span className="block truncate text-[14px] font-medium text-foreground">
                      {row.title}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-medium text-action-foreground ring-1 ring-inset ring-action/15">
                    {row.status}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {emptyCopyBySlot?.todayNowEmpty ?? today?.nowEmptyCopy ?? "Nothing in Now yet."}
              </p>
            )
          ) : (
          NOW_ROWS.map((row) => {
            const Icon = row.icon
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => select(row.id)}
                className="o-calm group flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-accent/40"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.kicker}
                  </span>
                  <span className="block truncate text-[14px] font-medium text-foreground">
                    {row.title}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-medium text-action-foreground ring-1 ring-inset ring-action/15">
                  {row.status}
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                  aria-hidden
                />
              </button>
            )
          })
          )}
        </div>

        {/* Recent model movement */}
        <div className="mb-2 mt-8 flex items-center gap-1.5">
          <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
          <SectionLabel>Recent model movement</SectionLabel>
        </div>
        <div className="space-y-2.5">
          {isProduction ? (
            today?.movements.length ? (
              today.movements.map((m) => (
                <div key={m.id} className="o-material rounded-[10px] p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                    <div className="rounded-[10px] bg-muted/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Previously
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                        {m.previous ??
                          emptyCopyBySlot?.todayPriorReadEmpty ??
                          "Prior read unavailable."}
                      </p>
                    </div>
                    <div className="hidden items-center justify-center sm:flex">
                      <ArrowRight className="size-4 text-primary" aria-hidden />
                    </div>
                    <div className="rounded-[10px] bg-evidence-muted/70 px-3 py-2 ring-1 ring-inset ring-primary/15">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Updated understanding
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                        {m.updated}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                      <ScrollText className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      {m.evidence}
                    </p>
                    <button
                      type="button"
                      onClick={() => seeWhy(m.id)}
                      className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                    >
                      See why
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="o-material rounded-[10px] p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                  <div className="rounded-[10px] bg-muted/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Previously
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                      {emptyCopyBySlot?.todayPriorReadEmpty ?? "Prior read unavailable."}
                    </p>
                  </div>
                  <div className="hidden items-center justify-center sm:flex">
                    <ArrowRight className="size-4 text-primary" aria-hidden />
                  </div>
                  <div className="rounded-[10px] bg-evidence-muted/70 px-3 py-2 ring-1 ring-inset ring-primary/15">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Updated understanding
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                      {emptyCopyBySlot?.todayMovementEmpty ??
                        today?.movementEmptyCopy ??
                        "No recent movement in this window."}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
          MOVEMENTS.map((m) => (
            <div key={m.id} className="o-material rounded-[10px] p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                <div className="rounded-[10px] bg-muted/70 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Previously
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                    {m.previous}
                  </p>
                </div>
                <div className="hidden items-center justify-center sm:flex">
                  <ArrowRight className="size-4 text-primary" aria-hidden />
                </div>
                <div className="rounded-[10px] bg-evidence-muted/70 px-3 py-2 ring-1 ring-inset ring-primary/15">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Updated understanding
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                    {m.updated}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                  <ScrollText className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {m.evidence}
                </p>
                <button
                  type="button"
                  onClick={() => seeWhy(m.id)}
                  className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                >
                  See why
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))
          )}
        </div>

          </div>

          {/* ── side rail ───────────────────────────── */}
          <aside className="min-w-0 lg:sticky lg:top-2 lg:self-start">
        {/* report ready */}
        <button
          type="button"
          onClick={() => openReport("rep-weekly")}
          className="o-calm flex w-full items-center gap-3 rounded-2xl bg-evidence-muted/60 px-4 py-3 text-left ring-1 ring-inset ring-primary/15 hover:bg-evidence-muted"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
            <FileText className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-foreground">
              Weekly Model Movement report
            </span>
            <span className="block text-[12px] text-muted-foreground">
              Ready · 3 loops, 2 decisions, 1 context update
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
        </button>

        {/* Receipts resurfaced */}
        <div className="mb-2 mt-7 flex items-center gap-1.5">
          <ScrollText className="size-3.5 text-primary" aria-hidden />
          <SectionLabel>Receipts resurfaced</SectionLabel>
        </div>
        <div className="o-material space-y-px overflow-hidden rounded-[10px]">
          {resurfacedReceipts.length > 0 ? (
          resurfacedReceipts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => select(r.id)}
                className="o-calm flex w-full items-start gap-3 border-l-2 border-primary/50 px-4 py-2.5 text-left hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] italic leading-relaxed text-foreground">
                    “{r.sourceText ?? r.title}”
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {r.sourceOrigin ?? "Receipt"} · {r.date ?? r.lastUpdated}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
          ))
          ) : (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              {emptyCopyBySlot?.todayResurfacedEmpty ??
                "No receipts resurfaced in this window yet."}
            </p>
          )}
        </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
