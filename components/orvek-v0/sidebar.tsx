"use client"

import { cn } from "@/lib/utils"
import { isProductionDisplay } from "@/lib/orvek-v0/display-contract"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { resolveWorkbenchRoutePath, updateWorkbenchHistory, isIsolatedWorkbenchPath } from "@/lib/orvek-v0/workbench-route-history"
import { useWorkbench, type OrvekPage } from "@/components/orvek-v0/store"
import { CalendarClock, Compass, GitBranch, Home, Telescope } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const NAV: { id: OrvekPage; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Today", icon: Home },
  { id: "map", label: "Map", icon: Compass },
  { id: "decisions", label: "Decisions", icon: GitBranch },
  { id: "timeline", label: "Timeline", icon: CalendarClock },
  { id: "explore", label: "Explore", icon: Telescope },
]

export function Sidebar() {
  const data = useOrvekData()
  const { page, setPage } = useWorkbench()
  const isProduction = isProductionDisplay(data)
  const movementPlaceCount = data.modelStatusCard?.movementPlaceCount ?? 0
  const movementStatusTitle =
    movementPlaceCount > 0
      ? `Model changed in ${movementPlaceCount} ${movementPlaceCount === 1 ? "place" : "places"}`
      : "No model movement is ready for review"

  return (
    <nav
      className="flex h-full w-[68px] shrink-0 flex-col items-center pb-4 pt-1"
      data-shell-slot="navigator"
    >
      {/* nav — icon-only, soft */}
      <ul className="flex w-full flex-col items-center gap-1.5 px-3">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <li key={item.id} className="w-full">
              <button
                type="button"
                onClick={() => {
                  setPage(item.id)
                  // Production root syncs URL; isolated /dev candidates keep pathname.
                  if (isProduction && !isIsolatedWorkbenchPath()) {
                    updateWorkbenchHistory(resolveWorkbenchRoutePath(item.id))
                  }
                }}
                aria-current={active ? "page" : undefined}
                title={item.label}
                data-testid={`nav-${item.id}`}
                data-shell-item="navigator-link"
                className={cn(
                  "o-calm group relative flex aspect-square w-full items-center justify-center rounded-[13px]",
                  active
                    ? "bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "o-calm size-[20px]",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  aria-hidden
                />
                <span className="sr-only">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* live model pulse */}
      <div className="mt-auto">
        <div
          className="relative flex size-9 items-center justify-center rounded-full bg-action-muted/40 ring-1 ring-inset ring-action/25"
          title={movementStatusTitle}
          data-shell-slot="navigator-model-pulse"
        >
          <span
            className={cn(
              "size-1.5 rounded-full bg-action",
              movementPlaceCount > 0 && "o-breathe",
            )}
            data-navigator-activity={movementPlaceCount > 0 ? "active" : "idle"}
          />
          <span
            className={cn(
              "absolute inset-0 rounded-full border border-action/20",
              movementPlaceCount > 0 && "animate-ping",
            )}
          />
        </div>
      </div>
    </nav>
  )
}
