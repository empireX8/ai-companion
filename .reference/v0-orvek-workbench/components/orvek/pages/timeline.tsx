"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { getObject } from "@/lib/orvek-data"
import { useWorkbench } from "../store"
import { SectionLabel } from "../primitives"
import { Search } from "lucide-react"

const GROUPS: { heading: string; ids: string[] }[] = [
  { heading: "Today", ids: ["t1", "t2", "t3", "t4"] },
  { heading: "This week", ids: ["t5", "t6", "t7"] },
  { heading: "Last week", ids: ["t8", "t9", "t10", "t11"] },
  { heading: "Earlier", ids: ["t12", "t13", "t14"] },
  { heading: "Imported history", ids: ["imp-1"] },
]

const FILTERS = [
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
  const [filter, setFilter] = useState("All")
  const [query, setQuery] = useState("")

  function openEvent(id: string) {
    select(id)
    const e = getObject(id)
    if (e?.before || e?.after) setInspectorTab("movement")
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Timeline</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          How the model evolved — receipts, decisions, reports, fieldwork, and movement.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr]">
        {/* filter rail — soft embedded rail */}
        <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-4 py-4 lg:mr-1.5">
          <SectionLabel>Filter</SectionLabel>
          <ul className="mt-2 space-y-0.5">
            {FILTERS.map((f) => (
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
              <li key={x.l} className="flex items-center gap-2">
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
              {GROUPS.map((group) => {
                const visible = group.ids
                  .map((id) => getObject(id)!)
                  .filter(
                    (e) =>
                      e &&
                      matches(filter, e.eventType ?? e.reportType ?? "", e.tags ?? []) &&
                      (query === "" ||
                        e.title.toLowerCase().includes(query.toLowerCase())),
                  )
                if (visible.length === 0) return null
                return (
                  <div key={group.heading} className="mb-6">
                    <div className="relative mb-2.5">
                      <span className="absolute -left-[19px] top-0.5 size-3 rounded-full border-2 border-primary bg-card shadow-[0_0_0_3px_var(--card)]" />
                      <SectionLabel>{group.heading}</SectionLabel>
                    </div>
                    <div className="o-material overflow-hidden rounded-[10px]">
                      {visible.map((e, i) => {
                        const sel = selectedId === e.id
                        const laneKey = lane(e.eventType ?? e.reportType ?? "")
                        const moved = !!(e.before || e.after)
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => openEvent(e.id)}
                            className={cn(
                              "o-calm relative flex w-full gap-3 px-4 py-3 pl-5 text-left",
                              "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r",
                              LANE_STRIPE[laneKey],
                              i !== 0 && "border-t o-hairline",
                              sel ? "bg-accent/50" : "hover:bg-accent/30",
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
                                  {e.eventType ?? e.reportType}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  · {e.date ?? e.lastUpdated}
                                </span>
                                {moved && (
                                  <span className="rounded-full bg-evidence-muted px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    moved
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[14px] font-medium leading-snug text-foreground">
                                {e.title}
                              </span>
                              {e.summary && (
                                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                                  {e.summary}
                                </span>
                              )}
                              {moved && (
                                <span className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                  <span className="block rounded-[8px] bg-muted/70 px-2 py-1 text-[12px] text-foreground">
                                    <span className="text-muted-foreground">Before: </span>
                                    {e.before}
                                  </span>
                                  <span className="block rounded-[8px] bg-evidence-muted/70 px-2 py-1 text-[12px] text-foreground ring-1 ring-inset ring-primary/15">
                                    <span className="text-primary">After: </span>
                                    {e.after}
                                  </span>
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
