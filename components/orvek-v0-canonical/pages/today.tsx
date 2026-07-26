"use client"

import { useCanonicalData } from "@/components/orvek-v0-canonical/canonical-data-context"
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

const PRIMARY_ACTION_SLOTS: {
  label: string
  primary?: boolean
  icon: LucideIcon
}[] = [
  { label: "Continue from what changed", primary: true, icon: ArrowRight },
  { label: "Add what happened", icon: Plus },
  { label: "Review outcome", icon: FileText },
  { label: "Check in on fieldwork", icon: BellRing },
  { label: "Capture new signal", icon: Telescope },
]

const NOW_SLOT_ICONS: LucideIcon[] = [BellRing, Telescope, FileText, CircleHelp]
const MOVEMENT_SLOT_COUNT = 3
const RECEIPT_SLOT_COUNT = 3

function permanentSlots<T>(items: readonly T[], count: number): (T | null)[] {
  return Array.from({ length: count }, (_, index) => items[index] ?? null)
}

export function TodayPage() {
  const { select, openReport, setInspectorTab } = useWorkbench()
  const { getObject, orvekDataApi, today } = useCanonicalData()
  const isLoading = orvekDataApi.todayIsLoading === true
  const lead = today.leadId ? getObject(today.leadId) : undefined
  const movementTarget = today.movements.find((movement) => Boolean(getObject(movement.id)))
  const reportObject = today.reportId ? getObject(today.reportId) : undefined
  const reportAvailable = Boolean(today.reportId && reportObject)

  const primaryActions = permanentSlots(today.primaryActions, PRIMARY_ACTION_SLOTS.length)
  const nowRows = permanentSlots(today.nowRows, NOW_SLOT_ICONS.length)
  const movements = permanentSlots(today.movements, MOVEMENT_SLOT_COUNT)
  const receipts = permanentSlots(
    today.resurfacedIds
      .map((id) => getObject(id))
      .filter((receipt): receipt is NonNullable<typeof receipt> => Boolean(receipt)),
    RECEIPT_SLOT_COUNT,
  )

  const briefingLine =
    today.briefingLine || (isLoading ? "Today · loading" : "Today · current state")
  const briefingTitle =
    today.briefingTitle || (isLoading ? "Loading today…" : "Current state")
  const briefingMeta =
    today.briefingMeta ||
    (isLoading ? "Loading current information…" : "Nothing currently needs your attention.")
  const leadKicker =
    today.leadKicker || (isLoading ? "Most consequential now · loading" : "Most consequential now")
  const leadTitle =
    lead?.title || (isLoading ? "Loading current item…" : "No current item is available.")
  const leadNarrative =
    today.leadNarrative ||
    (isLoading ? "Loading the latest supported information…" : "Not enough information yet.")
  const reportTitle =
    today.reportTitle ||
    (isLoading ? "Loading movement report…" : "No movement is ready for review.")
  const reportMeta =
    today.reportMeta || (isLoading ? "Loading current status…" : "Not enough information yet.")

  function seeWhy(id: string) {
    if (!getObject(id)) {
      return
    }
    select(id)
    setInspectorTab("movement")
  }

  return (
    <div className="px-6 py-7 lg:px-10" data-today-slot="page">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {briefingLine}
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-foreground text-balance">
          {briefingTitle}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {briefingMeta}
        </p>

        <div
          className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
          data-today-slot="two-column-grid"
        >
          <div className="min-w-0" data-today-slot="primary-column">
            <div
              className="o-raised overflow-hidden rounded-2xl ring-1 ring-inset ring-action/20"
              data-today-slot="lead-card"
            >
              <div className="bg-action-muted/50 px-5 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
                  <BellRing className="size-3.5" aria-hidden />
                  {leadKicker}
                </span>
              </div>
              <div className="p-5">
                <button
                  type="button"
                  onClick={lead ? () => select(lead.id) : undefined}
                  disabled={!lead}
                  data-today-item="lead-title-action"
                  data-live-object-id={lead?.id}
                  className="text-left disabled:cursor-default"
                >
                  <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty enabled:hover:text-primary">
                    {leadTitle}
                  </h2>
                </button>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {leadNarrative}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 px-3 py-3">
                  <div data-today-item="lead-metric">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      What changed
                    </dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                      {today.leadWhatChanged || (isLoading ? "Loading…" : "Unavailable")}
                    </dd>
                  </div>
                  <div data-today-item="lead-metric">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Linked receipts
                    </dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                      {lead?.evidenceCount != null
                        ? `${lead.evidenceCount} receipts`
                        : isLoading
                          ? "Loading…"
                          : "0 receipts"}
                    </dd>
                  </div>
                  <div data-today-item="lead-metric">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Last evidence
                    </dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                      {today.leadLastEvidence || (isLoading ? "Loading…" : "Unavailable")}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={lead ? () => select(lead.id) : undefined}
                    disabled={!lead}
                    data-today-item="lead-action"
                    data-live-object-id={lead?.id}
                    className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98] disabled:cursor-default disabled:opacity-70"
                  >
                    Add outcome
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={movementTarget ? () => seeWhy(movementTarget.id) : undefined}
                    disabled={!movementTarget}
                    data-today-item="lead-action"
                    data-live-object-id={movementTarget?.id}
                    className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-3 py-2 text-sm font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)] hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
                  >
                    <GitCompareArrows className="size-4 text-primary" aria-hidden />
                    See why it moved
                  </button>
                </div>
              </div>
            </div>

            <div
              className="mt-4 flex flex-wrap gap-2"
              data-today-slot="primary-actions"
            >
              {primaryActions.map((action, index) => {
                const fallback = PRIMARY_ACTION_SLOTS[index]!
                const Icon = action?.icon ?? fallback.icon
                const label = action?.label || fallback.label
                const primary = action?.primary ?? fallback.primary
                const interactive = Boolean(action && lead)

                return (
                  <button
                    key={`${index}-${label}`}
                    type="button"
                    onClick={interactive && lead ? () => select(lead.id) : undefined}
                    disabled={!interactive}
                    aria-label={label}
                    data-today-item="primary-action"
                    data-live-object-id={interactive ? lead?.id : undefined}
                    className={
                      primary
                        ? "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:brightness-[1.05] disabled:cursor-default disabled:opacity-70"
                        : "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent/60 disabled:cursor-default disabled:opacity-70"
                    }
                  >
                    <Icon
                      className={primary ? "size-3.5" : "size-3.5 text-primary"}
                      aria-hidden
                    />
                    {label}
                  </button>
                )
              })}
            </div>

            <section data-today-slot="now">
              <SectionLabel className="mb-2 mt-8">Now</SectionLabel>
              <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
                {nowRows.map((row, index) => {
                  const Icon = row?.icon ?? NOW_SLOT_ICONS[index]!
                  const rowObject = row ? getObject(row.id) : undefined
                  const interactive = Boolean(row && rowObject)
                  const kicker = row?.kicker || (isLoading ? "Loading" : "Current item")
                  const title =
                    row?.title ||
                    (isLoading ? "Loading current item…" : "No current item is available.")
                  const status = row?.status || (isLoading ? "Loading" : "Unavailable")

                  return (
                    <button
                      key={row ? row.id : `empty-now-slot-${index}`}
                      type="button"
                      onClick={interactive && row ? () => select(row.id) : undefined}
                      disabled={!interactive}
                      aria-label={`${kicker}: ${title}`}
                      data-today-item="now-row"
                      data-live-object-id={interactive ? row?.id : undefined}
                      className="o-calm group flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-accent/40 disabled:cursor-default disabled:opacity-70"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {kicker}
                        </span>
                        <span className="block truncate text-[14px] font-medium text-foreground">
                          {title}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-medium text-action-foreground ring-1 ring-inset ring-action/15">
                        {status}
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                        aria-hidden
                      />
                    </button>
                  )
                })}
              </div>
            </section>

            <section data-today-slot="movements">
              <div className="mb-2 mt-8 flex items-center gap-1.5">
                <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
                <SectionLabel>Recent model movement</SectionLabel>
              </div>
              <div className="space-y-2.5">
                {movements.map((movement, index) => {
                  const movementObject = movement ? getObject(movement.id) : undefined
                  const interactive = Boolean(movement && movementObject)

                  return (
                    <div
                      key={movement ? movement.id : `empty-movement-slot-${index}`}
                      className="o-material rounded-[10px] p-4"
                      data-today-item="movement-card"
                      data-live-object-id={interactive ? movement?.id : undefined}
                    >
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                        <div className="rounded-[10px] bg-muted/70 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Previously
                          </p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                            {movement?.previous ||
                              (isLoading ? "Loading prior information…" : "Not enough information yet.")}
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
                            {movement?.updated ||
                              (isLoading ? "Loading updated information…" : "No movement is ready for review.")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                          <ScrollText
                            className="mt-0.5 size-3.5 shrink-0 text-primary"
                            aria-hidden
                          />
                          {movement?.evidence ||
                            (isLoading ? "Loading evidence…" : "No recent evidence is available.")}
                        </p>
                        <button
                          type="button"
                          onClick={interactive && movement ? () => seeWhy(movement.id) : undefined}
                          disabled={!interactive}
                          data-today-item="movement-action"
                          data-live-object-id={interactive ? movement?.id : undefined}
                          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline disabled:cursor-default disabled:opacity-70"
                        >
                          See why
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <aside
            className="min-w-0 lg:sticky lg:top-2 lg:self-start"
            data-today-slot="side-rail"
          >
            <button
              type="button"
              onClick={reportAvailable ? () => openReport(today.reportId) : undefined}
              disabled={!reportAvailable}
              aria-label={reportTitle}
              data-today-slot="report-card"
              data-live-object-id={reportAvailable ? today.reportId : undefined}
              className="o-calm flex w-full items-center gap-3 rounded-2xl bg-evidence-muted/60 px-4 py-3 text-left ring-1 ring-inset ring-primary/15 hover:bg-evidence-muted disabled:cursor-default disabled:opacity-70"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <FileText className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground">
                  {reportTitle}
                </span>
                <span className="block text-[12px] text-muted-foreground">
                  {reportMeta}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
            </button>

            <section data-today-slot="receipts">
              <div className="mb-2 mt-7 flex items-center gap-1.5">
                <ScrollText className="size-3.5 text-primary" aria-hidden />
                <SectionLabel>Receipts resurfaced</SectionLabel>
              </div>
              <div className="o-material space-y-px overflow-hidden rounded-[10px]">
                {receipts.map((receipt, index) => {
                  const interactive = Boolean(receipt)
                  const quote =
                    receipt?.sourceText ||
                    receipt?.title ||
                    (isLoading ? "Loading receipt…" : "No recent receipts are available.")
                  const source = receipt?.sourceOrigin || "Receipt"
                  const date =
                    receipt?.date ||
                    receipt?.lastUpdated ||
                    (isLoading ? "loading" : "unavailable")

                  return (
                    <button
                      key={receipt ? receipt.id : `empty-receipt-slot-${index}`}
                      type="button"
                      onClick={receipt ? () => select(receipt.id) : undefined}
                      disabled={!interactive}
                      data-today-item="receipt-row"
                      data-live-object-id={receipt?.id}
                      className="o-calm flex w-full items-start gap-3 border-l-2 border-primary/50 px-4 py-2.5 text-left hover:bg-accent/40 disabled:cursor-default disabled:opacity-70"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] italic leading-relaxed text-foreground">
                          “{quote}”
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {source} · {date}
                        </span>
                      </span>
                      <ArrowRight
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  )
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
