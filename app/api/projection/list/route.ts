import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const allowedStatuses = ["active", "archived", "resolved"] as const;
  type PStatus = typeof allowedStatuses[number];
  const status: PStatus =
    allowedStatuses.includes(statusParam as PStatus)
      ? (statusParam as PStatus)
      : "active";

  const projections = await prismadb.projection.findMany({
    where: { userId, status },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projections);
}
