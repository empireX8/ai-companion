import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import prismadb from "@/lib/prismadb";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { sessionId } = (await req.json()) as { sessionId?: string };
    if (!sessionId) {
      return new NextResponse("sessionId required", { status: 400 });
    }

    // Verify ownership and check that a label hasn't already been set
    const session = await prismadb.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, label: true },
    });

    if (!session) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Don't overwrite a label the user set manually
    if (session.label) {
      return NextResponse.json({ label: session.label });
    }

    // Fetch first few messages for context
    const messages = await prismadb.message.findMany({
      where: { sessionId, userId },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: { role: true, content: true },
    });

    if (messages.length < 2) {
      return NextResponse.json({ label: null });
    }

    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Given this conversation, write a short title (4-7 words, no punctuation, no quotes) that captures what it's about:\n\n${transcript}\n\nTitle:`,
      maxTokens: 20,
      temperature: 0.3,
    });

    const label = text.trim().replace(/^["']|["']$/g, "").trim();
    if (!label) {
      return NextResponse.json({ label: null });
    }

    await prismadb.session.update({
      where: { id: sessionId },
      data: { label },
    });

    return NextResponse.json({ label });
  } catch (error) {
    console.log("[SESSION_TITLE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
