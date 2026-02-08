import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const session = await prismadb.session.create({
      data: {
        userId,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.log("[SESSION_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
