"use client";

import {
  CircleHelp,
  Compass,
  FileText,
  GitBranch,
  Microscope,
  ScrollText,
  Sparkles,
  Telescope,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type OrvekObjectType =
  | "receipt"
  | "decision"
  | "report"
  | "fieldwork"
  | "map-object"
  | "timeline-event"
  | "investigation"
  | "context"
  | "model-update"
  | "active-question";

export const TYPE_META: Record<
  OrvekObjectType,
  { label: string; icon: LucideIcon; tone: "evidence" | "action" | "neutral" }
> = {
  receipt: { label: "Receipt", icon: ScrollText, tone: "evidence" },
  decision: { label: "Decision", icon: GitBranch, tone: "neutral" },
  report: { label: "Report", icon: FileText, tone: "action" },
  fieldwork: { label: "Fieldwork", icon: Telescope, tone: "action" },
  "map-object": { label: "Model object", icon: Compass, tone: "evidence" },
  "timeline-event": { label: "Event", icon: GitBranch, tone: "neutral" },
  investigation: { label: "Investigation", icon: Microscope, tone: "evidence" },
  context: { label: "Context", icon: Compass, tone: "neutral" },
  "model-update": { label: "Model update", icon: Sparkles, tone: "evidence" },
  "active-question": { label: "Active question", icon: CircleHelp, tone: "action" },
};

export function TypeBadge({ type }: { type: OrvekObjectType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        meta.tone === "evidence" && "bg-evidence-muted text-primary",
        meta.tone === "action" && "bg-action-muted text-action-foreground",
        meta.tone === "neutral" && "bg-secondary text-secondary-foreground"
      )}
    >
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

type ChipTone = "evidence" | "action" | "neutral" | "danger";

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        tone === "evidence" && "border-primary/20 bg-evidence-muted text-primary",
        tone === "action" && "border-action/30 bg-action-muted text-action-foreground",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
        tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle ? (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          {subtitle}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function EvidenceMeta({
  count,
  time,
  className,
}: {
  count?: number;
  time?: string;
  className?: string;
}) {
  if (count == null && !time) return null;
  return (
    <div className={cn("flex items-center gap-3 text-xs text-muted-foreground", className)}>
      {count != null ? (
        <span className="inline-flex items-center gap-1">
          <ScrollText className="size-3" aria-hidden />
          {count} {count === 1 ? "receipt" : "receipts"}
        </span>
      ) : null}
      {time ? <span>{time}</span> : null}
    </div>
  );
}

export function BeforeAfter({
  before,
  after,
  compact,
}: {
  before?: string | null;
  after?: string | null;
  compact?: boolean;
}) {
  if (!before && !after) return null;
  return (
    <div className={cn("space-y-1.5", compact ? "mt-1.5" : "mt-2")}>
      {before ? (
        <div className="rounded-[9px] bg-muted/70 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Before
          </p>
          <p className="mt-0.5 text-[13px] text-foreground">{before}</p>
        </div>
      ) : null}
      {after ? (
        <div className="rounded-[9px] bg-evidence-muted/70 px-2.5 py-1.5 ring-1 ring-inset ring-primary/15">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">After</p>
          <p className="mt-0.5 text-[13px] text-foreground">{after}</p>
        </div>
      ) : null}
    </div>
  );
}
