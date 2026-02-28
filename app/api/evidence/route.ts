import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const originParam = searchParams.get("origin") ?? "all";
    const hasArtifactsParam = searchParams.get("hasArtifacts");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "30", 10), 1), 100);
    const cursor = searchParams.get("cursor") ?? undefined;

    // Build session origin filter
    const originFilter =
      originParam === "app"
        ? "APP"
        : originParam === "imported"
          ? "IMPORTED_ARCHIVE"
          : undefined;

    // Fetch spans with message + session joins
    const spans = await prismadb.evidenceSpan.findMany({
      where: {
        userId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        message: {
          session: originFilter ? { origin: originFilter } : undefined,
          ...(q ? { content: { contains: q, mode: "insensitive" } } : {}),
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        createdAt: true,
        charStart: true,
        charEnd: true,
        message: {
          select: {
            content: true,
            session: {
              select: {
                id: true,
                label: true,
                origin: true,
              },
            },
          },
        },
        profileArtifactLinks: {
          select: { artifactId: true },
        },
      },
    });

    const hasMore = spans.length > limit;
    const items = hasMore ? spans.slice(0, limit) : spans;

    const hasArtifactsFilter =
      hasArtifactsParam === "true"
        ? true
        : hasArtifactsParam === "false"
          ? false
          : undefined;

    const filtered =
      hasArtifactsFilter === undefined
        ? items
        : items.filter((s) =>
            hasArtifactsFilter
              ? s.profileArtifactLinks.length > 0
              : s.profileArtifactLinks.length === 0
          );

    const result = filtered.map((s) => {
      const content = s.message.content;
      const excerpt = content.slice(s.charStart, s.charEnd).slice(0, 200);
      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        excerpt,
        sessionId: s.message.session?.id ?? null,
        sessionLabel: s.message.session?.label ?? null,
        origin: (s.message.session?.origin ?? "APP") as "APP" | "IMPORTED_ARCHIVE",
        artifactCount: s.profileArtifactLinks.length,
      };
    });

    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1].createdAt.toISOString()
        : null;

    return NextResponse.json({ items: result, nextCursor });
  } catch (error) {
    console.log("[EVIDENCE_LIST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
