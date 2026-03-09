import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { ContradictionStatus } from "@prisma/client";

import {
  computeEscalationCooldown,
  computeEscalationLevel,
  computeRecommendedRung,
  shouldEscalate,
} from "@/lib/contradiction-escalation";
import { buildContradictionPatchData } from "@/lib/contradiction-patch";
import { patchContradictionSchema } from "@/lib/contradiction-schema";
import {
  applyContradictionAction,
  ContradictionTransitionError,
} from "@/lib/contradiction-transitions";
import {
  ContradictionSourceError,
  resolveContradictionSource,
} from "@/lib/contradiction-source";
import prismadb from "@/lib/prismadb";
import { serverLogMetric } from "@/lib/metrics-server";

const CONTRADICTION_WITH_EVIDENCE = {
  id: true,
  userId: true,
  title: true,
  sideA: true,
  sideB: true,
  type: true,
  confidence: true,
  status: true,
  weight: true,
  snoozeCount: true,
  timesSurfaced: true,
  lastSurfacedAt: true,
  lastEvidenceAt: true,
  evidenceCount: true,
  recommendedRung: true,
  escalationLevel: true,
  avoidanceCount: true,
  lastEscalatedAt: true,
  lastAvoidedAt: true,
  rung: true,
  snoozedUntil: true,
  createdAt: true,
  lastTouchedAt: true,
  sourceSessionId: true,
  sourceMessageId: true,
  evidence: {
    orderBy: {
      createdAt: "desc",
    },
  },
  _count: {
    select: {
      evidence: true,
    },
  },
} as const;

const TERMINAL_STATUSES: ContradictionStatus[] = [
  "resolved",
  "accepted_tradeoff",
  "archived_tension",
];

const NON_TERMINAL_STATUSES: ContradictionStatus[] = ["open", "snoozed", "explored"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;
    if (!id) {
      return new NextResponse("Contradiction id is required", { status: 400 });
    }

    const node = await prismadb.contradictionNode.findFirst({
      where: { id, userId },
      select: CONTRADICTION_WITH_EVIDENCE,
    });

    if (!node) {
      return new NextResponse("Contradiction not found", { status: 404 });
    }

    // Batch-look up EvidenceSpans for evidence items that have a messageId
    const evidenceMessageIds = node.evidence
      .map((ev) => ev.messageId)
      .filter((mid): mid is string => Boolean(mid));

    const spanByMessageId = new Map<string, string>();
    if (evidenceMessageIds.length > 0) {
      const spans = await prismadb.evidenceSpan.findMany({
        where: { messageId: { in: evidenceMessageIds }, userId },
        select: { id: true, messageId: true },
      });
      for (const span of spans) {
        if (!spanByMessageId.has(span.messageId)) {
          spanByMessageId.set(span.messageId, span.id);
        }
      }
    }

    const evidenceWithSpans = node.evidence.map((ev) => ({
      ...ev,
      spanId: ev.messageId ? (spanByMessageId.get(ev.messageId) ?? null) : null,
    }));

    const cooldown = computeEscalationCooldown(node.lastEscalatedAt);
    return NextResponse.json({
      ...node,
      evidence: evidenceWithSpans,
      cooldownActive: cooldown.active,
      cooldownUntil: cooldown.until?.toISOString() ?? null,
    });
  } catch (error) {
    console.log("[CONTRADICTION_GET_DETAIL_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;
    if (!id) {
      return new NextResponse("Contradiction id is required", { status: 400 });
    }

    const currentNode = await prismadb.contradictionNode.findFirst({
      where: { id, userId },
      select: { id: true, status: true, snoozedUntil: true },
    });

    if (!currentNode) {
      return new NextResponse("Contradiction not found", { status: 404 });
    }

    const body = await req.json();
    const parsed = patchContradictionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    let statusOverride: ContradictionStatus | undefined;
    let forceSnoozedUntilNull = false;

    if (input.action) {
      if (input.action === "snooze" && input.snoozedUntil === undefined) {
        return new NextResponse("snoozedUntil is required for action snooze", {
          status: 400,
        });
      }

      try {
        const transition = applyContradictionAction(currentNode.status, input.action);
        statusOverride = transition.nextStatus;
      } catch (error) {
        if (error instanceof ContradictionTransitionError) {
          void serverLogMetric({
            userId,
            name: "invariant.violation",
            level: "warn",
            meta: {
              code: error.code,
              route: "/api/contradiction/[id]",
              entityId: id,
              action: input.action,
              currentStatus: currentNode.status,
            },
            source: "server",
            route: `/api/contradiction/${id}`,
          });
          return NextResponse.json(
            { error: { code: error.code, message: error.message } },
            { status: 409 }
          );
        }
        throw error;
      }

      if (
        input.action === "resolve" ||
        input.action === "accept_tradeoff" ||
        input.action === "archive_tension" ||
        input.action === "unsnooze"
      ) {
        forceSnoozedUntilNull = true;
      }
    } else if (
      input.status &&
      TERMINAL_STATUSES.includes(currentNode.status) &&
      NON_TERMINAL_STATUSES.includes(input.status)
    ) {
      return new NextResponse("Terminal status requires action reopen", { status: 400 });
    }

    let evidenceToAdd: Array<{
      sessionId: string;
      messageId: string;
      quote: string | null;
    }> = [];
    if (input.addEvidence?.length) {
      evidenceToAdd = await Promise.all(
        input.addEvidence.map(async (item) => {
          const resolved = await resolveContradictionSource({
            userId,
            sourceSessionId: item.sessionId,
            sourceMessageId: item.messageId,
            db: prismadb,
          });

          return {
            sessionId: resolved.sourceSessionId,
            messageId: resolved.sourceMessageId,
            quote: item.quote?.trim() || null,
          };
        })
      );
    }

    const updatedNode = await prismadb.$transaction(async (tx) => {
      if (evidenceToAdd.length) {
        await tx.contradictionEvidence.createMany({
          data: evidenceToAdd.map((item) => ({
            nodeId: id,
            sessionId: item.sessionId || null,
            messageId: item.messageId || null,
            quote: item.quote,
          })),
        });
      }

      const now = new Date();
      const intermediateNode = await tx.contradictionNode.update({
        where: { id },
        data: buildContradictionPatchData(input, evidenceToAdd.length, now, {
          statusOverride,
          forceSnoozedUntilNull,
        }),
        select: {
          id: true,
          snoozeCount: true,
          avoidanceCount: true,
          timesSurfaced: true,
          lastEscalatedAt: true,
          lastTouchedAt: true,
          lastEvidenceAt: true,
          escalationLevel: true,
        },
      });

      const nextLevel = computeEscalationLevel(
        {
          snoozeCount: intermediateNode.snoozeCount,
          avoidanceCount: intermediateNode.avoidanceCount,
          timesSurfaced: intermediateNode.timesSurfaced,
          lastEscalatedAt: intermediateNode.lastEscalatedAt,
          lastTouchedAt: intermediateNode.lastTouchedAt,
          lastEvidenceAt: intermediateNode.lastEvidenceAt,
        },
        now
      );
      const escalatedNow = shouldEscalate(
        intermediateNode.escalationLevel,
        nextLevel,
        intermediateNode.lastEscalatedAt,
        now
      );

      return tx.contradictionNode.update({
        where: { id },
        data: {
          escalationLevel: nextLevel,
          recommendedRung: computeRecommendedRung(nextLevel),
          lastEscalatedAt: escalatedNow ? now : undefined,
        },
        select: CONTRADICTION_WITH_EVIDENCE,
      });
    });

    return NextResponse.json(updatedNode);
  } catch (error) {
    if (error instanceof ContradictionSourceError) {
      return new NextResponse(error.message, { status: error.status });
    }

    console.log("[CONTRADICTION_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;
    if (!id) {
      return new NextResponse("Contradiction id is required", { status: 400 });
    }

    const node = await prismadb.contradictionNode.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });

    if (!node) {
      return new NextResponse("Contradiction not found", { status: 404 });
    }

    if (node.status !== "candidate") {
      return new NextResponse("Only candidate tensions can be dismissed", { status: 409 });
    }

    await prismadb.$transaction(async (tx) => {
      await tx.contradictionEvidence.deleteMany({ where: { nodeId: id } });
      await tx.contradictionNode.delete({ where: { id } });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.log("[CONTRADICTION_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
