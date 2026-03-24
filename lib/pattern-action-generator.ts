/**
 * Pattern Action Generator — micro-experiment factory (P2.5-03)
 *
 * Generates small, reversible micro-experiments from claim type AND receipts.
 * Rule-based, no LLM. Language is plain and non-coaching.
 *
 * Receipt input materially affects output in two ways:
 *  1. Quote anchor — when the most recent receipt has a non-trivial quote,
 *     a context-specific anchor is appended so the experiment references
 *     the user's own words rather than a generic prompt.
 *  2. Session clustering — when all evidence comes from a single session
 *     the experiment is flagged as a one-time trial rather than a pattern
 *     observation, reflecting the lower confidence of single-session data.
 *
 * Base prompt selection is deterministic by claim ID. Anchoring is
 * deterministic by receipt quote content. Same claim + same receipts
 * always produces the same output.
 *
 * Do NOT add due dates, streaks, or reminder language here.
 */

import type { PatternClaimView } from "./patterns-api";
import type { FamilyKey } from "./patterns-api";

// ── Base experiment prompts (family-keyed) ────────────────────────────────────

const EXPERIMENTS: Record<FamilyKey, readonly string[]> = {
  trigger_condition: [
    "Next time you notice this situation coming up, pause for 10 seconds before responding. Just observe — no need to change anything yet.",
    "When this trigger shows up, try naming it internally: 'There it is.' Note whether labelling it shifts anything at all.",
    "Track one instance of this trigger this week. Write down what was happening right before it started.",
  ],
  inner_critic: [
    "When that inner voice shows up, write down its exact words. Then ask: would I say this to someone I care about?",
    "The next time you catch this kind of self-talk, note the context — what was happening just before it started?",
    "Try writing a single sentence response to the inner critic as if you were a fair witness, not a judge.",
  ],
  repetitive_loop: [
    "Track one instance of this loop this week. Just note when it starts — not why. Recognition usually comes before change.",
    "Next time you notice you're in this loop, name it to yourself ('there's that pattern') and note one small thing that feels different from last time.",
    "Write down two conditions that were present the last time this loop started. Look for patterns in the context.",
  ],
  contradiction_drift: [
    "Pick one area where this gap feels most visible. For the next few days, just notice when it shows up — no pressure to fix it.",
    "Write down one small, low-stakes situation where you could act more in line with what you said matters. Try it once.",
    "Note one recent moment where the gap closed a little — even briefly. What was different about that moment?",
  ],
  recovery_stabilizer: [
    "Notice what conditions were present the last time this stabilizer was working well. Write down two of them.",
    "When this positive pattern shows up, try to name what made it possible today. Look for things in your environment or routine.",
    "Note one thing you could do to make the conditions for this pattern slightly more likely this week.",
  ],
} as const;

// ── Receipt context helpers ───────────────────────────────────────────────────

const MIN_QUOTE_LEN = 12;
const QUOTE_ANCHOR_MAX = 65;

/**
 * Extracts a usable anchor phrase from a receipt quote.
 * Returns null if the quote is too short or only whitespace.
 */
function extractAnchor(quote: string): string | null {
  const trimmed = quote.trim();
  if (trimmed.length < MIN_QUOTE_LEN) return null;
  const capped = trimmed.slice(0, QUOTE_ANCHOR_MAX);
  return capped.length < trimmed.length ? `${capped}…` : capped;
}

/**
 * Returns the most recent receipt quote that is long enough to use as context.
 * Receipts are expected to be ordered newest-first (as returned by the API).
 */
function findRecentAnchorQuote(claim: PatternClaimView): string | null {
  for (const receipt of claim.receipts) {
    if (receipt.quote) {
      const anchor = extractAnchor(receipt.quote);
      if (anchor) return anchor;
    }
  }
  return null;
}

/**
 * Returns true when all receipts belong to a single session —
 * signals low cross-session confidence.
 */
function isSingleSession(claim: PatternClaimView): boolean {
  return claim.sessionCount <= 1 && claim.evidenceCount > 0;
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Returns a micro-experiment prompt for the given claim, incorporating
 * receipt context when available.
 *
 * Deterministic: same claim ID + same receipts → same output every time.
 */
export function generateMicroExperiment(claim: PatternClaimView): string {
  const pool = EXPERIMENTS[claim.patternType];

  // Deterministic base selection via sum of first 4 chars of claim ID
  const charSum = Array.from(claim.id.slice(0, 4)).reduce(
    (acc, c) => acc + c.charCodeAt(0),
    0
  );
  const basePrompt = pool[charSum % pool.length]!;

  // Receipt input 1 — quote anchor: personalise with the user's own words
  const anchorQuote = findRecentAnchorQuote(claim);
  if (anchorQuote) {
    return `${basePrompt} Specifically, watch for moments like: "${anchorQuote}"`;
  }

  // Receipt input 2 — single-session signal: frame as a one-time trial
  if (isSingleSession(claim)) {
    return `${basePrompt} This is based on one session — try it once and see if it matches your experience.`;
  }

  return basePrompt;
}
