/**
 * POST /api/patterns/actions — Suggest a micro-experiment for a claim (P2.5-03)
 *
 * Body: { claimId: string }
 *
 * Validates:
 *  - Claim exists + belongs to the authenticated user
 *  - Claim passes the maturity gate (P2.5-04)
 *  - No existing pending/in_progress action for this claim (one at a time)
 *
 * Returns: PatternClaimActionView
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { generateMicroExperiment } from "@/lib/pattern-action-generator";
import { isActionReady, createClaimAction, toActionView } from "@/lib/pattern-claim-action";
import { projectVisiblePatternClaim } from "@/lib/pattern-visible-claim";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let claimId: string;
  try {
    const body = (await req.json()) as { claimId?: unknown };
    if (typeof body.claimId !== "string" || !body.claimId) {
      return NextResponse.json({ error: "claimId required" }, { status: 400 });
    }
    claimId = body.claimId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fetch claim with evidence count
  const claim = await prismadb.patternClaim.findFirst({
    where: { id: claimId, userId },
    include: {
      evidence: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      actions: {
        where: { status: { in: ["pending", "in_progress"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const claimView = projectVisiblePatternClaim({
    id: claim.id,
    patternType: claim.patternType as "trigger_condition" | "inner_critic" | "repetitive_loop" | "contradiction_drift" | "recovery_stabilizer",
    summary: claim.summary,
    status: claim.status as "candidate" | "active" | "paused" | "dismissed",
    strengthLevel: claim.strengthLevel as "tentative" | "developing" | "established",
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    journalEvidenceCount: claim.journalEvidenceCount,
    journalEntrySpread: claim.journalEntrySpread,
    journalDaySpread: claim.journalDaySpread,
    supportContainerSpread: claim.supportContainerSpread,
    evidence: claim.evidence,
    actions: claim.actions,
  });

  if (!claimView) {
    return NextResponse.json(
      { error: "Claim not ready for action", code: "CLAIM_NOT_READY" },
      { status: 422 }
    );
  }

  // P2.5-04 — maturity gate
  if (!isActionReady(claimView)) {
    return NextResponse.json(
      { error: "Claim not ready for action", code: "CLAIM_NOT_READY" },
      { status: 422 }
    );
  }

  // One active action at a time
  if (claim.actions.length > 0) {
    return NextResponse.json(toActionView(claim.actions[0]!));
  }

  // P2.5-03 — generate micro-experiment
  const prompt = generateMicroExperiment(claimView);

  const action = await createClaimAction(
    { claimId, userId, prompt },
    prismadb
  );

  return NextResponse.json(action, { status: 201 });
}
