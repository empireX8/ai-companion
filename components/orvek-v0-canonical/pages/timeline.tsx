"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useCanonicalData } from "@/components/orvek-v0-canonical/canonical-data-context"
import { minimumPermanentSlots } from "@/components/orvek-v0-canonical/permanent-presentation"
import { useWorkbench } from "@/components/orvek-v0/store"
import { SectionLabel } from "@/components/orvek-v0/primitives"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { Search } from "lucide-react"

const TIMELINE_GROUP_SHELLS = [
  { heading: "Today", minimumRows: 4 },
  { heading: "This week", minimumRows: 3 },
  { heading: "Last week", minimumRows: 4 },
  { heading: "Earlier", minimumRows: 3 },
  { heading: "Imported history", minimumRows: 1 },
]

const TIMELINE_FILTER_SHELL = [
  "All",
  "Model Updates",
  "Receipts",
  "Decisions",
  "Reports",
  "Fieldwork",
  "Context Profile",
  "Imports",
]

/** lane colour keyed off event type */
function lane(eventType: string): "evidence" | "action" | "decision" | "receipt" {
  const e = eventType.toLowerCase()
  if (/model|map|context/.test(e)) return "evidence"
  if (/report|fieldwork|import/.test(e)) return "action"
  if (/decision/.test(e)) return "decision"
  return "receipt"
}

const LANE_DOT: Record<string, string> = {
  evidence: "bg-primary",
  action: "bg-action",
  decision: "bg-foreground/60",
  receipt: "bg-muted-foreground",
}

const LANE_STRIPE: Record<string, string> = {
  evidence: "before:bg-primary",
  action: "before:bg-action",
  decision: "before:bg-foreground/50",
  receipt: "before:bg-muted-foreground/60",
}

function matches(filter: string, eventType: string, tags: string[]) {
  if (filter === "All") return true
  const hay = (eventType + " " + tags.join(" ")).toLowerCase()
  const key = filter.toLowerCase().replace(/s$/, "")
  return hay.includes(key.replace("context profile", "context"))
}

export function TimelinePage() {
  const { selectedId, select, setInspectorTab } = useWorkbench()
  const { getObject, timelineGroups, timelineFilters } = useCanonicalData()
  const data = useOrvekData()
  const [filter, setFilter] = useState("All")
  const [query, setQuery] = useState("")
  const isLoading = data.timelineIsLoading === true
  const filters =
    timelineFilters.length > 0 ? timelineFilters : TIMELINE_FILTER_SHELL
  const permanentGroups = [
    ...TIMELINE_GROUP_SHELLS.map((shell) => {
      const live = timelineGroups.find((group) => group.heading === shell.heading)
      return {
        ...shell,
        ids: minimumPermanentSlots(live?.ids, shell.minimumRows),
      }
    }),
    ...timelineGroups
      .filter(
        (group) => !TIMELINE_GROUP_SHELLS.some((shell) => shell.heading === group.heading),
      )
      .map((group) => ({
        ...group,
        minimumRows: 0,
        ids: minimumPermanentSlots(group.ids, 0),
      })),
  ]

  function openEvent(id: string) {
    select(id)
    const e = getObject(id)
    if (e?.before || e?.after) setInspectorTab("movement")
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-shell-page="timeline">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Timeline</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          How the model evolved — receipts, decisions, reports, fieldwork, and movement.
        </p>
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr]"
        data-shell-slot="timeline-master-detail"
      >
        {/* filter rail — soft embedded rail */}
        <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-4 py-4 lg:mr-1.5">
          <SectionLabel>Filter</SectionLabel>
          <ul className="mt-2 space-y-0.5">
            {filters.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "o-calm w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-medium",
                    filter === f
                      ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                  data-shell-item="timeline-filter"
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>

          <SectionLabel className="mt-5">Lanes</SectionLabel>
          <ul className="mt-2 space-y-1.5 text-[12px] text-muted-foreground">
            {[
              { c: "bg-primary", l: "Model / context movement" },
              { c: "bg-action", l: "Reports / fieldwork / imports" },
              { c: "bg-foreground/60", l: "Decisions" },
              { c: "bg-muted-foreground", l: "Receipts" },
            ].map((x) => (
              <li
                key={x.l}
                className="flex items-center gap-2"
                data-shell-item="timeline-lane"
              >
                <span className={cn("size-2 rounded-full", x.c)} />
                {x.l}
              </li>
            ))}
          </ul>
        </div>

        {/* rail */}
        <div className="min-h-0 overflow-y-auto px-6 py-5 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="relative mb-5">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search timeline…"
                className="w-full rounded-[10px] bg-secondary/60 py-2 pl-8 pr-3 text-sm text-foreground outline-none ring-1 ring-inset ring-transparent focus:bg-card focus:ring-primary/40"
              />
            </div>

            <div className="relative pl-5">
              <div
                className="absolute bottom-2 left-[5px] top-2 w-px bg-border"
                aria-hidden
              />
              {permanentGroups.map((group) => {
                const isDefaultView = filter === "All" && query === ""
                const matchingObjects = group.ids
                  .map((id) => (id ? getObject(id) : undefined))
                  .filter((event): event is NonNullable<typeof event> => Boolean(event))
                  .filter(
                    (event) =>
                      matches(
                        filter,
                        event.eventType ?? event.reportType ?? "",
                        event.tags ?? [],
                      ) &&
                      (query === "" ||
                        event.title.toLowerCase().includes(query.toLowerCase())),
                  )
                const visible = isDefaultView
                  ? group.ids.map((id) => (id ? getObject(id) : undefined))
                  : minimumPermanentSlots(matchingObjects, 1)
                return (
                  <div
                    key={group.heading}
                    className="mb-6"
                    data-shell-item="timeline-group"
                  >
                    <div className="relative mb-2.5">
                      <span className="absolute -left-[19px] top-0.5 size-3 rounded-full border-2 border-primary bg-card shadow-[0_0_0_3px_var(--card)]" />
                      <SectionLabel>{group.heading}</SectionLabel>
                    </div>
                    <div className="o-material overflow-hidden rounded-[10px]">
                      {visible.map((event, index) => {
                        const selected = Boolean(event && selectedId === event.id)
                        const moved = Boolean(event && (event.before || event.after))
                        const showNeutralDetail =
                          !event && group.heading === "Today" && index === 0
                        const laneKey = event
                          ? lane(event.eventType ?? event.reportType ?? "")
                          : "receipt"
                        const eventType =
                          event?.eventType ??
                          event?.reportType ??
                          (isLoading ? "Loading" : "Current activity")
                        const date =
                          event?.date ??
                          event?.lastUpdated ??
                          (isLoading ? "loading" : "unavailable")
                        const title =
                          event?.title ||
                          (isLoading
                            ? "Loading timeline activity…"
                            : "No timeline activity is available.")
                        return (
                          <button
                            key={event?.id ?? `${group.heading}-empty-${index}`}
                            type="button"
                            onClick={event ? () => openEvent(event.id) : undefined}
                            disabled={!event}
                            data-shell-item="timeline-row"
                            data-live-object-id={event?.id}
                            data-movement-state={moved ? "moved" : undefined}
                            className={cn(
                              "o-calm relative flex w-full gap-3 px-4 py-3 pl-5 text-left disabled:cursor-default disabled:opacity-70",
                              "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r",
                              LANE_STRIPE[laneKey],
                              index !== 0 && "border-t o-hairline",
                              selected ? "bg-accent/50" : "hover:bg-accent/30",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1.5 size-2 shrink-0 rounded-full",
                                LANE_DOT[laneKey],
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                  {eventType}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  · {date}
                                </span>
                                {moved && (
                                  <span className="rounded-full bg-evidence-muted px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    moved
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[14px] font-medium leading-snug text-foreground">
                                {title}
                              </span>
                              {(event?.summary ||
                                (!event &&
                                  ((group.heading === "Today" && index < 2) ||
                                    (group.heading === "Last week" && index === 0) ||
                                    group.heading === "Imported history"))) && (
                                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                                  {event?.summary ||
                                    (isLoading
                                      ? "Loading activity details…"
                                      : "No additional detail is available.")}
                                </span>
                              )}
                              {moved && (
                                <span className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                  <span className="block rounded-[8px] bg-muted/70 px-2 py-1 text-[12px] text-foreground">
                                    <span className="text-muted-foreground">Before: </span>
                                    {event?.before ||
                                      (isLoading
                                        ? "Loading prior information…"
                                        : "Not enough information yet.")}
                                  </span>
                                  <span className="block rounded-[8px] bg-evidence-muted/70 px-2 py-1 text-[12px] text-foreground ring-1 ring-inset ring-primary/15">
                                    <span className="text-primary">After: </span>
                                    {event?.after ||
                                      (isLoading
                                        ? "Loading updated information…"
                                        : "No movement is ready for review.")}
                                  </span>
                                </span>
                              )}
                              {showNeutralDetail && (
                                <span className="mt-2 block rounded-[8px] bg-muted/70 px-2 py-2 text-[12px] text-muted-foreground">
                                  {isLoading
                                    ? "Loading movement comparison…"
                                    : "No movement comparison is available."}
                                </span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
