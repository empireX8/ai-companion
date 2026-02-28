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
        origin: "APP",
      },
      select: {
        id: true,
      },
    });

    // TODO(B2-native): Native sessions accumulate messages incrementally during
    // chat; there is no single batch boundary here to wrap in a DerivationRun.
    // Wire DerivationRun(scope="native") around the per-message inference step
    // once a clean processing boundary exists in the message handler.

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.log("[SESSION_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
