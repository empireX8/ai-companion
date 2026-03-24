/**
 * Pattern Quote Selection (Phase 4)
 *
 * Provides display-quote ranking and selection for pattern claims.
 *
 * Design principle: separates classification evidence selection from
 * display quote selection. The best clue for classification is not
 * always the best quote to show the user.
 *
 * Hard rule: no quote is better than a bad quote.
 * When no candidate meets the display threshold, returns null.
 *
 * No LLM calls. Rule-based, auditable scoring.
 */

import { analyzeBehavioralEligibility } from "./behavioral-filter";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuoteScore = {
  /** Composite score 0–100. Zero means disqualified. */
  score: number;
  /** Text starts with first-person ownership term (I / I'm / My / Me / etc.) */
  firstPersonOwnership: boolean;
  /** Text contains habit, self-judgment, or progress behavioral language */
  hasBehavioralLanguage: boolean;
  /** 0–1 brevity factor: 1.0 at ≤80 chars, linear decay to 0 at 250 chars */
  brevityFactor: number;
  // Hard disqualifiers — any true means score is 0
  isQuestion: boolean;
  isAssistantDirected: boolean;
  isQuotedOrPasted: boolean;
  isTooLong: boolean;
  isTooShort: boolean;
  isRawSelfAttack: boolean;
  /** No behavioral language — text is too vague to be a trustworthy receipt */
  isVague: boolean;
};

export type QuoteRejectionReason =
  | "raw_self_attack"
  | "question_like"
  | "assistant_directed"
  | "quoted_or_pasted"
  | "too_long"
  | "too_short"
  | "vague_no_behavioral_signal"
  | "below_score_threshold";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum character length for a display quote. Over this → disqualified. */
export const MAX_QUOTE_LENGTH = 250;

/**
 * Minimum composite score required to use text as a display quote.
 * Score of 40 requires at minimum: behavioral language + adequate brevity.
 * Score of 70+ requires first-person ownership + behavioral language.
 */
export const MIN_QUOTE_SCORE = 40;

// ── Internal helpers ──────────────────────────────────────────────────────────

/** True when text starts with a first-person ownership term. */
function detectFirstPersonOwnership(text: string): boolean {
  return /^(?:i\b|my\b|me\b)/i.test(text.trim());
}

/**
 * 0–1 brevity factor.
 * 1.0 at ≤80 chars, linear decay to 0.0 at 250 chars.
 */
function computeBrevityFactor(length: number): number {
  if (length <= 80) return 1.0;
  if (length >= 250) return 0.0;
  return 1.0 - (length - 80) / 170;
}

function normalizeQuoteText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Hard-block direct, severe self-attack statements from display quotes.
 * Keep this intentionally narrow so ordinary self-doubt language still survives.
 */
export function containsRawSelfAttackLanguage(text: string): boolean {
  const normalized = normalizeQuoteText(text);
  const rawSelfAttackPatterns = [
    /\bi hate myself\b/,
    /\bi hate who i am\b/,
    /\bi'?m such a failure\b/,
    /\bi am such a failure\b/,
    /\bi'?m a failure\b/,
    /\bi am a failure\b/,
    /\bi'?m worthless\b/,
    /\bi am worthless\b/,
    /\bi'?m pathetic\b/,
    /\bi am pathetic\b/,
    /\bi'?m disgusting\b/,
    /\bi am disgusting\b/,
  ];

  return rawSelfAttackPatterns.some((pattern) => pattern.test(normalized));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Score a text as a potential pattern-claim display quote.
 *
 * Score components (only when no disqualifier fires):
 *   firstPersonOwnership   +40
 *   hasBehavioralLanguage  +30
 *   brevityFactor × 30      0–30
 *
 * Hard disqualifiers (any → score=0):
 *   isQuestion, isAssistantDirected, isQuotedOrPasted,
 *   isTooLong, isTooShort, isVague (no behavioral language)
 *
 * Minimum useful score (MIN_QUOTE_SCORE=40):
 *   behavioral-only short quote scores 60; first-person + behavioral scores 70–100.
 */
export function scorePatternQuoteCandidate(text: string): QuoteScore {
  const t = text.trim();
  const el = analyzeBehavioralEligibility(t);
  const f = el.features;

  const isQuestion = f.questionLike;
  const isAssistantDirected = f.assistantDirected;
  const isQuotedOrPasted = f.likelyQuotedOrPasted;
  const isTooLong = t.length > MAX_QUOTE_LENGTH;
  const isTooShort = f.tooShort;
  const isRawSelfAttack = containsRawSelfAttackLanguage(t);

  const firstPersonOwnership = detectFirstPersonOwnership(t);
  const hasBehavioralLanguage =
    f.containsHabitLanguage ||
    f.containsSelfJudgmentLanguage ||
    f.containsProgressLanguage;

  // Behavioral language is required — purely autobiographical or generic text
  // is too vague to serve as a trustworthy receipt.
  const isVague = !hasBehavioralLanguage;

  const bFactor = computeBrevityFactor(t.length);

  const disqualified =
    isRawSelfAttack ||
    isQuestion ||
    isAssistantDirected ||
    isQuotedOrPasted ||
    isTooLong ||
    isTooShort ||
    isVague;

  if (disqualified) {
    return {
      score: 0,
      firstPersonOwnership,
      hasBehavioralLanguage,
      brevityFactor: bFactor,
      isQuestion,
      isAssistantDirected,
      isQuotedOrPasted,
      isTooLong,
      isTooShort,
      isRawSelfAttack,
      isVague,
    };
  }

  const score =
    (firstPersonOwnership ? 40 : 0) +
    (hasBehavioralLanguage ? 30 : 0) +
    Math.round(bFactor * 30);

  return {
    score,
    firstPersonOwnership,
    hasBehavioralLanguage,
    brevityFactor: bFactor,
    isQuestion,
    isAssistantDirected,
    isQuotedOrPasted,
    isTooLong,
    isTooShort,
    isRawSelfAttack,
    isVague,
  };
}

/**
 * Returns true when text meets the minimum bar for use as a display quote.
 */
export function isDisplaySafePatternQuote(text: string): boolean {
  return scorePatternQuoteCandidate(text).score >= MIN_QUOTE_SCORE;
}

/**
 * Select the best display quote from candidate messages.
 *
 * Scores each candidate on the original text (length checked before truncation).
 * Returns the highest-scoring text truncated to MAX_QUOTE_LENGTH, or null if
 * no candidate meets MIN_QUOTE_SCORE.
 *
 * Tie-breaking: last candidate wins (recency preference).
 *
 * Hard rule: returns null rather than a weak quote when no candidate qualifies.
 * A clue with no quote is preferable to a clue with a misleading receipt.
 */
export function selectBestDisplayQuote<T extends { content: string }>(
  candidates: T[]
): string | null {
  let best: string | null = null;
  let bestScore = MIN_QUOTE_SCORE - 1;

  for (const candidate of candidates) {
    const originalText = candidate.content.trim();
    const { score } = scorePatternQuoteCandidate(originalText);
    // Use >= so that later candidates win ties (recency as tie-breaker)
    if (score >= MIN_QUOTE_SCORE && score >= bestScore) {
      best = originalText.slice(0, MAX_QUOTE_LENGTH);
      bestScore = score;
    }
  }

  return best;
}
