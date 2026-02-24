import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy one-shot import endpoint is disabled. Use /api/upload/init, /api/upload/chunk, /api/upload/finalize, and /api/upload/status.",
    },
    { status: 410 }
  );
}
