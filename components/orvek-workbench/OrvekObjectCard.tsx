"use client";

import { cn } from "@/lib/utils";

import {
  Chip,
  EvidenceMeta,
  TypeBadge,
  type OrvekObjectType,
} from "./OrvekPrimitives";

export function OrvekObjectCard({
  title,
  summary,
  type,
  tags,
  evidenceCount,
  selected,
  onSelect,
  className,
  compact,
}: {
  title: string;
  summary?: string | null;
  type: OrvekObjectType;
  tags?: string[];
  evidenceCount?: number;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group w-full rounded-lg border bg-card p-3.5 text-left transition-colors",
        "hover:border-primary/40 hover:bg-accent/40",
        selected ? "border-primary bg-accent/30 ring-1 ring-primary/30" : "border-border",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <TypeBadge type={type} />
        {selected ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
            Inspecting
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 font-medium text-card-foreground text-pretty",
          compact ? "text-sm" : "text-[15px] leading-snug"
        )}
      >
        {title}
      </p>
      {!compact && summary ? (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>
      ) : null}
      {tags && tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Chip
              key={tag}
              tone={
                /due|high|needs|pending|unresolved/i.test(tag)
                  ? "action"
                  : /wrong|remove|didn't help/i.test(tag)
                    ? "danger"
                    : "neutral"
              }
            >
              {tag}
            </Chip>
          ))}
        </div>
      ) : null}
      <EvidenceMeta className="mt-2.5" count={evidenceCount} />
    </button>
  );
}
