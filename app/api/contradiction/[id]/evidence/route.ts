import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import {
  addEvidenceToContradiction,
  EvidenceNodeNotFoundError,
} from "@/lib/contradiction-evidence";

const addEvidenceSchema = z.object({
  source: z.enum(["user_input", "reflection", "session"]),
  note: z.string().trim().min(1, "Note is required").max(2000, "Note must be 2000 characters or less"),
  sessionId: z.string().optional(),
});

export async function POST(
  req: Request,
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
      return new NextResponse("Contradiction id is required", { status: 400 });
    }

    const body = await req.json();
    const parsed = addEvidenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { source, note, sessionId } = parsed.data;

    const result = await addEvidenceToContradiction({
      userId,
      contradictionId: id,
      source,
      note,
      sessionId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof EvidenceNodeNotFoundError) {
      return new NextResponse(error.message, { status: 404 });
    }

    console.log("[CONTRADICTION_EVIDENCE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
