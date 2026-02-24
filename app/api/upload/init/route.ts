import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { initUploadSession, toHttpErrorPayload, type InitUploadInput } from "@/lib/import-upload-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as Partial<InitUploadInput>;
    console.log(
      `[UPLOAD_INIT] userId=${userId.slice(0, 8)}… filename=${body.filename ?? "(none)"} bytesTotal=${body.bytesTotal ?? "(none)"}`
    );

    const result = await initUploadSession({
      userId,
      input: {
        filename: body.filename ?? "",
        contentType: body.contentType ?? "",
        bytesTotal: Number(body.bytesTotal),
        chunkSize: Number(body.chunkSize),
        totalChunks: Number(body.totalChunks),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[UPLOAD_INIT_ERROR]", error);
    const httpError = toHttpErrorPayload(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
