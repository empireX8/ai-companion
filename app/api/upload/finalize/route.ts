import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { finalizeUploadSession, toHttpErrorPayload } from "@/lib/import-upload-service";
import { serverLogMetric } from "@/lib/metrics-server";

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

    const sessionsCreated = (result as Record<string, unknown>).sessionsCreated ?? null;
    void serverLogMetric({
      userId,
      name: "import.upload.finalize",
      meta: {
        sessionId,
        sessionsCreated,
        messagesCreated: (result as Record<string, unknown>).messagesCreated ?? null,
        contradictionsCreated: (result as Record<string, unknown>).contradictionsCreated ?? null,
      },
      source: "server",
      route: "/api/upload/finalize",
    });
    if (typeof sessionsCreated === "number" && sessionsCreated > 0) {
      void serverLogMetric({
        userId,
        name: "import.archive.created",
        value: sessionsCreated,
        meta: { uploadSessionId: sessionId },
        source: "server",
        route: "/api/upload/finalize",
      });
    }

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const httpError = toHttpErrorPayload(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
