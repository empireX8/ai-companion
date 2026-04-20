import type { ContradictionStatus } from "@prisma/client";

import type { DetectedContradiction } from "./contradiction-detection";
import prismadb from "./prismadb";

const MAX_MATERIALIZED_DETECTIONS = 2;
const APPENDABLE_NODE_STATUSES = [
  "candidate",
  "open",
  "snoozed",
  "explored",
] as const satisfies readonly ContradictionStatus[];

type MaterializationNodeRow = {
  id: string;
  status: ContradictionStatus;
};

type MaterializationEvidenceRow = {
  id: string;
};

type ContradictionMaterializationTx = {
  contradictionNode: {
    findFirst: (args: unknown) => Promise<MaterializationNodeRow | null>;
    create: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<unknown>;
  };
  contradictionEvidence: {
    findFirst: (args: unknown) => Promise<MaterializationEvidenceRow | null>;
    create: (args: unknown) => Promise<unknown>;
  };
};

export type ContradictionMaterializationDb = ContradictionMaterializationTx & {
  $transaction: <T>(fn: (tx: ContradictionMaterializationTx) => Promise<T>) => Promise<T>;
};

export type MaterializeContradictionsParams = {
  userId: string;
  detections: DetectedContradiction[];
  sessionId?: string | null;
  messageId?: string | null;
  quote?: string | null;
  now?: Date;
  newNodeStatus?: ContradictionStatus;
  db?: ContradictionMaterializationDb;
};

export type MaterializeContradictionsResult = {
  nodesCreated: number;
  evidenceCreated: number;
  reusedExistingNodes: number;
  duplicateEvidenceSkips: number;
  terminalCollisionSkips: number;
};

function isAppendableStatus(status: ContradictionStatus): boolean {
  return APPENDABLE_NODE_STATUSES.includes(
    status as (typeof APPENDABLE_NODE_STATUSES)[number]
  );
}

async function findExactCollisionNode(
  tx: ContradictionMaterializationTx,
  userId: string,
  detection: DetectedContradiction
): Promise<MaterializationNodeRow | null> {
  return tx.contradictionNode.findFirst({
    where: {
      userId,
      title: detection.title,
      sideA: detection.sideA,
      sideB: detection.sideB,
      type: detection.type,
    },
    select: { id: true, status: true },
  });
}

async function findReusableNode(
  tx: ContradictionMaterializationTx,
  userId: string,
  detection: DetectedContradiction
): Promise<MaterializationNodeRow | null> {
  if (detection.existingNodeId) {
    const existingNode = await tx.contradictionNode.findFirst({
      where: {
        id: detection.existingNodeId,
        userId,
        status: { in: APPENDABLE_NODE_STATUSES },
      },
      select: { id: true, status: true },
    });

    if (existingNode) {
      return existingNode;
    }
  }

  const exactCollision = await findExactCollisionNode(tx, userId, detection);
  if (!exactCollision || !isAppendableStatus(exactCollision.status)) {
    return null;
  }

  return exactCollision;
}

function buildEvidenceLookupWhere({
  nodeId,
  messageId,
  sessionId,
  quote,
}: {
  nodeId: string;
  messageId?: string | null;
  sessionId?: string | null;
  quote?: string | null;
}): Record<string, unknown> {
  if (messageId) {
    return { nodeId, messageId };
  }

  return {
    nodeId,
    sessionId: sessionId ?? null,
    quote: quote ?? null,
  };
}

export async function materializeContradictions({
  userId,
  detections,
  sessionId = null,
  messageId = null,
  quote = null,
  now = new Date(),
  newNodeStatus = "candidate",
  db = prismadb as unknown as ContradictionMaterializationDb,
}: MaterializeContradictionsParams): Promise<MaterializeContradictionsResult> {
  if (detections.length === 0) {
    return {
      nodesCreated: 0,
      evidenceCreated: 0,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 0,
      terminalCollisionSkips: 0,
    };
  }

  return db.$transaction(async (tx) => {
    const summary: MaterializeContradictionsResult = {
      nodesCreated: 0,
      evidenceCreated: 0,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 0,
      terminalCollisionSkips: 0,
    };

    for (const detection of detections.slice(0, MAX_MATERIALIZED_DETECTIONS)) {
      const reusableNode = await findReusableNode(tx, userId, detection);
      if (reusableNode) {
        const existingEvidence = await tx.contradictionEvidence.findFirst({
          where: buildEvidenceLookupWhere({
            nodeId: reusableNode.id,
            messageId,
            sessionId,
            quote,
          }),
          select: { id: true },
        });

        if (existingEvidence) {
          summary.duplicateEvidenceSkips += 1;
          continue;
        }

        await tx.contradictionEvidence.create({
          data: {
            nodeId: reusableNode.id,
            sessionId,
            messageId,
            quote,
          },
        });
        await tx.contradictionNode.update({
          where: { id: reusableNode.id },
          data: {
            evidenceCount: { increment: 1 },
            lastEvidenceAt: now,
            lastTouchedAt: now,
          },
        });

        summary.reusedExistingNodes += 1;
        summary.evidenceCreated += 1;
        continue;
      }

      const exactCollision = await findExactCollisionNode(tx, userId, detection);
      if (exactCollision && !isAppendableStatus(exactCollision.status)) {
        summary.terminalCollisionSkips += 1;
        continue;
      }

      const createdNode = await tx.contradictionNode.create({
        data: {
          userId,
          title: detection.title,
          sideA: detection.sideA,
          sideB: detection.sideB,
          type: detection.type,
          confidence: detection.confidence,
          status: newNodeStatus,
          sourceSessionId: sessionId,
          sourceMessageId: messageId,
          evidenceCount: 1,
          lastEvidenceAt: now,
          lastTouchedAt: now,
          recommendedRung: "rung1_gentle_mirror",
          escalationLevel: 0,
        },
        select: { id: true },
      });

      await tx.contradictionEvidence.create({
        data: {
          nodeId: createdNode.id,
          sessionId,
          messageId,
          quote,
        },
      });

      summary.nodesCreated += 1;
      summary.evidenceCreated += 1;
    }

    return summary;
  });
}
