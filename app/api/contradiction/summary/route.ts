import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await prismadb.contradictionNode.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });

  const c: Record<string, number> = {};
  for (const row of rows) c[row.status] = row._count._all;

  return NextResponse.json({
    open: c["open"] ?? 0,
    explored: c["explored"] ?? 0,
    snoozed: c["snoozed"] ?? 0,
    resolved: c["resolved"] ?? 0,
    accepted_tradeoff: c["accepted_tradeoff"] ?? 0,
    archived_tension: c["archived_tension"] ?? 0,
    total: Object.values(c).reduce((s, n) => s + n, 0),
  });
}
