"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { isProductionDisplay, ORVEK_DEFERRED_ACTION_CLASS } from "@/lib/orvek-v0/display-contract"
import {
  isTodayReentryHref,
  resolveTodayNowRowTarget,
} from "@/lib/orvek-v0/today-workbench-routes"
import { useWorkbench } from "@/components/orvek-v0/store"
import { SectionLabel } from "@/components/orvek-v0/primitives"
import {
  TODAY_ATTENTION_EMPTY_COPY,
  TODAY_PRIMARY_EMPTY_COPY,
} from "@/lib/today-reentry"
import type { V0NowRowIcon, V0PrimaryAction } from "@/lib/orvek-adapters/types"
import { cn } from "@/lib/utils"
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

const PRIMARY_ACTION_ICONS: Record<string, LucideIcon> = {
  "Continue from what changed": ArrowRight,
  "Add what happened": Plus,
  "Review outcome": FileText,
  "Check in on fieldwork": BellRing,
  "Capture new signal": Telescope,
}

const NOW_ROW_ICONS: Record<V0NowRowIcon, LucideIcon> = {
  watch: BellRing,
  fieldwork: Telescope,
  decision: FileText,
  question: CircleHelp,
  movement: GitCompareArrows,
}

/* reference mock — not used in production */
const REFERENCE_PRIMARY_ACTIONS: { label: string; primary?: boolean; icon?: LucideIcon }[] = [
  { label: "Continue from what changed", primary: true, icon: ArrowRight },
  { label: "Add what happened", icon: Plus },
  { label: "Review outcome", icon: FileText },
  { label: "Check in on fieldwork", icon: BellRing },
  { label: "Capture new signal", icon: Telescope },
]

interface ReferenceNowRow {
  id: string
  kicker: string
  icon: LucideIcon
  title: string
  status: string
}

const REFERENCE_NOW_ROWS: ReferenceNowRow[] = [
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

interface ReferenceMovement {
  id: string
  previous: string
  evidence: string
  updated: string
}

const REFERENCE_MOVEMENTS: ReferenceMovement[] = [
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

const REFERENCE_RESURFACED = ["r6", "r5", "r2"]

function primaryActionClassName(primary?: boolean) {
  return primary
    ? "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:brightness-[1.05]"
    : "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent/60"
}

export function TodayPage() {
  const router = useRouter()
  const data = useOrvekData()
  const { getObject, getObjects, todayCopy, todayResurfacedIds, today, emptyCopyBySlot, todayIsLoading } =
    data
  const isProduction = isProductionDisplay(data)
  const { select, openReport } = useWorkbench()

  const productionHero = isProduction ? today?.hero ?? null : null
  const referenceLead = isProduction ? undefined : getObject("d1")
  const resurfacedReceipts = getObjects(
    isProduction ? (todayResurfacedIds ?? []) : (todayResurfacedIds ?? REFERENCE_RESURFACED),
  )
  const reportPrimaryMovementId =
    isProduction && today?.report?.primaryMovement ? today.report.primaryMovement.id : null
  const additionalMovements =
    isProduction && today?.movements
      ? today.movements.filter((m) => m.id !== reportPrimaryMovementId)
      : (today?.movements ?? [])

  function isInspectableObject(objectId: string): boolean {
    const obj = getObject(objectId)
    return Boolean(obj?.inspectorObjectType && (obj.inspectorObjectId ?? obj.id))
  }

  function openInspectorSelection(objectId: string, tab: "evidence" | "movement") {
    select(objectId, tab)
  }

  function seeWhy(id: string) {
    openInspectorSelection(id, "movement")
  }

  function handleNowRowActivate(row: {
    id: string
    href: string | null
    hasSelection: boolean
    inspectorTab: "evidence" | "movement" | null
  }) {
    const target = resolveTodayNowRowTarget({
      href: row.href,
      hasSelection: row.hasSelection,
      hasRegisteredSelection: Boolean(getObject(row.id)),
    })
    if (target?.kind === "route") {
      router.push(target.href)
      return
    }
    if (target?.kind === "inspect") {
      openInspectorSelection(row.id, row.inspectorTab ?? "evidence")
    }
  }

  function isNowRowInteractive(row: {
    id: string
    href: string | null
    hasSelection: boolean
  }): boolean {
    if (!isProduction) {
      return true
    }
    return (
      resolveTodayNowRowTarget({
        href: row.href,
        hasSelection: row.hasSelection,
        hasRegisteredSelection: Boolean(getObject(row.id)),
      }) !== null
    )
  }

  const heroEmptyCopy =
    emptyCopyBySlot?.todayHeroEmpty ?? today?.heroEmptyCopy ?? TODAY_PRIMARY_EMPTY_COPY
  const nowEmptyCopy =
    emptyCopyBySlot?.todayNowEmpty ?? today?.nowEmptyCopy ?? TODAY_ATTENTION_EMPTY_COPY
  const reportEmptyCopy =
    emptyCopyBySlot?.todayReportEmpty ??
    today?.movementEmptyCopy ??
    "No published movement to show yet."

  return (
    <div className="px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {todayCopy?.briefingLine ?? "Tuesday · since your last visit"}
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-foreground text-balance">
          {todayCopy?.briefingTitle ?? (isProduction ? "Today" : "Your model moved in 3 places.")}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {todayCopy?.briefingMeta ??
            (isProduction
              ? heroEmptyCopy
              : "2 reviews are due and 1 report is ready. Start where the change is most consequential.")}
        </p>
        {isProduction && todayIsLoading && (
          <p className="mt-2 text-[13px] text-muted-foreground">Loading today…</p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {(productionHero || referenceLead || isProduction) ? (
              <div className="o-raised overflow-hidden rounded-2xl ring-1 ring-inset ring-action/20">
                <div className="bg-action-muted/50 px-5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
                    <BellRing className="size-3.5" aria-hidden />
                    {isProduction
                      ? productionHero
                        ? `${productionHero.kicker}${productionHero.whatChanged ? ` · ${productionHero.whatChanged}` : ""}`
                        : "Most consequential now"
                      : "Most consequential now · decision outcome due"}
                  </span>
                </div>
                <div className="p-5">
                  {isProduction ? (
                    productionHero ? (
                      <>
                        <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty">
                          {productionHero.title}
                        </h2>
                        {productionHero.summary ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {productionHero.summary}
                          </p>
                        ) : null}
                        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 px-3 py-3">
                          <div>
                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              What changed
                            </dt>
                            <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                              {productionHero.whatChanged}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Linked receipts
                            </dt>
                            <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                              {productionHero.linkedReceipts}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Last evidence
                            </dt>
                            <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                              {productionHero.lastEvidence}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {productionHero.primaryAction?.kind === "link" ? (
                            <Link
                              href={productionHero.primaryAction.href}
                              className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98]"
                            >
                              {productionHero.primaryAction.label}
                              <ArrowRight className="size-4" aria-hidden />
                            </Link>
                          ) : productionHero.primaryAction?.kind === "inspect" &&
                            productionHero.inspectSelectId ? (
                            <button
                              type="button"
                              onClick={() =>
                                openInspectorSelection(
                                  productionHero.inspectSelectId!,
                                  productionHero.movementId ? "movement" : "evidence"
                                )
                              }
                              className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98]"
                            >
                              Open in Inspector
                              <ArrowRight className="size-4" aria-hidden />
                            </button>
                          ) : null}
                          {productionHero.showSeeWhyMoved && productionHero.movementId ? (
                            <button
                              type="button"
                              onClick={() => seeWhy(productionHero.movementId!)}
                              className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-3 py-2 text-sm font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)] hover:bg-accent/60"
                            >
                              <GitCompareArrows className="size-4 text-primary" aria-hidden />
                              See why it moved
                            </button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty">
                          {heroEmptyCopy}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          Priority cards appear when a decision outcome or surfaced signal needs
                          review.
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
                    )
                  ) : referenceLead ? (
                    <>
                      <button
                        type="button"
                        onClick={() => select(referenceLead.id)}
                        className="text-left"
                      >
                        <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty hover:text-primary">
                          {referenceLead.title}
                        </h2>
                      </button>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        You set a review window after choosing to prototype the architecture first.
                        Recording what happened is what lets Orvek tell whether the scope-reopening
                        loop actually eased.
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
                            {referenceLead.evidenceCount ?? 6} receipts
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Last evidence
                          </dt>
                          <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                            2 hours ago
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => select(referenceLead.id)}
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
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {isProduction
                ? (today?.primaryActions ?? []).map((action: V0PrimaryAction) => {
                    const Icon = PRIMARY_ACTION_ICONS[action.label]
                    const className = primaryActionClassName(action.primary)
                    if (action.disabled || !isTodayReentryHref(action.href)) {
                      return (
                        <button
                          key={action.label}
                          type="button"
                          disabled
                          title="Not available on a live v0 route yet"
                          className={cn(className, ORVEK_DEFERRED_ACTION_CLASS)}
                        >
                          {Icon ? (
                            <Icon
                              className={action.primary ? "size-3.5" : "size-3.5 text-primary"}
                              aria-hidden
                            />
                          ) : null}
                          {action.label}
                        </button>
                      )
                    }
                    return (
                      <Link key={action.label} href={action.href} className={className}>
                        {Icon ? (
                          <Icon
                            className={action.primary ? "size-3.5" : "size-3.5 text-primary"}
                            aria-hidden
                          />
                        ) : null}
                        {action.label}
                      </Link>
                    )
                  })
                : REFERENCE_PRIMARY_ACTIONS.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => select("d1")}
                        className={primaryActionClassName(action.primary)}
                      >
                        {Icon ? (
                          <Icon
                            className={action.primary ? "size-3.5" : "size-3.5 text-primary"}
                            aria-hidden
                          />
                        ) : null}
                        {action.label}
                      </button>
                    )
                  })}
            </div>

            <SectionLabel className="mb-2 mt-8">Now</SectionLabel>
            <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
              {isProduction ? (
                today?.nowRows.length ? (
                  today.nowRows.map((row) => {
                    const Icon = NOW_ROW_ICONS[row.icon] ?? BellRing
                    const interactive = isNowRowInteractive(row)
                    const rowBody = (
                      <>
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
                        {interactive ? (
                          <ArrowRight
                            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                            aria-hidden
                          />
                        ) : null}
                      </>
                    )
                    const className = cn(
                      "group flex w-full items-center gap-3.5 px-4 py-3 text-left",
                      interactive
                        ? "o-calm hover:bg-accent/40"
                        : "cursor-default opacity-70"
                    )

                    if (!interactive) {
                      return (
                        <div key={row.id} className={className}>
                          {rowBody}
                        </div>
                      )
                    }

                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => handleNowRowActivate(row)}
                        className={className}
                      >
                        {rowBody}
                      </button>
                    )
                  })
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">{nowEmptyCopy}</p>
                )
              ) : (
                REFERENCE_NOW_ROWS.map((row) => {
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

            {isProduction ? (
              <section className="mt-8" data-testid="today-what-changed-output">
                <div className="mb-2 flex items-center gap-1.5">
                  <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
                  <SectionLabel>{today?.report?.title ?? "What Changed"}</SectionLabel>
                </div>
                {today?.report ? (
                  <div className="o-float overflow-hidden rounded-2xl">
                    <div className="bg-evidence-muted/40 px-5 py-3 ring-1 ring-inset ring-primary/15">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
                        {today.report.meta}
                      </span>
                    </div>
                    <div className="space-y-4 p-5">
                      {today.report.primaryMovement ? (
                        (() => {
                          const movement = today.report.primaryMovement!
                          const selectId = movement.inspectSelectId
                          const registered = isInspectableObject(selectId)
                          const body = (
                            <>
                              <p className="text-[15px] font-medium leading-snug text-foreground text-pretty">
                                {movement.summary}
                              </p>
                              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-muted-foreground">
                                <ScrollText
                                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                                  aria-hidden
                                />
                                {movement.evidence}
                              </p>
                              {registered ? (
                                <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary">
                                  Open in Inspector
                                  <ArrowUpRight className="size-3.5" aria-hidden />
                                </span>
                              ) : null}
                            </>
                          )
                          return registered ? (
                            <button
                              type="button"
                              onClick={() => openInspectorSelection(selectId, "movement")}
                              className="o-calm w-full rounded-[10px] bg-secondary/40 px-4 py-3 text-left hover:bg-accent/40"
                            >
                              {body}
                            </button>
                          ) : (
                            <div className="rounded-[10px] bg-secondary/40 px-4 py-3">{body}</div>
                          )
                        })()
                      ) : null}
                      {today.report.fullReportAvailable ? (
                        <Link
                          href={today.report.href}
                          className="o-calm inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                        >
                          {today.report.fullReportLabel}
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      ) : (
                        <p
                          className={cn(
                            "text-[13px] text-muted-foreground",
                            ORVEK_DEFERRED_ACTION_CLASS
                          )}
                          data-testid="today-full-report-deferred"
                        >
                          {today.report.fullReportDeferredCopy}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                    {reportEmptyCopy}
                  </div>
                )}
              </section>
            ) : null}

            {(isProduction ? additionalMovements.length > 0 : true) ? (
            <>
            <div className="mb-2 mt-8 flex items-center gap-1.5">
              <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
              <SectionLabel>Recent model movement</SectionLabel>
            </div>
            <div className="space-y-2.5">
              {isProduction ? (
                additionalMovements.length ? (
                  additionalMovements.map((m) => (
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
                REFERENCE_MOVEMENTS.map((m) => (
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
            </>
            ) : null}
          </div>

          <aside className="min-w-0 lg:sticky lg:top-2 lg:self-start">
            {!isProduction ? (
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
            ) : null}

            <div className={cn("mb-2 flex items-center gap-1.5", isProduction ? "mt-0" : "mt-7")}>
              <ScrollText className="size-3.5 text-primary" aria-hidden />
              <SectionLabel>Receipts resurfaced</SectionLabel>
            </div>
            <div className="o-material space-y-px overflow-hidden rounded-[10px]">
              {resurfacedReceipts.length > 0 ? (
                resurfacedReceipts.map((r) => {
                  const inspectable = !isProduction || isInspectableObject(r.id)
                  const rowBody = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] italic leading-relaxed text-foreground">
                          “{r.sourceText ?? r.title}”
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {r.sourceOrigin ?? "Receipt"} · {r.date ?? r.lastUpdated}
                        </span>
                      </span>
                      {inspectable ? (
                        <ArrowRight
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      ) : null}
                    </>
                  )

                  if (!inspectable) {
                    return (
                      <div
                        key={r.id}
                        className="flex w-full items-start gap-3 border-l-2 border-border/60 px-4 py-2.5 text-left"
                      >
                        {rowBody}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        isProduction
                          ? openInspectorSelection(r.id, "evidence")
                          : select(r.id)
                      }
                      className="o-calm flex w-full items-start gap-3 border-l-2 border-primary/50 px-4 py-2.5 text-left hover:bg-accent/40"
                    >
                      {rowBody}
                    </button>
                  )
                })
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
