import { PrismaClient } from "@prisma/client";

import {
  publishMovementAssaultClaimFixture,
  seedMovementAssaultRuntimeFixture,
} from "../lib/model-movement-runtime-fixture";
import { decodeMovementRationaleFromInternalNotes } from "../lib/model-movement-rationale";

async function main() {
  const userId = process.env.EVIDENCE_DEPTH_FIXTURE_USER_ID?.trim();
  if (!userId) {
    throw new Error("EVIDENCE_DEPTH_FIXTURE_USER_ID is required");
  }

  const db = new PrismaClient();
  try {
    const seeded = await seedMovementAssaultRuntimeFixture({ userId, db });
    await publishMovementAssaultClaimFixture({
      userId,
      db,
      modelUpdateId: seeded.claimModelUpdateId,
    });

    const [claim, conclusion, sparse] = await Promise.all([
      db.modelUpdate.findUnique({ where: { id: seeded.claimModelUpdateId } }),
      db.modelUpdate.findUnique({ where: { id: seeded.conclusionModelUpdateId } }),
      db.modelUpdate.findUnique({ where: { id: seeded.sparseModelUpdateId } }),
    ]);

    const claimEvidenceCount = await db.understandingEvidenceLink.count({
      where: {
        userId,
        targetType: "model_update",
        targetId: seeded.claimModelUpdateId,
      },
    });

    console.log(
      JSON.stringify(
        {
          userId,
          endpoints: {
            movementDepth: "/api/today/movement-depth",
            whatChangedDetail: `/api/what-changed/${seeded.claimModelUpdateId}`,
            whatChangedEvidence: `/api/what-changed/${seeded.claimModelUpdateId}/evidence`,
          },
          ids: {
            claimPatternUpdate: seeded.claimModelUpdateId,
            conclusionUpdate: seeded.conclusionModelUpdateId,
            sparseUpdate: seeded.sparseModelUpdateId,
          },
          claim: {
            before: claim?.beforeSummary ?? null,
            after: claim?.afterSummary ?? null,
            rationale: decodeMovementRationaleFromInternalNotes(claim?.internalNotes),
            evidenceLinkCount: claimEvidenceCount,
          },
          conclusion: {
            before: conclusion?.beforeSummary ?? null,
            after: conclusion?.afterSummary ?? null,
            rationale: decodeMovementRationaleFromInternalNotes(conclusion?.internalNotes),
          },
          sparse: {
            before: sparse?.beforeSummary ?? null,
            after: sparse?.afterSummary ?? null,
            rationale: decodeMovementRationaleFromInternalNotes(sparse?.internalNotes),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

void main();
