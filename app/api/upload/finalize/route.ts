import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { finalizeUploadSession, toHttpErrorPayload } from "@/lib/import-upload-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as { sessionId?: string };
    const sessionId = body.sessionId ?? "";
    const result = await finalizeUploadSession({
      userId,
      sessionId,
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const httpError = toHttpErrorPayload(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
