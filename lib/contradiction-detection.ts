import { ContradictionType, ReferenceStatus, ReferenceType } from "@prisma/client";

import prismadb from "./prismadb";

type DetectionConfidence = "low" | "medium";

export type DetectedContradiction = {
  title: string;
  sideA: string;
  sideB: string;
  type: ContradictionType;
  confidence: DetectionConfidence;
  existingNodeId?: string;
};

type DetectionReference = {
  id: string;
  type: ReferenceType;
  statement: string;
};

type DetectionNode = {
  id: string;
  type: ContradictionType;
  sideA: string;
  sideB: string;
};

type DetectFromDataParams = {
  messageContent: string;
  activeReferences: DetectionReference[];
  existingNodes: DetectionNode[];
};

export type ContradictionDetectionDb = {
  referenceItem: {
    findMany: (args: unknown) => Promise<DetectionReference[]>;
  };
  contradictionNode: {
    findMany: (args: unknown) => Promise<DetectionNode[]>;
  };
};

const MAX_DETECTIONS_PER_MESSAGE = 2;
const MIN_DETECTION_LENGTH = 15;
const GOAL_MISMATCH_MARKERS = [
  "i didn't",
  "i failed",
  "i avoided",
  "i skipped",
  "i procrastinated",
];
const CONSTRAINT_VIOLATION_MARKERS = ["but i", "however i", "even though"];

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

const tokenOverlap = (left: string, right: string): number => {
  const leftTokens = new Set(
    normalize(left)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  );
  const rightTokens = new Set(
    normalize(right)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  );

  if (leftTokens.size < 3 || rightTokens.size < 3) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(leftTokens.size, rightTokens.size);
};

const isSimilarText = (left: string, right: string): boolean => {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const shorter = Math.min(normalizedLeft.length, normalizedRight.length);
  if (
    shorter >= 15 &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
  ) {
    return true;
  }

  return tokenOverlap(normalizedLeft, normalizedRight) >= 0.6;
};

const findExistingNodeId = (
  existingNodes: DetectionNode[],
  type: ContradictionType,
  sideA: string,
  sideB: string
): string | undefined => {
  const match = existingNodes.find(
    (node) =>
      node.type === type &&
      isSimilarText(node.sideA, sideA) &&
      isSimilarText(node.sideB, sideB)
  );

  return match?.id;
};

const uniqueByStableKey = (items: DetectedContradiction[]) => {
  const seen = new Set<string>();
  const deduped: DetectedContradiction[] = [];

  for (const item of items) {
    const key = item.existingNodeId
      ? `existing:${item.existingNodeId}`
      : `new:${item.type}:${normalize(item.sideA)}:${normalize(item.sideB)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

export function detectContradictionsFromData({
  messageContent,
  activeReferences,
  existingNodes,
}: DetectFromDataParams): DetectedContradiction[] {
  const content = messageContent.trim();
  if (content.length < MIN_DETECTION_LENGTH) {
    return [];
  }

  const lowerContent = content.toLowerCase();
  const hasGoalMismatchSignal = GOAL_MISMATCH_MARKERS.some((marker) =>
    lowerContent.includes(marker)
  );
  const hasConstraintViolationSignal = CONSTRAINT_VIOLATION_MARKERS.some((marker) =>
    lowerContent.includes(marker)
  );

  if (!hasGoalMismatchSignal && !hasConstraintViolationSignal) {
    return [];
  }

  const goalReferences = activeReferences.filter((item) => item.type === "goal");
  const constraintReferences = activeReferences.filter(
    (item) => item.type === "constraint"
  );

  const detections: DetectedContradiction[] = [];

  if (hasGoalMismatchSignal) {
    for (const reference of goalReferences) {
      const existingNodeId = findExistingNodeId(
        existingNodes,
        "goal_behavior_gap",
        reference.statement,
        content
      );

      detections.push({
        title: "Goal behavior gap",
        sideA: reference.statement,
        sideB: content,
        type: "goal_behavior_gap",
        confidence: "medium",
        ...(existingNodeId ? { existingNodeId } : {}),
      });
    }
  }

  if (hasConstraintViolationSignal) {
    for (const reference of constraintReferences) {
      const existingNodeId = findExistingNodeId(
        existingNodes,
        "constraint_conflict",
        reference.statement,
        content
      );

      detections.push({
        title: "Constraint conflict",
        sideA: reference.statement,
        sideB: content,
        type: "constraint_conflict",
        confidence: "low",
        ...(existingNodeId ? { existingNodeId } : {}),
      });
    }
  }

  return uniqueByStableKey(detections).slice(0, MAX_DETECTIONS_PER_MESSAGE);
}

export async function detectContradictions({
  userId,
  messageContent,
  referenceStatuses = ["active"],
  db = prismadb as unknown as ContradictionDetectionDb,
}: {
  userId: string;
  messageContent: string;
  /**
   * Which reference statuses to match against.
   * Defaults to ["active"] for live-chat paths.
   * Pass ["active", "candidate"] in the import pipeline so that references
   * extracted from imported history are available for contradiction detection
   * in the same import run (imported refs land as "candidate", never "active").
   */
  referenceStatuses?: ReferenceStatus[];
  db?: ContradictionDetectionDb;
}): Promise<DetectedContradiction[]> {
  const content = messageContent.trim();
  if (content.length < MIN_DETECTION_LENGTH) {
    return [];
  }

  const [activeReferences, existingNodes] = await Promise.all([
    db.referenceItem.findMany({
      where: {
        userId,
        status: { in: referenceStatuses },
        type: {
          in: ["goal", "constraint"],
        },
      },
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        statement: true,
      },
    }),
    db.contradictionNode.findMany({
      where: {
        userId,
        status: {
          in: ["candidate", "open", "snoozed", "explored"],
        },
      },
      orderBy: [{ weight: "desc" }, { lastTouchedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        sideA: true,
        sideB: true,
      },
    }),
  ]);

  return detectContradictionsFromData({
    messageContent: content,
    activeReferences,
    existingNodes,
  });
}
