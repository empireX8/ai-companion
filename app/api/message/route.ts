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

const AFFIRMATIVE_TOKENS = [
  "yes",
  "y",
  "yeah",
  "yep",
  "correct",
  "do it",
  "update it",
  "please do",
  "confirm",
];

const NEGATIVE_TOKENS = [
  "no",
  "n",
  "nope",
  "don't",
  "do not",
  "leave it",
  "keep it",
  "cancel",
];

const startsWithIntentToken = (content: string, tokens: string[]) => {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return tokens.some(
    (token) =>
      normalized === token ||
      normalized.startsWith(`${token} `) ||
      normalized.startsWith(`${token},`) ||
      normalized.startsWith(`${token}.`) ||
      normalized.startsWith(`${token}!`)
  );
};

const isAffirmative = (content: string) => {
  return startsWithIntentToken(content, AFFIRMATIVE_TOKENS);
};

const isNegative = (content: string) => {
  return startsWithIntentToken(content, NEGATIVE_TOKENS);
};

const toSingleLine = (value: string) => value.replace(/\s+/g, " ").trim();

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
    const createTextStreamResponse = (text: string) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    };
    const persistAssistantReply = async (text: string) => {
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
    };

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

    const pendingCandidate = await prismadb.referenceItem.findFirst({
      where: {
        userId,
        status: "candidate",
        sourceSessionId: session.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        type: true,
        statement: true,
        supersedesId: true,
      },
    });

    if (pendingCandidate && isAffirmative(normalizedContent)) {
      await prismadb.$transaction(async (tx) => {
        if (pendingCandidate.supersedesId) {
          await tx.referenceItem.update({
            where: { id: pendingCandidate.supersedesId },
            data: {
              status: "superseded",
              supersedesId: pendingCandidate.id,
            },
          });
        }

        await tx.referenceItem.update({
          where: { id: pendingCandidate.id },
          data: {
            status: "active",
          },
        });
      });

      const confirmationText = `Done — I updated your saved ${pendingCandidate.type} to: "${pendingCandidate.statement}".`;
      try {
        await persistAssistantReply(confirmationText);
      } catch (error) {
        console.log("[MESSAGE_CONFIRM_APPLY_PERSIST_ERROR]", error);
      }

      return createTextStreamResponse(confirmationText);
    }

    if (pendingCandidate && isNegative(normalizedContent)) {
      await prismadb.referenceItem.update({
        where: { id: pendingCandidate.id },
        data: {
          status: "superseded",
        },
      });

      const discardText = `Got it — I won't change your saved ${pendingCandidate.type}.`;
      try {
        await persistAssistantReply(discardText);
      } catch (error) {
        console.log("[MESSAGE_CONFIRM_DISCARD_PERSIST_ERROR]", error);
      }

      return createTextStreamResponse(discardText);
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
              id: true,
              type: true,
              statement: true,
            },
          })
        : [];
    const governedOldItem =
      maybeMemoryUpdate && governedType && governedReferences.length > 0
        ? governedReferences[0]
        : null;

    if (governedOldItem && governedType) {
      const existingCandidate = await prismadb.referenceItem.findFirst({
        where: {
          userId,
          status: "candidate",
          sourceSessionId: session.id,
          type: governedType,
          supersedesId: governedOldItem.id,
          statement: normalizedContent,
        },
        select: {
          id: true,
        },
      });

      if (existingCandidate) {
        await prismadb.referenceItem.update({
          where: { id: existingCandidate.id },
          data: {
            status: "candidate",
            sourceMessageId: userMessage.id,
          },
        });
      } else {
        await prismadb.referenceItem.create({
          data: {
            userId,
            type: governedType,
            statement: normalizedContent,
            confidence: "medium",
            status: "candidate",
            supersedesId: governedOldItem.id,
            sourceSessionId: session.id,
            sourceMessageId: userMessage.id,
          },
        });
      }
    }

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
      governedOldItem && governedType
        ? `Respond with exactly one question and nothing else: Do you want me to update your saved ${governedType} from '${toSingleLine(
            governedOldItem.statement
          )}' to '${toSingleLine(normalizedContent)}'?`
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

        await persistAssistantReply(finalText);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.log("[MESSAGE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
