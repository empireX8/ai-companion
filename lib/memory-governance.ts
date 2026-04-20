type GovernedType = "preference" | "goal" | "constraint";
type ReferenceIntentType = GovernedType | "rule";

const NORMALIZE_APOSTROPHES_PATTERN = /[\u2018\u2019]/g;

const GOVERNANCE_TRIGGER_PATTERNS = [
  /\bi dont\b/i,
  /\bi don't\b/i,
  /\bi do not\b/i,
  /\bnot anymore\b/i,
  /\banymore\b/i,
  /\bno more\b/i,
  /\bi like .*\bagain\b/i,
  /\bi like .*\bnow\b/i,
  /\bi prefer .*\bagain\b/i,
  /\bi prefer .*\bnow\b/i,
  /\bactually\b/i,
  /\bchanged my mind\b/i,
  /\binstead\b/i,
  /\bno longer\b/i,
];

const EXPLICIT_MEMORY_CAPTURE_PATTERN =
  /^(?:please\s+)?remember(?:\s+this(?:\s+for\s+future\s+chats?)?)?(?:\s*[:,-]\s*|\s+that\s+|\s+)/i;

const RULE_LIKE_PATTERN = /^when i say .* respond with exactly/i;

const AFFIRMATIVE_TOKENS = [
  "yes",
  "y",
  "yeah",
  "yep",
  "correct",
  "do it",
  "update it",
  "please do",
  "confirm",
];

const NEGATIVE_TOKENS = [
  "no",
  "n",
  "nope",
  "don't",
  "do not",
  "leave it",
  "keep it",
  "cancel",
];

export const GOVERNANCE_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "you",
  "your",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "will",
  "would",
  "should",
  "can",
  "could",
  "from",
  "into",
  "onto",
  "about",
  "just",
  "really",
  "very",
  "more",
  "less",
  "not",
  "dont",
  "don't",
  "doesnt",
  "doesn't",
  "didnt",
  "didn't",
  "anymore",
  "again",
  "like",
  "dislike",
  "prefer",
  "preference",
  "say",
  "respond",
  "exactly",
  "when",
]);

type PreferenceItem = { id: string; type: string; statement: string };

const normalizeGovernanceContent = (content: string) =>
  content.replace(NORMALIZE_APOSTROPHES_PATTERN, "'").replace(/\s+/g, " ").trim();

const hasExplicitMemoryCaptureIntent = (content: string) =>
  EXPLICIT_MEMORY_CAPTURE_PATTERN.test(normalizeGovernanceContent(content));

export const extractMemoryStatement = (content: string) => {
  const normalized = normalizeGovernanceContent(content);
  const extracted = normalized.replace(EXPLICIT_MEMORY_CAPTURE_PATTERN, "").trim();
  return extracted || normalized;
};

const startsWithIntentToken = (content: string, tokens: string[]) => {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return tokens.some(
    (token) =>
      normalized === token ||
      normalized.startsWith(`${token} `) ||
      normalized.startsWith(`${token},`) ||
      normalized.startsWith(`${token}.`) ||
      normalized.startsWith(`${token}!`)
  );
};

export const isRuleLikeStatement = (statement: string) => {
  return RULE_LIKE_PATTERN.test(statement.trim().toLowerCase());
};

const chooseTopicAwarePreference = (items: PreferenceItem[]) => {
  const nonRuleItems = items.filter((item) => !isRuleLikeStatement(item.statement));
  return nonRuleItems.length > 0 ? nonRuleItems : items;
};

export const detectReferenceIntentType = (content: string): ReferenceIntentType | null => {
  if (RULE_LIKE_PATTERN.test(content.trim())) {
    return "rule";
  }

  // Goal: requires first-person ownership — "my goal", "I want to", "I'm trying to", etc.
  if (
    /\bmy\s+(?:goal|objective|aim|purpose)\b|\bi\s+(?:want|need|intend|plan|aim|hope)\s+to\b|\bi(?:'m|\s+am)\s+trying\s+to\b|\bi(?:'d|\s+would)\s+like\s+to\b/i.test(
      content
    )
  ) {
    return "goal";
  }

  if (
    /\bprefer\b|\bpreference\b|\bi like\b|\bi dislike\b|\bi dont like\b|\bi don't like\b|\bi do not like\b/i.test(
      content
    )
  ) {
    return "preference";
  }

  // Constraint: requires first-person — "I must", "I cannot", "I will never", "my rule", etc.
  if (
    /\bi\s+(?:must|cannot|can't|will\s+never|can\s+never)\b|\bi\s+(?:always|never)\s+\w|\bmy\s+(?:rule|constraint|limit)\b/i.test(
      content
    )
  ) {
    return "constraint";
  }

  return null;
};

export const detectNativeReferenceIntentType = (content: string): GovernedType | null => {
  const statement = extractMemoryStatement(content);
  const intent = detectReferenceIntentType(statement);
  if (intent === "preference" || intent === "goal" || intent === "constraint") {
    return intent;
  }

  if (
    hasExplicitMemoryCaptureIntent(content) &&
    /\bi\s+do\s+better\s+with\b|\bi\s+work\s+better\s+with\b|\bi\s+work\s+best\s+with\b|\bi\s+respond\s+better\s+to\b/i.test(
      statement
    )
  ) {
    return "preference";
  }

  return null;
};

export const shouldPromptForMemoryUpdate = (content: string) => {
  const normalized = normalizeGovernanceContent(content);
  if (hasExplicitMemoryCaptureIntent(normalized)) {
    return true;
  }

  return GOVERNANCE_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
};

/**
 * Write-path quality gate — returns true only if the message is worth
 * storing as a memory candidate. Applied before any ReferenceItem write.
 *
 * Rejects: too short, too few words, questions, messages that don't start
 * with a first-person or declarative signal.
 */
export const isWriteableMemoryStatement = (content: string): boolean => {
  const t = extractMemoryStatement(content);
  if (t.length < 25) return false;
  const wordCount = (t.match(/\b\w{2,}\b/g) ?? []).length;
  if (wordCount < 5) return false;
  // Questions are not memory statements
  if (t.endsWith("?")) return false;
  // Must start with a first-person signal or a first-person temporal clause.
  if (
    !/^(?:i\b|my\b|i'|i'm\b|i've\b|i'll\b|i'd\b|(?:when|if)\s+(?:i\b|my\b|i'|i'm\b))/i.test(
      t
    )
  ) {
    return false;
  }
  return true;
};

export const isAffirmative = (content: string) => {
  return startsWithIntentToken(content, AFFIRMATIVE_TOKENS);
};

export const isNegative = (content: string) => {
  return startsWithIntentToken(content, NEGATIVE_TOKENS);
};

export const tokenizeMeaningful = (value: string) => {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !GOVERNANCE_STOPWORDS.has(token));
};

export const scoreTokenOverlap = (left: string, right: string) => {
  const leftTokens = new Set(tokenizeMeaningful(left));
  const rightTokens = new Set(tokenizeMeaningful(right));
  let score = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      score += 1;
    }
  }

  return score;
};

export const pickBestPreferenceMatch = (items: PreferenceItem[], content: string) => {
  const scopedItems = chooseTopicAwarePreference(items);
  const contentTokens = new Set(tokenizeMeaningful(content));

  if (scopedItems.length === 0) {
    return { item: null, score: 0 };
  }

  if (contentTokens.size === 0) {
    return { item: scopedItems[0], score: 0 };
  }

  let bestItem = scopedItems[0];
  let bestScore = -1;

  for (const item of scopedItems) {
    const score = scoreTokenOverlap(item.statement, content);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { item: bestItem, score: bestScore };
};
