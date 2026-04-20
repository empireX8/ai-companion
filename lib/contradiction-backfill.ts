import type { ContradictionStatus } from "@prisma/client";

import {
  detectContradictions,
  type ContradictionDetectionDb,
} from "./contradiction-detection";
import {
  materializeContradictions,
  type ContradictionMaterializationDb,
} from "./contradiction-materialization";
import prismadb from "./prismadb";

type BackfillMessageRow = {
  id: string;
  sessionId: string;
  content: string;
  createdAt: Date;
};

type ContradictionBackfillDb = ContradictionDetectionDb &
  ContradictionMaterializationDb & {
    message: {
      findMany: (args: {
        where: {
          userId: string;
          role: "user";
          session: { origin: "IMPORTED_ARCHIVE" };
        };
        orderBy: Array<{ createdAt: "asc" } | { id: "asc" }>;
        take?: number;
        select: {
          id: true;
          sessionId: true;
          content: true;
          createdAt: true;
        };
      }) => Promise<BackfillMessageRow[]>;
    };
  };

export type BackfillImportedContradictionsParams = {
  userId: string;
  limit?: number;
  newNodeStatus?: ContradictionStatus;
  db?: ContradictionBackfillDb;
};

export type BackfillImportedContradictionsResult = {
  messagesScanned: number;
  messagesWithDetections: number;
  nodesCreated: number;
  evidenceCreated: number;
  reusedExistingNodes: number;
  duplicateEvidenceSkips: number;
  terminalCollisionSkips: number;
};

export async function backfillImportedContradictionsForUser({
  userId,
  limit,
  newNodeStatus = "open",
  db = prismadb as unknown as ContradictionBackfillDb,
}: BackfillImportedContradictionsParams): Promise<BackfillImportedContradictionsResult> {
  const messages = await db.message.findMany({
    where: {
      userId,
      role: "user",
      session: { origin: "IMPORTED_ARCHIVE" },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      sessionId: true,
      content: true,
      createdAt: true,
    },
  });

  const summary: BackfillImportedContradictionsResult = {
    messagesScanned: messages.length,
    messagesWithDetections: 0,
    nodesCreated: 0,
    evidenceCreated: 0,
    reusedExistingNodes: 0,
    duplicateEvidenceSkips: 0,
    terminalCollisionSkips: 0,
  };

  for (const message of messages) {
    const detections = await detectContradictions({
      userId,
      messageContent: message.content,
      referenceStatuses: ["active", "candidate"],
      db,
    });

    if (detections.length === 0) {
      continue;
    }

    summary.messagesWithDetections += 1;

    const result = await materializeContradictions({
      userId,
      detections,
      sessionId: message.sessionId,
      messageId: message.id,
      quote: message.content,
      newNodeStatus,
      db,
    });

    summary.nodesCreated += result.nodesCreated;
    summary.evidenceCreated += result.evidenceCreated;
    summary.reusedExistingNodes += result.reusedExistingNodes;
    summary.duplicateEvidenceSkips += result.duplicateEvidenceSkips;
    summary.terminalCollisionSkips += result.terminalCollisionSkips;
  }

  return summary;
}
