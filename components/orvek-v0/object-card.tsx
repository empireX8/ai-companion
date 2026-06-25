"use client"

import { cn } from "@/lib/utils"
import { getObject } from "@/lib/orvek-v0/mock-orvek-data"
import { useWorkbench } from "./store"
import { Chip, EvidenceMeta, TypeBadge } from "./primitives"

/**
 * Renders a clickable card for an object id. Clicking selects the object,
 * which drives the right-side Evidence / Context panel.
 */
export function ObjectCard({
  id,
  className,
  compact,
}: {
  id: string
  className?: string
  compact?: boolean
}) {
  const obj = getObject(id)
  const { selectedId, select } = useWorkbench()
  if (!obj) return null
  const selected = selectedId === id

  return (
    <button
      type="button"
      onClick={() => select(id)}
      aria-pressed={selected}
      className={cn(
        "group w-full rounded-lg border bg-card p-3.5 text-left transition-colors",
        "hover:border-primary/40 hover:bg-accent/40",
        selected ? "border-primary ring-1 ring-primary/30 bg-accent/30" : "border-border",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <TypeBadge type={obj.type} />
        {selected && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
            Inspecting
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-medium text-card-foreground text-pretty",
          compact ? "text-sm" : "text-[15px] leading-snug",
        )}
      >
        {obj.title}
      </p>
      {!compact && obj.summary && (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {obj.summary}
        </p>
      )}
      {obj.tags && obj.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {obj.tags.map((t) => (
            <Chip
              key={t}
              tone={
                /due|high|needs|pending/i.test(t)
                  ? "action"
                  : /wrong|remove/i.test(t)
                    ? "danger"
                    : "neutral"
              }
            >
              {t}
            </Chip>
          ))}
        </div>
      )}
      <EvidenceMeta
        className="mt-2.5"
        count={obj.evidenceCount}
        time={obj.lastUpdated ?? obj.date}
      />
    </button>
  )
}
