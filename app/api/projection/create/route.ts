import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json() as {
    premise?: string;
    drivers?: unknown;
    outcomes?: unknown;
    confidence?: unknown;
    source?: { kind: string; sessionId?: string; messageId?: string };
  };

  const premise = typeof body.premise === "string" ? body.premise.trim() : "";
  if (!premise) {
    return new NextResponse("premise is required", { status: 400 });
  }

  const drivers = Array.isArray(body.drivers)
    ? (body.drivers as unknown[]).filter((d): d is string => typeof d === "string" && d.trim() !== "").map((d) => d.trim())
    : [];

  const outcomes = Array.isArray(body.outcomes)
    ? (body.outcomes as unknown[]).filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
    : [];

  const rawConf = typeof body.confidence === "number" ? body.confidence : 0.5;
  const confidence = Math.max(0, Math.min(1, rawConf));

  const sourceSessionId =
    body.source?.sessionId && typeof body.source.sessionId === "string"
      ? body.source.sessionId
      : null;
  const sourceMessageId =
    body.source?.messageId && typeof body.source.messageId === "string"
      ? body.source.messageId
      : null;

  const projection = await prismadb.projection.create({
    data: {
      userId,
      premise,
      drivers,
      outcomes,
      confidence,
      sourceSessionId,
      sourceMessageId,
    },
  });

  return NextResponse.json(projection);
}
