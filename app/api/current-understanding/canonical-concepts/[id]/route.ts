import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { isCanonicalModelAuthorityError } from "../../../../../lib/canonical-model-authority-errors";
import { readCanonicalProductConceptForUser } from "../../../../../lib/current-understanding-product-projection";
import prismadb from "../../../../../lib/prismadb";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const { id } = await params;
  const conceptId = id?.trim();
  if (!conceptId) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: NO_STORE },
    );
  }

  try {
    const concept = await readCanonicalProductConceptForUser({
      userId,
      conceptId,
      db: prismadb,
    });
    if (concept === "not_found") {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: NO_STORE },
      );
    }

    return NextResponse.json(concept, {
      headers: NO_STORE,
    });
  } catch (error) {
    if (
      isCanonicalModelAuthorityError(error) &&
      error.code === "BROKEN_CANONICAL_PROJECTION"
    ) {
      console.error("[CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_GET]", {
        code: error.code,
      });
      return NextResponse.json(
        { error: "Canonical model unavailable", code: "canonical_model_unavailable" },
        { status: 500, headers: NO_STORE },
      );
    }
    console.error("[CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_GET_ERROR]", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Internal Error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
