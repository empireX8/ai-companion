import { ContradictionType, ReferenceStatus, ReferenceType } from "@prisma/client";

import prismadb from "./prismadb";

type DetectionConfidence = "low" | "medium";

/**
 * Persistable contradiction detection result.
 *
 * CEQR-002: the legacy public detection path returns zero of these until
 * model-assisted semantic adjudication is wired (CEQR-004+). Marker / reference
 * matches are nominations only — never DetectedContradiction.
 */
export type DetectedContradiction = {
  title: string;
  sideA: string;
  sideB: string;
  type: ContradictionType;
  confidence: DetectionConfidence;
  existingNodeId?: string;
};

/**
 * Explicit non-persistable nomination from rhetorical markers + goal/constraint
 * reference presence. Useful as a retrieval hint for later semantic adjudication
 * (CEQR-004). Must never be passed to materializeContradictions.
 */
export type ContradictionMarkerNomination = {
  readonly kind: "marker_nomination";
  readonly persistable: false;
  readonly quarantineReason: "semantic_adjudication_required";
  readonly markerFamily: "goal_mismatch" | "constraint_violation";
  readonly markerMatched: string;
  readonly referenceId: string;
  readonly referenceType: ReferenceType;
  readonly referenceStatement: string;
  readonly messageContent: string;
  /** Textual-similarity hint for duplicate checking only — not eligibility. */
  readonly similarExistingNodeId?: string;
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

const MAX_NOMINATIONS_PER_MESSAGE = 2;
const MIN_DETECTION_LENGTH = 15;
const GOAL_MISMATCH_MARKERS = [
  "i didn't",
  "i failed",
  "i avoided",
  "i skipped",
  "i procrastinated",
] as const;
const CONSTRAINT_VIOLATION_MARKERS = ["but i", "however i", "even though"] as const;

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

/** Duplicate-checking similarity only — never contradiction eligibility. */
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

const findSimilarExistingNodeId = (
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

const uniqueNominationsByKey = (items: ContradictionMarkerNomination[]) => {
  const seen = new Set<string>();
  const deduped: ContradictionMarkerNomination[] = [];

  for (const item of items) {
    const key = item.similarExistingNodeId
      ? `existing:${item.similarExistingNodeId}`
      : `nom:${item.markerFamily}:${item.referenceId}:${normalize(item.messageContent)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

function firstMatchingMarker(
  lowerContent: string,
  markers: readonly string[]
): string | undefined {
  return markers.find((marker) => lowerContent.includes(marker));
}

/**
 * Marker + reference nomination (retrieval hint only).
 *
 * CEQR-002: nominations are never DetectedContradiction and are never
 * persistable. Callers must not cast these to DetectedContradiction.
 */
export function nominateContradictionMarkersFromData({
  messageContent,
  activeReferences,
  existingNodes,
}: DetectFromDataParams): ContradictionMarkerNomination[] {
  const content = messageContent.trim();
  if (content.length < MIN_DETECTION_LENGTH) {
    return [];
  }

  const lowerContent = content.toLowerCase();
  const goalMarker = firstMatchingMarker(lowerContent, GOAL_MISMATCH_MARKERS);
  const constraintMarker = firstMatchingMarker(
    lowerContent,
    CONSTRAINT_VIOLATION_MARKERS
  );

  if (!goalMarker && !constraintMarker) {
    return [];
  }

  const goalReferences = activeReferences.filter((item) => item.type === "goal");
  const constraintReferences = activeReferences.filter(
    (item) => item.type === "constraint"
  );

  const nominations: ContradictionMarkerNomination[] = [];

  if (goalMarker) {
    for (const reference of goalReferences) {
      const similarExistingNodeId = findSimilarExistingNodeId(
        existingNodes,
        "goal_behavior_gap",
        reference.statement,
        content
      );

      nominations.push({
        kind: "marker_nomination",
        persistable: false,
        quarantineReason: "semantic_adjudication_required",
        markerFamily: "goal_mismatch",
        markerMatched: goalMarker,
        referenceId: reference.id,
        referenceType: reference.type,
        referenceStatement: reference.statement,
        messageContent: content,
        ...(similarExistingNodeId ? { similarExistingNodeId } : {}),
      });
    }
  }

  if (constraintMarker) {
    for (const reference of constraintReferences) {
      const similarExistingNodeId = findSimilarExistingNodeId(
        existingNodes,
        "constraint_conflict",
        reference.statement,
        content
      );

      nominations.push({
        kind: "marker_nomination",
        persistable: false,
        quarantineReason: "semantic_adjudication_required",
        markerFamily: "constraint_violation",
        markerMatched: constraintMarker,
        referenceId: reference.id,
        referenceType: reference.type,
        referenceStatement: reference.statement,
        messageContent: content,
        ...(similarExistingNodeId ? { similarExistingNodeId } : {}),
      });
    }
  }

  return uniqueNominationsByKey(nominations).slice(0, MAX_NOMINATIONS_PER_MESSAGE);
}

/**
 * Legacy persistable detection path — fail closed (CEQR-002).
 *
 * Markers, goal/constraint reference presence, token overlap, and textual
 * similarity do not authorize DetectedContradiction creation. Zero semantic
 * authorization ⇒ zero candidates. Semantic runtime is not wired in this slice.
 */
export function detectContradictionsFromData({
  messageContent,
  activeReferences: _activeReferences,
  existingNodes: _existingNodes,
}: DetectFromDataParams): DetectedContradiction[] {
  void messageContent;
  void _activeReferences;
  void _existingNodes;
  // Explicit abstention: nomination helpers exist separately and are non-persistable.
  return [];
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
   *
   * CEQR-002: references are still loaded for future semantic wiring / nomination
   * diagnostics, but the public path returns no persistable detections.
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

  // Fail closed until semantic adjudication is wired into this path.
  return detectContradictionsFromData({
    messageContent: content,
    activeReferences,
    existingNodes,
  });
}
