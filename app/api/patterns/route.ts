/**
 * GET /api/patterns — Patterns Read API (P2-01)
 *
 * Returns all PatternClaims for the authenticated user, grouped into the five
 * locked family sections with inline evidence receipts and scope metadata.
 *
 * Does NOT return ProfileArtifact data. PatternClaim and ProfileArtifact are
 * disjoint surfaces (pattern-claim-boundary.ts).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { projectVisiblePatternClaim } from "@/lib/pattern-visible-claim";
import {
  PATTERN_FAMILY_SECTIONS,
  type PatternFamilySection,
  type PatternsResponse,
} from "@/lib/patterns-api";
import { patternBatchOrchestrator } from "@/lib/pattern-batch-orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch all claims + inline evidence ──────────────────────────────────────
  const claims = await prismadb.patternClaim.findMany({
    where: { userId },
    include: {
      evidence: {
        orderBy: { createdAt: "desc" },
        take: 10, // cap inline receipts at 10 per claim
      },
      // Include most recent pending/in_progress action (P2.5-02)
      actions: {
        where: { status: { in: ["pending", "in_progress"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── Fetch scope metadata for P2-06 ─────────────────────────────────────────
  const [scopeMessageCount, scopeSessionCount] = await Promise.all([
    prismadb.message.count({ where: { userId } }),
    prismadb.session.count({ where: { userId } }),
  ]);

  // ── Build view model ────────────────────────────────────────────────────────

  // Group claims by patternType
  const byFamily = new Map<string, typeof claims>();
  for (const claim of claims) {
    const group = byFamily.get(claim.patternType) ?? [];
    group.push(claim);
    byFamily.set(claim.patternType, group);
  }

  const sections: PatternFamilySection[] = PATTERN_FAMILY_SECTIONS.map(
    ({ familyKey, sectionLabel, description }) => {
      const familyClaims = byFamily.get(familyKey) ?? [];

      const claimViews = familyClaims.flatMap((claim) => {
        const projected = projectVisiblePatternClaim({
          id: claim.id,
          patternType: familyKey,
          summary: claim.summary,
          status: claim.status as typeof familyClaims[number]["status"] & ("candidate" | "active" | "paused" | "dismissed"),
          strengthLevel: claim.strengthLevel as typeof familyClaims[number]["strengthLevel"] & ("tentative" | "developing" | "established"),
          createdAt: claim.createdAt,
          updatedAt: claim.updatedAt,
          evidence: claim.evidence,
          actions: claim.actions,
        });

        return projected ? [projected] : [];
      });

      return { familyKey, sectionLabel, description, claims: claimViews };
    }
  );

  const response: PatternsResponse = {
    sections,
    scopeMessageCount,
    scopeSessionCount,
  };

  return NextResponse.json(response);
}

/**
 * POST /api/patterns — trigger a manual detection re-run for the current user.
 * Returns { status, claimsCreated } so the client can decide whether to refresh.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await patternBatchOrchestrator.runForUser({
    userId,
    trigger: "manual",
  });

  return NextResponse.json({
    status: result.status,
    claimsCreated: result.claimsCreated,
    messageCount: result.messageCount,
  });
}
