import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const span = await prismadb.evidenceSpan.findFirst({
      where: { id, userId },
      select: {
        id: true,
        createdAt: true,
        charStart: true,
        charEnd: true,
        messageId: true,
        message: {
          select: {
            content: true,
            session: {
              select: {
                id: true,
                label: true,
                origin: true,
              },
            },
          },
        },
        profileArtifactLinks: {
          select: {
            artifact: {
              select: {
                id: true,
                type: true,
                claim: true,
                confidence: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!span) {
      return new NextResponse("Not found", { status: 404 });
    }

    const content = span.message.content.slice(span.charStart, span.charEnd);

    return NextResponse.json({
      id: span.id,
      createdAt: span.createdAt.toISOString(),
      content,
      charStart: span.charStart,
      charEnd: span.charEnd,
      messageId: span.messageId,
      sessionId: span.message.session?.id ?? null,
      sessionLabel: span.message.session?.label ?? null,
      origin: (span.message.session?.origin ?? "APP") as "APP" | "IMPORTED_ARCHIVE",
      artifacts: span.profileArtifactLinks.map((link) => ({
        id: link.artifact.id,
        type: link.artifact.type,
        claim: link.artifact.claim,
        confidence: link.artifact.confidence,
        status: link.artifact.status,
      })),
    });
  } catch (error) {
    console.log("[EVIDENCE_DETAIL_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
