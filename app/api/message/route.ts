import { NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  detectNativeReferenceIntentType,
  extractMemoryStatement,
  isWriteableMemoryStatement,
  pickBestPreferenceMatch,
  scoreTokenOverlap,
  shouldPromptForMemoryUpdate,
} from "@/lib/memory-governance";
import {
  compactProductionIngestionLog,
  runProductionContradictionIngestion,
} from "@/lib/contradiction-production-ingestion";
import { createPrismaContradictionProductionAdapter } from "@/lib/contradiction-production-db-adapter";
import { getTop3WithOptionalSurfacing } from "@/lib/contradiction-surface";
import prismadb from "@/lib/prismadb";
import { getRelevantReferenceMemory } from "@/lib/reference-memory";
import { SessionMemoryManager } from "@/lib/session-memory";
import {
  BASE_SYSTEM_PROMPT,
  FAST_PATH_SYSTEM_PROMPT,
} from "@/lib/assistant/system-prompt";
import { buildCanonicalModelPromptBlock } from "@/lib/canonical-model-ai-context";
import { isCanonicalModelAuthorityError } from "@/lib/canonical-model-authority-errors";
import { readCanonicalModelProjection } from "@/lib/canonical-model-projection";
import { toCanonicalProductAuthoritySnapshotV1 } from "@/lib/canonical-model-product-projection";
import { ensureWeeklyAuditForCurrentWeek } from "@/lib/weekly-audit";
import { patternBatchOrchestrator } from "@/lib/pattern-batch-orchestrator";
import { triggerNativeDerivationIfDue } from "@/lib/native-derivation-trigger";
import { processMessageForProfile } from "@/lib/profile-derivation";
import {
  shouldRunAppMessageCandidateBridgeForSession,
  tryCreateInternalUserMapCandidateFromAppMessage,
} from "@/lib/understanding-dark-engine/app-message-candidate-bridge";
import {
  buildExploreAssaultDeterministicReply,
  exploreAssaultDeterministicReplyAllowed,
} from "@/lib/explore-assault-test-provider";
import {
  orchestrateExploreReplyGrounding,
  persistExploreGroundingPayload,
} from "@/lib/explore-grounding-orchestrator";

type GovernedType = "preference" | "goal" | "constraint";
const NATIVE_PROFILE_SURFACE_TYPES = new Set(["journal_chat", "explore_chat"]);

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

export function shouldDeriveNativeProfileForSession(session: {
  origin: string | null;
  surfaceType: string | null;
}) {
  return (
    session.origin === "APP" &&
    !!session.surfaceType &&
    NATIVE_PROFILE_SURFACE_TYPES.has(session.surfaceType)
  );
}

export async function processNativeUserMessageForProfile({
  userId,
  messageId,
  content,
  sessionOrigin,
  sessionSurfaceType,
  reqId,
}: {
  userId: string;
  messageId: string;
  content: string;
  sessionOrigin: string | null;
  sessionSurfaceType: string | null;
  reqId: string;
}) {
  if (
    !shouldDeriveNativeProfileForSession({
      origin: sessionOrigin,
      surfaceType: sessionSurfaceType,
    })
  ) {
    return;
  }

  try {
    await processMessageForProfile({
      userId,
      messageId,
      content,
      db: prismadb,
    });
  } catch (error) {
    console.error(`[MESSAGE_PROFILE_BG_ERROR][${reqId}]`, error);
  }
}

function shouldEvaluateNoWriteTriggerForSession(session: {
  origin: string | null;
  surfaceType: string | null;
}) {
  return shouldRunAppMessageCandidateBridgeForSession(session);
}

export async function POST(req: Request) {
  const tServer = Date.now();
  const reqId = req.headers.get("x-request-id") ?? "?";
  const tag = `[CHAT_TIMING_SERVER][${reqId}]`;
  console.debug(tag, "request_received", 0);
  try {
    const { userId } = await auth();
    console.debug(tag, "auth_complete", Date.now() - tServer);

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { sessionId, content, model: requestedModel, debugFastPath, responseMode: requestedResponseMode } = body ?? {};

    const ALLOWED_RESPONSE_MODES = ["standard", "deep"] as const;
    type ResponseMode = (typeof ALLOWED_RESPONSE_MODES)[number];
    const responseMode: ResponseMode =
      typeof requestedResponseMode === "string" &&
      (ALLOWED_RESPONSE_MODES as readonly string[]).includes(requestedResponseMode)
        ? (requestedResponseMode as ResponseMode)
        : "standard";

    const ALLOWED_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
    type AllowedModel = (typeof ALLOWED_MODELS)[number];
    const selectedModel: AllowedModel =
      typeof requestedModel === "string" &&
      (ALLOWED_MODELS as readonly string[]).includes(requestedModel)
        ? (requestedModel as AllowedModel)
        : "gpt-4o-mini";

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

    console.debug(tag, "session_lookup_start", Date.now() - tServer);
    const session = await prismadb.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, origin: true, surfaceType: true },
    });
    console.debug(tag, "session_lookup_done", Date.now() - tServer);

    if (!session) {
      return new NextResponse("Session not found", { status: 404 });
    }

    const modelName = selectedModel;
    console.debug(tag, `model: ${modelName} mode: ${responseMode}`);
    const memoryKey = {
      userId,
      sessionId: session.id,
      modelName,
    };
    console.debug(tag, "memory_manager_init_start", Date.now() - tServer);
    const memory = await SessionMemoryManager.getInstance();
    console.debug(tag, "memory_manager_init_done", Date.now() - tServer);
    const persistAssistantReply = async (text: string, userMessageId: string) => {
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

      // Explore-only: attach honest grounding + optional proposed (not published) movement.
      if (session.surfaceType === "explore_chat") {
        try {
          const grounding = await orchestrateExploreReplyGrounding({
            userId,
            db: prismadb,
            conversationId: session.id,
            assistantMessageId: assistantDbMessage.id,
            userMessageId,
            userMessageContent: normalizedContent,
            assistantReplyContent: finalText,
            createProposalWhenSufficient: true,
          });
          await persistExploreGroundingPayload({
            db: prismadb,
            messageId: assistantDbMessage.id,
            userId,
            payload: grounding.payload,
          });
        } catch (groundingError) {
          console.log("[EXPLORE_GROUNDING_ORCHESTRATION_ERROR]", groundingError);
        }
      }
    };

    console.debug(tag, "user_message_create_start", Date.now() - tServer);
    const userMessage = await prismadb.message.create({
      data: {
        userId,
        sessionId: session.id,
        role: "user",
        content: normalizedContent,
      },
    });
    console.debug(tag, "user_message_create_done", Date.now() - tServer);

    // ── Local/test-only deterministic Explore reply (assault / CI) ───────────
    if (
      session.surfaceType === "explore_chat" &&
      exploreAssaultDeterministicReplyAllowed(process.env)
    ) {
      const deterministicText = buildExploreAssaultDeterministicReply(normalizedContent);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(deterministicText));
          controller.close();
        },
      });

      after(async () => {
        try {
          await memory.appendToTranscript(memoryKey, `Human: ${normalizedContent}`);
          await memory.upsertVector(memoryKey, {
            id: userMessage.id,
            role: "user",
            content: normalizedContent,
            createdAt: userMessage.createdAt,
          });
        } catch (error) {
          console.log("[EXPLORE_ASSAULT_DETERMINISTIC_SIDE_EFFECT_ERROR]", error);
        }
      });

      // Persist assistant + grounding on the same turn (still real handler path).
      await persistAssistantReply(deterministicText, userMessage.id);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Orvek-Explore-Provider": "assault-deterministic-local",
        },
      });
    }

    // ── debugFastPath: skip all enrichment, stream immediately ──────────────
    if (debugFastPath === true) {
      console.debug(tag, "FAST_PATH_ACTIVE — skipping all enrichment");
      const baseSystem = FAST_PATH_SYSTEM_PROMPT;
      let firstChunkFp = false;
      const resultFp = streamText({
        model: openai(modelName),
        system: baseSystem,
        messages: [{ role: "user", content: normalizedContent }],
        onChunk: () => {
          if (!firstChunkFp) {
            firstChunkFp = true;
            console.debug(tag, "FAST_PATH first_chunk", Date.now() - tServer);
          }
        },
        onFinish: async ({ text }) => {
          console.debug(tag, "FAST_PATH response_complete", Date.now() - tServer);
          const finalText = text.trim();
          if (finalText) await persistAssistantReply(finalText, userMessage.id);
        },
      });
      return resultFp.toTextStreamResponse();
    }

    // ── Background work scheduled via after() ──
    // Memory writes, audit, profile derivation, pattern derivation, and the
    // app-message candidate bridge all run after the response is sent, so they
    // never delay the main stream.
    after(async () => {
      try {
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

        await ensureWeeklyAuditForCurrentWeek(userId, new Date());
        await processNativeUserMessageForProfile({
          userId,
          messageId: userMessage.id,
          content: normalizedContent,
          sessionOrigin: session.origin,
          sessionSurfaceType: session.surfaceType,
          reqId,
        });

        // Native pattern derivation — non-blocking, immediate-or-scheduled
        await triggerNativeDerivationIfDue(
          { userId },
          prismadb,
          patternBatchOrchestrator
        );
      } catch (bgErr) {
        console.error(`[MESSAGE_BG_ERROR][${reqId}]`, bgErr);
      }

      // ── App-message candidate bridge (isolated from other background work) ──
      // Runs independently so failures in transcript/vector/audit/profile tasks
      // do not prevent candidate bridge execution.
      if (
        shouldRunAppMessageCandidateBridgeForSession({
          origin: session.origin,
          surfaceType: session.surfaceType,
        })
      ) {
        try {
          await tryCreateInternalUserMapCandidateFromAppMessage({
            userId,
            messageId: userMessage.id,
            sessionOrigin: session.origin,
            sessionSurfaceType: session.surfaceType,
            now: userMessage.createdAt,
            reqId,
          });
        } catch (error) {
          console.error(`[MESSAGE_APP_CANDIDATE_BRIDGE_ERROR][${reqId}]`, error);
        }
      }
    });

    // ── Contradiction production ingestion (separate after() registration) ──
    // Registered independently so memory/audit/profile/pattern failure or delay
    // cannot prevent this callback from being scheduled. Failures here never
    // fail the chat response. Gate defaults OFF
    // (RUN_PRODUCTION_CONTRADICTION_INGESTION).
    after(async () => {
      try {
        console.debug(tag, "contradiction_ingestion_start (async)", Date.now() - tServer);
        const ingestionResult = await runProductionContradictionIngestion({
          userId,
          session: { id: session.id },
          currentMessage: {
            id: userMessage.id,
            content: normalizedContent,
            role: "user",
          },
          db: createPrismaContradictionProductionAdapter(prismadb),
        });
        console.log(
          `[MESSAGE_CONTRADICTION_INGESTION][${reqId}]`,
          compactProductionIngestionLog(ingestionResult),
        );
      } catch (error) {
        console.error(`[MESSAGE_CONTRADICTION_INGESTION_ERROR][${reqId}]`, {
          code: "ingestion_unhandled_error",
        });
        void error;
      }
    });

    // Retrieval parameters vary by mode:
    // standard — lighter context (faster, lower token cost)
    // deep — broader context (more history, more vector hits, more references)
    const transcriptLimitSession = responseMode === "deep" ? 16_000 : 8_000;
    const transcriptLimitUser    = responseMode === "deep" ? 8_000  : 4_000;
    const vectorTopK             = responseMode === "deep" ? 12     : 6;
    const historyTake            = responseMode === "deep" ? 60     : 30;

    // Injection caps — final count of items that enter the system prompt.
    const MAX_INJECTED_MEMORIES_STANDARD  = 6;
    const MAX_INJECTED_MEMORIES_DEEP      = 12;
    const MAX_INJECTED_TENSIONS_STANDARD  = 2;
    const MAX_INJECTED_TENSIONS_DEEP      = 4;
    const maxMemories  = responseMode === "deep" ? MAX_INJECTED_MEMORIES_DEEP      : MAX_INJECTED_MEMORIES_STANDARD;
    const maxTensions  = responseMode === "deep" ? MAX_INJECTED_TENSIONS_DEEP      : MAX_INJECTED_TENSIONS_STANDARD;

    console.debug(tag, "memory_reads_start", Date.now() - tServer);
    const [sessionTranscript, userTranscript, sessionRelevant, userRelevant] = await Promise.all([
      memory.readTranscript(memoryKey, transcriptLimitSession),
      memory.readTranscript(memoryKey, transcriptLimitUser, "user"),
      memory.queryRelevant(memoryKey, normalizedContent, vectorTopK, "session"),
      memory.queryRelevant(memoryKey, normalizedContent, vectorTopK, "user"),
    ]);
    console.debug(tag, "memory_reads_done", Date.now() - tServer);
    const memoryStatement = extractMemoryStatement(normalizedContent);
    const governedType: GovernedType | null =
      detectNativeReferenceIntentType(normalizedContent);
    const maybeMemoryUpdate = shouldPromptForMemoryUpdate(normalizedContent);
    if (maybeMemoryUpdate && governedType && isWriteableMemoryStatement(normalizedContent)) {
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
          ? pickBestPreferenceMatch(activeItems, memoryStatement)
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
        // Conflicting path: detected update to an existing active memory → create candidate
        const existingCandidate = await prismadb.referenceItem.findFirst({
          where: {
            userId,
            status: "candidate",
            sourceSessionId: session.id,
            type: governedType,
            supersedesId: governedOldItem.id,
            statement: memoryStatement,
          },
          select: { id: true },
        });

        if (existingCandidate) {
          await prismadb.referenceItem.update({
            where: { id: existingCandidate.id },
            data: { status: "candidate", sourceMessageId: userMessage.id },
          });
        } else {
          await prismadb.referenceItem.create({
            data: {
              userId,
              type: governedType,
              statement: memoryStatement,
              confidence: "medium",
              status: "candidate",
              supersedesId: governedOldItem.id,
              sourceSessionId: session.id,
              sourceMessageId: userMessage.id,
            },
          });
        }
      } else {
        // Non-conflicting path: brand-new memory type → candidate (never promoted silently)
        const existingActive = await prismadb.referenceItem.findFirst({
          where: { userId, status: "active", type: governedType, statement: memoryStatement },
          select: { id: true },
        });
        const existingCandidate = await prismadb.referenceItem.findFirst({
          where: { userId, status: "candidate", type: governedType, statement: memoryStatement, sourceSessionId: session.id },
          select: { id: true },
        });

        if (!existingActive && !existingCandidate) {
          await prismadb.referenceItem.create({
            data: {
              userId,
              type: governedType,
              statement: memoryStatement,
              confidence: "medium",
              status: "candidate",
              sourceSessionId: session.id,
              sourceMessageId: userMessage.id,
            },
          });
        }
      }

      // No early return — candidate surfaces non-blockingly; LLM continues below.
    }

    console.debug(tag, "reference_and_contradictions_start", Date.now() - tServer);

    let canonicalPromptBlock = "";
    try {
      const canonicalProjection = await readCanonicalModelProjection({
        userId,
        db: prismadb,
      });
      const productConcepts = canonicalProjection.concepts.map((concept) =>
        toCanonicalProductAuthoritySnapshotV1(concept),
      );
      canonicalPromptBlock = buildCanonicalModelPromptBlock({
        projection: canonicalProjection,
      });
      console.debug(tag, "[CHAT_CONTEXT] canonical", {
        conceptsLoaded: productConcepts.length,
        currentRevisionsInjected: productConcepts.length,
        blockChars: canonicalPromptBlock.length,
      });
    } catch (error) {
      if (
        isCanonicalModelAuthorityError(error) &&
        error.code === "BROKEN_CANONICAL_PROJECTION"
      ) {
        console.error(tag, "[CHAT_CONTEXT] canonical_broken", {
          code: error.code,
        });
        return NextResponse.json(
          {
            error: "Canonical model unavailable",
            code: "canonical_model_unavailable",
          },
          { status: 500 },
        );
      }
      throw error;
    }

    const [refMemResult, topContradictions] = await Promise.all([
      getRelevantReferenceMemory(userId, normalizedContent, maxMemories),
      getTop3WithOptionalSurfacing({
        userId,
        mode: "recorded",
      }),
    ]);
    console.debug(tag, "reference_and_contradictions_done", Date.now() - tServer);

    // Relevance-gate tensions: filter by token overlap, then cap.
    const tensionRetrieved = topContradictions.items.length;
    const relevantTensions = topContradictions.items.filter((item) => {
      const tensionText = `${item.title}\n${item.sideA}\n${item.sideB}`;
      return scoreTokenOverlap(tensionText, normalizedContent) >= 1;
    });
    const injectedTensions = relevantTensions.slice(0, maxTensions);

    console.debug(
      tag,
      `[CHAT_CONTEXT] memories: retrieved=${refMemResult.retrieved} relevant=${refMemResult.relevant} injected=${refMemResult.injected} fallback=${refMemResult.usedFallback}`
    );
    console.debug(
      tag,
      `[CHAT_CONTEXT] tensions: retrieved=${tensionRetrieved} relevant=${relevantTensions.length} injected=${injectedTensions.length}`
    );
    const topContradictionsBlock = buildTopContradictionsBlock(injectedTensions);

    console.debug(tag, "fallback_messages_start", Date.now() - tServer);
    const fallbackMessages = await prismadb.message.findMany({
      where: {
        userId,
        sessionId: session.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: historyTake,
      select: {
        role: true,
        content: true,
      },
    });

    console.debug(tag, "fallback_messages_done", Date.now() - tServer);
    const fallbackTranscript = fallbackMessages
      .reverse()
      .map((message) => {
        const label = message.role === "assistant" ? "AI" : "Human";
        return `${label}: ${message.content}`;
      })
      .join("\n");

    const effectiveSessionTranscript = sessionTranscript || fallbackTranscript;
    const baseSystem = BASE_SYSTEM_PROMPT;
    const governancePrompt = "";
    const retrievedUserMemory = [userRelevant, userTranscript].filter(Boolean).join("\n");
    const sessionMemoryBlock = [sessionRelevant, effectiveSessionTranscript]
      .filter(Boolean)
      .join("\n");
    const systemPrompt = [
      baseSystem,
      governancePrompt,
      canonicalPromptBlock,
      refMemResult.text ? `Long-term memory:\n${refMemResult.text}` : "",
      topContradictionsBlock,
      retrievedUserMemory ? `Relevant memory:\n${retrievedUserMemory}` : "",
      sessionMemoryBlock ? `Recent transcript:\n${sessionMemoryBlock}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    console.debug(
      tag, "context_payload",
      `systemPrompt=${systemPrompt.length}chars`,
      `hasRefMemory=${!!refMemResult.text}`,
      `hasTopContradictions=${injectedTensions.length > 0}`,
      `hasSessionTranscript=${!!sessionTranscript}`,
      `hasUserMemory=${!!userRelevant}`
    );
    console.debug(tag, `model_call_start mode=${responseMode}`, Date.now() - tServer);
    let firstChunkLogged = false;
    const result = streamText({
      model: openai(modelName),
      system: systemPrompt,
      messages: [{ role: "user", content: normalizedContent }],
      onChunk: () => {
        if (!firstChunkLogged) {
          firstChunkLogged = true;
          console.debug(tag, "first_chunk", Date.now() - tServer);
        }
      },
      onFinish: async ({ text }) => {
        console.debug(tag, "response_complete", Date.now() - tServer);
        const finalText = text.trim();
        if (!finalText) {
          return;
        }

        await persistAssistantReply(finalText, userMessage.id);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.log("[MESSAGE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
