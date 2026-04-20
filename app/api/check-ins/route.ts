import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  QUICK_CHECK_IN_LIST_LIMIT,
  createQuickCheckInSchema,
  toQuickCheckInView,
} from "../../../lib/quick-check-ins";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const checkIns = await prismadb.quickCheckIn.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: QUICK_CHECK_IN_LIST_LIMIT,
      select: {
        id: true,
        stateTag: true,
        eventTags: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(checkIns.map(toQuickCheckInView));
  } catch (error) {
    console.log("[CHECK_INS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createQuickCheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid check-in" },
      { status: 400 }
    );
  }

  try {
    const checkIn = await prismadb.quickCheckIn.create({
      data: {
        userId,
        stateTag: parsed.data.stateTag,
        eventTags: parsed.data.eventTags,
        note: parsed.data.note,
      },
      select: {
        id: true,
        stateTag: true,
        eventTags: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(toQuickCheckInView(checkIn), { status: 201 });
  } catch (error) {
    console.log("[CHECK_INS_POST_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
