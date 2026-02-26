import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  getReferenceDetail,
  ReferenceDetailNotFoundError,
} from "@/lib/reference-detail";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;
    if (!id) {
      return new NextResponse("Reference id is required", { status: 400 });
    }

    const detail = await getReferenceDetail({ userId, referenceId: id });

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof ReferenceDetailNotFoundError) {
      return new NextResponse(error.message, { status: 404 });
    }

    console.log("[REFERENCE_DETAIL_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
