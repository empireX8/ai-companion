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

import { getTopContradictions } from "@/lib/contradiction-top";
import prismadb from "@/lib/prismadb";
import { projectVisiblePatternClaim } from "@/lib/pattern-visible-claim";
import {
  PATTERN_FAMILY_SECTIONS,
  type PatternContradictionView,
  type PatternFamilySection,
  type PatternsResponse,
} from "@/lib/patterns-api";
import { patternBatchOrchestrator } from "@/lib/pattern-batch-orchestrator";
import { createPatternRerunDebugCollector } from "@/lib/pattern-rerun-debug";

export const dynamic = "force-dynamic";
const INLINE_RECEIPT_LIMIT = 10;

type TopContradictionItem = Awaited<ReturnType<typeof getTopContradictions>>[number];

function projectPatternContradictionItem(
  item: TopContradictionItem
): PatternContradictionView {
  return {
    id: item.id,
    title: item.title,
    sideA: item.sideA,
    sideB: item.sideB,
    type: item.type,
    status: item.status,
    lastEvidenceAt: item.lastEvidenceAt?.toISOString() ?? null,
    lastTouchedAt: item.lastTouchedAt.toISOString(),
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch claims, contradiction surface items, and scope metadata ──────────
  const [claims, contradictionItems, scopeMessageCount, scopeSessionCount] =
    await Promise.all([
      prismadb.patternClaim.findMany({
        where: { userId },
        include: {
          evidence: {
            orderBy: { createdAt: "desc" },
          },
          // Include most recent pending/in_progress action (P2.5-02)
          actions: {
            where: { status: { in: ["pending", "in_progress"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      getTopContradictions(userId, new Date(), prismadb).then((items) =>
        items.map(projectPatternContradictionItem)
      ),
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
          journalEvidenceCount: claim.journalEvidenceCount,
          journalDaySpread: claim.journalDaySpread,
          evidence: claim.evidence,
          actions: claim.actions,
        });

        return projected
          ? [
              {
                ...projected,
                receipts: projected.receipts.slice(0, INLINE_RECEIPT_LIMIT),
              },
            ]
          : [];
      });

      if (familyKey === "contradiction_drift") {
        return {
          familyKey,
          sectionLabel,
          description,
          claims: claimViews,
          contradictionItems,
        };
      }

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
 * Default response: { status, claimsCreated, messageCount }.
 * Optional diagnostics: POST /api/patterns?debug=1 includes a `debug` payload.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debugParam = new URL(request.url).searchParams.get("debug");
  const debugEnabled =
    debugParam === "1" || debugParam?.toLowerCase() === "true";

  const debugCollector = debugEnabled
    ? createPatternRerunDebugCollector()
    : undefined;

  const result = await patternBatchOrchestrator.runForUser({
    userId,
    trigger: "manual",
    debugCollector,
  });

  if (!debugEnabled || !debugCollector) {
    return NextResponse.json({
      status: result.status,
      claimsCreated: result.claimsCreated,
      messageCount: result.messageCount,
    });
  }

  return NextResponse.json({
    status: result.status,
    claimsCreated: result.claimsCreated,
    messageCount: result.messageCount,
    debug: debugCollector.buildDiagnostics(),
  });
}
