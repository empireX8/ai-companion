import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: Array<{ type: "text"; text: string }>;
};

const getMessageText = (message: IncomingMessage) => {
  if (typeof message.content === "string" && message.content.trim() !== "") {
    return message.content;
  }

  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }

  return "";
};

export async function POST(req: Request) {
  try {
    const { id, messages } = await req.json();
    const companionId = id;

    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const identifier = `${req.url}-${userId}`;
    const { success } = await rateLimit(identifier);

    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    if (!companionId || typeof companionId !== "string") {
      return new NextResponse("Companion id is required", { status: 400 });
    }

    if (!Array.isArray(messages)) {
      return new NextResponse("Messages are required", { status: 400 });
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m?.role === "user");
    const prompt = lastUserMessage ? getMessageText(lastUserMessage) : "";

    if (!prompt) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    const companion = await prismadb.companion.findUnique({
      where: { id: companionId },
    });

    if (!companion) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    // READS only (needed to build system prompt)
    const memoryManager = await MemoryManager.getInstance();

    const companionKey = {
      companionName: companionId,
      modelName: "gpt-4o-mini",
      userId,
    };

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
          console.error("[CHAT_ROUTE_ONFINISH_ERROR]", error);
        }
      },
    });

    // WRITES fire-and-forget (do not block streaming)
    void (async () => {
      try {
        await memoryManager.seedChatHistory(companion.seed, "\n", companionKey);
        await memoryManager.writeToHistory(`Human: ${prompt}`, companionKey);

        await prismadb.message.create({
          data: {
            companionId: companion.id,
            role: "user",
            content: prompt,
            userId,
          },
        });
      } catch (error) {
        console.error("[CHAT_ROUTE_SIDE_EFFECT_ERROR]", error);
      }
    })();

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.log("[CHAT_ROUTE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
