"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

import {
  formatContradictionPrimaryTitle,
  normalizeContradictionText,
} from "@/lib/pattern-contradiction-title";
import { cn } from "@/lib/utils";
import type { PatternContradictionView } from "@/lib/patterns-api";

// Border class per item status — visually distinguishes live vs settled tensions.
const STATUS_BORDER: Record<PatternContradictionView["status"], string> = {
  candidate: "border-border/40",
  open: "border-primary/30",
  explored: "border-blue-500/30",
  snoozed: "border-amber-500/30",
  resolved: "border-emerald-500/30",
  accepted_tradeoff: "border-purple-500/30",
  archived_tension: "border-border/20",
};

// Opacity modifier for settled states
const STATUS_WRAPPER: Partial<Record<PatternContradictionView["status"], string>> = {
  resolved: "opacity-80",
  accepted_tradeoff: "opacity-80",
  archived_tension: "opacity-70",
};

// Status label — surfaced in the meta row, not as a badge.
const STATUS_LABEL: Record<PatternContradictionView["status"], string> = {
  candidate: "Candidate",
  open: "Open",
  explored: "Explored",
  snoozed: "Snoozed",
  resolved: "Resolved",
  accepted_tradeoff: "Trade-off",
  archived_tension: "Archived",
};

// ── Type-contextual side labels ────────────────────────────────────────────────
//
// Instead of generic "One side" / "Other side", show labels that reflect
// what kind of pull each side represents for this tension type.
// Default is "One pull" / "The other pull" when the type is unknown.

const TYPE_SIDE_LABELS: Record<string, readonly [string, string]> = {
  goal_behavior_gap: ["The goal", "The behavior"],
  value_conflict: ["One value", "Another value"],
  constraint_conflict: ["One constraint", "Another constraint"],
  belief_conflict: ["One belief", "Another belief"],
  pattern_loop: ["One direction", "The other direction"],
  narrative_conflict: ["One reading", "Another reading"],
};

const DEFAULT_SIDE_LABELS: readonly [string, string] = ["One pull", "The other pull"];

function getSideLabels(type: string): readonly [string, string] {
  return TYPE_SIDE_LABELS[type] ?? DEFAULT_SIDE_LABELS;
}

// ── Text helpers ───────────────────────────────────────────────────────────────

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "recently";
  const now = new Date();
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(parsed.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function normalizeText(value: string): string {
  return normalizeContradictionText(value);
}

function typeLabel(value: string): string {
  return value.replace(/_/g, " ");
}

/**
 * Meta row: status · recency · type (type is demoted to last position).
 * Putting status and recency first makes the item read as a live/settled tension
 * rather than a database record categorized by type.
 */
export function formatContradictionSecondaryMeta(
  item: PatternContradictionView
): string {
  const statusText = STATUS_LABEL[item.status] ?? item.status;
  const recencyLabel = item.lastEvidenceAt
    ? `Last noted ${formatDate(item.lastEvidenceAt)}`
    : `Last updated ${formatDate(item.lastTouchedAt)}`;
  return `${statusText} · ${recencyLabel} · ${typeLabel(item.type)}`;
}

type Props = {
  item: PatternContradictionView;
  primaryTitle?: string;
};

export function PatternContradictionCard({ item, primaryTitle: titleOverride }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const primaryTitle = titleOverride ?? formatContradictionPrimaryTitle(item);
  const secondaryMeta = formatContradictionSecondaryMeta(item);
  const [labelA, labelB] = getSideLabels(item.type);

  return (
    <div
      className={cn(
        "rounded-md border bg-background/40 px-3 py-2.5 transition-colors",
        STATUS_BORDER[item.status],
        STATUS_WRAPPER[item.status]
      )}
    >
      {/* Header: sideA vs sideB tension title + View link */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-foreground">
          {primaryTitle}
        </p>
        <Link
          href={`/contradictions/${item.id}`}
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          <span>View</span>
        </Link>
      </div>

      {/* Meta row — status · recency · type (type demoted to last) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
        <span>{secondaryMeta}</span>
      </div>

      {/* Expand/collapse — "Show each side" exposes the two contextual pull labels */}
      <button
        type="button"
        onClick={() => setDetailsOpen((value) => !value)}
        className={cn(
          "mt-2.5 flex items-center gap-1 text-[11px] transition-colors",
          detailsOpen
            ? "text-foreground"
            : "text-muted-foreground/60 hover:text-muted-foreground"
        )}
      >
        {detailsOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span>{detailsOpen ? "Collapse" : "Show each side"}</span>
      </button>

      {detailsOpen && (
        <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
          {/* Type-contextual label so the reader understands what each side represents */}
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              {labelA}
            </p>
            <p className="mt-1 text-xs leading-snug text-foreground/80 line-clamp-3">
              {normalizeText(item.sideA)}
            </p>
          </div>

          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              {labelB}
            </p>
            <p className="mt-1 text-xs leading-snug text-foreground/80 line-clamp-3">
              {normalizeText(item.sideB)}
            </p>
          </div>

          <Link
            href={`/contradictions/${item.id}`}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <span>Open full detail</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
