import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  IMPORTED_CONTRADICTION_SIDE_FANOUT_CAP,
  extractChatGptConversations,
  importExtractedConversations,
  type ExtractedConversation,
} from "../import-chatgpt";
import { createEmptyImportRunDiagnostics } from "../import-diagnostics";

// ── extractChatGptConversations — externalId capture ─────────────────────────

describe("extractChatGptConversations — externalId", () => {
  const withMessage = (extra: Record<string, unknown>) => [
    {
      ...extra,
      mapping: {
        a: {
          message: {
            author: { role: "user" },
            create_time: 1730000000,
            content: { parts: ["Hello"] },
          },
        },
      },
    },
  ];

  it("captures the conversation id as externalId", () => {
    const { conversations } = extractChatGptConversations(
      withMessage({ id: "conv-abc-123", title: "Test" })
    );
    expect(conversations[0]?.externalId).toBe("conv-abc-123");
  });

  it("sets externalId to null when conversation has no id field", () => {
    const { conversations } = extractChatGptConversations(withMessage({ title: "No id" }));
    expect(conversations[0]?.externalId).toBeNull();
  });

  it("sets externalId to null for blank/whitespace-only id", () => {
    const { conversations } = extractChatGptConversations(
      withMessage({ id: "   ", title: "Empty id" })
    );
    expect(conversations[0]?.externalId).toBeNull();
  });
});

// ── importExtractedConversations — deduplication + metadata ──────────────────

function baseConversation(overrides: Partial<ExtractedConversation> = {}): ExtractedConversation {
  return {
    title: "Test conversation",
    externalId: "conv-ext-001",
    messages: [
      // Keep user message < MIN_DETECTION_LENGTH (15) so detectContradictions
      // returns early without querying prismadb (makes test DB-independent).
      { role: "user", content: "Hi archive", createdAt: null },
      { role: "assistant", content: "Hi", createdAt: null },
    ],
    ...overrides,
  };
}

type SessionRow = { id: string; userId: string; importedExternalId: string | null };

/**
 * Builds a minimal Prisma mock that supports the subset of methods called by
 * importExtractedConversations. The `tx` object is wired to the same in-memory
 * state so transaction callbacks behave realistically.
 */
function makeMockDb(opts: { existingExternalId?: string | null } = {}): {
  db: PrismaClient;
  sessionCreateSpy: ReturnType<typeof vi.fn>;
} {
  const sessions: SessionRow[] = [];
  if (opts.existingExternalId != null) {
    sessions.push({ id: "existing-session", userId: "user_1", importedExternalId: opts.existingExternalId });
  }

  const sessionCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const id = `session-${sessions.length + 1}`;
    sessions.push({
      id,
      userId: data.userId as string,
      importedExternalId: (data.importedExternalId as string | undefined) ?? null,
    });
    return { id };
  });

  const sessionFindUnique = async ({
    where,
  }: {
    where: { userId_importedExternalId: { userId: string; importedExternalId: string } };
  }) => {
    return (
      sessions.find(
        (s) =>
          s.userId === where.userId_importedExternalId.userId &&
          s.importedExternalId === where.userId_importedExternalId.importedExternalId
      ) ?? null
    );
  };

  const messageCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `msg-${Math.random().toString(16).slice(2)}`,
    role: data.role,
    content: data.content,
  }));

  const tx = {
    session: { findUnique: sessionFindUnique, create: sessionCreateSpy },
    message: { create: messageCreate },
    contradictionNode: { findFirst: async () => null },
    contradictionEvidence: { create: async () => ({}) },
    referenceItem: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => data,
    },
  };

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
    referenceItem: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    derivationRun: { create: async () => ({ id: "run-1" }), update: async () => ({}) },
    evidenceSpan: { findUnique: async () => null, create: async () => ({ id: "span-1" }) },
    derivationArtifact: { create: async () => ({}) },
    artifactEvidenceLink: { create: async () => ({}) },
    profileArtifact: { findUnique: async () => null, create: async () => ({ id: "art-1" }), update: async () => ({}) },
    profileArtifactEvidenceLink: { create: async () => ({}) },
  } as unknown as PrismaClient;

  return { db, sessionCreateSpy };
}

describe("importExtractedConversations — deduplication", () => {
  it("creates a session when no duplicate exists", async () => {
    const { db } = makeMockDb();
    const result = await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation()],
      db,
    });
    expect(result.sessionsCreated).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("skips silently when externalId was already imported", async () => {
    const { db } = makeMockDb({ existingExternalId: "conv-ext-001" });
    const result = await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation()],
      db,
    });
    expect(result.sessionsCreated).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("imports a conversation with null externalId (no dedup check)", async () => {
    const { db, sessionCreateSpy } = makeMockDb();
    const result = await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation({ externalId: null })],
      db,
    });
    expect(result.sessionsCreated).toBe(1);
    // importedExternalId should not be set on the session row
    expect(sessionCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ importedExternalId: expect.anything() }) })
    );
  });

  it("deduplicates correctly when two conversations share the same externalId", async () => {
    const { db } = makeMockDb();
    // First import creates it; second call with same id is skipped
    const first = await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation({ externalId: "dup-id" })],
      db,
    });
    const second = await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation({ externalId: "dup-id" })],
      db,
    });
    expect(first.sessionsCreated).toBe(1);
    expect(second.sessionsCreated).toBe(0);
  });
});

describe("importExtractedConversations — importedSource", () => {
  it("defaults importedSource to chatgpt_export_json", async () => {
    const { db, sessionCreateSpy } = makeMockDb();
    await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation()],
      db,
    });
    expect(sessionCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ importedSource: "chatgpt_export_json" }),
      })
    );
  });

  it("passes custom importedSource through to session data", async () => {
    const { db, sessionCreateSpy } = makeMockDb();
    await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation()],
      importedSource: "chatgpt_export_zip",
      db,
    });
    expect(sessionCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ importedSource: "chatgpt_export_zip" }),
      })
    );
  });

  it("sets origin to IMPORTED_ARCHIVE on the session", async () => {
    const { db, sessionCreateSpy } = makeMockDb();
    await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation()],
      db,
    });
    expect(sessionCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origin: "IMPORTED_ARCHIVE" }),
      })
    );
  });

  it("sets importedAt to a recent Date on the session", async () => {
    const { db, sessionCreateSpy } = makeMockDb();
    const before = new Date();
    await importExtractedConversations({
      userId: "user_1",
      conversations: [baseConversation()],
      db,
    });
    const after = new Date();

    const callData = (sessionCreateSpy.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    const importedAt = callData.importedAt as Date;
    expect(importedAt).toBeInstanceOf(Date);
    expect(importedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(importedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("importExtractedConversations — import relevance gate", () => {
  it("skips profile/reference/contradiction extraction for technical import noise", async () => {
    let messageCounter = 0;
    const evidenceSpanFindUnique = vi.fn(async () => null);
    const evidenceSpanCreate = vi.fn(async () => ({ id: "span_1" }));
    const referenceFindMany = vi.fn(async () => []);
    const referenceCreate = vi.fn(async () => ({}));
    const contradictionFindMany = vi.fn(async () => []);

    const tx = {
      session: {
        findUnique: async () => null,
        create: async () => ({ id: "session_1" }),
      },
      message: {
        create: async ({ data }: { data: { role: string; content: string } }) => {
          messageCounter += 1;
          return {
            id: `msg_${messageCounter}`,
            role: data.role,
            content: data.content,
          };
        },
      },
    };

    const db = {
      $transaction: async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx),
      referenceItem: {
        findMany: referenceFindMany,
        create: referenceCreate,
      },
      contradictionNode: {
        findMany: contradictionFindMany,
      },
      derivationRun: {
        create: async () => ({ id: "run_1" }),
        update: async () => ({}),
      },
      evidenceSpan: {
        findUnique: evidenceSpanFindUnique,
        create: evidenceSpanCreate,
      },
      derivationArtifact: {
        create: async () => ({}),
      },
      artifactEvidenceLink: {
        create: async () => ({}),
      },
      profileArtifact: {
        findUnique: async () => null,
        create: async () => ({ id: "artifact_1" }),
        update: async () => ({}),
      },
      profileArtifactEvidenceLink: {
        create: async () => ({}),
      },
    } as unknown as PrismaClient;

    const diagnostics = createEmptyImportRunDiagnostics();
    const result = await importExtractedConversations({
      userId: "user_1",
      conversations: [
        {
          title: "technical logs",
          externalId: "conv-tech-1",
          messages: [
            {
              role: "user",
              content:
                "user@macbook ~ % pip3 install openai requests python-dotenv\nCollecting openai\nCollecting requests",
              createdAt: null,
            },
          ],
        },
      ],
      db,
      diagnostics,
    });

    expect(result.errors).toEqual([]);
    expect(result.sessionsCreated).toBe(1);
    expect(result.messagesCreated).toBe(1);
    expect(diagnostics.reasonCodeCounts.import_human_relevance_rejected).toBe(1);
    expect(diagnostics.reasonCodeCounts.technical_or_terminal_noise).toBe(1);
    expect(diagnostics.candidateMessagesConsideredForReferenceExtraction).toBe(0);
    expect(diagnostics.contradictionDetectionAttemptedCount).toBe(0);
    expect(evidenceSpanFindUnique).not.toHaveBeenCalled();
    expect(evidenceSpanCreate).not.toHaveBeenCalled();
    expect(referenceFindMany).not.toHaveBeenCalled();
    expect(referenceCreate).not.toHaveBeenCalled();
    expect(contradictionFindMany).not.toHaveBeenCalled();
  });

  it("skips profile/reference/contradiction extraction for low-context technical questions", async () => {
    let messageCounter = 0;
    const evidenceSpanFindUnique = vi.fn(async () => null);
    const evidenceSpanCreate = vi.fn(async () => ({ id: "span_1" }));
    const referenceFindMany = vi.fn(async () => []);
    const referenceCreate = vi.fn(async () => ({}));
    const contradictionFindMany = vi.fn(async () => []);

    const tx = {
      session: {
        findUnique: async () => null,
        create: async () => ({ id: "session_2" }),
      },
      message: {
        create: async ({ data }: { data: { role: string; content: string } }) => {
          messageCounter += 1;
          return {
            id: `msg_q_${messageCounter}`,
            role: data.role,
            content: data.content,
          };
        },
      },
    };

    const db = {
      $transaction: async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx),
      referenceItem: {
        findMany: referenceFindMany,
        create: referenceCreate,
      },
      contradictionNode: {
        findMany: contradictionFindMany,
      },
      derivationRun: {
        create: async () => ({ id: "run_2" }),
        update: async () => ({}),
      },
      evidenceSpan: {
        findUnique: evidenceSpanFindUnique,
        create: evidenceSpanCreate,
      },
      derivationArtifact: {
        create: async () => ({}),
      },
      artifactEvidenceLink: {
        create: async () => ({}),
      },
      profileArtifact: {
        findUnique: async () => null,
        create: async () => ({ id: "artifact_2" }),
        update: async () => ({}),
      },
      profileArtifactEvidenceLink: {
        create: async () => ({}),
      },
    } as unknown as PrismaClient;

    const diagnostics = createEmptyImportRunDiagnostics();
    await importExtractedConversations({
      userId: "user_1",
      conversations: [
        {
          title: "task chatter",
          externalId: "conv-task-1",
          messages: [
            {
              role: "user",
              content:
                "do i need to do that in the terminal? i can do that myself in the finder",
              createdAt: null,
            },
          ],
        },
      ],
      db,
      diagnostics,
    });

    expect(diagnostics.reasonCodeCounts.import_human_relevance_rejected).toBe(1);
    expect(diagnostics.reasonCodeCounts.low_context_technical_question).toBe(1);
    expect(diagnostics.candidateMessagesConsideredForReferenceExtraction).toBe(0);
    expect(diagnostics.contradictionDetectionAttemptedCount).toBe(0);
    expect(evidenceSpanFindUnique).not.toHaveBeenCalled();
    expect(evidenceSpanCreate).not.toHaveBeenCalled();
    expect(referenceFindMany).not.toHaveBeenCalled();
    expect(referenceCreate).not.toHaveBeenCalled();
    expect(contradictionFindMany).not.toHaveBeenCalled();
  });

  it("rejects cross-topic imported contradiction pairs before node materialization", async () => {
    let messageCounter = 0;
    const referenceRows: Array<{
      id: string;
      userId: string;
      type: string;
      statement: string;
      status: string;
      confidence: string;
      updatedAt: Date;
    }> = [];
    const evidenceSpanFindUnique = vi.fn(async () => null);
    const evidenceSpanCreate = vi.fn(async () => ({ id: "span_3" }));
    const contradictionFindMany = vi.fn(async () => []);

    const tx = {
      session: {
        findUnique: async () => null,
        create: async () => ({ id: "session_3" }),
      },
      message: {
        create: async ({ data }: { data: { role: string; content: string } }) => {
          messageCounter += 1;
          return {
            id: `msg_c_${messageCounter}`,
            role: data.role,
            content: data.content,
          };
        },
      },
    };

    const db = {
      $transaction: async (input: unknown) => {
        if (typeof input === "function") {
          return (input as (arg: typeof tx) => Promise<unknown>)(tx);
        }
        return Promise.resolve([]);
      },
      referenceItem: {
        findMany: async ({
          where,
        }: {
          where?: { userId?: string; type?: string | { in?: string[] }; status?: { in?: string[] } };
        }) => {
          return referenceRows.filter((row) => {
            if (where?.userId && row.userId !== where.userId) return false;
            if (typeof where?.type === "string" && row.type !== where.type) return false;
            if (typeof where?.type === "object" && Array.isArray(where.type?.in)) {
              if (!where.type.in.includes(row.type)) return false;
            }
            if (where?.status?.in && !where.status.in.includes(row.status)) return false;
            return true;
          }).map((row) => ({
            id: row.id,
            type: row.type,
            statement: row.statement,
            updatedAt: row.updatedAt,
            confidence: row.confidence,
            status: row.status,
          }));
        },
        create: async ({ data }: { data: { userId: string; type: string; statement: string; status: string; confidence: string } }) => {
          referenceRows.push({
            id: `ref_${referenceRows.length + 1}`,
            userId: data.userId,
            type: data.type,
            statement: data.statement,
            status: data.status,
            confidence: data.confidence,
            updatedAt: new Date(),
          });
          return data;
        },
      },
      contradictionNode: {
        findMany: contradictionFindMany,
      },
      derivationRun: {
        create: async () => ({ id: "run_3" }),
        update: async () => ({}),
      },
      evidenceSpan: {
        findUnique: evidenceSpanFindUnique,
        create: evidenceSpanCreate,
      },
      derivationArtifact: {
        create: async () => ({}),
      },
      artifactEvidenceLink: {
        create: async () => ({}),
      },
      profileArtifact: {
        findUnique: async () => null,
        create: async () => ({ id: "artifact_3" }),
        update: async () => ({}),
      },
      profileArtifactEvidenceLink: {
        create: async () => ({}),
      },
      contradictionEvidence: {
        findFirst: async () => null,
        create: async () => ({}),
      },
    } as unknown as PrismaClient;

    const diagnostics = createEmptyImportRunDiagnostics();
    const result = await importExtractedConversations({
      userId: "user_1",
      conversations: [
        {
          title: "cross topic contradiction",
          externalId: "conv-cross-topic-1",
          messages: [
            {
              role: "user",
              content: "I must protect ethnic and cultural survival in my life.",
              createdAt: null,
            },
            {
              role: "user",
              content:
                "I care about this, but I need to wire Stripe and Telegram to ship the MVP implementation.",
              createdAt: null,
            },
          ],
        },
      ],
      db,
      diagnostics,
    });

    expect(result.errors).toEqual([]);
    expect(result.contradictionsCreated).toBe(0);
    expect(diagnostics.contradictionDetectionAttemptedCount).toBeGreaterThanOrEqual(1);
    expect(
      (diagnostics.reasonCodeCounts.imported_contradiction_rejected ?? 0) +
        (diagnostics.reasonCodeCounts.import_human_relevance_rejected ?? 0)
    ).toBeGreaterThanOrEqual(1);
  });

  it("caps repeated sideA anchors and records fanout diagnostics", async () => {
    let messageCounter = 0;
    const referenceRows: Array<{
      id: string;
      userId: string;
      type: string;
      statement: string;
      status: string;
      confidence: string;
      updatedAt: Date;
    }> = [];
    const contradictionNodes: Array<{
      id: string;
      userId: string;
      title: string;
      sideA: string;
      sideB: string;
      type: string;
      status: string;
      evidenceCount: number;
      lastEvidenceAt: Date;
      lastTouchedAt: Date;
    }> = [];
    const contradictionEvidenceRows: Array<{
      nodeId: string;
      sessionId: string | null;
      messageId: string | null;
      quote: string | null;
    }> = [];

    const tx = {
      session: {
        findUnique: async () => null,
        create: async () => ({ id: "session_4" }),
      },
      message: {
        create: async ({ data }: { data: { role: string; content: string } }) => {
          messageCounter += 1;
          return {
            id: `msg_f_${messageCounter}`,
            role: data.role,
            content: data.content,
          };
        },
      },
      contradictionNode: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          if (typeof where.id === "string") {
            const byId = contradictionNodes.find((node) => node.id === where.id);
            if (!byId) return null;
            if (where.userId && byId.userId !== where.userId) return null;
            if (where.status && typeof where.status === "object") {
              const statusIn = (where.status as { in?: string[] }).in ?? [];
              if (statusIn.length > 0 && !statusIn.includes(byId.status)) return null;
            }
            return { id: byId.id, status: byId.status };
          }

          const match = contradictionNodes.find(
            (node) =>
              node.userId === where.userId &&
              node.title === where.title &&
              node.sideA === where.sideA &&
              node.sideB === where.sideB &&
              node.type === where.type
          );
          if (!match) return null;
          return { id: match.id, status: match.status };
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const created = {
            id: `node_${contradictionNodes.length + 1}`,
            userId: data.userId as string,
            title: data.title as string,
            sideA: data.sideA as string,
            sideB: data.sideB as string,
            type: data.type as string,
            status: data.status as string,
            evidenceCount: (data.evidenceCount as number) ?? 1,
            lastEvidenceAt: (data.lastEvidenceAt as Date) ?? new Date(),
            lastTouchedAt: (data.lastTouchedAt as Date) ?? new Date(),
          };
          contradictionNodes.push(created);
          return { id: created.id };
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const node = contradictionNodes.find((entry) => entry.id === where.id);
          if (!node) return null;
          if (data.evidenceCount && typeof data.evidenceCount === "object") {
            const increment = (data.evidenceCount as { increment?: number }).increment ?? 0;
            node.evidenceCount += increment;
          }
          if (data.lastEvidenceAt instanceof Date) {
            node.lastEvidenceAt = data.lastEvidenceAt;
          }
          if (data.lastTouchedAt instanceof Date) {
            node.lastTouchedAt = data.lastTouchedAt;
          }
          return node;
        },
      },
      contradictionEvidence: {
        findFirst: async ({ where }: { where: { nodeId?: string; messageId?: string | null; sessionId?: string | null; quote?: string | null } }) => {
          return (
            contradictionEvidenceRows.find((row) => {
              if (where.nodeId && row.nodeId !== where.nodeId) return false;
              if ("messageId" in where && where.messageId !== undefined) {
                if (row.messageId !== where.messageId) return false;
              }
              if ("sessionId" in where && where.sessionId !== undefined) {
                if (row.sessionId !== where.sessionId) return false;
              }
              if ("quote" in where && where.quote !== undefined) {
                if (row.quote !== where.quote) return false;
              }
              return true;
            }) ?? null
          );
        },
        create: async ({ data }: { data: { nodeId: string; sessionId: string | null; messageId: string | null; quote: string | null } }) => {
          contradictionEvidenceRows.push(data);
          return data;
        },
      },
    };

    const db = {
      $transaction: async (input: unknown) => {
        if (typeof input === "function") {
          return (input as (arg: typeof tx) => Promise<unknown>)(tx);
        }
        return Promise.resolve([]);
      },
      referenceItem: {
        findMany: async ({
          where,
        }: {
          where?: { userId?: string; type?: string | { in?: string[] }; status?: { in?: string[] } };
        }) => {
          return referenceRows.filter((row) => {
            if (where?.userId && row.userId !== where.userId) return false;
            if (typeof where?.type === "string" && row.type !== where.type) return false;
            if (typeof where?.type === "object" && Array.isArray(where.type?.in)) {
              if (!where.type.in.includes(row.type)) return false;
            }
            if (where?.status?.in && !where.status.in.includes(row.status)) return false;
            return true;
          }).map((row) => ({
            id: row.id,
            type: row.type,
            statement: row.statement,
            updatedAt: row.updatedAt,
            confidence: row.confidence,
            status: row.status,
          }));
        },
        create: async ({ data }: { data: { userId: string; type: string; statement: string; status: string; confidence: string } }) => {
          referenceRows.push({
            id: `ref_${referenceRows.length + 1}`,
            userId: data.userId,
            type: data.type,
            statement: data.statement,
            status: data.status,
            confidence: data.confidence,
            updatedAt: new Date(),
          });
          return data;
        },
      },
      contradictionNode: {
        findMany: async () => [],
      },
      derivationRun: {
        create: async () => ({ id: "run_4" }),
        update: async () => ({}),
      },
      evidenceSpan: {
        findUnique: async () => null,
        create: async () => ({ id: "span_4" }),
      },
      derivationArtifact: {
        create: async () => ({}),
      },
      artifactEvidenceLink: {
        create: async () => ({}),
      },
      profileArtifact: {
        findUnique: async () => null,
        create: async () => ({ id: "artifact_4" }),
        update: async () => ({}),
      },
      profileArtifactEvidenceLink: {
        create: async () => ({}),
      },
    } as unknown as PrismaClient;

    const diagnostics = createEmptyImportRunDiagnostics();
    const result = await importExtractedConversations({
      userId: "user_1",
      conversations: [
        {
          title: "fanout repetition",
          externalId: "conv-fanout-1",
          messages: [
            { role: "user", content: "I must protect calm and coherence.", createdAt: null },
            { role: "user", content: "I want honesty, but I avoid conflict.", createdAt: null },
            { role: "user", content: "I value independence, but I keep seeking approval.", createdAt: null },
            { role: "user", content: "I want to simplify my life, but I keep adding more systems.", createdAt: null },
            { role: "user", content: "I want coherence, but I change direction whenever I feel uncertain.", createdAt: null },
            { role: "user", content: "I want consistency, but I keep switching plans when anxious.", createdAt: null },
          ],
        },
      ],
      db,
      diagnostics,
    });

    expect(result.errors).toEqual([]);
    expect(result.contradictionsCreated).toBe(IMPORTED_CONTRADICTION_SIDE_FANOUT_CAP);
    expect(contradictionNodes).toHaveLength(IMPORTED_CONTRADICTION_SIDE_FANOUT_CAP);
    expect(diagnostics.reasonCodeCounts.imported_contradiction_fanout_rejected).toBe(2);
    expect(diagnostics.reasonCodeCounts.contradiction_repeated_side_a).toBe(2);
  });
});
