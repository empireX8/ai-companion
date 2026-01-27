import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companionId: string }> }
) {
  try {
    const { companionId } = await params;
    const { userId } = await auth();
    const { prompt } = await req.json();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const identifier = `${req.url}-${userId}`;
    const { success } = await rateLimit(identifier);

    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    if (!prompt || typeof prompt !== "string") {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    const companion = await prismadb.companion.findUnique({
      where: { id: companionId },
    });

    if (!companion) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    // ----- Memory (Redis + Pinecone) -----
    const memoryManager = await MemoryManager.getInstance();

    const companionKey = {
      companionName: companionId,
      modelName: "gpt-4o-mini",
      userId,
    };

    await memoryManager.seedChatHistory(companion.seed, "\n", companionKey);
    await memoryManager.writeToHistory(`Human: ${prompt}`, companionKey);

    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);

    let similarDocsText = "";
    try {
      const similarDocs = await memoryManager.vectorSearch(
        recentChatHistory,
        companionId
      );
      similarDocsText = similarDocs?.map((d) => d.pageContent).join("\n\n") ?? "";
    } catch (e) {
      console.error("[PINECONE_VECTOR_SEARCH_ERROR]", e);
    }

    // ----- Persist user message (Prisma) -----
    await prismadb.message.create({
      data: {
        companionId: companion.id,
        role: "user",
        content: prompt,
        userId, // IMPORTANT: keep messages scoped to user
      },
    });

    const system = [
      companion.instructions,
      similarDocsText ? `\nRelevant memory:\n${similarDocsText}` : "",
      recentChatHistory ? `\nRecent conversation:\n${recentChatHistory}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await streamText({
      model: openai("gpt-4o-mini"),
      system,
      messages: [{ role: "user", content: prompt }],
      onFinish: async ({ text }) => {
        const finalText = text ?? "";

        try {
          await memoryManager.writeToHistory(`AI: ${finalText}`, companionKey);

          await prismadb.message.create({
            data: {
              companionId: companion.id,
              role: "assistant",
              content: finalText,
              userId,
            },
          });
        } catch (error) {
          console.error("AI save error:", error);
        }
      },
    });

  return result.toUIMessageStreamResponse();
  } catch (error) {
    console.log("[CHAT_ROUTE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
