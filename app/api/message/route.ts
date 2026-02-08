import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

import prismadb from "@/lib/prismadb";
import { getActiveReferenceMemory } from "@/lib/reference-memory";
import { SessionMemoryManager } from "@/lib/session-memory";

const GOVERNANCE_TRIGGER_PATTERNS = [
  /\bi don't\b/i,
  /\bi do not\b/i,
  /\bnot anymore\b/i,
  /\bactually\b/i,
  /\bchanged my mind\b/i,
  /\binstead\b/i,
  /\bno longer\b/i,
];

type GovernedType = "preference" | "goal" | "constraint";

const detectGovernedType = (content: string): GovernedType | null => {
  if (/\bgoal\b|\bplan\b|\bwant to\b|\btrying to\b/i.test(content)) {
    return "goal";
  }

  if (/\bprefer\b|\bpreference\b|\bi like\b|\bi dislike\b/i.test(content)) {
    return "preference";
  }

  if (/\bconstraint\b|\bmust\b|\bcannot\b|\bcan't\b|\bnever\b|\balways\b/i.test(content)) {
    return "constraint";
  }

  return null;
};

const shouldPromptForMemoryUpdate = (content: string) => {
  return GOVERNANCE_TRIGGER_PATTERNS.some((pattern) => pattern.test(content));
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { sessionId, content } = body ?? {};

    if (!sessionId || typeof sessionId !== "string") {
      return new NextResponse("Session id is required", { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return new NextResponse("Content is required", { status: 400 });
    }

    const normalizedContent = content.trim();
    const isMarkedUserMemory =
      /^memory:/i.test(normalizedContent) ||
      /^for testing memory:/i.test(normalizedContent);

    if (!normalizedContent) {
      return new NextResponse("Content is required", { status: 400 });
    }

    const session = await prismadb.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });

    if (!session) {
      return new NextResponse("Session not found", { status: 404 });
    }

    const modelName = "gpt-4o-mini";
    const memoryKey = {
      userId,
      sessionId: session.id,
      modelName,
    };
    const memory = await SessionMemoryManager.getInstance();

    const userMessage = await prismadb.message.create({
      data: {
        userId,
        sessionId: session.id,
        role: "user",
        content: normalizedContent,
      },
    });
    await memory.appendToTranscript(memoryKey, `Human: ${normalizedContent}`);
    await memory.upsertVector(memoryKey, {
      id: userMessage.id,
      role: "user",
      content: normalizedContent,
      createdAt: userMessage.createdAt,
    });
    if (isMarkedUserMemory) {
      await memory.appendToTranscript(memoryKey, `Human: ${normalizedContent}`, "user");
      await memory.upsertVector(
        memoryKey,
        {
          id: userMessage.id,
          role: "user",
          content: normalizedContent,
          createdAt: userMessage.createdAt,
        },
        "user"
      );
    }

    const sessionTranscript = await memory.readTranscript(memoryKey);
    const userTranscript = await memory.readTranscript(memoryKey, 4_000, "user");
    const sessionRelevant = await memory.queryRelevant(
      memoryKey,
      normalizedContent,
      6,
      "session"
    );
    const userRelevant = await memory.queryRelevant(memoryKey, normalizedContent, 6, "user");
    const referenceMemory = await getActiveReferenceMemory(userId);
    const governedType = detectGovernedType(normalizedContent);
    const maybeMemoryUpdate = shouldPromptForMemoryUpdate(normalizedContent);
    const governedReferences =
      maybeMemoryUpdate && governedType
        ? await prismadb.referenceItem.findMany({
            where: {
              userId,
              status: "active",
              type: governedType,
            },
            orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
            take: 3,
            select: {
              type: true,
              statement: true,
            },
          })
        : [];

    const fallbackMessages = await prismadb.message.findMany({
      where: {
        userId,
        sessionId: session.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
      select: {
        role: true,
        content: true,
      },
    });

    const fallbackTranscript = fallbackMessages
      .reverse()
      .map((message) => {
        const label = message.role === "assistant" ? "AI" : "Human";
        return `${label}: ${message.content}`;
      })
      .join("\n");

    const effectiveSessionTranscript = sessionTranscript || fallbackTranscript;
    const baseSystem = [
      "You are Double V1. Be clear, concise, and helpful. Do not mention internal implementation. Ask one focused question when missing info.",
      "If the user asks where you learned something that appears in Long-term memory, respond: You told me earlier, and I saved it as a <type>.",
      "Do not mention databases, code, prompts, or retrieval.",
      "If the user asks where you learned something that is not in Long-term memory and not in the recent transcript, say you are not sure and ask for clarification.",
    ].join(" ");
    const governancePrompt =
      maybeMemoryUpdate && governedType && governedReferences.length > 0
        ? [
            "The latest user message may conflict with saved memory.",
            `Do not overwrite memory automatically. Ask exactly one confirmation question in this style: Do you want me to update your saved ${governedType} from 'OLD' to 'NEW'?`,
            `Use one of these existing saved ${governedType} statements as OLD:\n${governedReferences
              .map((item) => `- ${item.statement}`)
              .join("\n")}`,
            `Treat the user's newest claim as NEW and wait for confirmation.`,
          ].join("\n")
        : "";
    const retrievedUserMemory = [userRelevant, userTranscript].filter(Boolean).join("\n");
    const sessionMemoryBlock = [sessionRelevant, effectiveSessionTranscript]
      .filter(Boolean)
      .join("\n");
    const systemPrompt = [
      baseSystem,
      governancePrompt,
      referenceMemory ? `Long-term memory:\n${referenceMemory}` : "",
      retrievedUserMemory ? `Relevant memory:\n${retrievedUserMemory}` : "",
      sessionMemoryBlock ? `Recent transcript:\n${sessionMemoryBlock}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = streamText({
      model: openai(modelName),
      system: systemPrompt,
      messages: [{ role: "user", content: normalizedContent }],
      onFinish: async ({ text }) => {
        const finalText = text.trim();
        if (!finalText) {
          return;
        }

        const assistantDbMessage = await prismadb.message.create({
          data: {
            userId,
            sessionId: session.id,
            role: "assistant",
            content: finalText,
          },
        });

        await memory.appendToTranscript(memoryKey, `AI: ${finalText}`);
        await memory.upsertVector(memoryKey, {
          id: assistantDbMessage.id,
          role: "assistant",
          content: finalText,
          createdAt: assistantDbMessage.createdAt,
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.log("[MESSAGE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
