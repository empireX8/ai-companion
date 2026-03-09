import type { PrismaClient, ReferenceConfidence } from "@prisma/client";

import prismadb from "./prismadb";
import {
  validateReferenceTransition,
  ReferenceTransitionError,
  type ReferenceAction,
} from "./reference-transitions";

export { ReferenceTransitionError };

const ITEM_SELECT = {
  id: true,
  type: true,
  confidence: true,
  statement: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  supersedesId: true,
} as const;

type ReferenceSelectResult = {
  id: string;
  type: string;
  confidence: string;
  statement: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  supersedesId: string | null;
};

export type PerformReferenceActionPayload = {
  confidence?: ReferenceConfidence;
  newStatement?: string;
  newConfidence?: ReferenceConfidence;
};

export type PerformReferenceActionParams = {
  userId: string;
  referenceId: string;
  action: ReferenceAction;
  payload?: PerformReferenceActionPayload;
  db?: PrismaClient;
};

export type PerformReferenceActionResult =
  | { item: ReferenceSelectResult }
  | { newItem: ReferenceSelectResult; oldItem: ReferenceSelectResult };

export async function performReferenceAction({
  userId,
  referenceId,
  action,
  payload,
  db = prismadb,
}: PerformReferenceActionParams): Promise<PerformReferenceActionResult> {
  const existing = await db.referenceItem.findFirst({
    where: { id: referenceId, userId },
    select: {
      id: true,
      type: true,
      confidence: true,
      statement: true,
      status: true,
    },
  });

  if (!existing) {
    throw new ReferenceNotFoundError();
  }

  validateReferenceTransition(existing.status, action);

  switch (action) {
    case "promote_candidate": {
      const item = await db.referenceItem.update({
        where: { id: referenceId },
        data: { status: "active" },
        select: ITEM_SELECT,
      });
      return { item };
    }

    case "deactivate": {
      const item = await db.referenceItem.update({
        where: { id: referenceId },
        data: { status: "inactive" },
        select: ITEM_SELECT,
      });
      return { item };
    }

    case "update_confidence": {
      if (!payload?.confidence) {
        throw new Error("confidence is required for update_confidence");
      }
      const item = await db.referenceItem.update({
        where: { id: referenceId },
        data: { confidence: payload.confidence },
        select: ITEM_SELECT,
      });
      return { item };
    }

    case "supersede": {
      const newStatement = payload?.newStatement?.trim();
      if (!newStatement) {
        throw new Error("newStatement is required for supersede");
      }

      return db.$transaction(async (tx) => {
        const newItem = await tx.referenceItem.create({
          data: {
            userId,
            type: existing.type,
            statement: newStatement,
            confidence: payload?.newConfidence ?? existing.confidence,
            status: "active",
          },
          select: ITEM_SELECT,
        });

        const oldItem = await tx.referenceItem.update({
          where: { id: referenceId },
          data: {
            status: "superseded",
            supersedesId: newItem.id,
          },
          select: ITEM_SELECT,
        });

        return { newItem, oldItem };
      });
    }

    case "confirm_governance": {
      // Promote governance candidate → active; mark the item it supersedes → superseded.
      const candidateFull = await db.referenceItem.findFirst({
        where: { id: referenceId, userId },
        select: { supersedesId: true },
      });

      return db.$transaction(async (tx) => {
        if (candidateFull?.supersedesId) {
          await tx.referenceItem.update({
            where: { id: candidateFull.supersedesId },
            data: { status: "superseded", supersedesId: referenceId },
          });
        }
        const item = await tx.referenceItem.update({
          where: { id: referenceId },
          data: { status: "active" },
          select: ITEM_SELECT,
        });
        return { item };
      });
    }

    case "dismiss_governance": {
      const item = await db.referenceItem.update({
        where: { id: referenceId },
        data: { status: "dismissed" },
        select: ITEM_SELECT,
      });
      return { item };
    }
  }
}

export class ReferenceNotFoundError extends Error {
  status = 404;
  code = "REFERENCE_NOT_FOUND";

  constructor() {
    super("Reference not found");
  }
}
