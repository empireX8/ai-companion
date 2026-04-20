/**
 * Patterns API — View Model + Client Helpers (P2-01)
 *
 * Canonical client-facing types for the Patterns destination.
 * All types are plain serialisable objects — no Prisma types leak here.
 *
 * Family sections are ordered and labelled exactly as specified in P2-02.
 * Strength levels are expressed as qualitative labels, not numeric scores (P2-06).
 */

// ── Locked family section labels ──────────────────────────────────────────────

export const PATTERN_FAMILY_SECTIONS = [
  {
    familyKey: "trigger_condition" as const,
    sectionLabel: "Triggers & Conditions",
    description: "Recurring stimulus-response patterns — situations that reliably trigger specific behaviours or reactions.",
  },
  {
    familyKey: "inner_critic" as const,
    sectionLabel: "Inner-Critic / Self-Talk",
    description: "Patterns of self-critical language and harsh inner dialogue observed across sessions.",
  },
  {
    familyKey: "repetitive_loop" as const,
    sectionLabel: "Repetitive Loops",
    description: "Behaviours or situations that recur cyclically despite awareness or intention to change.",
  },
  {
    familyKey: "contradiction_drift" as const,
    sectionLabel: "Tensions",
    description: "Competing pulls, internal conflicts, and unresolved tensions visible in your recent material.",
  },
  {
    familyKey: "recovery_stabilizer" as const,
    sectionLabel: "Recovery & Stabilizers",
    description: "Positive change, progress, and stabilisation patterns that signal momentum.",
  },
] as const;

export type FamilyKey = (typeof PATTERN_FAMILY_SECTIONS)[number]["familyKey"];

// ── Qualitative strength labels ───────────────────────────────────────────────
// Source of truth lives in trust-copy.ts (P4-03). Re-exported here for
// backwards-compatible imports in existing components.

export { STRENGTH_LABELS } from "./trust-copy";

// ── Action view model (P2.5-01) ────────────────────────────────────────────────

/**
 * V1 claim-attached action. No due dates, no reminders, no streaks.
 * Lifecycle: pending → in_progress → completed | skipped | abandoned
 * outcomeSignal populated on completion/abandonment.
 */
export type PatternClaimActionView = {
  id: string;
  claimId: string;
  prompt: string;
  status: "pending" | "in_progress" | "completed" | "skipped" | "abandoned";
  outcomeSignal: "helpful" | "not_helpful" | "unclear" | null;
  reflectionNote: string | null;
  createdAt: string;
  completedAt: string | null;
};

// ── View model types ──────────────────────────────────────────────────────────

export type PatternReceiptView = {
  id: string;
  source: string;
  sessionId: string | null;
  messageId: string | null;
  quote: string | null;
  createdAt: string;
};

export type PatternClaimView = {
  id: string;
  patternType: FamilyKey;
  summary: string;
  status: "candidate" | "active" | "paused" | "dismissed";
  strengthLevel: "tentative" | "developing" | "established";
  /** Number of evidence receipts attached to this claim */
  evidenceCount: number;
  /** Number of distinct sessions represented in receipts */
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
  receipts: PatternReceiptView[];
  /** Most recent pending/in_progress action, or null (P2.5-01) */
  action: PatternClaimActionView | null;
};

export type PatternContradictionView = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  type: string;
  status:
    | "candidate"
    | "open"
    | "snoozed"
    | "explored"
    | "resolved"
    | "accepted_tradeoff"
    | "archived_tension";
  lastEvidenceAt: string | null;
  lastTouchedAt: string;
};

export type PatternFamilySection = {
  familyKey: FamilyKey;
  sectionLabel: string;
  description: string;
  claims: PatternClaimView[];
  contradictionItems?: PatternContradictionView[];
};

export type PatternsResponse = {
  sections: PatternFamilySection[];
  /** Total user messages analysed (for scope display, P2-06) */
  scopeMessageCount: number;
  /** Total distinct sessions analysed (for scope display, P2-06) */
  scopeSessionCount: number;
};

// ── Client fetch helper ───────────────────────────────────────────────────────

/**
 * Fetch the user's Patterns data from the read API.
 * Returns null on auth failure or server error.
 */
export async function fetchPatterns(): Promise<PatternsResponse | null> {
  try {
    const res = await fetch("/api/patterns", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PatternsResponse;
  } catch {
    return null;
  }
}

/**
 * Suggest a micro-experiment for a claim. Returns the created action or null.
 */
export async function suggestClaimAction(
  claimId: string
): Promise<PatternClaimActionView | null> {
  try {
    const res = await fetch("/api/patterns/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    });
    if (!res.ok) return null;
    return (await res.json()) as PatternClaimActionView;
  } catch {
    return null;
  }
}

/**
 * Update an action's status, outcome, and/or reflection note.
 */
export async function updateClaimAction(
  actionId: string,
  patch: {
    status?: PatternClaimActionView["status"];
    outcomeSignal?: "helpful" | "not_helpful" | "unclear";
    reflectionNote?: string;
  }
): Promise<PatternClaimActionView | null> {
  try {
    const res = await fetch(`/api/patterns/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return (await res.json()) as PatternClaimActionView;
  } catch {
    return null;
  }
}
