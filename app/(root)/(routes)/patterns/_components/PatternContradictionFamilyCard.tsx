"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";

import type { PatternClaimView, PatternContradictionView } from "@/lib/patterns-api";
import { formatContradictionPrimaryTitles } from "@/lib/pattern-contradiction-title";
import { cn } from "@/lib/utils";
import { PatternClaimCard } from "./PatternClaimCard";
import { PatternContradictionCard } from "./PatternContradictionCard";

type Props = {
  items: PatternContradictionView[];
  claims: PatternClaimView[];
};

// ── Type → readable tension title ─────────────────────────────────────────────

const TYPE_TENSION_LABELS: Record<string, string> = {
  goal_behavior_gap: "Goal–behavior gap",
  value_conflict: "Value conflict",
  constraint_conflict: "Competing constraints",
  belief_conflict: "Belief conflict",
  pattern_loop: "Recurring loop",
  narrative_conflict: "Narrative conflict",
};

// ── Type → landscape description sentence ─────────────────────────────────────
//
// One sentence per tension type that describes what kind of inner pull is
// showing up — keeps the card feeling like a tension summary, not a record count.

const TYPE_LANDSCAPE_DESC: Record<string, string> = {
  goal_behavior_gap:
    "A pull between what you want to do and what you're actually doing.",
  value_conflict:
    "Competing values pulling in different directions at the same time.",
  constraint_conflict:
    "Situations where different constraints are working against each other.",
  belief_conflict:
    "Conflicting beliefs creating friction around the same question.",
  pattern_loop:
    "A recurring pattern cycling without reaching clear resolution.",
  narrative_conflict:
    "Competing stories about the same situation, both feeling true.",
};

function tensionLabelForType(type: string): string {
  return (
    TYPE_TENSION_LABELS[type] ??
    type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getDominantType(items: PatternContradictionView[]): string | null {
  const freq = new Map<string, number>();
  for (const item of items) {
    if (item.type) freq.set(item.type, (freq.get(item.type) ?? 0) + 1);
  }
  if (freq.size === 0) return null;
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function formatFamilyTitle(items: PatternContradictionView[]): string {
  const dominantType = getDominantType(items);
  return dominantType ? tensionLabelForType(dominantType) : "Recurring tension";
}

/**
 * Returns a one-sentence description of the tension landscape.
 * Uses the dominant type's description when one type is clearly dominant (≥60%).
 * Falls back to a multi-type summary when the family is mixed.
 */
export function formatLandscapeDescription(
  items: PatternContradictionView[]
): string | null {
  if (items.length === 0) return null;

  const freq = new Map<string, number>();
  for (const item of items) {
    if (item.type) freq.set(item.type, (freq.get(item.type) ?? 0) + 1);
  }
  if (freq.size === 0) return null;

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const dominantType = sorted[0]![0];
  const dominantCount = sorted[0]![1];

  if (freq.size === 1 || dominantCount / items.length >= 0.6) {
    return TYPE_LANDSCAPE_DESC[dominantType] ?? null;
  }

  const names = sorted.map(([t]) => tensionLabelForType(t).toLowerCase());
  const last = names.pop();
  return `Visible across ${names.join(", ")} and ${last}.`;
}

// ── Surface status pill ────────────────────────────────────────────────────────

type FamilySurfaceStatus = {
  label: string;
  borderClass: string;
  badgeClass: string;
};

function deriveFamilySurfaceStatus(
  displayItems: PatternContradictionView[]
): FamilySurfaceStatus {
  const hasUnresolved = displayItems.some(
    (i) =>
      i.status === "open" ||
      i.status === "candidate" ||
      i.status === "explored" ||
      i.status === "snoozed"
  );
  if (hasUnresolved || displayItems.length === 0) {
    return {
      label: "Active",
      borderClass: "border-primary/30",
      badgeClass: "bg-primary/10 text-primary",
    };
  }
  return {
    label: "Resolved",
    borderClass: "border-emerald-500/30",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
}

// ── Metric helpers ─────────────────────────────────────────────────────────────

function isUnresolved(item: PatternContradictionView): boolean {
  return (
    item.status === "open" ||
    item.status === "candidate" ||
    item.status === "explored" ||
    item.status === "snoozed"
  );
}

/** Bar fill — ratio of unresolved tensions to total. */
function computeUnresolvedPct(displayItems: PatternContradictionView[]): number {
  if (displayItems.length === 0) return 0;
  const unresolved = displayItems.filter(isUnresolved).length;
  return Math.round((unresolved / displayItems.length) * 100);
}

function formatDateShort(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "recently";
  const now = new Date();
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(parsed.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/**
 * Compact scope stats: "N surfaced · N unresolved · Last noted Apr 15".
 * Only includes lines that have real data — no fabricated counts.
 */
export function formatTensionScopeText(
  displayItems: PatternContradictionView[]
): string {
  const n = displayItems.length;
  const unresolved = displayItems.filter(isUnresolved).length;
  const parts: string[] = [];

  parts.push(`${n} surfaced`);

  if (unresolved > 0 && unresolved < n) {
    parts.push(`${unresolved} unresolved`);
  } else if (unresolved === n && n > 0) {
    parts.push("all unresolved");
  } else if (n > 0) {
    parts.push("all resolved");
  }

  const evidenceDates = displayItems
    .filter((i) => i.lastEvidenceAt != null)
    .map((i) => i.lastEvidenceAt as string);
  if (evidenceDates.length > 0) {
    const mostRecent = evidenceDates.sort().at(-1)!;
    parts.push(`Last noted ${formatDateShort(mostRecent)}`);
  }

  return parts.join(" · ");
}

// ── Near-duplicate suppression ────────────────────────────────────────────────

const NEAR_DUPLICATE_THRESHOLD = 0.6;

const STATUS_PRIORITY: Record<PatternContradictionView["status"], number> = {
  open: 6,
  explored: 5,
  candidate: 4,
  snoozed: 3,
  accepted_tradeoff: 2,
  resolved: 1,
  archived_tension: 0,
};

function tokenizeForDedup(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((t) => t.length >= 3)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function strongerItem(
  a: PatternContradictionView,
  b: PatternContradictionView
): PatternContradictionView {
  const pa = STATUS_PRIORITY[a.status] ?? 0;
  const pb = STATUS_PRIORITY[b.status] ?? 0;
  if (pa !== pb) return pa > pb ? a : b;
  return (a.lastTouchedAt ?? "") >= (b.lastTouchedAt ?? "") ? a : b;
}

function suppressNearDuplicates(
  items: PatternContradictionView[]
): PatternContradictionView[] {
  const kept: PatternContradictionView[] = [];
  for (const item of items) {
    const itemTokens = new Set([
      ...tokenizeForDedup(item.sideA),
      ...tokenizeForDedup(item.sideB),
    ]);
    let dominated = false;
    for (let i = 0; i < kept.length; i++) {
      const existing = kept[i]!;
      const existingTokens = new Set([
        ...tokenizeForDedup(existing.sideA),
        ...tokenizeForDedup(existing.sideB),
      ]);
      if (jaccardSimilarity(itemTokens, existingTokens) >= NEAR_DUPLICATE_THRESHOLD) {
        if (strongerItem(item, existing) === item) kept[i] = item;
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(item);
  }
  return kept;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PatternContradictionFamilyCard({ items, claims }: Props) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const displayItems = suppressNearDuplicates(items);
  const n = displayItems.length;
  const title = formatFamilyTitle(displayItems);
  const landscapeDesc = formatLandscapeDescription(displayItems);
  const surfaceStatus = deriveFamilySurfaceStatus(displayItems);
  const fillPct = computeUnresolvedPct(displayItems);
  const scopeText = formatTensionScopeText(displayItems);
  const primaryTitles = formatContradictionPrimaryTitles(displayItems);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3 transition-colors",
        surfaceStatus.borderClass
      )}
    >
      {/* ── Row 1: tension shape title + status pill ───────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-foreground">
          {title}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            surfaceStatus.badgeClass
          )}
        >
          {surfaceStatus.label}
        </span>
      </div>

      {/* ── Row 2: landscape description ──────────────────────────────────── */}
      {/* One sentence describing what kind of inner pull is showing up. */}
      {landscapeDesc && (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          {landscapeDesc}
        </p>
      )}

      {/* ── Row 3: scope stats ─────────────────────────────────────────────── */}
      {/* Bar fill = fraction of tensions still unresolved (real data). */}
      {/* Scope text: "N surfaced · N unresolved · Last noted Apr 15"       */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${fillPct}%` }}
          />
        </div>
        {scopeText && (
          <span className="text-[11px] text-muted-foreground/70">{scopeText}</span>
        )}
      </div>

      {/* ── Row 4: expand/collapse toggle ─────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "mt-2 flex items-center gap-1.5 text-xs transition-colors",
          open
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span>
          {open
            ? "Hide tensions"
            : `Show ${n} tension${n !== 1 ? "s" : ""}`}
        </span>
      </button>

      {/* ── Row 5: review link ─────────────────────────────────────────────── */}
      <Link
        href="/contradictions"
        className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
      >
        <SlidersHorizontal className="h-3 w-3" />
        <span>Review tensions</span>
      </Link>

      {/* ── Expanded: nested tension items + drift signal claims ──────────── */}
      {open && (
        <div className="mt-3 space-y-3 border-t border-border/30 pt-3">
          <div className="space-y-2">
            {displayItems.map((item) => (
              <PatternContradictionCard
                key={item.id}
                item={item}
                primaryTitle={primaryTitles.get(item.id)}
              />
            ))}
          </div>

          {claims.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                Drift signals
              </p>
              {claims.map((claim) => (
                <PatternClaimCard key={claim.id} claim={claim} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
