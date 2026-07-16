import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        authenticated: false,
        userId: null,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    userId,
  });
}
