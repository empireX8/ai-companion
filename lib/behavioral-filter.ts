/**
 * Behavioral Filter (Phase 1 — Precision Gate)
 *
 * Precision-first gating layer that decides whether a user message is
 * eligible for behavioral pattern analysis before any family detector runs.
 *
 * Goal: stop non-behavioral text from reaching pattern-family detectors.
 *
 * Design constraints:
 *  - No LLM calls
 *  - No schema changes
 *  - Precision over recall — abstain over guess
 *  - Structured output for auditability
 *
 * Integration: called in pattern-detector-v1.ts after synthesizeHistory,
 * before any family detector receives entries.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type BehavioralFilterFeatures = {
  /** Message starts with "I" — clean self-referential start */
  firstPersonStart: boolean;
  /** Message contains "I", "me", "my", or "myself" anywhere */
  firstPersonAnywhere: boolean;
  /** Contains habitual, recurring, or trigger-response behavior language */
  containsHabitLanguage: boolean;
  /** Contains self-judgment, self-doubt, or self-labeling language */
  containsSelfJudgmentLanguage: boolean;
  /** Contains progress, recovery, or improvement language */
  containsProgressLanguage: boolean;
  /** Ends with "?" — structured as a question */
  questionLike: boolean;
  /** Addresses the AI directly ("you're", "can you", etc.) */
  assistantDirected: boolean;
  /** Opens with a command or request ("let's", "help me", etc.) */
  imperativeLike: boolean;
  /** Under minimum length for behavioral analysis */
  tooShort: boolean;
  /** Appears to be pasted/quoted/system content */
  likelyQuotedOrPasted: boolean;
  /** Appears to be a third-party topic query, not self-referential */
  likelyTopicQuery: boolean;
};

export type BehavioralFilterResult = {
  /** True if the message should proceed to family detectors */
  eligible: boolean;
  /**
   * Why the message was accepted or rejected.
   * Rejected: which disqualifying features fired.
   * Accepted: which positive signals were present.
   */
  reasons: string[];
  features: BehavioralFilterFeatures;
};

// ── Thresholds ────────────────────────────────────────────────────────────────

const MIN_BEHAVIORAL_LENGTH = 15;

// ── Public API — individual signal functions ──────────────────────────────────

/**
 * True if the message contains first-person singular pronouns.
 * Necessary but not sufficient for behavioral eligibility.
 */
export function isSelfReferential(text: string): boolean {
  return /\b(?:i|me|my|myself)\b/i.test(text);
}

/**
 * True if the message ends with "?" — structured as a question.
 */
export function isQuestionLike(text: string): boolean {
  return text.trim().endsWith("?");
}

/**
 * True if the message is directed at the assistant rather than
 * describing the user's own behavior.
 */
export function isAssistantDirected(text: string): boolean {
  const t = text.trim();
  // "you're", "you are", "you were", "you seem", "you keep", "you finally", etc.
  if (
    /\byou(?:'re|\s+are|\s+were|\s+seem\s+to|\s+finally|\s+always|\s+keep|\s+don't|\s+haven't|\s+sound)\b/i.test(
      t
    )
  )
    return true;
  // "can you", "could you", "would you"
  if (/\b(?:can|could|would|please)\s+you\b/i.test(t)) return true;
  // Starts with "can you", "could you", "would you"
  if (/^(?:can|could|would)\s+you\b/i.test(t)) return true;
  return false;
}

/**
 * True if the message is suitable as an evidence quote:
 *  - Passes behavioral eligibility
 *  - Starts with "I" (not "me"/"my" or a mid-sentence fragment)
 *  - Under 300 characters
 *  - Not speaker-prefixed (e.g. "User: ...")
 */
export function isEvidenceEligible(text: string): boolean {
  const t = text.trim();
  if (!analyzeBehavioralEligibility(t).eligible) return false;
  if (!/^i\b/i.test(t)) return false;
  if (t.length > 300) return false;
  if (/^.{0,30}:/.test(t)) return false;
  return true;
}

/**
 * True if the message is the preferred kind of evidence representative:
 * starts with "I", under 300 characters, and not speaker-prefixed.
 *
 * Soft preference for selectEvidenceRepresentative — not a hard gate.
 * Messages that do not satisfy this may still be used as fallback representatives.
 */
export function isEvidencePreferred(text: string): boolean {
  const t = text.trim();
  if (t.length > 300) return false;
  if (/^.{0,30}:/.test(t)) return false;
  return /^i\b/i.test(t);
}

/**
 * Select the best evidence representative from a candidate list.
 *
 * Prefers the last I-starting, ≤300-char, non-colon-prefixed candidate.
 * Falls back to the last candidate if none qualify.
 *
 * Never silently drops a claim — always returns a candidate if the list
 * is non-empty. Replaces detector-local hard I-start gates that would
 * silently return [] when no I-starting message existed.
 */
export function selectEvidenceRepresentative<T extends { content: string }>(
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null;
  const preferred = candidates.filter((e) => isEvidencePreferred(e.content));
  return preferred.length > 0
    ? preferred[preferred.length - 1]!
    : candidates[candidates.length - 1]!;
}

// ── Private signal helpers ────────────────────────────────────────────────────

function detectImperativeLike(text: string): boolean {
  return /^(?:let(?:'s|\s+me|\s+us)|help\s+me|tell\s+me|show\s+me|walk\s+me|give\s+me|make\s+me|remind\s+me|think\s+(?:about|through))\b/i.test(
    text.trim()
  );
}

function detectTopicQuery(text: string): boolean {
  const t = text.trim();
  // "How [adjective/amount] ..." — topic query form, not self-referential
  if (
    /^how\s+(?:difficult|hard|easy|long|much|many|often|far|old|big|small|would|does|do|did|is|are|can|could|likely|possible)\b/i.test(
      t
    )
  )
    return true;
  // "What is/are/was/were/does..." — topic query when subject is not "I"
  if (
    /^what(?:'s|\s+is|\s+are|\s+was|\s+were|\s+does|\s+do|\s+did|\s+would|\s+will)\s+(?!i\b)/i.test(
      t
    )
  )
    return true;
  // "When does/did/will..." — topic query when subject is not "I"
  if (
    /^when\s+(?:does|did|will|would|is|are|was|were|can|could)\s+(?!i\b)/i.test(
      t
    )
  )
    return true;
  // "Where does/did/is..." — topic query when subject is not "I"
  if (
    /^where\s+(?:does|did|is|are|will|would|can|could)\s+(?!i\b)/i.test(t)
  )
    return true;
  // "Which..." or "Who..." — almost always a topic query
  if (/^(?:which|who)\s/i.test(t)) return true;
  return false;
}

function detectQuotedOrPasted(text: string): boolean {
  const t = text.trim();
  if (/```/.test(t)) return true;
  if (/^https?:\/\//m.test(t)) return true;
  if (/^(?:user|assistant|system|human|ai):\s/im.test(t)) return true;
  // Shell prompt / terminal output: "user@host % cmd", "$ cmd", "% cmd"
  if (/^(?:\w+@[\w.-]+[\s:~]*[$%]|[$%])\s/m.test(t)) return true;
  // JavaScript/TypeScript error text at line start
  if (/^(?:TypeError|SyntaxError|ReferenceError|RangeError|EvalError|URIError):/m.test(t)) return true;
  // Stack trace indented lines ("    at Object.<anonymous>")
  if (/^\s{2,}at\s+\S/m.test(t)) return true;
  // Structured log lines: timestamped or level-prefixed
  if (/^(?:\[\d{4}-\d{2}-\d{2}|\[(?:INFO|WARN|ERROR|DEBUG|FATAL)\]|(?:INFO|WARN|ERROR|DEBUG|FATAL):\s)/m.test(t)) return true;
  return false;
}

function detectHabitLanguage(text: string): boolean {
  return (
    // Explicit habit/frequency words
    /\b(?:always|tend\s+to|every\s+time|keeps?\s+\w+ing|usually|typically|by\s+default|instinctively|automatically|habitually)\b/i.test(
      text
    ) ||
    // "I (always) end up"
    /\bi\s+(?:always\s+)?end\s+up\b/i.test(text) ||
    // "I notice (that) I" — self-observation of a pattern
    /\bi\s+notice\s+(?:that\s+)?i\b/i.test(text) ||
    /\b(?:i\s+)?default\s+to\b/i.test(text) ||
    // "my default / go-to / pattern / habit / instinct"
    /\bmy\s+(?:default|go-?to|pattern|habit|instinct|first\s+instinct)\b/i.test(
      text
    ) ||
    /\bwalk\s+back\s+(?:my|the)\b/i.test(text) ||
    /\bappeas(?:e|ing)\b/i.test(text) ||
    // Trigger-response: "triggers me", "makes me want/feel"
    /\btriggers?\s+(?:me|my)\b/i.test(text) ||
    /\bmakes?\s+me\s+(?:want|feel|start|tend)\b/i.test(text) ||
    // Recurrence markers
    /\b(?:same\s+(?:pattern|cycle|thing|mistake|loop)|over\s+and\s+over|back\s+to\s+(?:square\s+one|the\s+same))\b/i.test(
      text
    ) ||
    /\bagain\b/i.test(text) ||
    // "I find myself"
    /\bi\s+find\s+myself\b/i.test(text) ||
    /\bkeep\s+(?:ending\s+up|finding\s+myself|going\s+back)\b/i.test(text) ||
    /\bas\s+usual\b/i.test(text)
  );
}

function detectSelfJudgmentLanguage(text: string): boolean {
  return (
    /\bstruggle\b/i.test(text) ||
    /\bregret\b/i.test(text) ||
    /\bdoubt\s+myself\b/i.test(text) ||
    /\bhate\s+myself\b/i.test(text) ||
    /\bsecond-?guess\b/i.test(text) ||
    /\bi\s+(?:find\s+it\s+)?(?:hard|difficult)\s+to\b/i.test(text) ||
    /\bi\s+have\s+(?:a\s+hard\s+time|trouble|difficulty)\s+(?:with\b|\w+ing)/i.test(text) ||
    /\bi\s+(?:probably|honestly)\s+(?:can't|cannot|won't\s+be\s+able)\b/i.test(text) ||
    /\bi'?m\s+(?:worried|afraid|scared)\s+(?:that\s+)?i'?(?:ll|m\s+going\s+to)\b/i.test(text) ||
    /\b(?:people[-\s]?pleaser|perfectionist|procrastinat\w+|overthink\w*)\b/i.test(
      text
    ) ||
    /\bi'?m\s+(?:so\s+)?(?:terrible|awful|bad|horrible|pathetic|useless)\s+at\b/i.test(
      text
    ) ||
    /\bi'?m\s+not\s+(?:good\s+enough|sure\s+i\s+can|capable)\b/i.test(text) ||
    /\bi\s+(?:can't|cannot)\s+(?:seem\s+to\s+)?(?:do|get|make|keep|stop|finish|follow)\b/i.test(
      text
    ) ||
    /\bi\s+(?:never\s+)?(?:follow\s+through|stick\s+with|commit\s+to)\b/i.test(
      text
    ) ||
    /\bnot\s+(?:my\s+)?(?:strong\s+)?(?:suit|point)\b/i.test(text) ||
    /\bself-?(?:sabotage|doubt|criticism|critical|blame)\b/i.test(text)
  );
}

function detectProgressLanguage(text: string): boolean {
  return (
    /\b(?:doing|getting|feeling)\s+better\b/i.test(text) ||
    /\bdoing\s+a\s+better\s+job\b/i.test(text) ||
    /\b(?:making|seeing|noticing)\s+(?:real\s+)?progress\b/i.test(text) ||
    /\bi\s+(?:managed|was\s+able)\s+to\b/i.test(text) ||
    /\bproud\s+of\s+(?:myself|how)\b/i.test(text) ||
    /\b(?:finally|actually)\s+(?:did\s+it|managed|overcame|broke|succeeded|stuck\s+with)\b/i.test(
      text
    ) ||
    /\b(?:recovering|bouncing\s+back|stabiliz\w+|rebuilding)\b/i.test(text) ||
    /\bstabiliz\w+\s+faster\b/i.test(text) ||
    /\bi'?ve\s+been\s+keeping\s+(?:up|at\s+it|going)\b/i.test(text) ||
    /\b(?:improving|improved)\b/i.test(text)
  );
}

// ── Core analysis ─────────────────────────────────────────────────────────────

/**
 * Analyze whether a message is eligible for behavioral pattern analysis.
 *
 * Returns a structured result with the eligibility decision, the reasons,
 * and all feature flags for auditability.
 *
 * Disqualifiers (any one → reject):
 *  - tooShort, likelyQuotedOrPasted, questionLike, assistantDirected,
 *    imperativeLike, likelyTopicQuery, no first-person pronoun
 *
 * Positive requirement (must have at least one):
 *  - containsHabitLanguage, containsSelfJudgmentLanguage, containsProgressLanguage
 */
export function analyzeBehavioralEligibility(
  text: string
): BehavioralFilterResult {
  const t = text.trim();

  const features: BehavioralFilterFeatures = {
    firstPersonStart: /^i\b/i.test(t),
    firstPersonAnywhere: isSelfReferential(t),
    containsHabitLanguage: detectHabitLanguage(t),
    containsSelfJudgmentLanguage: detectSelfJudgmentLanguage(t),
    containsProgressLanguage: detectProgressLanguage(t),
    questionLike: isQuestionLike(t),
    assistantDirected: isAssistantDirected(t),
    imperativeLike: detectImperativeLike(t),
    tooShort: t.length < MIN_BEHAVIORAL_LENGTH,
    likelyQuotedOrPasted: detectQuotedOrPasted(t),
    likelyTopicQuery: detectTopicQuery(t),
  };

  // ── Disqualifiers — any one rejects the message ───────────────────────────
  const disqualifiers: string[] = [];
  if (features.tooShort) disqualifiers.push("too_short");
  if (features.likelyQuotedOrPasted) disqualifiers.push("likely_quoted_or_pasted");
  if (features.questionLike) disqualifiers.push("question_like");
  if (features.assistantDirected) disqualifiers.push("assistant_directed");
  if (features.imperativeLike) disqualifiers.push("imperative_like");
  if (features.likelyTopicQuery) disqualifiers.push("likely_topic_query");
  if (!features.firstPersonAnywhere) disqualifiers.push("no_first_person");

  if (disqualifiers.length > 0) {
    return { eligible: false, reasons: disqualifiers, features };
  }

  // ── Positive signal — at least one behavioral language marker required ─────
  const hasBehavioralSignal =
    features.containsHabitLanguage ||
    features.containsSelfJudgmentLanguage ||
    features.containsProgressLanguage;

  if (!hasBehavioralSignal) {
    return { eligible: false, reasons: ["no_behavioral_signal"], features };
  }

  // ── Eligible ──────────────────────────────────────────────────────────────
  const positive: string[] = [];
  if (features.containsHabitLanguage) positive.push("has_habit_language");
  if (features.containsSelfJudgmentLanguage)
    positive.push("has_self_judgment_language");
  if (features.containsProgressLanguage) positive.push("has_progress_language");
  if (features.firstPersonStart) positive.push("first_person_start");

  return { eligible: true, reasons: positive, features };
}

// ── Entry-array filter ────────────────────────────────────────────────────────

/**
 * Filter an entry array to only entries that are:
 *  1. user-authored (role === "user")
 *  2. eligible for behavioral pattern analysis
 *
 * The output stream contains exclusively behavioral user messages.
 * Non-user messages (assistant, system) are excluded — family detectors
 * operate only on user-authored behavioral content.
 */
export function filterBehavioralMessages<
  T extends { role: string; content: string },
>(entries: T[]): T[] {
  return entries.filter(
    (e) => e.role === "user" && analyzeBehavioralEligibility(e.content).eligible
  );
}
