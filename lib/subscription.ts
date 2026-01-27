import { auth } from "@clerk/nextjs/server";
import { unstable_noStore as noStore } from "next/cache";

import prismadb from "@/lib/prismadb";

export const checkSubscription = async (): Promise<boolean> => {
  noStore();
  const { userId } = await auth();
  if (!userId) return false;

  const userSubscription = await prismadb.userSubscription.findFirst({
    where: { userId },
    orderBy: { stripeCurrentPeriodEnd: "desc" },
    select: {
      stripePriceId: true,
      stripeCurrentPeriodEnd: true,
    },
  });

  if (!userSubscription?.stripePriceId) return false;
  if (!userSubscription?.stripeCurrentPeriodEnd) return false;

  return userSubscription.stripeCurrentPeriodEnd.getTime() > Date.now();
};
