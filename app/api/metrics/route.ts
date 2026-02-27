import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { serverLogMetric } from "@/lib/metrics-server";
import { sanitizeMetaForStorage } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const VALID_LEVELS = new Set(["debug", "info", "warn", "error"]);
const MAX_NAME_LENGTH = 120;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid JSON", { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new NextResponse("Invalid body", { status: 400 });
    }

    const { name, level, value, meta, sessionId, route } = body as Record<string, unknown>;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return new NextResponse("Missing or invalid name", { status: 400 });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return new NextResponse("name too long", { status: 400 });
    }
    if (level !== undefined && !VALID_LEVELS.has(level as string)) {
      return new NextResponse("Invalid level", { status: 400 });
    }
    if (value !== undefined && value !== null && typeof value !== "number") {
      return new NextResponse("Invalid value", { status: 400 });
    }
    if (meta !== undefined && meta !== null && (typeof meta !== "object" || Array.isArray(meta))) {
      return new NextResponse("Invalid meta", { status: 400 });
    }

    await serverLogMetric({
      userId,
      name: name.trim(),
      level: (level as "debug" | "info" | "warn" | "error") ?? "info",
      value: typeof value === "number" ? value : null,
      meta: sanitizeMetaForStorage((meta as Record<string, unknown>) ?? null),
      sessionId: typeof sessionId === "string" ? sessionId : null,
      route: typeof route === "string" ? route : null,
      source: "client",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("[METRICS_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const query = searchParams.get("query");   // name contains (new)
    const nameFilter = searchParams.get("name"); // legacy: exact or startsWith*
    const levelFilter = searchParams.get("level");

    const limit = limitParam ? Math.min(Number(limitParam), 500) : 200;
    if (!Number.isInteger(limit) || limit < 1) {
      return new NextResponse("Invalid limit", { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId };

    if (query) {
      where.name = { contains: query };
    } else if (nameFilter) {
      where.name = nameFilter.endsWith("*")
        ? { startsWith: nameFilter.slice(0, -1) }
        : nameFilter;
    }

    if (levelFilter && VALID_LEVELS.has(levelFilter)) {
      where.level = levelFilter;
    }

    const events = await prismadb.internalMetricEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(events, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.log("[METRICS_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
