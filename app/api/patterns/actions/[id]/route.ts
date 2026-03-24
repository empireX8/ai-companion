/**
 * PATCH /api/patterns/actions/[id] — Update action status/outcome/reflection (P2.5-05, P2.5-06, P2.5-07)
 *
 * Body: {
 *   status?: "pending" | "in_progress" | "completed" | "skipped" | "abandoned"
 *   outcomeSignal?: "helpful" | "not_helpful" | "unclear"
 *   reflectionNote?: string
 * }
 *
 * P2.5-07: if outcomeSignal === "not_helpful", touches claim.updatedAt
 * to flag it for reevaluation on the next refresh pass.
 *
 * Returns: PatternClaimActionView
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { updateClaimActionStatus } from "@/lib/pattern-claim-action";
import type { PatternClaimActionView } from "@/lib/patterns-api";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "pending",
  "in_progress",
  "completed",
  "skipped",
  "abandoned",
]);

const VALID_OUTCOMES = new Set(["helpful", "not_helpful", "unclear"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    status?: unknown;
    outcomeSignal?: unknown;
    reflectionNote?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate status
  if (body.status !== undefined && !VALID_STATUSES.has(body.status as string)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Validate outcome signal
  if (
    body.outcomeSignal !== undefined &&
    body.outcomeSignal !== null &&
    !VALID_OUTCOMES.has(body.outcomeSignal as string)
  ) {
    return NextResponse.json({ error: "Invalid outcomeSignal" }, { status: 400 });
  }

  const result = await updateClaimActionStatus(
    {
      actionId: id,
      userId,
      status: (body.status as PatternClaimActionView["status"]) ?? "in_progress",
      outcomeSignal: body.outcomeSignal as "helpful" | "not_helpful" | "unclear" | undefined,
      reflectionNote: typeof body.reflectionNote === "string" ? body.reflectionNote : undefined,
    },
    prismadb
  );

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
