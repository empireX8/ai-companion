/**
 * CONTRADICTION-REAL-DB-ROUND-TRIP-PROOF-001
 *
 * Real PostgreSQL round-trip proof for production contradiction ingestion.
 * Skipped unless CONTRADICTION_REAL_DB_TEST_URL is present and passes the
 * isolated-DB safety guard. Never falls back to DATABASE_URL.
 *
 * Deterministic fake adjudicator/referee only. No OpenAI. No live network.
 */

import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import type { ContradictionModelTransportResult } from "../contradiction-adjudicator";
import { KERNEL_FIRST_PROOF_OBJECT } from "../contradiction-adjudicator";
import { createPrismaContradictionProductionAdapter } from "../contradiction-production-db-adapter";
import {
  PRODUCTION_MAX_ADJUDICATOR_CANDIDATES,
  PRODUCTION_MAX_REFEREE_CALLS,
  PRODUCTION_MAX_TOTAL_PROVIDER_CALLS,
  RUN_PRODUCTION_CONTRADICTION_INGESTION_ENV,
  runProductionContradictionIngestion,
} from "../contradiction-production-ingestion";
import type { ContradictionRepairedPersistenceDb } from "../contradiction-repaired-persistence";
import {
  CONTRADICTION_REAL_DB_TEST_DATABASE,
  CONTRADICTION_REAL_DB_TEST_URL_ENV,
  assessContradictionRealDbTestUrlSafety,
  assertContradictionRealDbTestUrl,
  assertDestructiveTargetIsIsolatedTestDb,
} from "../contradiction-real-db-round-trip-safety";
import {
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";
import { transportSelectionForSubstring } from "./helpers/ceqr020-transport-selection";

const QUOTE_A = "I never drink alcohol";
const QUOTE_B = "I drank last night";
const CONTENT_A = `${QUOTE_A} and other text`;
const CONTENT_B = `Preface. ${QUOTE_B}`;
const PROP_A = "Speaker never drinks alcohol";
const PROP_B = "Speaker drank alcohol last night";

const GATE_ON = {
  [RUN_PRODUCTION_CONTRADICTION_INGESTION_ENV]: "1",
} as const;

const FIXED_NOW = () => new Date("2026-07-24T12:00:00.000Z");

function sha(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function classAResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return {
    propositionA: {
      normalizedProposition: PROP_A,
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: PROP_B,
      actor: "speaker",
      subject: "alcohol",
      timeframe: "last night",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "same speaker, overlapping claim scope",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.86,
    evidenceClaimA: transportSelectionForSubstring(sideA.sourceText, QUOTE_A),
    evidenceClaimB: transportSelectionForSubstring(sideB.sourceText, QUOTE_B),
    rationale: "Incompatible under matching scope.",
    alternativeInterpretation: "Temporal change.",
    whatWouldChangeClassification: "Explicit time-scoped belief change.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
  } as ContradictionModelTransportResult;
}

function sequenceRunner(
  factories: Array<
    (
      sideA: KernelSourceUnit,
      sideB: KernelSourceUnit,
    ) => ContradictionModelTransportResult
  >,
): StructuredModelRunner & { callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    async runStructured(request) {
      const idx = calls;
      calls += 1;
      const factory = factories[Math.min(idx, factories.length - 1)]!;
      const prompt = request.prompt;

      const parseSide = (side: "A" | "B"): KernelSourceUnit => {
        const sourceId =
          prompt.match(new RegExp(`Side ${side} sourceId: (.+)`))?.[1]?.trim() ??
          `side-${side.toLowerCase()}`;
        const sessionId =
          prompt.match(new RegExp(`Side ${side} sessionId: (.+)`))?.[1]?.trim() ??
          "unknown-session";
        const messageIdRaw =
          prompt.match(new RegExp(`Side ${side} messageId: (.+)`))?.[1]?.trim() ??
          null;
        const label =
          prompt.match(new RegExp(`Side ${side} label: (.+)`))?.[1]?.trim() ??
          `side-${side.toLowerCase()}`;
        const roleType =
          prompt.match(new RegExp(`Side ${side} role/type: (.+)`))?.[1]?.trim() ??
          "user";
        const [sourceRole, sourceType] = roleType.split(" / ").map((s) => s.trim());
        const textMatch = prompt.match(
          new RegExp(`Side ${side} sourceText: ("(?:\\\\.|[^"\\\\])*")`),
        );
        const sourceText = textMatch ? (JSON.parse(textMatch[1]!) as string) : "";
        return {
          sourceId,
          sessionId,
          messageId:
            messageIdRaw && messageIdRaw !== "null" ? messageIdRaw : undefined,
          sourceText,
          sourceRole: sourceRole || "user",
          sourceType: sourceType || undefined,
          label,
        };
      };

      return {
        ok: true as const,
        object: factory(parseSide("A"), parseSide("B")),
        providerId: "crt-rt-fake-adjudicator",
        modelId: "crt-rt-deterministic-fixture",
        rawText: null,
      };
    },
  };
}

function bindReferee(): ObjectivityReferee & { callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    async evaluate() {
      calls += 1;
      return {
        outcome: "PASS" as const,
        rationale: "Clear contradiction.",
      };
    },
  };
}

function makeProviders() {
  return {
    modelRunner: sequenceRunner([classAResult]),
    objectivityReferee: bindReferee(),
  };
}

type FixtureIds = {
  prefix: string;
  userId: string;
  sessionId: string;
  messageAId: string;
  messageBId: string;
  referenceId: string;
};

function makeFixtureIds(label: string): FixtureIds {
  const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const prefix = `crt-rt-${label}-${runId}`;
  return {
    prefix,
    userId: `${prefix}-user`,
    sessionId: `${prefix}-session`,
    messageAId: `${prefix}-message-a`,
    messageBId: `${prefix}-message-b`,
    referenceId: `${prefix}-ref-a`,
  };
}

async function seedAuthoritativeFixture(
  db: PrismaClient,
  ids: FixtureIds,
): Promise<FixtureIds> {
  await db.session.create({
    data: {
      id: ids.sessionId,
      userId: ids.userId,
      label: `${ids.prefix}-session-label`,
      origin: "APP",
    },
  });

  await db.message.create({
    data: {
      id: ids.messageAId,
      sessionId: ids.sessionId,
      userId: ids.userId,
      role: "user",
      content: CONTENT_A,
    },
  });

  await db.message.create({
    data: {
      id: ids.messageBId,
      sessionId: ids.sessionId,
      userId: ids.userId,
      role: "user",
      content: CONTENT_B,
    },
  });

  await db.referenceItem.create({
    data: {
      id: ids.referenceId,
      userId: ids.userId,
      type: "goal",
      confidence: "high",
      status: "active",
      statement: QUOTE_A,
      sourceSessionId: ids.sessionId,
      sourceMessageId: ids.messageAId,
    },
  });

  return ids;
}

async function cleanupFixtureUser(
  db: PrismaClient,
  userId: string,
): Promise<{
  contradictionNodes: number;
  evidenceSpans: number;
  referenceItems: number;
  messages: number;
  sessions: number;
}> {
  assertDestructiveTargetIsIsolatedTestDb({
    databaseName: CONTRADICTION_REAL_DB_TEST_DATABASE,
    operation: `cleanupFixtureUser(${userId})`,
  });

  // FK order: nodes (Restrict on spans) → spans → references → messages → sessions
  const nodes = await db.contradictionNode.deleteMany({ where: { userId } });
  const spans = await db.evidenceSpan.deleteMany({ where: { userId } });
  const refs = await db.referenceItem.deleteMany({ where: { userId } });
  const messages = await db.message.deleteMany({ where: { userId } });
  const sessions = await db.session.deleteMany({ where: { userId } });

  return {
    contradictionNodes: nodes.count,
    evidenceSpans: spans.count,
    referenceItems: refs.count,
    messages: messages.count,
    sessions: sessions.count,
  };
}

async function fixtureCounts(db: PrismaClient, userId: string) {
  const [
    contradictionNodes,
    evidenceSpans,
    referenceItems,
    messages,
    sessions,
    contradictionEvidence,
    modelUpdates,
  ] = await Promise.all([
    db.contradictionNode.count({ where: { userId } }),
    db.evidenceSpan.count({ where: { userId } }),
    db.referenceItem.count({ where: { userId } }),
    db.message.count({ where: { userId } }),
    db.session.count({ where: { userId } }),
    db.contradictionEvidence.count({
      where: { node: { userId } },
    }),
    db.modelUpdate.count({ where: { userId } }),
  ]);
  return {
    contradictionNodes,
    evidenceSpans,
    referenceItems,
    messages,
    sessions,
    contradictionEvidence,
    modelUpdates,
  };
}

/**
 * Narrow Prisma-shaped wrapper: real `$transaction` / real PostgreSQL, but
 * ContradictionNode.create throws after span work has begun.
 * Does not replace `$transaction` with a fake.
 */
function createRollbackThrowingAdapterClient(prisma: PrismaClient) {
  return {
    referenceItem: prisma.referenceItem,
    message: prisma.message,
    evidenceSpan: prisma.evidenceSpan,
    contradictionNode: prisma.contradictionNode,
    $transaction: <T>(
      fn: (tx: ContradictionRepairedPersistenceDb) => Promise<T>,
    ): Promise<T> =>
      prisma.$transaction(async (tx) => {
        let spanCreates = 0;
        const wrapped: ContradictionRepairedPersistenceDb = {
          message: {
            findUnique: (args) => tx.message.findUnique(args),
          },
          evidenceSpan: {
            findUnique: (args) => tx.evidenceSpan.findUnique(args),
            create: async (args) => {
              spanCreates += 1;
              return tx.evidenceSpan.create(args);
            },
          },
          contradictionNode: {
            findFirst: (args) => tx.contradictionNode.findFirst(args),
            create: async () => {
              if (spanCreates < 1) {
                throw new Error(
                  "rollback wrapper expected EvidenceSpan work before ContradictionNode.create",
                );
              }
              throw new Error(
                "deliberate ContradictionNode.create failure for real PostgreSQL rollback proof",
              );
            },
          },
          $transaction: async () => {
            throw new Error("nested $transaction must not be used in rollback wrapper");
          },
        };
        return fn(wrapped);
      }),
  };
}

// ---------------------------------------------------------------------------
// Always-on safety unit checks (no PostgreSQL)
// ---------------------------------------------------------------------------

describe("contradiction real-db URL safety guard", () => {
  it("allows the exact isolated local test URL", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test?schema=public",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(true);
    expect(assessment.identity.database).toBe(CONTRADICTION_REAL_DB_TEST_DATABASE);
    expect(assessment.identity.hostname).toBe("127.0.0.1");
    expect(assessment.identity.port).toBe("5432");
    expect(assessment.identity.pathname).toBe(
      `/${CONTRADICTION_REAL_DB_TEST_DATABASE}`,
    );
    expect(assessment.identity.schema).toBe("public");
  });

  it("allows localhost hostname variant", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@localhost:5432/companion_contradiction_rt_test?schema=public",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(true);
    expect(assessment.identity.hostname).toBe("localhost");
  });

  it("refuses blank URL", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "   ",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
  });

  it("refuses near-match database companion_contradiction_rt_test_shadow", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test_shadow?schema=public",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.identity.database).toBeNull();
    expect(assessment.identity.pathname).toBe(
      "/companion_contradiction_rt_test_shadow",
    );
    expect(assessment.blockers.join(" ")).toMatch(/pathname|database/);
  });

  it("refuses extra path segment /companion_contradiction_rt_test/extra", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test/extra?schema=public",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.identity.database).toBeNull();
    expect(assessment.identity.pathname).toBe(
      "/companion_contradiction_rt_test/extra",
    );
  });

  it("refuses port 5433", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5433/companion_contradiction_rt_test?schema=public",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.blockers.join(" ")).toMatch(/port/);
  });

  it("refuses schema other than public", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test?schema=private",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.blockers.join(" ")).toMatch(/schema/);
  });

  it("refuses missing schema query parameter", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.identity.schema).toBeNull();
    expect(assessment.blockers.join(" ")).toMatch(/schema/);
  });

  it("refuses remote host that hides @127.0.0.1: in a query parameter", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://user:pass@evil.example:5432/companion_contradiction_rt_test?schema=public&application_name=@127.0.0.1:",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.identity.hostname).toBe("evil.example");
    expect(assessment.blockers.join(" ")).toMatch(/hostname/);
  });

  it("refuses wrong source env name", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test?schema=public",
      sourceEnvName: "DATABASE_URL",
    });
    expect(assessment.allowed).toBe(false);
  });

  it("refuses the normal companion development database", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/companion?schema=public",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.identity.database).toBeNull();
    expect(assessment.blockers.join(" ")).toMatch(/pathname|database|companion/);
  });

  it("refuses cloud hosts", () => {
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: "postgresql://user:pass@ep-foo.neon.tech:5432/companion_contradiction_rt_test?schema=public",
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    });
    expect(assessment.allowed).toBe(false);
  });

  it("refuses a URL equal to the supplied normal app DATABASE_URL", () => {
    const twin =
      "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test?schema=public";
    const assessment = assessContradictionRealDbTestUrlSafety({
      url: twin,
      sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
      appDatabaseUrl: twin,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.blockers.join(" ")).toMatch(/DATABASE_URL/);
  });

  it("refuses destructive ops against non-isolated DB names", () => {
    expect(() =>
      assertDestructiveTargetIsIsolatedTestDb({
        databaseName: "companion",
        operation: "deleteMany",
      }),
    ).toThrow(/REFUSED destructive/);
  });
});

// ---------------------------------------------------------------------------
// Opt-in real PostgreSQL proof
// ---------------------------------------------------------------------------

const rawTestUrl = process.env[CONTRADICTION_REAL_DB_TEST_URL_ENV];
const shouldAttemptRealDb = typeof rawTestUrl === "string" && rawTestUrl.trim().length > 0;

describe.skipIf(!shouldAttemptRealDb)(
  "contradiction real-db round-trip proof",
  () => {
    let safeUrl: string;
    let prisma: PrismaClient;
    let main: FixtureIds;
    let createdNodeId: string;
    let createdSideASpanId: string;
    let createdSideBSpanId: string;
    const trackedUserIds = new Set<string>();

    beforeAll(() => {
      safeUrl = assertContradictionRealDbTestUrl(
        process.env[CONTRADICTION_REAL_DB_TEST_URL_ENV],
        process.env.DATABASE_URL,
      );
      const identity = assessContradictionRealDbTestUrlSafety({
        url: safeUrl,
        sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
      });
      expect(identity.allowed).toBe(true);
      expect(identity.identity.database).toBe(CONTRADICTION_REAL_DB_TEST_DATABASE);

      // Never rely on DATABASE_URL — bind the isolated URL explicitly.
      prisma = new PrismaClient({
        datasources: { db: { url: safeUrl } },
      });
    });

    afterAll(async () => {
      if (!prisma) return;
      for (const userId of trackedUserIds) {
        await cleanupFixtureUser(prisma, userId);
      }
      await prisma.$disconnect();
    });

    it("1. initial real persistence via production ingestion", async () => {
      main = await seedAuthoritativeFixture(prisma, makeFixtureIds("main"));
      trackedUserIds.add(main.userId);

      const adapter = createPrismaContradictionProductionAdapter(prisma);
      const providers = makeProviders();
      const createProviders = async () => {
        throw new Error("must not construct OpenAI providers when injected");
      };

      const result = await runProductionContradictionIngestion({
        userId: main.userId,
        session: { id: main.sessionId },
        currentMessage: {
          id: main.messageBId,
          content: CONTENT_B,
          role: "user",
        },
        db: adapter,
        env: GATE_ON,
        providers,
        createProviders,
        now: FIXED_NOW,
      });

      expect(result.outcome).toBe("created");
      expect(result.writeExecuted).toBe(true);
      expect(result.writerInvoked).toBe(true);
      expect(result.contradictionNodeOutcome).toBe("created");
      expect(result.contradictionNodeId).toBeTruthy();
      expect(result.sideASourceSpanId).toBeTruthy();
      expect(result.sideBSourceSpanId).toBeTruthy();
      expect(result.sideASourceSpanId).not.toBe(result.sideBSourceSpanId);
      expect(result.providerConstructionCount).toBe(0);
      expect(result.adjudicatorCallCount).toBeLessThanOrEqual(
        PRODUCTION_MAX_ADJUDICATOR_CANDIDATES,
      );
      expect(result.refereeCallCount).toBe(PRODUCTION_MAX_REFEREE_CALLS);
      expect(result.totalProviderCalls).toBeLessThanOrEqual(
        PRODUCTION_MAX_TOTAL_PROVIDER_CALLS,
      );
      expect(JSON.stringify(result)).not.toMatch(
        /persistenceAuthorisedPlan|WeakSet|sk-/,
      );
      expect(providers.modelRunner.callCount()).toBeGreaterThan(0);
      expect(providers.objectivityReferee.callCount()).toBe(1);

      createdNodeId = result.contradictionNodeId!;
      createdSideASpanId = result.sideASourceSpanId!;
      createdSideBSpanId = result.sideBSourceSpanId!;

      const nodes = await prisma.contradictionNode.findMany({
        where: { userId: main.userId, sourceSessionId: main.sessionId },
      });
      expect(nodes).toHaveLength(1);
      const node = nodes[0]!;
      expect(node.id).toBe(createdNodeId);
      expect(node.status).toBe("candidate");
      expect(node.sideASourceSpanId).toBe(createdSideASpanId);
      expect(node.sideBSourceSpanId).toBe(createdSideBSpanId);
      expect(node.sideA).toBe(PROP_A);
      expect(node.sideB).toBe(PROP_B);
      expect(node.sourceSessionId).toBe(main.sessionId);
      expect(node.evidenceCount).toBe(0);

      const spans = await prisma.evidenceSpan.findMany({
        where: { userId: main.userId },
        orderBy: { createdAt: "asc" },
      });
      expect(spans).toHaveLength(2);

      const spanA = spans.find((s) => s.id === createdSideASpanId);
      const spanB = spans.find((s) => s.id === createdSideBSpanId);
      expect(spanA).toBeTruthy();
      expect(spanB).toBeTruthy();
      expect(spanA!.messageId).toBe(main.messageAId);
      expect(spanB!.messageId).toBe(main.messageBId);

      const msgA = await prisma.message.findUniqueOrThrow({
        where: { id: main.messageAId },
      });
      const msgB = await prisma.message.findUniqueOrThrow({
        where: { id: main.messageBId },
      });
      expect(msgA.content.slice(spanA!.charStart, spanA!.charEnd)).toBe(QUOTE_A);
      expect(msgB.content.slice(spanB!.charStart, spanB!.charEnd)).toBe(QUOTE_B);
      expect(spanA!.contentHash).toBe(sha(QUOTE_A));
      expect(spanB!.contentHash).toBe(sha(QUOTE_B));

      const counts = await fixtureCounts(prisma, main.userId);
      expect(counts.contradictionEvidence).toBe(0);
      expect(counts.modelUpdates).toBe(0);
    });

    it("2. fresh-client round trip retrieval", async () => {
      expect(createdNodeId).toBeTruthy();
      await prisma.$disconnect();

      const fresh = new PrismaClient({
        datasources: { db: { url: safeUrl } },
      });
      try {
        const node = await fresh.contradictionNode.findUniqueOrThrow({
          where: { id: createdNodeId },
          include: {
            sideASourceSpan: true,
            sideBSourceSpan: true,
          },
        });
        expect(node.id).toBe(createdNodeId);
        expect(node.sideASourceSpanId).toBe(createdSideASpanId);
        expect(node.sideBSourceSpanId).toBe(createdSideBSpanId);
        expect(node.sideASourceSpan).toBeTruthy();
        expect(node.sideBSourceSpan).toBeTruthy();

        const msgA = await fresh.message.findUniqueOrThrow({
          where: { id: node.sideASourceSpan!.messageId },
        });
        const msgB = await fresh.message.findUniqueOrThrow({
          where: { id: node.sideBSourceSpan!.messageId },
        });
        expect(
          msgA.content.slice(
            node.sideASourceSpan!.charStart,
            node.sideASourceSpan!.charEnd,
          ),
        ).toBe(QUOTE_A);
        expect(
          msgB.content.slice(
            node.sideBSourceSpan!.charStart,
            node.sideBSourceSpan!.charEnd,
          ),
        ).toBe(QUOTE_B);
        expect(node.sideASourceSpan!.contentHash).toBe(sha(QUOTE_A));
        expect(node.sideBSourceSpan!.contentHash).toBe(sha(QUOTE_B));
      } finally {
        await fresh.$disconnect();
      }

      // Reconnect original client for subsequent proofs.
      prisma = new PrismaClient({
        datasources: { db: { url: safeUrl } },
      });
    });

    it("3. sequential exact duplicate reuse", async () => {
      const adapter = createPrismaContradictionProductionAdapter(prisma);
      const result = await runProductionContradictionIngestion({
        userId: main.userId,
        session: { id: main.sessionId },
        currentMessage: {
          id: main.messageBId,
          content: CONTENT_B,
          role: "user",
        },
        db: adapter,
        env: GATE_ON,
        providers: makeProviders(),
        now: FIXED_NOW,
      });

      expect(result.outcome).toBe("reused");
      expect(result.writeExecuted).toBe(false);
      expect(result.contradictionNodeOutcome).toBe("reused");
      expect(result.contradictionNodeId).toBe(createdNodeId);
      expect(result.sideASourceSpanId).toBe(createdSideASpanId);
      expect(result.sideBSourceSpanId).toBe(createdSideBSpanId);

      const counts = await fixtureCounts(prisma, main.userId);
      expect(counts.contradictionNodes).toBe(1);
      expect(counts.evidenceSpans).toBe(2);
    });

    it("4. concurrent duplicate safety on a fresh fixture", async () => {
      const concurrent = await seedAuthoritativeFixture(
        prisma,
        makeFixtureIds("concurrent"),
      );
      trackedUserIds.add(concurrent.userId);

      const adapterA = createPrismaContradictionProductionAdapter(prisma);
      const adapterB = createPrismaContradictionProductionAdapter(prisma);
      const providersA = makeProviders();
      const providersB = makeProviders();

      const settled = await Promise.allSettled([
        runProductionContradictionIngestion({
          userId: concurrent.userId,
          session: { id: concurrent.sessionId },
          currentMessage: {
            id: concurrent.messageBId,
            content: CONTENT_B,
            role: "user",
          },
          db: adapterA,
          env: GATE_ON,
          providers: providersA,
          now: FIXED_NOW,
        }),
        runProductionContradictionIngestion({
          userId: concurrent.userId,
          session: { id: concurrent.sessionId },
          currentMessage: {
            id: concurrent.messageBId,
            content: CONTENT_B,
            role: "user",
          },
          db: adapterB,
          env: GATE_ON,
          providers: providersB,
          now: FIXED_NOW,
        }),
      ]);

      expect(settled).toHaveLength(2);
      for (const entry of settled) {
        expect(entry.status).toBe("fulfilled");
      }

      const results = settled.map((entry) => {
        if (entry.status !== "fulfilled") {
          throw entry.reason;
        }
        return entry.value;
      });

      const nodeIds = new Set(
        results.map((r) => r.contradictionNodeId).filter(Boolean),
      );
      expect(nodeIds.size).toBe(1);
      const sharedNodeId = [...nodeIds][0]!;
      expect(sharedNodeId).toBeTruthy();

      for (const r of results) {
        expect(r.contradictionNodeId).toBe(sharedNodeId);
        expect(["created", "reused"]).toContain(r.outcome);
        expect(r.sideASourceSpanId).toBeTruthy();
        expect(r.sideBSourceSpanId).toBeTruthy();
        expect(r.sideASourceSpanId).not.toBe(r.sideBSourceSpanId);
      }

      const sideAIds = new Set(results.map((r) => r.sideASourceSpanId));
      const sideBIds = new Set(results.map((r) => r.sideBSourceSpanId));
      expect(sideAIds.size).toBe(1);
      expect(sideBIds.size).toBe(1);

      const counts = await fixtureCounts(prisma, concurrent.userId);
      expect(counts.contradictionNodes).toBe(1);
      expect(counts.evidenceSpans).toBe(2);

      const node = await prisma.contradictionNode.findUniqueOrThrow({
        where: { id: sharedNodeId },
      });
      expect(node.sideASourceSpanId).toBe([...sideAIds][0]);
      expect(node.sideBSourceSpanId).toBe([...sideBIds][0]);
      expect(node.sideA).toBe(PROP_A);
      expect(node.sideB).toBe(PROP_B);
    });

    it("5. real PostgreSQL transaction rollback", async () => {
      const rollback = await seedAuthoritativeFixture(
        prisma,
        makeFixtureIds("rollback"),
      );
      trackedUserIds.add(rollback.userId);

      const throwingClient = createRollbackThrowingAdapterClient(prisma);
      const adapter = createPrismaContradictionProductionAdapter(throwingClient);

      const result = await runProductionContradictionIngestion({
        userId: rollback.userId,
        session: { id: rollback.sessionId },
        currentMessage: {
          id: rollback.messageBId,
          content: CONTENT_B,
          role: "user",
        },
        db: adapter,
        env: GATE_ON,
        providers: makeProviders(),
        now: FIXED_NOW,
      });

      expect(result.outcome).toBe("failed_safely");
      expect(result.writerInvoked).toBe(true);
      expect(result.writeExecuted).toBe(false);
      expect(result.contradictionNodeId).toBeNull();

      const counts = await fixtureCounts(prisma, rollback.userId);
      expect(counts.contradictionNodes).toBe(0);
      expect(counts.evidenceSpans).toBe(0);
      // Source fixtures may remain until cleanup.
      expect(counts.sessions).toBe(1);
      expect(counts.messages).toBe(2);
      expect(counts.referenceItems).toBe(1);
    });

    it("6. cleanup leaves zero fixture rows", async () => {
      const userIds = [...trackedUserIds];
      for (const userId of userIds) {
        await cleanupFixtureUser(prisma, userId);
        const counts = await fixtureCounts(prisma, userId);
        expect(counts.contradictionNodes).toBe(0);
        expect(counts.evidenceSpans).toBe(0);
        expect(counts.referenceItems).toBe(0);
        expect(counts.messages).toBe(0);
        expect(counts.sessions).toBe(0);
      }
      trackedUserIds.clear();
    });
  },
);
