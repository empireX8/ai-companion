import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { toHttpErrorPayload, upsertUploadChunk } from "@/lib/import-upload-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const sessionId = req.headers.get("x-session-id") ?? "";
    const chunkIndex = Number(req.headers.get("x-chunk-index") ?? "NaN");
    const checksum = req.headers.get("x-checksum") ?? null;
    const contentLength = req.headers.get("content-length") ?? "unknown";

    console.log(
      `[UPLOAD_CHUNK] sessionId=${sessionId} chunkIndex=${chunkIndex} contentLength=${contentLength}`
    );

    if (!sessionId) {
      return NextResponse.json({ error: "X-Session-Id header is required" }, { status: 400 });
    }

    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json(
        { error: "X-Chunk-Index header must be a non-negative integer" },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await req.arrayBuffer());

    if (bytes.length === 0) {
      return NextResponse.json({ error: "chunk body is empty" }, { status: 400 });
    }

    await upsertUploadChunk({
      userId,
      sessionId,
      chunkIndex,
      checksum,
      chunkBytes: bytes,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[UPLOAD_CHUNK_ERROR]", error);
    const httpError = toHttpErrorPayload(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
