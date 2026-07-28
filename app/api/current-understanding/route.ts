import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { isCanonicalModelAuthorityError } from "../../../lib/canonical-model-authority-errors";
import { readCurrentUnderstandingProductProjection } from "../../../lib/current-understanding-product-projection";
import prismadb from "../../../lib/prismadb";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const projection = await readCurrentUnderstandingProductProjection({
      userId,
      db: prismadb,
    });

    return NextResponse.json(projection, {
      headers: NO_STORE,
    });
  } catch (error) {
    if (
      isCanonicalModelAuthorityError(error) &&
      error.code === "BROKEN_CANONICAL_PROJECTION"
    ) {
      console.error("[CURRENT_UNDERSTANDING_GET]", {
        code: error.code,
      });
      return NextResponse.json(
        { error: "Canonical model unavailable", code: "canonical_model_unavailable" },
        { status: 500, headers: NO_STORE },
      );
    }
    console.error("[CURRENT_UNDERSTANDING_GET_ERROR]", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Internal Error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
