import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  detectReferenceIntentType,
  isAffirmative,
  isNegative,
  pickBestPreferenceMatch,
  shouldPromptForMemoryUpdate,
} from "@/lib/memory-governance";
import { detectContradictions } from "@/lib/contradiction-detection";
import { getTop3WithOptionalSurfacing } from "@/lib/contradiction-surface";
import prismadb from "@/lib/prismadb";
import { getActiveReferenceMemory } from "@/lib/reference-memory";
import { SessionMemoryManager } from "@/lib/session-memory";
import { ensureWeeklyAuditForCurrentWeek } from "@/lib/weekly-audit";

type GovernedType = "preference" | "goal" | "constraint";

const toSingleLine = (value: string) => value.replace(/\s+/g, " ").trim();
const truncateForPrompt = (value: string, maxLength = 240) => {
  const normalized = toSingleLine(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
};

const buildTopContradictionsBlock = (
  items: Awaited<ReturnType<typeof getTop3WithOptionalSurfacing>>["items"]
) => {
  if (!items.length) {
    return "";
  }

  const lines = ["TOP CONTRADICTIONS (salience-ranked, max 3):"];
  for (const [index, item] of items.entries()) {
    lines.push(`${index + 1}) [${item.type}] ${truncateForPrompt(item.title, 180)}`);
    lines.push(`A: ${truncateForPrompt(item.sideA)}`);
    lines.push(`B: ${truncateForPrompt(item.sideB)}`);
    lines.push(`recommended_rung: ${item.recommendedRung ?? "rung1_gentle_mirror"}`);
    lines.push(`status: ${item.status}`);
    lines.push(
      `lastEvidenceAt: ${item.lastEvidenceAt ? item.lastEvidenceAt.toISOString() : "n/a"}`
    );
  }

  return lines.join("\n");
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

    if (userMessage.role === "user") {
      await ensureWeeklyAuditForCurrentWeek(userId, new Date());
    }

    if (userMessage.role === "user" && normalizedContent.length >= 15) {
      const detections = await detectContradictions({
        userId,
        messageContent: normalizedContent,
      });

      if (detections.length) {
        const now = new Date();
        await prismadb.$transaction(async (tx) => {
          for (const detection of detections.slice(0, 2)) {
            if (detection.existingNodeId) {
              const existingNode = await tx.contradictionNode.findFirst({
                where: {
                  id: detection.existingNodeId,
                  userId,
                  status: { in: ["open", "explored"] },
                },
                select: { id: true },
              });

              if (!existingNode) {
                continue;
              }

              await tx.contradictionEvidence.create({
                data: {
                  nodeId: existingNode.id,
                  sessionId: session.id,
                  messageId: userMessage.id,
                  quote: normalizedContent,
                },
              });

              await tx.contradictionNode.update({
                where: { id: existingNode.id },
                data: {
                  evidenceCount: { increment: 1 },
                  lastEvidenceAt: now,
                  lastTouchedAt: now,
                },
              });

              continue;
            }

            const createdNode = await tx.contradictionNode.create({
              data: {
                userId,
                title: detection.title,
                sideA: detection.sideA,
                sideB: detection.sideB,
                type: detection.type,
                confidence: detection.confidence,
                status: "open",
                sourceSessionId: session.id,
                sourceMessageId: userMessage.id,
                evidenceCount: 1,
                lastEvidenceAt: now,
                recommendedRung: "rung1_gentle_mirror",
                escalationLevel: 0,
              },
              select: { id: true },
            });

            await tx.contradictionEvidence.create({
              data: {
                nodeId: createdNode.id,
                sessionId: session.id,
                messageId: userMessage.id,
                quote: normalizedContent,
              },
            });
          }
        });
      }
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
    const referenceIntentType = detectReferenceIntentType(normalizedContent);
    const governedType: GovernedType | null =
      referenceIntentType === "preference" ||
      referenceIntentType === "goal" ||
      referenceIntentType === "constraint"
        ? referenceIntentType
        : null;
    const maybeMemoryUpdate = shouldPromptForMemoryUpdate(normalizedContent);
    if (maybeMemoryUpdate && governedType) {
      const activeItems = await prismadb.referenceItem.findMany({
        where: {
          userId,
          status: "active",
          type: governedType,
        },
        orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
        take: governedType === "preference" ? 25 : 1,
        select: {
          id: true,
          type: true,
          statement: true,
        },
      });

      const preferenceMatch =
        governedType === "preference"
          ? pickBestPreferenceMatch(activeItems, normalizedContent)
          : null;
      const governedOldItem =
        governedType === "preference"
          ? preferenceMatch?.item ?? null
          : activeItems[0] ?? null;
      const hasConflictingActiveItem =
        governedType === "preference"
          ? (preferenceMatch?.score ?? 0) > 0
          : activeItems.length > 0;

      if (hasConflictingActiveItem && governedOldItem) {
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

        const confirmationQuestion = `Do you want me to update your saved ${governedType} from '${toSingleLine(
          governedOldItem.statement
        )}' to '${toSingleLine(normalizedContent)}'?`;
        try {
          await persistAssistantReply(confirmationQuestion);
        } catch (error) {
          console.log("[MESSAGE_CONFIRM_QUESTION_PERSIST_ERROR]", error);
        }

        return createTextStreamResponse(confirmationQuestion);
      }

      const existingActive = await prismadb.referenceItem.findFirst({
        where: {
          userId,
          status: "active",
          type: governedType,
          statement: normalizedContent,
        },
        select: {
          id: true,
        },
      });

      if (!existingActive) {
        await prismadb.referenceItem.create({
          data: {
            userId,
            type: governedType,
            statement: normalizedContent,
            confidence: "medium",
            status: "active",
            sourceSessionId: session.id,
            sourceMessageId: userMessage.id,
          },
        });
      }

      const savedText = `Saved — I stored that as a ${governedType}.`;
      try {
        await persistAssistantReply(savedText);
      } catch (error) {
        console.log("[MESSAGE_GOVERNANCE_SAVE_PERSIST_ERROR]", error);
      }

      return createTextStreamResponse(savedText);
    }

    const [referenceMemory, topContradictions] = await Promise.all([
      getActiveReferenceMemory(userId),
      getTop3WithOptionalSurfacing({
        userId,
        mode: "recorded",
      }),
    ]);
    const topContradictionsBlock = buildTopContradictionsBlock(topContradictions.items);

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
    const governancePrompt = "";
    const retrievedUserMemory = [userRelevant, userTranscript].filter(Boolean).join("\n");
    const sessionMemoryBlock = [sessionRelevant, effectiveSessionTranscript]
      .filter(Boolean)
      .join("\n");
    const systemPrompt = [
      baseSystem,
      governancePrompt,
      referenceMemory ? `Long-term memory:\n${referenceMemory}` : "",
      topContradictionsBlock,
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
