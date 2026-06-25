import React, { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";

import { OrvekMapPage } from "@/components/orvek-workbench/OrvekMapPage";

export const dynamic = "force-dynamic";

function YourMapFallback() {
  return (
    <div className="px-6 pt-5 pb-4 lg:px-8">
      <div className="o-material rounded-2xl p-5 text-[13px] text-muted-foreground">
        Loading your map…
      </div>
    </div>
  );
}

export default async function YourMapPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  return (
    <Suspense fallback={<YourMapFallback />}>
      <OrvekMapPage />
    </Suspense>
  );
}
