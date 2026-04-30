import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { resolveApiUserId } from "../../../lib/api-user-auth";
import { parseSessionSurfaceTypeBody } from "../../../lib/session-surface-type";

export async function POST(req: Request) {
  try {
    const userId = await resolveApiUserId(req);

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    if (rawBody.trim().length > 0) {
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return new NextResponse("Invalid JSON body", { status: 400 });
      }

      if (
        parsedBody === null ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        return new NextResponse("Invalid request body", { status: 400 });
      }

      body = parsedBody as Record<string, unknown>;
    }

    const parsedSurfaceType = parseSessionSurfaceTypeBody(body.surfaceType);
    if (!parsedSurfaceType.ok) {
      return new NextResponse("Invalid surfaceType value", { status: 400 });
    }

    const surfaceType = parsedSurfaceType.value ?? "journal_chat";

    const session = await prismadb.session.create({
      data: {
        userId,
        origin: "APP",
        surfaceType,
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
