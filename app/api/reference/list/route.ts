import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const items = await prismadb.referenceItem.findMany({
      where: {
        userId,
        status: "active",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        type: true,
        confidence: true,
        statement: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.log("[REFERENCE_LIST_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
