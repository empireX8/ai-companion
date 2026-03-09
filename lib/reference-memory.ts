import prismadb from "@/lib/prismadb";
import { scoreTokenOverlap } from "./memory-governance";

type ReferenceType =
  | "constraint"
  | "preference"
  | "goal"
  | "pattern"
  | "assumption"
  | "hypothesis";

type ReferenceConfidence = "low" | "medium" | "high";

type MemoryRow = {
  type: ReferenceType;
  statement: string;
  confidence: ReferenceConfidence;
  createdAt: Date;
  updatedAt: Date;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
};

const TYPE_ORDER: ReferenceType[] = [
  "constraint",
  "preference",
  "goal",
  "pattern",
  "assumption",
  "hypothesis",
];

const GROUP_LABELS: Record<ReferenceType, string> = {
  constraint: "Constraints",
  preference: "Preferences",
  goal: "Goals",
  pattern: "Patterns",
  assumption: "Assumptions",
  hypothesis: "Hypotheses",
};

const CONFLICT_CHECK_TYPES = new Set<ReferenceType>([
  "preference",
  "goal",
  "constraint",
]);

const hasAlwaysNeverConflict = (statements: string[]) => {
  const hasAlways = statements.some((statement) => /\balways\b/i.test(statement));
  const hasNever = statements.some((statement) => /\bnever\b/i.test(statement));
  return hasAlways && hasNever;
};

const hasLikeDislikeConflict = (statements: string[]) => {
  const likeTargets = new Set<string>();
  const dislikeTargets = new Set<string>();

  for (const statement of statements) {
    const likeMatch = statement.match(/\bi like\s+(.+)/i);
    if (likeMatch?.[1]) {
      likeTargets.add(likeMatch[1].trim().toLowerCase());
    }

    const dislikeMatch = statement.match(/\bi dislike\s+(.+)/i);
    if (dislikeMatch?.[1]) {
      dislikeTargets.add(dislikeMatch[1].trim().toLowerCase());
    }
  }

  for (const target of likeTargets) {
    if (dislikeTargets.has(target)) {
      return true;
    }
  }

  return false;
};

// Minimum token-overlap score for a memory to be considered relevant to the current turn.
const RELEVANCE_THRESHOLD = 1;

// Confidence ranking for tie-breaking.
const CONFIDENCE_RANK: Record<string, number> = { high: 2, medium: 1, low: 0 };

export type ReferenceMemoryResult = {
  text: string;
  retrieved: number;
  relevant: number;
  injected: number;
  usedFallback: boolean;
};

/**
 * Fetch active non-source memories, score each against the current turn's query using
 * lightweight token overlap, and return the top `maxItems` relevant ones.
 *
 * If nothing passes the relevance threshold, falls back to the most-recent `min(maxItems, 3)`
 * active items rather than injecting nothing or injecting everything.
 */
export async function getRelevantReferenceMemory(
  userId: string,
  query: string,
  maxItems: number
): Promise<ReferenceMemoryResult> {
  const rows = await prismadb.referenceItem.findMany({
    where: {
      userId,
      status: "active",
      type: { not: "source" },
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      type: true,
      statement: true,
      confidence: true,
      createdAt: true,
      updatedAt: true,
      sourceSessionId: true,
      sourceMessageId: true,
    },
  });

  const retrieved = rows.length;
  if (retrieved === 0) {
    return { text: "", retrieved: 0, relevant: 0, injected: 0, usedFallback: false };
  }

  const typedRows = rows as MemoryRow[];

  const scored = typedRows.map((item) => ({
    item,
    score: scoreTokenOverlap(item.statement, query),
  }));

  const passing = scored.filter((s) => s.score >= RELEVANCE_THRESHOLD);
  const relevant = passing.length;

  let usedFallback = false;
  let selected: MemoryRow[];

  if (passing.length > 0) {
    passing.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (CONFIDENCE_RANK[b.item.confidence] ?? 0) - (CONFIDENCE_RANK[a.item.confidence] ?? 0);
    });
    selected = passing.slice(0, maxItems).map((s) => s.item);
  } else {
    // Conservative fallback: most-recent items already sorted by DB query.
    usedFallback = true;
    selected = typedRows.slice(0, Math.min(maxItems, 3));
  }

  const injected = selected.length;
  if (injected === 0) {
    return { text: "", retrieved, relevant, injected: 0, usedFallback };
  }

  const lines: string[] = [
    "User-stated memory (treat as true unless contradicted by the user later):",
  ];

  for (const type of TYPE_ORDER) {
    const group = selected.filter((item) => item.type === type);
    if (group.length === 0) continue;

    const seenStatements = new Set<string>();
    const dedupedGroup = group.filter((item) => {
      if (seenStatements.has(item.statement)) return false;
      seenStatements.add(item.statement);
      return true;
    });

    lines.push(`${GROUP_LABELS[type]}:`);
    const statements = dedupedGroup.map((item) => item.statement);
    if (
      CONFLICT_CHECK_TYPES.has(type) &&
      (hasLikeDislikeConflict(statements) || hasAlwaysNeverConflict(statements))
    ) {
      lines.push("(If these conflict, ask the user which is current.)");
    }

    for (const item of dedupedGroup) {
      lines.push(`- (${item.confidence}) ${item.statement}`);
    }
  }

  return { text: lines.join("\n"), retrieved, relevant, injected, usedFallback };
}

export async function getActiveReferenceMemory(userId: string): Promise<string> {
  const items = await prismadb.referenceItem.findMany({
    where: {
      userId,
      status: "active",
      type: { not: "source" },
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      type: true,
      statement: true,
      confidence: true,
      createdAt: true,
      updatedAt: true,
      sourceSessionId: true,
      sourceMessageId: true,
    },
  });

  if (items.length === 0) {
    return "";
  }

  const typedItems = items as MemoryRow[];
  const lines: string[] = [
    "User-stated memory (treat as true unless contradicted by the user later):",
  ];

  for (const type of TYPE_ORDER) {
    const group = typedItems.filter((item) => item.type === type);
    if (group.length === 0) {
      continue;
    }

    const seenStatements = new Set<string>();
    const dedupedGroup = group.filter((item) => {
      if (seenStatements.has(item.statement)) {
        return false;
      }

      seenStatements.add(item.statement);
      return true;
    });

    lines.push(`${GROUP_LABELS[type]}:`);
    const statements = dedupedGroup.map((item) => item.statement);
    if (
      CONFLICT_CHECK_TYPES.has(type) &&
      (hasLikeDislikeConflict(statements) || hasAlwaysNeverConflict(statements))
    ) {
      lines.push("(If these conflict, ask the user which is current.)");
    }

    for (const item of dedupedGroup) {
      lines.push(`- (${item.confidence}) ${item.statement}`);
    }
  }

  return lines.join("\n");
}
