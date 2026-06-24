import React, { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";

import { YourMapWorkbench } from "@/components/your-map/YourMapWorkbench";

export const dynamic = "force-dynamic";

function YourMapWorkbenchFallback() {
  return (
    <div className="animate-fade-in px-4 py-6 lg:px-8 lg:py-7">
      <div className="ml-material rounded-2xl p-5 text-[13px] text-muted-foreground">
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
    <Suspense fallback={<YourMapWorkbenchFallback />}>
      <YourMapWorkbench />
    </Suspense>
  );
}
