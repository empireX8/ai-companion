import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createHash } from "crypto";

import prismadb from "@/lib/prismadb";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
    const quote = typeof body?.quote === "string" ? body.quote.trim() : "";

    if (!messageId || !quote) {
      return new NextResponse("messageId and quote are required", { status: 400 });
    }

    // Verify the message exists and belongs to the user
    const message = await prismadb.message.findFirst({
      where: { id: messageId, userId },
      select: { id: true, content: true },
    });

    if (!message) {
      return new NextResponse("Message not found", { status: 404 });
    }

    // Find quote position; fall back to full content if not found
    const idx = message.content.indexOf(quote);
    const charStart = idx >= 0 ? idx : 0;
    const slice = idx >= 0 ? quote : message.content.slice(0, Math.min(500, message.content.length));
    const charEnd = charStart + slice.length;
    const contentHash = createHash("sha256").update(slice).digest("hex");

    // Upsert — return existing span if already saved
    const existing = await prismadb.evidenceSpan.findUnique({
      where: {
        messageId_charStart_charEnd_contentHash: { messageId, charStart, charEnd, contentHash },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ id: existing.id, created: false });
    }

    const span = await prismadb.evidenceSpan.create({
      data: { userId, messageId, charStart, charEnd, contentHash },
      select: { id: true },
    });

    return NextResponse.json({ id: span.id, created: true });
  } catch (error) {
    console.log("[EVIDENCE_CREATE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
