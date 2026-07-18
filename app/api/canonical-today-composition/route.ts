import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { loadCanonicalWorkbenchBundle } from "@/lib/canonical-today-composition";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

/**
 * Auth-scoped Canonical Today Composition + Model Movement Report bundle.
 * Empty 200 when the user has no explicit composition (normal accounts).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bundle = await loadCanonicalWorkbenchBundle(prismadb, userId);
    if (!bundle) {
      return NextResponse.json({ composition: null, report: null });
    }
    return NextResponse.json({
      composition: bundle.composition,
      report: bundle.report,
    });
  } catch (err) {
    console.error("[canonical-today-composition]", err);
    return NextResponse.json({ error: "Failed to load composition" }, { status: 500 });
  }
}
