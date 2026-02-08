import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

const REFERENCE_SELECT = {
  id: true,
  type: true,
  confidence: true,
  statement: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  sourceSessionId: true,
  sourceMessageId: true,
  supersedesId: true,
} as const;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";

    if (!id) {
      return new NextResponse("Reference id is required", { status: 400 });
    }

    const existingItem = await prismadb.referenceItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existingItem) {
      return new NextResponse("Reference not found", { status: 404 });
    }

    const updatedItem = await prismadb.referenceItem.update({
      where: { id },
      data: { status: "superseded" },
      select: REFERENCE_SELECT,
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.log("[REFERENCE_DEACTIVATE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
