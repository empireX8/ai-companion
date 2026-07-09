import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  createSurfacedEvidenceDepthLinkageDeps,
  readSurfacedEvidencePointersForUser,
} from "@/lib/live-evidence-depth-linkage";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deps = createSurfacedEvidenceDepthLinkageDeps(prismadb);
    const graph = await readSurfacedEvidencePointersForUser({ userId }, deps);

    return NextResponse.json({
      pointerObjects: graph.pointerObjects,
      linkedObjects: graph.linkedObjects,
      depthSafePointerIds: graph.depthSafePointerIds,
      rejectedPointers: graph.rejectedPointers,
      inspectorDepthListReady: graph.inspectorDepthListReady,
    });
  } catch (error) {
    console.error("[TODAY_EVIDENCE_POINTERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
