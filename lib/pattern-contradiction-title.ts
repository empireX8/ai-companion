import type { PatternContradictionView } from "./patterns-api";

const MAX_TITLE_SIDE_WORDS = 7;
const MAX_TITLE_SIDE_LENGTH = 44;
const MAX_TITLE_LENGTH = 72;

const DISCOURSE_OPENERS = [
  /^(?:well|so|and|but)\b[\s,.-]*/i,
  /^(?:honestly|basically|actually|literally|maybe|probably)\b[\s,.-]*/i,
  /^(?:i mean|you know|kind of|sort of)\b[\s,.-]*/i,
  /^(?:i think|i guess|i feel like|it feels like|it seems like|it's like)\s+/i,
] as const;

const CLAUSE_SPLITTERS = [
  /[.!?;:]+/,
  /\s+(?:but|however|though|although|yet|because|since|when|while)\s+/i,
  /,\s+/,
] as const;

const HIGH_SIGNAL_PATTERNS = [
  /\bkeep\b/i,
  /\bskipp(?:ed|ing)\b/i,
  /\bavoid(?:ed|ing)\b/i,
  /\bprocrastinat(?:ed|ing)\b/i,
  /\bresist(?:ed|ing)?\b/i,
  /\brel(?:ied|ying)\s+on\b/i,
  /\bcopy(?:ied|ing)\b/i,
  /\bdefault(?:ed|ing)\s+to\b/i,
  /\bfell\s+back\s+to\b/i,
] as const;

const MEDIUM_SIGNAL_PATTERNS = [
  /\bwant(?:ed)?\b/i,
  /\bneed(?:ed)?\b/i,
  /\btrying\b/i,
  /\bworking\s+on\b/i,
  /\bplan(?:ning)?\b/i,
  /\bhope(?:ing)?\b/i,
  /\bdescrib(?:e|ing)\b/i,
  /\bmention(?:ed|ing)?\b/i,
] as const;

const TRAILING_DETAIL_SPLITTERS = [
  /\s+(?:because|since|when|while|so that)\s+/i,
] as const;

type SummaryCandidate = {
  text: string;
  score: number;
};

type PhraseVariant = {
  text: string;
  bias: number;
};

type PhraseTransform = {
  pattern: RegExp;
  preferred: (body: string) => string | null;
  alternate?: (body: string) => string | null;
  preferredBias: number;
  alternateBias?: number;
};

const PHRASE_TRANSFORMS: readonly PhraseTransform[] = [
  {
    pattern: /^(?:i|you)\s+(?:just\s+)?want(?:ed)?\s+to\s+(.+)$/i,
    preferred: (body) => `wanting to ${body}`,
    alternate: (body) => body,
    preferredBias: 1.5,
    alternateBias: 1.0,
  },
  {
    pattern: /^(?:i|you)\s+(?:just\s+)?want(?:ed)?\s+(.+)$/i,
    preferred: (body) => `wanting ${body}`,
    alternate: (body) => body,
    preferredBias: 1.5,
    alternateBias: 1.0,
  },
  {
    pattern: /^(?:i|you)\s+(?:just\s+)?need(?:ed)?\s+to\s+(.+)$/i,
    preferred: (body) => `needing to ${body}`,
    alternate: (body) => body,
    preferredBias: 1.25,
    alternateBias: 0.95,
  },
  {
    pattern: /^(?:i|you)\s+(?:just\s+)?need(?:ed)?\s+(.+)$/i,
    preferred: (body) => `needing ${body}`,
    alternate: (body) => body,
    preferredBias: 1.25,
    alternateBias: 0.95,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?keep\s+trying\s+to\s+(.+)$/i,
    preferred: (body) => `trying to ${body}`,
    alternate: (body) => body,
    preferredBias: 1.15,
    alternateBias: 0.9,
  },
  {
    pattern:
      /^(?:i(?:'m| am)|you(?:'re| are))\s+trying\s+to\s+(.+)$/i,
    preferred: (body) => `trying to ${body}`,
    alternate: (body) => body,
    preferredBias: 1.15,
    alternateBias: 0.9,
  },
  {
    pattern:
      /^(?:i(?:'m| am)|you(?:'re| are))\s+working\s+on\s+(.+)$/i,
    preferred: (body) => `working on ${body}`,
    alternate: (body) => body,
    preferredBias: 1.05,
    alternateBias: 0.85,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?keep\s+rel(?:ying|ied)\s+on\s+(.+)$/i,
    preferred: (body) => `relying on ${body}`,
    alternate: (body) => body,
    preferredBias: 1.2,
    alternateBias: 0.65,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?rel(?:ying|ied)\s+on\s+(.+)$/i,
    preferred: (body) => `relying on ${body}`,
    alternate: (body) => body,
    preferredBias: 1.2,
    alternateBias: 0.65,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?resist(?:ing|ed)?\s+(.+)$/i,
    preferred: (body) => `resisting ${body}`,
    alternate: (body) => body,
    preferredBias: 1.15,
    alternateBias: 0.6,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?avoid(?:ing|ed)?\s+(.+)$/i,
    preferred: (body) => `avoiding ${body}`,
    alternate: (body) => body,
    preferredBias: 1.15,
    alternateBias: 0.6,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?procrastinat(?:ed|ing)\s+(.+)$/i,
    preferred: (body) => `procrastinating ${body}`,
    alternate: (body) => body,
    preferredBias: 1.1,
    alternateBias: 0.45,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?default(?:ed|ing)\s+to\s+(.+)$/i,
    preferred: (body) => `defaulting to ${body}`,
    alternate: (body) => body,
    preferredBias: 1.1,
    alternateBias: 0.55,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?fell\s+back\s+to\s+(.+)$/i,
    preferred: (body) => `falling back to ${body}`,
    alternate: (body) => body,
    preferredBias: 1.1,
    alternateBias: 0.55,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?cop(?:ied|ying)\s+(.+)$/i,
    preferred: (body) => `copying ${body}`,
    alternate: (body) => body,
    preferredBias: 0.95,
    alternateBias: 0.7,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?mak(?:e|es|ing|ed)\s+(.+)$/i,
    preferred: (body) => body,
    alternate: (body) => `making ${body}`,
    preferredBias: 1.2,
    alternateBias: 0.2,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?chang(?:e|es|ing|ed)\s+(.+)$/i,
    preferred: (body) => body,
    alternate: (body) => `changing ${body}`,
    preferredBias: 1.1,
    alternateBias: 0.2,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?miss(?:ed|ing)\s+(.+)$/i,
    preferred: (body) => `missing ${body}`,
    alternate: (body) => body,
    preferredBias: 0.95,
    alternateBias: 0.55,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?(?:keep\s+)?skip(?:ped|ping)\s+(.+)$/i,
    preferred: (body) => `skipping ${body}`,
    alternate: (body) => body,
    preferredBias: 1.05,
    alternateBias: 0.5,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?do(?:n't| not)\s+know\s+(.+)$/i,
    preferred: (body) => `not knowing ${body}`,
    alternate: (body) => body,
    preferredBias: 0.95,
    alternateBias: 0.7,
  },
  {
    pattern:
      /^(?:i(?:'m| am)|you(?:'re| are))\s+not\s+sure\s+(.+)$/i,
    preferred: (body) => `not sure ${body}`,
    alternate: (body) => body,
    preferredBias: 0.95,
    alternateBias: 0.7,
  },
  {
    pattern:
      /^(?:i|you)\s+(?:just\s+)?keep\s+(?:describing|describe|talking about|mentioning|noticing)\s+(.+)$/i,
    preferred: (body) => body,
    preferredBias: 1.25,
  },
  {
    pattern:
      /^(?:describing|describe|talking about|mentioning|noticing)\s+(.+)$/i,
    preferred: (body) => body,
    preferredBias: 1.25,
  },
] as const;

export function normalizeContradictionText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[("'`\[{]+/, "")
    .replace(/[)"'`\]}]+$/, "")
    .trim();
}

function getWordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function stripOpeners(value: string): string {
  let result = value.trim();
  let changed = true;

  while (changed) {
    changed = false;
    for (const pattern of DISCOURSE_OPENERS) {
      const next = result.replace(pattern, "").trim();
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }

  return result;
}

function trimTrailingDetail(value: string): string {
  let result = value.trim();

  for (const splitter of TRAILING_DETAIL_SPLITTERS) {
    const parts = result.split(splitter);
    if (parts.length < 2) {
      continue;
    }

    const candidate = parts[0]?.trim() ?? "";
    if (getWordCount(candidate) >= 3) {
      result = candidate;
    }
  }

  return result;
}

function dropLeadingArticle(value: string): string {
  if (getWordCount(value) <= 2) {
    return value;
  }

  return value.replace(/^(?:a|an|the)\s+/i, "").trim();
}

function normalizeSummaryBody(value: string): string {
  return dropLeadingArticle(
    trimTrailingDetail(normalizeContradictionText(value))
      .replace(/[.,;:!?]+$/g, "")
      .trim()
  );
}

function buildClauseCandidates(value: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const push = (candidate: string) => {
    const normalized = normalizeContradictionText(candidate);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  };

  push(value);

  for (const splitter of CLAUSE_SPLITTERS) {
    for (const existing of [...candidates]) {
      for (const part of existing.split(splitter)) {
        push(part);
      }
    }
  }

  return candidates;
}

function truncatePhrase(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  let result = value.trim();
  let truncated = false;

  if (words.length > MAX_TITLE_SIDE_WORDS) {
    result = words.slice(0, MAX_TITLE_SIDE_WORDS).join(" ");
    truncated = true;
  }

  if (result.length > MAX_TITLE_SIDE_LENGTH) {
    const slice = result.slice(0, MAX_TITLE_SIDE_LENGTH - 1);
    const lastSpace = slice.lastIndexOf(" ");
    result = slice.slice(0, lastSpace >= 20 ? lastSpace : slice.length).trimEnd();
    truncated = true;
  }

  result = result.replace(/[.,;:!?]+$/g, "").trim();
  return truncated ? `${result}…` : result;
}

function capitalizeFirst(value: string): string {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function truncateFallback(value: string, maxLength: number): string {
  const normalized = normalizeContradictionText(value).replace(/[.,;:!?]+$/g, "");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cutoff = lastSpace >= Math.floor(maxLength * 0.6) ? lastSpace : slice.length;
  return `${slice.slice(0, cutoff).trimEnd()}…`;
}

function scoreCandidate(original: string, cleaned: string): number {
  const wordCount = getWordCount(cleaned);
  let score = 0;

  if (wordCount >= 3 && wordCount <= 9) {
    score += 2;
  } else if (wordCount === 2) {
    score += 1;
  } else if (wordCount > 12) {
    score -= 1;
  }

  if (/^(?:i|you)\b/i.test(original)) {
    score += 0.4;
  }

  for (const pattern of HIGH_SIGNAL_PATTERNS) {
    if (pattern.test(original)) {
      score += 2.5;
    }
  }

  for (const pattern of MEDIUM_SIGNAL_PATTERNS) {
    if (pattern.test(original)) {
      score += 1.25;
    }
  }

  score -= Math.max(0, wordCount - 9) * 0.15;
  score -= cleaned.length * 0.01;

  return score;
}

function hasSignalPattern(value: string): boolean {
  return [...HIGH_SIGNAL_PATTERNS, ...MEDIUM_SIGNAL_PATTERNS].some((pattern) =>
    pattern.test(value)
  );
}

function buildPhraseVariants(value: string): PhraseVariant[] {
  const normalized = normalizeSummaryBody(value);
  if (!normalized) {
    return [];
  }

  for (const transform of PHRASE_TRANSFORMS) {
    const match = normalized.match(transform.pattern);
    if (!match) {
      continue;
    }

    const body = normalizeSummaryBody(match[1] ?? "");
    if (!body) {
      continue;
    }

    const variants: PhraseVariant[] = [];
    const preferred = transform.preferred(body)?.trim();
    if (preferred) {
      variants.push({ text: preferred, bias: transform.preferredBias });
    }

    const alternate = transform.alternate?.(body)?.trim();
    if (alternate && alternate.toLowerCase() !== preferred?.toLowerCase()) {
      variants.push({
        text: alternate,
        bias: transform.alternateBias ?? transform.preferredBias - 0.4,
      });
    }

    return variants;
  }

  return [{ text: normalized, bias: 0.9 }];
}

function buildSummaryCandidates(value: string): SummaryCandidate[] {
  const normalized = normalizeContradictionText(value);
  if (!normalized) {
    return [];
  }

  const seen = new Set<string>();
  const candidates: SummaryCandidate[] = [];

  buildClauseCandidates(normalized).forEach((candidate, clauseIndex) => {
    const clause = stripOpeners(candidate);
    if (!clause) {
      return;
    }

    buildPhraseVariants(clause).forEach((variant, variantIndex) => {
      const text = truncatePhrase(variant.text);
      if (!text) {
        return;
      }

      const dedupeKey = text.toLowerCase();
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);

      candidates.push({
        text,
        score:
          scoreCandidate(candidate, variant.text) +
          variant.bias -
          clauseIndex * 0.2 -
          variantIndex * 0.05 -
          (clauseIndex > 0 && !hasSignalPattern(candidate) ? 1.4 : 0),
      });
    });
  });

  return candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.text.length !== right.text.length) {
      return left.text.length - right.text.length;
    }

    return left.text.localeCompare(right.text);
  });
}

function buildPrimaryTitle(
  left: SummaryCandidate | undefined,
  right: SummaryCandidate | undefined,
  fallbackTitle: string
): string {
  if (left?.text && right?.text) {
    return capitalizeFirst(`${left.text} vs ${right.text}`);
  }

  return truncateFallback(fallbackTitle, MAX_TITLE_LENGTH);
}

export function summarizeContradictionSide(value: string): string {
  return buildSummaryCandidates(value)[0]?.text ?? "";
}

export function formatContradictionPrimaryTitles(
  items: PatternContradictionView[]
): Map<string, string> {
  return new Map(
    items.map((item) => [
      item.id,
      buildPrimaryTitle(
        buildSummaryCandidates(item.sideA)[0],
        buildSummaryCandidates(item.sideB)[0],
        item.title
      ),
    ])
  );
}

export function formatContradictionPrimaryTitle(
  item: PatternContradictionView
): string {
  return (
    formatContradictionPrimaryTitles([item]).get(item.id) ??
    truncateFallback(item.title, MAX_TITLE_LENGTH)
  );
}
