/**
 * Trust-copy — approved phrasing for trust-sensitive visible copy (P4-03 through P4-07)
 *
 * All copy that expresses:
 *   - certainty levels (strength, trust ladder)
 *   - evidence scope and evidence-empty states
 *   - gate conditions and readiness qualifiers
 *   - receipt/observation display
 *   - action-layer states
 *   - section empty states and low-data banners
 *
 * Components import from this file. Drift causes visible regression.
 * Do not add clinical, score, forecast, or certainty-overclaim copy here.
 */

// ── P4-03: Strength labels (trust ladder) ─────────────────────────────────────
// Qualitative only — no numeric scores anywhere in this file.

export const STRENGTH_LABELS: Record<string, string> = {
  tentative:   "Tentative signal",
  developing:  "Developing pattern",
  established: "Established pattern",
};

// ── P4-03: Evidence scope copy ────────────────────────────────────────────────

/** Shown when evidenceCount === 0 or sessionCount <= 1 (scope row on claim card). */
export const EVIDENCE_LIMITED = "Based on limited history" as const;

/** Shown on claim card scope row when evidence is sufficient. */
export function evidenceScopeLabel(evidenceCount: number, sessionCount: number): string {
  return `${evidenceCount} observation${evidenceCount !== 1 ? "s" : ""} · ${sessionCount} session${sessionCount !== 1 ? "s" : ""}`;
}

// ── P4-03: Low-data qualifiers (trust ladder — early signal) ──────────────────

/**
 * Single-claim low-data qualifier.
 * Shown when strengthLevel === "tentative" OR sessionCount <= 1.
 */
export const EARLY_SIGNAL_QUALIFIER =
  "This is an early signal, not a settled pattern." as const;

/** Page-level low-data banner — shown when message count is below threshold. */
export const LOW_DATA_BANNER = {
  heading: "Still gathering data",
  body: "Patterns need more history to be reliable. What you see here are early signals, not settled conclusions. Keep chatting and re-check in a few sessions.",
} as const;

// ── P4-03: Candidate state qualifier ──────────────────────────────────────────

/**
 * Returns the candidate-qualifier string for a given count of candidate claims.
 * Singular / plural handled internally.
 */
export function candidateQualifier(count: number): string {
  return count === 1
    ? "1 early signal being evaluated — not yet a confirmed pattern."
    : `${count} early signals being evaluated — none confirmed yet.`;
}

// ── P4-03 / P4-06: Gate reason strings ───────────────────────────────────────
// Used by getActionGateReason in pattern-claim-action.ts.
// Must remain non-punitive, honest about what is and is not known.

/** Gate shown when claim is still a candidate — not ready for a small experiment. */
export const GATE_CANDIDATE =
  "This pattern is still being evaluated. Once confirmed, you can try a small experiment." as const;

/** Gate shown when claim is paused. */
export const GATE_PAUSED = "This pattern is paused." as const;

/**
 * Gate shown when claim is active but does not yet have enough observations
 * to suggest a reliable next step.
 */
export const GATE_NOT_ENOUGH_OBSERVATIONS =
  "Not enough observations yet to suggest a reliable next step." as const;

// ── P4-04: Receipt / observation copy ────────────────────────────────────────

/** Shown when a claim has zero evidence. */
export const RECEIPT_EMPTY = "No observations recorded yet." as const;

/** Toggle label when the receipt list is expanded. */
export const RECEIPT_TOGGLE_OPEN = "Show less" as const;

/**
 * Toggle label when the receipt list is collapsed.
 * Shows the count so the user knows the scope before expanding.
 */
export function receiptToggleClosed(evidenceCount: number): string {
  return `Show ${evidenceCount} observation${evidenceCount !== 1 ? "s" : ""}`;
}

/** Shown when a session ID is unavailable for a receipt row. */
export const RECEIPT_SESSION_UNKNOWN = "Session unknown" as const;

/** Session label prefix for receipt rows. Suffix is sessionId.slice(-6). */
export function receiptSessionLabel(sessionSuffix: string): string {
  return `Session ${sessionSuffix}`;
}

/**
 * Link label to navigate from a receipt back to the source conversation.
 * Does not imply the receipt is proof — "view" is factual.
 */
export const RECEIPT_VIEW_IN_HISTORY = "View in history" as const;

// ── P4-07: Section empty states ───────────────────────────────────────────────

/** Primary empty state line for a pattern family section with no claims. */
export const SECTION_EMPTY_PRIMARY =
  "No patterns detected in this family yet." as const;

/** Secondary empty state line — honest about what is needed. */
export const SECTION_EMPTY_SECONDARY =
  "Patterns emerge as more conversations are analysed." as const;

// ── P4-07: Scope display copy (patterns/page.tsx) ────────────────────────────

/** Shown when no messages have been analysed yet. */
export const SCOPE_EMPTY =
  "No conversations analysed yet. Import or start a chat to build patterns." as const;

/** Shown when message data exists — honest about what was analysed. */
export function scopeLabel(messageCount: number, sessionCount: number): string {
  return (
    `Analysed ${messageCount.toLocaleString()} message${messageCount !== 1 ? "s" : ""}` +
    ` across ${sessionCount.toLocaleString()} session${sessionCount !== 1 ? "s" : ""}.`
  );
}

/**
 * Shown when there is conversation history but no pattern claims have been
 * confirmed yet — honest about detection status without implying failure.
 */
export const NO_CLAIMS_YET_HEADING =
  "No patterns confirmed yet." as const;

export const NO_CLAIMS_YET_BODY =
  "Pattern detection looks for recurring themes across your conversations. Results appear here once enough signal has been found. Try re-running the analysis if you've recently imported history." as const;

export const RERUN_LABEL = "Re-run analysis" as const;
export const RERUN_RUNNING_LABEL = "Running…" as const;

// ── P4-06: Action-layer copy ──────────────────────────────────────────────────

/** Button label when ready to suggest a small experiment (idle state). */
export const ACTION_SUGGEST_IDLE = "Suggest a small experiment" as const;

/** Button label while the suggestion is being generated. */
export const ACTION_SUGGEST_BUSY = "Thinking\u2026" as const;

// ── P4-06: Reflection capture copy ───────────────────────────────────────────

/** Label shown above the optional reflection text input. */
export const REFLECTION_LABEL = "How did it go?" as const;

/** Placeholder inside the reflection textarea. */
export const REFLECTION_PLACEHOLDER = "Add a note\u2026" as const;

// ── P4-05: Correction and refinement copy (PatternClaimControls) ──────────────

/** Primary feedback buttons — two locked options. */
export const CLAIM_CONTROL_PRIMARY = [
  { key: "looks_right", label: "Looks right", variant: "positive" as const },
  { key: "not_quite",   label: "Not quite",   variant: "negative" as const },
] as const;

/** Context action buttons — shown alongside primary feedback. */
export const CLAIM_CONTROL_CONTEXT = [
  { key: "add_context", label: "Add context" },
  { key: "pause",       label: "Pause this claim" },
] as const;

/** Refinement buttons — revealed after "Not quite". */
export const CLAIM_CONTROL_REFINEMENT = [
  { key: "wrong_condition", label: "Wrong condition" },
  { key: "wrong_outcome",   label: "Wrong outcome" },
  { key: "missing_context", label: "Missing context" },
] as const;

/** Prompt preceding the refinement buttons. */
export const CLAIM_CONTROL_REFINE_PROMPT = "What's off?" as const;

// ── P4-06: Action control copy (PatternActionControls) ────────────────────────

export const ACTION_STEP_COMPLETED = "Step completed." as const;
export const ACTION_STEP_SKIPPED   = "Skipped." as const;
export const ACTION_STEP_ABANDONED = "Didn\u2019t work \u2014 noted." as const;
export const ACTION_TRY_DIFFERENT  = "Try a different step" as const;
export const ACTION_ILL_TRY_THIS   = "I\u2019ll try this" as const;
export const ACTION_NOT_NOW        = "Not now" as const;
export const ACTION_DONE           = "Done" as const;
export const ACTION_DIDNT_WORK     = "Didn\u2019t work" as const;

// ── P4-07: Active steps section copy (ActiveStepsSection) ─────────────────────

export const ACTIVE_STEPS_HEADING         = "Active Steps" as const;
export const ACTIVE_STEPS_SUBHEADING      = "Small experiments you\u2019re currently trying across your patterns." as const;
export const ACTIVE_STEPS_STATUS_PROGRESS = "In progress" as const;
export const ACTIVE_STEPS_STATUS_PENDING  = "Pending" as const;
export const ACTIVE_STEPS_FROM_PREFIX     = "From:" as const;

// ── P4-07: Resolved/archived section copy (ResolvedClaimsSection) ────────────

export const RESOLVED_SECTION_HEADING = "Resolved & Archived" as const;

/**
 * Summary line beneath the resolved section heading.
 * Counts are omitted when zero.
 */
export function resolvedSectionSummary(pausedCount: number, dismissedCount: number): string {
  const parts: string[] = [];
  if (pausedCount > 0)   parts.push(`${pausedCount} paused`);
  if (dismissedCount > 0) parts.push(`${dismissedCount} dismissed`);
  return parts.join(", ");
}
