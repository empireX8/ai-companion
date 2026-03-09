import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  const projection = await prismadb.projection.findFirst({
    where: { id, userId },
  });

  if (!projection) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json(projection);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json();

    if (body?.action !== "archive" && body?.action !== "resolve") {
      return new NextResponse("Invalid action", { status: 400 });
    }

    const existing = await prismadb.projection.findFirst({
      where: { id, userId },
      select: { status: true },
    });

    if (!existing) return new NextResponse("Not found", { status: 404 });

    if (body.action === "resolve") {
      if (existing.status === "resolved") {
        const item = await prismadb.projection.findFirst({ where: { id, userId } });
        return NextResponse.json(item);
      }
      const verdict = body.verdict as string | undefined;
      const allowedVerdicts = ["correct", "incorrect", "mixed"];
      if (!verdict || !allowedVerdicts.includes(verdict)) {
        return new NextResponse("Invalid verdict", { status: 400 });
      }
      const updated = await prismadb.projection.update({
        where: { id },
        data: {
          status: "resolved",
          resolutionVerdict: verdict as "correct" | "incorrect" | "mixed",
          resolutionNote: typeof body.note === "string" ? body.note.trim() || null : null,
          resolvedAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    // archive action
    if (existing.status === "archived") {
      const item = await prismadb.projection.findFirst({ where: { id, userId } });
      return NextResponse.json(item);
    }

    const updated = await prismadb.projection.update({
      where: { id },
      data: { status: "archived" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.log("[PROJECTION_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    const existing = await prismadb.projection.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) return new NextResponse("Not found", { status: 404 });

    await prismadb.projection.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.log("[PROJECTION_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
