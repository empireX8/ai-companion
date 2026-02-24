import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getUploadSessionStatus, toHttpErrorPayload } from "@/lib/import-upload-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId") ?? "";

    const status = await getUploadSessionStatus({
      userId,
      sessionId,
    });

    return NextResponse.json(status);
  } catch (error) {
    const httpError = toHttpErrorPayload(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
