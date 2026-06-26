import { auth } from "@clerk/nextjs/server";
import { UserMapConclusionVisibility } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export default async function YourMapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    notFound();
  }

  const { id } = await params;
  const row = await prismadb.userMapConclusion.findFirst({
    where: {
      id,
      userId,
      visibility: UserMapConclusionVisibility.user_visible,
    },
    select: { id: true },
  });

  if (!row) {
    notFound();
  }

  redirect(`/your-map?selected=${encodeURIComponent(row.id)}`);
}
