import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await prismadb.referenceItem.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });

  const c: Record<string, number> = {};
  for (const row of rows) c[row.status] = row._count._all;

  return NextResponse.json({
    active: c["active"] ?? 0,
    candidate: c["candidate"] ?? 0,
    inactive: c["inactive"] ?? 0,
    superseded: c["superseded"] ?? 0,
    total: Object.values(c).reduce((s, n) => s + n, 0),
  });
}
