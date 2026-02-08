import prismadb from "@/lib/prismadb";

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

export async function getActiveReferenceMemory(userId: string): Promise<string> {
  const items = await prismadb.referenceItem.findMany({
    where: {
      userId,
      status: "active",
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
