/**
 * CONTRADICTION-PRODUCT-ROUND-TRIP-PROOF-001
 *
 * Proves the complete local product lifecycle:
 * Message route → candidate → review → Map exclusion → confirm →
 * Map Active conflicts → Inspector exact lineage → fresh-request persistence.
 *
 * Skipped unless CONTRADICTION_REAL_DB_TEST_URL is present and passes the
 * isolated-DB safety guard. DATABASE_URL (for prismadb singleton) must equal
 * that exact URL when present.
 *
 * Deterministic fake assistant/adjudicator/referee only. No live OpenAI.
 * No browser E2E — classified PASS_PRODUCT_ROUTE_DB_MAP_INSPECTOR_CONTRACT.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

import {
  CONTRADICTION_REAL_DB_TEST_DATABASE,
  CONTRADICTION_REAL_DB_TEST_URL_ENV,
  CONTRADICTION_REAL_DB_TEST_URL_EXPECTED,
  assessContradictionRealDbTestUrlSafety,
  assertContradictionRealDbTestUrl,
} from "../contradiction-real-db-round-trip-safety";
import { fetchInspectorContradiction } from "../inspector-object-api";
import { buildInspectorSelection, resolveInspectorObjectType } from "../inspector-selection";
import {
  fetchMapOpenContradictions,
  formatMapContradictionConfidenceLabel,
  mapContradictionObjectId,
  toMapOpenContradictionItem,
} from "../map-open-contradictions";
import { mapMapDataToV0Props } from "../orvek-adapters/map";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import {
  buildHybridWorkbenchDataApi,
  mergeLiveContradictionConflicts,
} from "../orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../orvek-v0/production/map-api";
import {
  normalizeMapProductionDataApi,
  shouldMergeMapProductionApi,
} from "../orvek-v0/production/map-presentation";
import { withProductionContract } from "../orvek-v0/display-contract";
import {
  CONTRADICTION_RT_CONTENT_B,
  CONTRADICTION_RT_PROP_A,
  CONTRADICTION_RT_PROP_B,
  CONTRADICTION_RT_QUOTE_A,
  CONTRADICTION_RT_QUOTE_B,
  cleanupContradictionRtFixtureUser,
  contradictionRtFixtureCounts,
  createDeterministicAdjudicatorRunner,
  createDeterministicPassReferee,
  makeContradictionRtFixtureIds,
  seedContradictionRtAuthoritativeFixture,
  shaExactQuote,
  type ContradictionRtFixtureIds,
} from "./helpers/contradiction-real-db-fixture-helpers";

const ROOT = join(__dirname, "..", "..");

const {
  afterCallbacks,
  authMock,
  streamTextMock,
  openaiMock,
  providerState,
  getRelevantReferenceMemoryMock,
  getTop3WithOptionalSurfacingMock,
  ensureWeeklyAuditForCurrentWeekMock,
  triggerNativeDerivationIfDueMock,
  tryCreateInternalUserMapCandidateFromAppMessageMock,
  processMessageForProfileMock,
  networkSentinelHits,
} = vi.hoisted(() => {
  const afterCallbacks: Array<() => void | Promise<void>> = [];
  const providerState = {
    constructionCount: 0,
    adjudicatorCalls: 0,
    refereeCalls: 0,
    lastAdjudicator: null as ReturnType<typeof createDeterministicAdjudicatorRunner> | null,
    lastReferee: null as ReturnType<typeof createDeterministicPassReferee> | null,
  };
  const networkSentinelHits: string[] = [];
  return {
    afterCallbacks,
    authMock: vi.fn(),
    streamTextMock: vi.fn(),
    openaiMock: vi.fn(() => "mock-openai-model"),
    providerState,
    getRelevantReferenceMemoryMock: vi.fn(async () => ({
      text: "",
      retrieved: 0,
      relevant: 0,
      injected: 0,
      usedFallback: false,
    })),
    getTop3WithOptionalSurfacingMock: vi.fn(async () => ({ items: [] })),
    ensureWeeklyAuditForCurrentWeekMock: vi.fn(async () => undefined),
    triggerNativeDerivationIfDueMock: vi.fn(async () => undefined),
    tryCreateInternalUserMapCandidateFromAppMessageMock: vi.fn(async () => undefined),
    processMessageForProfileMock: vi.fn(async () => undefined),
    networkSentinelHits,
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("ai", () => ({
  streamText: streamTextMock,
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: openaiMock,
}));

vi.mock("next/server", () => ({
  NextResponse: class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return Response.json(body, init);
    }
  },
  after: (callback: () => void | Promise<void>) => {
    afterCallbacks.push(callback);
  },
}));

vi.mock("@/lib/session-memory", () => ({
  SessionMemoryManager: {
    getInstance: vi.fn(async () => ({
      appendToTranscript: vi.fn(async () => undefined),
      upsertVector: vi.fn(async () => undefined),
      readTranscript: vi.fn(async () => ""),
      queryRelevant: vi.fn(async () => []),
    })),
  },
}));

vi.mock("@/lib/reference-memory", () => ({
  getRelevantReferenceMemory: getRelevantReferenceMemoryMock,
}));

vi.mock("@/lib/contradiction-surface", () => ({
  getTop3WithOptionalSurfacing: getTop3WithOptionalSurfacingMock,
}));

vi.mock("@/lib/weekly-audit", () => ({
  ensureWeeklyAuditForCurrentWeek: ensureWeeklyAuditForCurrentWeekMock,
}));

vi.mock("@/lib/pattern-batch-orchestrator", () => ({
  patternBatchOrchestrator: { runForUser: vi.fn() },
}));

vi.mock("@/lib/native-derivation-trigger", () => ({
  triggerNativeDerivationIfDue: triggerNativeDerivationIfDueMock,
}));

vi.mock("@/lib/understanding-dark-engine/app-message-candidate-bridge", () => ({
  shouldRunAppMessageCandidateBridgeForSession: () => false,
  tryCreateInternalUserMapCandidateFromAppMessage:
    tryCreateInternalUserMapCandidateFromAppMessageMock,
}));

vi.mock("@/lib/profile-derivation", () => ({
  processMessageForProfile: processMessageForProfileMock,
}));

vi.mock("@/lib/assistant/system-prompt", () => ({
  BASE_SYSTEM_PROMPT: "BASE",
  FAST_PATH_SYSTEM_PROMPT: "FAST",
}));

vi.mock("@/lib/memory-governance", async () => {
  return await import("../memory-governance");
});

vi.mock("@/lib/contradiction-production-ingestion", async () => {
  return await import("../contradiction-production-ingestion");
});

vi.mock("@/lib/contradiction-production-db-adapter", async () => {
  return await import("../contradiction-production-db-adapter");
});

vi.mock("@/lib/prismadb", async () => {
  return await import("../prismadb");
});

vi.mock("@/lib/explore-assault-test-provider", () => ({
  exploreAssaultDeterministicReplyAllowed: () => false,
  buildExploreAssaultDeterministicReply: () => "",
}));

vi.mock("@/lib/explore-grounding-orchestrator", () => ({
  orchestrateExploreReplyGrounding: vi.fn(async () => ({
    payload: null,
    proposalCreated: false,
  })),
  persistExploreGroundingPayload: vi.fn(async () => undefined),
}));

vi.mock("@/lib/contradiction-escalation", async () => {
  return await import("../contradiction-escalation");
});

vi.mock("@/lib/contradiction-enums", async () => {
  return await import("../contradiction-enums");
});

vi.mock("@/lib/contradiction-schema", async () => {
  return await import("../contradiction-schema");
});

vi.mock("@/lib/contradiction-snooze-expiry", async () => {
  return await import("../contradiction-snooze-expiry");
});

vi.mock("@/lib/contradiction-source", async () => {
  return await import("../contradiction-source");
});

vi.mock("@/lib/understanding-links", async () => {
  return await import("../understanding-links");
});

vi.mock("@/lib/contradiction-dual-source-presentation", async () => {
  return await import("../contradiction-dual-source-presentation");
});

vi.mock("@/lib/contradiction-patch", async () => {
  return await import("../contradiction-patch");
});

vi.mock("@/lib/contradiction-transitions", async () => {
  return await import("../contradiction-transitions");
});

vi.mock("@/lib/metrics-server", () => ({
  serverLogMetric: vi.fn(async () => undefined),
}));

vi.mock("../contradiction-live-provider-adapters", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../contradiction-live-provider-adapters")>();
  return {
    ...actual,
    openaiApiKeyPresent: () => true,
    resolveContradictionLiveProviderConfig: () =>
      ({
        ok: true as const,
        config: {
          providerId: "openai" as const,
          adjudicatorModelId: "gpt-4o-mini",
          refereeModelId: "gpt-4o-mini",
          timeoutMs: 45_000,
          maxRetries: 0 as const,
          maxTotalCalls: 4,
          independenceLevel: "separate_call_same_provider_same_model" as const,
          credentialsPresent: true,
        },
      }),
    createOpenAiContradictionLiveAdapters: async () => {
      const {
        createDeterministicAdjudicatorRunner,
        createDeterministicPassReferee,
      } = await import("./helpers/contradiction-real-db-fixture-helpers");
      providerState.constructionCount += 1;
      const adjudicatorRunner = createDeterministicAdjudicatorRunner();
      const objectivityReferee = createDeterministicPassReferee();
      providerState.lastAdjudicator = adjudicatorRunner;
      providerState.lastReferee = objectivityReferee;
      const wrappedAdjudicator = {
        async runStructured(
          request: Parameters<typeof adjudicatorRunner.runStructured>[0],
        ) {
          providerState.adjudicatorCalls += 1;
          return adjudicatorRunner.runStructured(request);
        },
      };
      const wrappedReferee = {
        async evaluate(
          input: Parameters<typeof objectivityReferee.evaluate>[0],
        ) {
          providerState.refereeCalls += 1;
          return objectivityReferee.evaluate(input);
        },
      };
      return {
        adjudicatorRunner: wrappedAdjudicator,
        refereeRunner: wrappedAdjudicator,
        objectivityReferee: wrappedReferee,
        providerId: "openai" as const,
        adjudicatorModelId: "gpt-4o-mini",
        refereeModelId: "gpt-4o-mini",
        independenceLevel: "separate_call_same_provider_same_model" as const,
        timeoutMs: 45_000,
        maxRetries: 0 as const,
        callBudgetExact: true,
      };
    },
  };
});

// Alias path used by some route imports.
vi.mock("@/lib/contradiction-live-provider-adapters", async () => {
  return await import("../contradiction-live-provider-adapters");
});

const rawTestUrl = process.env[CONTRADICTION_REAL_DB_TEST_URL_ENV];
const shouldAttemptRealDb =
  typeof rawTestUrl === "string" && rawTestUrl.trim().length > 0;

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

async function flushAfterCallbacks(): Promise<void> {
  const pending = [...afterCallbacks];
  afterCallbacks.length = 0;
  for (const cb of pending) {
    await cb();
  }
}

function restoreEnvVar(name: "RUN_PRODUCTION_CONTRADICTION_INGESTION" | "OPENAI_API_KEY", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function assertNoSourceLeak(
  body: string,
  forbidden: Array<string | null | undefined>,
): void {
  for (const value of forbidden) {
    if (value) {
      expect(body).not.toContain(value);
    }
  }
}

function buildSameTitleSeedCompositionApi(seedTitle: string) {
  const base = createMockOrvekDataApi();
  const baseGetObject = base.getObject.bind(base);
  const baseGetObjects = base.getObjects.bind(base);
  const seedId = "m-conflict-product-proof";

  return withProductionContract({
    ...base,
    mapCategories: [
      {
        id: "conflicts",
        label: "Active conflicts",
        ids: [seedId],
      },
    ],
    mapSelectedId: seedId,
    mapHasContent: true,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      if (id === seedId) {
        return {
          id,
          type: "map-object",
          subtype: "conflict",
          title: seedTitle,
          summary: "Composition/reference seed conflict",
          inspectorObjectType: "usermap_conclusion",
          inspectorObjectId: seedId,
        };
      }
      return baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved = [];
      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object =
          id === seedId
            ? {
                id,
                type: "map-object" as const,
                subtype: "conflict" as const,
                title: seedTitle,
                summary: "Composition/reference seed conflict",
                inspectorObjectType: "usermap_conclusion" as const,
                inspectorObjectId: seedId,
              }
            : baseGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }
      return resolved.length > 0 ? resolved : baseGetObjects(ids);
    },
  });
}

function expectExactLiveMapProjection(args: {
  object: ReturnType<ReturnType<typeof normalizeMapProductionDataApi>["getObject"]>;
  rawId: string;
  title: string;
  confidence: string;
  lastTouchedAt: string;
  evidenceCount: number;
}) {
  const { object } = args;
  expect(object).toBeTruthy();
  expect(object?.title).toBe(args.title);
  expect(object?.summary).toContain(CONTRADICTION_RT_PROP_A);
  expect(object?.summary).toContain(CONTRADICTION_RT_PROP_B);
  expect(object?.supporting).toEqual(
    expect.arrayContaining([`Side A: ${CONTRADICTION_RT_PROP_A}`]),
  );
  expect(object?.conflicting).toEqual(
    expect.arrayContaining([`Side B: ${CONTRADICTION_RT_PROP_B}`]),
  );
  expect(object?.confidence).toBe(
    formatMapContradictionConfidenceLabel(args.confidence),
  );
  expect(object?.lastUpdated).toBe(args.lastTouchedAt);
  expect(object?.evidenceCount).toBe(args.evidenceCount);
  expect(object?.subtype).toBe("conflict");
  expect(object?.inspectorObjectType).toBe("contradiction_node");
  expect(object?.inspectorObjectId).toBe(args.rawId);
}

function installInspectorFetchBridge(args: {
  candidateNodeId: string;
  inspectorRoute: typeof import("../../app/api/inspector/contradictions/[id]/route");
}): () => void {
  const previousFetch = globalThis.fetch;
  const exactPath = `/api/inspector/contradictions/${encodeURIComponent(
    args.candidateNodeId,
  )}`;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? new URL(rawUrl)
      : new URL(rawUrl, "http://localhost");
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");

    if (url.origin === "http://localhost" && url.pathname === exactPath) {
      if (method !== "GET") {
        throw new Error(
          `INSPECTOR FETCH BRIDGE: unexpected method ${method} for ${url.pathname}`,
        );
      }
      return args.inspectorRoute.GET(
        new Request(url.toString(), {
          method: "GET",
          headers: input instanceof Request ? input.headers : init?.headers,
        }),
        { params: Promise.resolve({ id: args.candidateNodeId }) },
      );
    }

    if (
      rawUrl.startsWith("/") ||
      /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(rawUrl)
    ) {
      throw new Error(
        `INSPECTOR FETCH BRIDGE: unexpected local destination ${url.pathname}${url.search}`,
      );
    }

    return previousFetch(input as never, init);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = previousFetch;
  };
}

function installNetworkSentinel(): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (/^https?:\/\//i.test(url) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url)) {
      networkSentinelHits.push(url);
      throw new Error(`NETWORK SENTINEL: blocked external request ${url}`);
    }
    if (typeof originalFetch === "function") {
      return originalFetch(input as never, init);
    }
    throw new Error(`NETWORK SENTINEL: no fetch available for ${url}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("contradiction product candidate-page contract (always)", () => {
  it("candidate page fetches status=candidate with includeDualSource and confirm_candidate", () => {
    const page = readSource(
      "app/(root)/(routes)/contradictions/candidates/page.tsx",
    );
    expect(page).toContain("status=candidate");
    expect(page).toContain("includeDualSource=true");
    expect(page).toContain("ContradictionDualSourceView");
    expect(page).toContain('action: "confirm_candidate"');
    expect(page).toContain('method: "DELETE"');
    expect(page).not.toContain("auto-promote");
  });
});

describe.skipIf(!shouldAttemptRealDb)(
  "contradiction product round-trip proof",
  () => {
    const originalEnv = {
      RUN_PRODUCTION_CONTRADICTION_INGESTION:
        process.env.RUN_PRODUCTION_CONTRADICTION_INGESTION,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    };
    let safeUrl: string;
    let prisma: PrismaClient;
    let fixture: ContradictionRtFixtureIds;
    let sideBMessageId: string;
    let candidateNodeId: string;
    let sideASpanId: string;
    let sideBSpanId: string;
    let restoreFetch: (() => void) | null = null;
    const trackedUserIds = new Set<string>();

    beforeAll(() => {
      safeUrl = assertContradictionRealDbTestUrl(
        process.env[CONTRADICTION_REAL_DB_TEST_URL_ENV],
        // Refuse equality with a *different* app URL; same isolated URL is required.
        process.env.DATABASE_URL &&
          process.env.DATABASE_URL !== process.env[CONTRADICTION_REAL_DB_TEST_URL_ENV]
          ? process.env.DATABASE_URL
          : undefined,
      );
      expect(safeUrl).toBe(CONTRADICTION_REAL_DB_TEST_URL_EXPECTED);
      expect(process.env.DATABASE_URL).toBe(safeUrl);

      const assessment = assessContradictionRealDbTestUrlSafety({
        url: safeUrl,
        sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
      });
      expect(assessment.allowed).toBe(true);
      expect(assessment.identity.database).toBe(CONTRADICTION_REAL_DB_TEST_DATABASE);

      process.env.RUN_PRODUCTION_CONTRADICTION_INGESTION = "1";
      delete process.env.OPENAI_API_KEY;
      expect(process.env.OPENAI_API_KEY).toBeUndefined();

      prisma = new PrismaClient({
        datasources: { db: { url: safeUrl } },
      });
      restoreFetch = installNetworkSentinel();
    });

    beforeEach(() => {
      afterCallbacks.length = 0;
      providerState.constructionCount = 0;
      providerState.adjudicatorCalls = 0;
      providerState.refereeCalls = 0;
      providerState.lastAdjudicator = null;
      providerState.lastReferee = null;
      networkSentinelHits.length = 0;
      streamTextMock.mockReset();
      streamTextMock.mockImplementation(
        (opts: { onFinish?: (args: { text: string }) => void | Promise<void> }) => {
          const text = "Deterministic assistant reply for product proof.";
          void Promise.resolve(opts.onFinish?.({ text }));
          return {
            toTextStreamResponse: () => new Response(text),
          };
        },
      );
      openaiMock.mockReset();
      openaiMock.mockReturnValue("mock-openai-model");
      getRelevantReferenceMemoryMock.mockResolvedValue({
        text: "",
        retrieved: 0,
        relevant: 0,
        injected: 0,
        usedFallback: false,
      });
      getTop3WithOptionalSurfacingMock.mockResolvedValue({ items: [] });
    });

    afterAll(async () => {
      restoreFetch?.();
      if (!prisma) return;
      for (const userId of trackedUserIds) {
        await cleanupContradictionRtFixtureUser(prisma, userId);
      }
      await prisma.$disconnect();
      restoreEnvVar(
        "RUN_PRODUCTION_CONTRADICTION_INGESTION",
        originalEnv.RUN_PRODUCTION_CONTRADICTION_INGESTION,
      );
      restoreEnvVar("OPENAI_API_KEY", originalEnv.OPENAI_API_KEY);
    });

    it("phases 1–7: message route → candidate → Map exclusion → confirm → Map → Inspector → refresh", async () => {
      fixture = await seedContradictionRtAuthoritativeFixture(
        prisma,
        makeContradictionRtFixtureIds("product"),
        { includeSideBMessage: false },
      );
      trackedUserIds.add(fixture.userId);
      authMock.mockResolvedValue({ userId: fixture.userId });

      const messageRoute = await import("../../app/api/message/route");
      const listRoute = await import("../../app/api/contradiction/route");
      const detailRoute = await import("../../app/api/contradiction/[id]/route");
      const inspectorRoute = await import(
        "../../app/api/inspector/contradictions/[id]/route"
      );

      // ── Phase 1: app Message route → candidate ───────────────────────────
      const registeredBefore = afterCallbacks.length;
      const response = await messageRoute.POST(
        new Request("http://localhost/api/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": `${fixture.prefix}-req`,
          },
          body: JSON.stringify({
            sessionId: fixture.sessionId,
            content: CONTRADICTION_RT_CONTENT_B,
            model: "gpt-4o-mini",
            responseMode: "standard",
          }),
        }),
      );
      expect(response.ok).toBe(true);
      expect(afterCallbacks.length - registeredBefore).toBeGreaterThanOrEqual(2);

      await flushAfterCallbacks();
      expect(networkSentinelHits).toEqual([]);
      expect(process.env.OPENAI_API_KEY).toBeUndefined();
      expect(providerState.constructionCount).toBe(1);

      const sideBMessages = await prisma.message.findMany({
        where: {
          userId: fixture.userId,
          sessionId: fixture.sessionId,
          role: "user",
          content: CONTRADICTION_RT_CONTENT_B,
        },
      });
      expect(sideBMessages).toHaveLength(1);
      sideBMessageId = sideBMessages[0]!.id;
      expect(sideBMessages[0]!.userId).toBe(fixture.userId);
      expect(sideBMessages[0]!.sessionId).toBe(fixture.sessionId);

      const nodes = await prisma.contradictionNode.findMany({
        where: { userId: fixture.userId },
      });
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.status).toBe("candidate");
      candidateNodeId = nodes[0]!.id;
      sideASpanId = nodes[0]!.sideASourceSpanId!;
      sideBSpanId = nodes[0]!.sideBSourceSpanId!;
      expect(sideASpanId).toBeTruthy();
      expect(sideBSpanId).toBeTruthy();
      expect(sideASpanId).not.toBe(sideBSpanId);

      const spans = await prisma.evidenceSpan.findMany({
        where: { userId: fixture.userId },
      });
      expect(spans).toHaveLength(2);
      expect(providerState.adjudicatorCalls).toBeLessThanOrEqual(3);
      expect(providerState.refereeCalls).toBe(1);
      expect(
        providerState.adjudicatorCalls + providerState.refereeCalls,
      ).toBeLessThanOrEqual(4);

      const countsAfterCreate = await contradictionRtFixtureCounts(
        prisma,
        fixture.userId,
      );
      expect(countsAfterCreate.contradictionEvidence).toBe(0);
      expect(countsAfterCreate.modelUpdates).toBe(0);

      // ── Phase 2: candidate review contract ───────────────────────────────
      const candidateListRes = await listRoute.GET(
        new Request(
          "http://localhost/api/contradiction?status=candidate&page=1&limit=50&includeDualSource=true",
        ),
      );
      expect(candidateListRes.status).toBe(200);
      const candidateList = (await candidateListRes.json()) as {
        items: Array<{
          id: string;
          status: string;
          sideA: string;
          sideB: string;
          sideASourceSpanId?: string | null;
          sideBSourceSpanId?: string | null;
          dualSource?: {
            lineageState: string;
            sideA: { exactQuote?: string; spanId?: string };
            sideB: { exactQuote?: string; spanId?: string };
          };
        }>;
      };
      const candidateItems = candidateList.items.filter(
        (item) => item.id === candidateNodeId,
      );
      expect(candidateItems).toHaveLength(1);
      const candidateItem = candidateItems[0]!;
      expect(candidateItem.status).toBe("candidate");
      expect(candidateItem.sideASourceSpanId).toBe(sideASpanId);
      expect(candidateItem.sideBSourceSpanId).toBe(sideBSpanId);
      expect(candidateItem.dualSource?.lineageState).toBe("complete_verified");
      expect(candidateItem.dualSource?.sideA.exactQuote).toBe(CONTRADICTION_RT_QUOTE_A);
      expect(candidateItem.dualSource?.sideB.exactQuote).toBe(CONTRADICTION_RT_QUOTE_B);
      expect(candidateItem.sideA).toBe(CONTRADICTION_RT_PROP_A);
      expect(candidateItem.sideB).toBe(CONTRADICTION_RT_PROP_B);
      expect(candidateItem.sideA).not.toBe(candidateItem.dualSource?.sideA.exactQuote);
      expect(candidateItem.sideB).not.toBe(candidateItem.dualSource?.sideB.exactQuote);

      const secondSyntheticUserId = `${fixture.prefix}-intruder-user`;
      authMock.mockResolvedValue({ userId: secondSyntheticUserId });
      const foreignCandidateRes = await listRoute.GET(
        new Request(
          "http://localhost/api/contradiction?status=candidate&page=1&limit=50&includeDualSource=true",
        ),
      );
      expect(foreignCandidateRes.status).toBe(200);
      const foreignCandidateBody = await foreignCandidateRes.text();
      assertNoSourceLeak(foreignCandidateBody, [
        candidateNodeId,
        sideASpanId,
        sideBSpanId,
        CONTRADICTION_RT_QUOTE_A,
        CONTRADICTION_RT_QUOTE_B,
        CONTRADICTION_RT_PROP_A,
        CONTRADICTION_RT_PROP_B,
      ]);
      const foreignCandidatePayload = JSON.parse(foreignCandidateBody) as {
        items: Array<{ id: string }>;
      };
      expect(
        foreignCandidatePayload.items.find((item) => item.id === candidateNodeId),
      ).toBeUndefined();

      authMock.mockResolvedValue({ userId: null });
      const unauthCandidateRes = await listRoute.GET(
        new Request(
          "http://localhost/api/contradiction?status=candidate&page=1&limit=50&includeDualSource=true",
        ),
      );
      expect(unauthCandidateRes.status).toBe(401);
      assertNoSourceLeak(await unauthCandidateRes.text(), [
        candidateNodeId,
        sideASpanId,
        sideBSpanId,
        CONTRADICTION_RT_QUOTE_A,
        CONTRADICTION_RT_QUOTE_B,
        CONTRADICTION_RT_PROP_A,
        CONTRADICTION_RT_PROP_B,
      ]);
      authMock.mockResolvedValue({ userId: fixture.userId });

      // ── Phase 3: candidate must not leak into Map / open list ─────────────
      const openBeforeRes = await listRoute.GET(
        new Request(
          "http://localhost/api/contradiction?status=open&page=1&limit=50",
        ),
      );
      expect(openBeforeRes.status).toBe(200);
      const openBefore = (await openBeforeRes.json()) as {
        items: Array<{ id: string }>;
      };
      expect(openBefore.items.find((item) => item.id === candidateNodeId)).toBeUndefined();

      const openMapItemsBefore = await fetchMapOpenContradictions(async (input) => {
        const url = typeof input === "string" ? input : String(input);
        const path = url.startsWith("http") ? new URL(url).pathname + new URL(url).search : url;
        return listRoute.GET(new Request(`http://localhost${path}`));
      });
      expect(openMapItemsBefore.find((item) => item.id === candidateNodeId)).toBeUndefined();

      const mapBefore = buildMapProductionDataApi({
        items: [],
        openContradictions: openMapItemsBefore,
        isLoading: false,
        loadError: null,
        selectedId: null,
        detail: null,
        isDetailLoading: false,
        evidence: [],
        openQuestionsCount: 0,
        mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
        movementPreview: { isLoading: false, items: [] },
        openQuestionsPreview: { isLoading: false, items: [] },
      });
      const beforeView = mapMapDataToV0Props({
        items: [],
        openContradictions: openMapItemsBefore,
        isLoading: false,
        loadError: null,
        selectedId: null,
        detail: null,
        isDetailLoading: false,
        evidence: [],
        openQuestionsCount: 0,
        mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
        movementPreview: { isLoading: false, items: [] },
        openQuestionsPreview: { isLoading: false, items: [] },
      });
      const beforeConflicts = beforeView.ontologyGroups.find(
        (group) => group.key === "conflicts",
      );
      expect(
        beforeConflicts?.items.some(
          (item) => item.id === mapContradictionObjectId(candidateNodeId),
        ),
      ).toBe(false);
      expect(
        mapBefore.getObject(mapContradictionObjectId(candidateNodeId)),
      ).toBeUndefined();

      const sameTitleCompositionApi = buildSameTitleSeedCompositionApi(
        nodes[0]!.title,
      );
      const sameTitleSeedId = "m-conflict-product-proof";
      const preConfirmHybrid = buildHybridWorkbenchDataApi(
        createMockOrvekDataApi(),
        sameTitleCompositionApi,
        mapBefore,
      );
      const preConfirmConflicts = preConfirmHybrid.mapCategories.find(
        (group) => group.id === "conflicts",
      );
      expect(preConfirmConflicts?.ids).toContain(sameTitleSeedId);
      expect(preConfirmConflicts?.ids).not.toContain(
        mapContradictionObjectId(candidateNodeId),
      );
      expect(
        preConfirmHybrid.getObject(sameTitleSeedId)?.inspectorObjectType,
      ).toBe("usermap_conclusion");
      expect(preConfirmHybrid.getObject(sameTitleSeedId)?.title).toBe(nodes[0]!.title);
      expect(preConfirmHybrid.getObject(mapContradictionObjectId(candidateNodeId))).toBeUndefined();
      expect(preConfirmHybrid.getObject(candidateNodeId)).toBeUndefined();
      expect(
        preConfirmConflicts?.ids
          .map((id) => preConfirmHybrid.getObject(id))
          .some((object) => object?.inspectorObjectId === candidateNodeId),
      ).toBe(false);

      // ── Phase 4: confirm through actual PATCH ────────────────────────────
      const confirmRes = await detailRoute.PATCH(
        new Request(`http://localhost/api/contradiction/${candidateNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_candidate" }),
        }),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(confirmRes.status).toBe(200);

      const confirmed = await prisma.contradictionNode.findUniqueOrThrow({
        where: { id: candidateNodeId },
      });
      expect(confirmed.status).toBe("open");
      expect(confirmed.sideASourceSpanId).toBe(sideASpanId);
      expect(confirmed.sideBSourceSpanId).toBe(sideBSpanId);
      expect(
        (await contradictionRtFixtureCounts(prisma, fixture.userId)).contradictionNodes,
      ).toBe(1);
      expect(
        (await contradictionRtFixtureCounts(prisma, fixture.userId)).evidenceSpans,
      ).toBe(2);
      expect(
        (await contradictionRtFixtureCounts(prisma, fixture.userId)).contradictionEvidence,
      ).toBe(0);
      expect(
        (await contradictionRtFixtureCounts(prisma, fixture.userId)).modelUpdates,
      ).toBe(0);

      const secondConfirm = await detailRoute.PATCH(
        new Request(`http://localhost/api/contradiction/${candidateNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_candidate" }),
        }),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(secondConfirm.status).toBe(409);
      const secondBody = (await secondConfirm.json()) as {
        error: { code: string };
      };
      expect(secondBody.error.code).toBe("CONFIRM_CANDIDATE_REQUIRES_CANDIDATE_STATUS");
      expect(
        (await contradictionRtFixtureCounts(prisma, fixture.userId)).contradictionNodes,
      ).toBe(1);

      // ── Phase 5: open node → production Map ──────────────────────────────
      const openAfterRes = await listRoute.GET(
        new Request(
          "http://localhost/api/contradiction?status=open&page=1&limit=50",
        ),
      );
      const openAfter = (await openAfterRes.json()) as {
        items: Array<{
          id: string;
          title: string;
          sideA: string;
          sideB: string;
          status: string;
          confidence: string;
          evidenceCount: number;
          lastTouchedAt: string;
        }>;
      };
      const openFixtureItems = openAfter.items.filter(
        (item) => item.id === candidateNodeId,
      );
      expect(openFixtureItems).toHaveLength(1);
      const openItem = openFixtureItems[0]!;

      const openMapItems = await fetchMapOpenContradictions(async (input) => {
        const url = typeof input === "string" ? input : String(input);
        const path = url.startsWith("http")
          ? new URL(url).pathname + new URL(url).search
          : url;
        return listRoute.GET(new Request(`http://localhost${path}`));
      });
      const mappedOpen = openMapItems.filter((item) => item.id === candidateNodeId);
      expect(mappedOpen).toHaveLength(1);
      expect(toMapOpenContradictionItem(openFixtureItems[0]!)?.id).toBe(candidateNodeId);

      const railId = mapContradictionObjectId(candidateNodeId);
      const mapInput = {
        items: [],
        openContradictions: openMapItems,
        isLoading: false,
        loadError: null,
        selectedId: railId,
        detail: null,
        isDetailLoading: false,
        evidence: [],
        openQuestionsCount: 0,
        mindContext: {
          isLoading: false,
          items: [],
          summaryCounts: { memories: 0, patterns: 0 },
        },
        movementPreview: { isLoading: false, items: [] },
        openQuestionsPreview: { isLoading: false, items: [] },
      };
      const mapView = mapMapDataToV0Props(mapInput);
      const conflictsRail = mapView.ontologyGroups.find(
        (group) => group.key === "conflicts",
      );
      expect(conflictsRail?.label).toBe("Active conflicts");
      const railItem = conflictsRail?.items.find((item) => item.id === railId);
      expect(railItem).toBeTruthy();
      expect(railItem?.rawId).toBe(candidateNodeId);
      expect(railItem?.kind).toBe("contradiction");

      const mapApi = normalizeMapProductionDataApi(
        buildMapProductionDataApi(mapInput),
      );
      expect(shouldMergeMapProductionApi(mapApi)).toBe(true);
      const mapObject = mapApi.getObject(railId);
      expectExactLiveMapProjection({
        object: mapObject,
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });
      expectExactLiveMapProjection({
        object: mapApi.getObject(candidateNodeId),
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });
      expect(resolveInspectorObjectType(mapObject!)).toBe("contradiction_node");

      const merged = mergeLiveContradictionConflicts(
        sameTitleCompositionApi,
        mapApi,
      );
      const mergedConflicts = merged.mapCategories.find((c) => c.id === "conflicts");
      expect(mergedConflicts?.ids).toContain(railId);
      expect(mergedConflicts?.ids).toContain(sameTitleSeedId);
      expectExactLiveMapProjection({
        object: merged.getObject(railId),
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });
      expectExactLiveMapProjection({
        object: merged.getObject(candidateNodeId),
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });
      expect(merged.getObject(sameTitleSeedId)?.title).toBe(openItem.title);
      expect(merged.getObject(sameTitleSeedId)?.inspectorObjectType).toBe(
        "usermap_conclusion",
      );
      expect(merged.getObject(sameTitleSeedId)?.inspectorObjectId).toBe(
        sameTitleSeedId,
      );

      const hybrid = buildHybridWorkbenchDataApi(
        createMockOrvekDataApi(),
        undefined,
        mapApi,
      );
      const hybridConflicts = hybrid.mapCategories.find((group) => group.id === "conflicts");
      expect(hybridConflicts?.ids).toContain(railId);
      expectExactLiveMapProjection({
        object: hybrid.getObject(railId),
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });
      expectExactLiveMapProjection({
        object: hybrid.getObject(candidateNodeId),
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });
      expect(hybrid.getObject(candidateNodeId)?.id).toBe(candidateNodeId);

      const sameTitleHybrid = buildHybridWorkbenchDataApi(
        createMockOrvekDataApi(),
        sameTitleCompositionApi,
        mapApi,
      );
      const sameTitleConflicts = sameTitleHybrid.mapCategories.find(
        (group) => group.id === "conflicts",
      );
      expect(sameTitleConflicts?.ids).toContain(sameTitleSeedId);
      expect(sameTitleConflicts?.ids).toContain(railId);
      expect(sameTitleHybrid.getObject(sameTitleSeedId)?.title).toBe(openItem.title);
      expect(sameTitleHybrid.getObject(sameTitleSeedId)?.inspectorObjectType).toBe(
        "usermap_conclusion",
      );
      expect(sameTitleHybrid.getObject(sameTitleSeedId)?.inspectorObjectId).toBe(
        sameTitleSeedId,
      );
      expectExactLiveMapProjection({
        object: sameTitleHybrid.getObject(railId),
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });
      expectExactLiveMapProjection({
        object: sameTitleHybrid.getObject(candidateNodeId),
        rawId: candidateNodeId,
        title: openItem.title,
        confidence: confirmed.confidence,
        lastTouchedAt: openItem.lastTouchedAt,
        evidenceCount: confirmed.evidenceCount,
      });

      // ── Phase 6: Inspector exact lineage ─────────────────────────────────
      const inspectorSelection = buildInspectorSelection({
        objectType: "contradiction_node",
        objectId: candidateNodeId,
        title: confirmed.title,
        sourceSurface: "map",
        availability: "live",
      });
      expect(inspectorSelection).toMatchObject({
        selectedObjectType: "contradiction_node",
        selectedObjectId: candidateNodeId,
        sourceSurface: "map",
        availability: "live",
      });

      const detailRes = await detailRoute.GET(
        new Request(`http://localhost/api/contradiction/${candidateNodeId}`),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(detailRes.status).toBe(200);
      const detail = (await detailRes.json()) as {
        id: string;
        status: string;
        sideA: string;
        sideB: string;
        dualSource: {
          lineageState: string;
          sideA: {
            spanId: string;
            exactQuote: string;
            messageId: string;
            side: string;
          };
          sideB: {
            spanId: string;
            exactQuote: string;
            messageId: string;
            side: string;
          };
        };
      };
      expect(detail.id).toBe(candidateNodeId);
      expect(detail.status).toBe("open");
      expect(detail.dualSource.lineageState).toBe("complete_verified");
      expect(detail.dualSource.sideA.spanId).toBe(sideASpanId);
      expect(detail.dualSource.sideB.spanId).toBe(sideBSpanId);
      expect(detail.dualSource.sideA.exactQuote).toBe(CONTRADICTION_RT_QUOTE_A);
      expect(detail.dualSource.sideB.exactQuote).toBe(CONTRADICTION_RT_QUOTE_B);
      expect(detail.dualSource.sideA.side).toBe("A");
      expect(detail.dualSource.sideB.side).toBe("B");
      expect(detail.dualSource.sideA.messageId).toBe(fixture.messageAId);
      expect(detail.dualSource.sideB.messageId).toBe(sideBMessageId);

      const inspectorRes = await inspectorRoute.GET(
        new Request(
          `http://localhost/api/inspector/contradictions/${candidateNodeId}`,
        ),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(inspectorRes.status).toBe(200);
      const inspectorPayload = (await inspectorRes.json()) as {
        item: {
          id: string;
          status: string;
          dualSource: {
            lineageState: string;
            sideA: { spanId: string; exactQuote: string };
            sideB: { spanId: string; exactQuote: string };
          };
        };
      };
      expect(inspectorPayload.item.id).toBe(candidateNodeId);
      expect(inspectorPayload.item.status).toBe("open");
      expect(inspectorPayload.item.dualSource.lineageState).toBe("complete_verified");
      expect(inspectorPayload.item.dualSource.sideA.spanId).toBe(sideASpanId);
      expect(inspectorPayload.item.dualSource.sideB.spanId).toBe(sideBSpanId);

      const restoreInspectorFetch = installInspectorFetchBridge({
        candidateNodeId,
        inspectorRoute,
      });
      try {
        const clientResult = await fetchInspectorContradiction(candidateNodeId);
        expect(clientResult).not.toBeNull();
        expect(clientResult?.id).toBe(candidateNodeId);
        expect(clientResult?.status).toBe("open");
        expect(clientResult?.sideA).toBe(CONTRADICTION_RT_PROP_A);
        expect(clientResult?.sideB).toBe(CONTRADICTION_RT_PROP_B);
        expect(clientResult?.dualSource.lineageState).toBe("complete_verified");
        expect(clientResult?.dualSource.sideA.availability).toBe("available");
        expect(clientResult?.dualSource.sideB.availability).toBe("available");
        if (
          !clientResult ||
          clientResult.dualSource.sideA.availability !== "available" ||
          clientResult.dualSource.sideB.availability !== "available"
        ) {
          throw new Error("expected available contradiction dual-source sides");
        }
        expect(clientResult.dualSource.sideA.exactQuote).toBe(
          CONTRADICTION_RT_QUOTE_A,
        );
        expect(clientResult.dualSource.sideB.exactQuote).toBe(
          CONTRADICTION_RT_QUOTE_B,
        );
        expect(clientResult.dualSource.sideA.spanId).toBe(sideASpanId);
        expect(clientResult.dualSource.sideB.spanId).toBe(sideBSpanId);
      } finally {
        restoreInspectorFetch();
      }
      expect(networkSentinelHits).toEqual([]);

      const msgA = await prisma.message.findUniqueOrThrow({
        where: { id: fixture.messageAId },
      });
      const msgB = await prisma.message.findUniqueOrThrow({
        where: { id: sideBMessageId },
      });
      const spanA = await prisma.evidenceSpan.findUniqueOrThrow({
        where: { id: sideASpanId },
      });
      const spanB = await prisma.evidenceSpan.findUniqueOrThrow({
        where: { id: sideBSpanId },
      });
      expect(msgA.content.slice(spanA.charStart, spanA.charEnd)).toBe(
        CONTRADICTION_RT_QUOTE_A,
      );
      expect(msgB.content.slice(spanB.charStart, spanB.charEnd)).toBe(
        CONTRADICTION_RT_QUOTE_B,
      );
      expect(spanA.contentHash).toBe(shaExactQuote(CONTRADICTION_RT_QUOTE_A));
      expect(spanB.contentHash).toBe(shaExactQuote(CONTRADICTION_RT_QUOTE_B));

      const panelSource = readSource(
        "components/inspector/panels/SelectedObjectEvidencePanel.tsx",
      );
      expect(panelSource).toContain("ContradictionDualSourceView");
      expect(panelSource).toContain("fetchInspectorContradiction");
      expect(panelSource).not.toMatch(
        /evidence\[.*\]\.spanId.*sideASourceSpanId|derive.*legacy.*evidence/,
      );

      expect(JSON.stringify(detail)).not.toMatch(/sk-|persistenceAuthorisedPlan|WeakSet/);
      expect(JSON.stringify(inspectorPayload)).not.toMatch(
        /sk-|persistenceAuthorisedPlan|WeakSet/,
      );

      authMock.mockResolvedValue({ userId: secondSyntheticUserId });
      const foreignOpenRes = await listRoute.GET(
        new Request(
          "http://localhost/api/contradiction?status=open&page=1&limit=50&includeDualSource=true",
        ),
      );
      expect(foreignOpenRes.status).toBe(200);
      const foreignOpenBody = await foreignOpenRes.text();
      assertNoSourceLeak(foreignOpenBody, [
        candidateNodeId,
        sideASpanId,
        sideBSpanId,
        CONTRADICTION_RT_QUOTE_A,
        CONTRADICTION_RT_QUOTE_B,
        CONTRADICTION_RT_PROP_A,
        CONTRADICTION_RT_PROP_B,
      ]);
      const foreignOpenPayload = JSON.parse(foreignOpenBody) as {
        items: Array<{ id: string }>;
      };
      expect(
        foreignOpenPayload.items.find((item) => item.id === candidateNodeId),
      ).toBeUndefined();

      const foreignDetailRes = await detailRoute.GET(
        new Request(`http://localhost/api/contradiction/${candidateNodeId}`),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(foreignDetailRes.status).toBe(404);
      assertNoSourceLeak(await foreignDetailRes.text(), [
        candidateNodeId,
        sideASpanId,
        sideBSpanId,
        CONTRADICTION_RT_QUOTE_A,
        CONTRADICTION_RT_QUOTE_B,
        CONTRADICTION_RT_PROP_A,
        CONTRADICTION_RT_PROP_B,
      ]);

      const foreignInspectorRes = await inspectorRoute.GET(
        new Request(
          `http://localhost/api/inspector/contradictions/${candidateNodeId}`,
        ),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(foreignInspectorRes.status).toBe(404);
      assertNoSourceLeak(await foreignInspectorRes.text(), [
        candidateNodeId,
        sideASpanId,
        sideBSpanId,
        CONTRADICTION_RT_QUOTE_A,
        CONTRADICTION_RT_QUOTE_B,
        CONTRADICTION_RT_PROP_A,
        CONTRADICTION_RT_PROP_B,
      ]);

      authMock.mockResolvedValue({ userId: null });
      const unauthDetailRes = await detailRoute.GET(
        new Request(`http://localhost/api/contradiction/${candidateNodeId}`),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(unauthDetailRes.status).toBe(401);
      assertNoSourceLeak(await unauthDetailRes.text(), [
        candidateNodeId,
        sideASpanId,
        sideBSpanId,
        CONTRADICTION_RT_QUOTE_A,
        CONTRADICTION_RT_QUOTE_B,
        CONTRADICTION_RT_PROP_A,
        CONTRADICTION_RT_PROP_B,
      ]);

      const unauthInspectorRes = await inspectorRoute.GET(
        new Request(
          `http://localhost/api/inspector/contradictions/${candidateNodeId}`,
        ),
        { params: Promise.resolve({ id: candidateNodeId }) },
      );
      expect(unauthInspectorRes.status).toBe(401);
      assertNoSourceLeak(await unauthInspectorRes.text(), [
        candidateNodeId,
        sideASpanId,
        sideBSpanId,
        CONTRADICTION_RT_QUOTE_A,
        CONTRADICTION_RT_QUOTE_B,
        CONTRADICTION_RT_PROP_A,
        CONTRADICTION_RT_PROP_B,
      ]);

      authMock.mockResolvedValue({ userId: fixture.userId });
      const ownerOpenDualSourceRes = await listRoute.GET(
        new Request(
          "http://localhost/api/contradiction?status=open&page=1&limit=50&includeDualSource=true",
        ),
      );
      expect(ownerOpenDualSourceRes.status).toBe(200);
      const ownerOpenDualSource = (await ownerOpenDualSourceRes.json()) as {
        items: Array<{
          id: string;
          dualSource?: {
            lineageState: string;
            sideA: { exactQuote?: string };
            sideB: { exactQuote?: string };
          };
        }>;
      };
      const ownerOpenItem = ownerOpenDualSource.items.find(
        (item) => item.id === candidateNodeId,
      );
      expect(ownerOpenItem).toBeTruthy();
      expect(ownerOpenItem?.dualSource?.lineageState).toBe("complete_verified");
      expect(ownerOpenItem?.dualSource?.sideA.exactQuote).toBe(
        CONTRADICTION_RT_QUOTE_A,
      );
      expect(ownerOpenItem?.dualSource?.sideB.exactQuote).toBe(
        CONTRADICTION_RT_QUOTE_B,
      );

      // ── Phase 7: fresh-client / refresh persistence ──────────────────────
      await prisma.$disconnect();
      const fresh = new PrismaClient({
        datasources: { db: { url: safeUrl } },
      });
      try {
        const freshNode = await fresh.contradictionNode.findUniqueOrThrow({
          where: { id: candidateNodeId },
        });
        expect(freshNode.status).toBe("open");
        expect(freshNode.sideASourceSpanId).toBe(sideASpanId);
        expect(freshNode.sideBSourceSpanId).toBe(sideBSpanId);

        const freshListRes = await listRoute.GET(
          new Request(
            "http://localhost/api/contradiction?status=open&page=1&limit=50",
          ),
        );
        const freshList = (await freshListRes.json()) as {
          items: Array<{ id: string; status: string }>;
        };
        expect(
          freshList.items.find((item) => item.id === candidateNodeId)?.status,
        ).toBe("open");

        const freshMapItems = await fetchMapOpenContradictions(async (input) => {
          const url = typeof input === "string" ? input : String(input);
          const path = url.startsWith("http")
            ? new URL(url).pathname + new URL(url).search
            : url;
          return listRoute.GET(new Request(`http://localhost${path}`));
        });
        const freshMapApi = normalizeMapProductionDataApi(
          buildMapProductionDataApi({
            ...mapInput,
            openContradictions: freshMapItems,
            selectedId: railId,
          }),
        );
        expect(shouldMergeMapProductionApi(freshMapApi)).toBe(true);
        expectExactLiveMapProjection({
          object: freshMapApi.getObject(railId),
          rawId: candidateNodeId,
          title: openItem.title,
          confidence: confirmed.confidence,
          lastTouchedAt: openItem.lastTouchedAt,
          evidenceCount: confirmed.evidenceCount,
        });
        expectExactLiveMapProjection({
          object: freshMapApi.getObject(candidateNodeId),
          rawId: candidateNodeId,
          title: openItem.title,
          confidence: confirmed.confidence,
          lastTouchedAt: openItem.lastTouchedAt,
          evidenceCount: confirmed.evidenceCount,
        });

        const freshInspector = await inspectorRoute.GET(
          new Request(
            `http://localhost/api/inspector/contradictions/${candidateNodeId}`,
          ),
          { params: Promise.resolve({ id: candidateNodeId }) },
        );
        const freshInspectorBody = (await freshInspector.json()) as {
          item: {
            dualSource: {
              sideA: { exactQuote: string };
              sideB: { exactQuote: string };
            };
          };
        };
        expect(freshInspectorBody.item.dualSource.sideA.exactQuote).toBe(
          CONTRADICTION_RT_QUOTE_A,
        );
        expect(freshInspectorBody.item.dualSource.sideB.exactQuote).toBe(
          CONTRADICTION_RT_QUOTE_B,
        );

        const freshCounts = await contradictionRtFixtureCounts(
          fresh,
          fixture.userId,
        );
        expect(freshCounts.contradictionNodes).toBe(1);
        expect(freshCounts.evidenceSpans).toBe(2);

        const freshMerged = mergeLiveContradictionConflicts(
          sameTitleCompositionApi,
          freshMapApi,
        );
        expectExactLiveMapProjection({
          object: freshMerged.getObject(railId),
          rawId: candidateNodeId,
          title: openItem.title,
          confidence: confirmed.confidence,
          lastTouchedAt: openItem.lastTouchedAt,
          evidenceCount: confirmed.evidenceCount,
        });
        expectExactLiveMapProjection({
          object: freshMerged.getObject(candidateNodeId),
          rawId: candidateNodeId,
          title: openItem.title,
          confidence: confirmed.confidence,
          lastTouchedAt: openItem.lastTouchedAt,
          evidenceCount: confirmed.evidenceCount,
        });
        const freshHybrid = buildHybridWorkbenchDataApi(
          createMockOrvekDataApi(),
          undefined,
          freshMapApi,
        );
        const freshHybridConflicts = freshHybrid.mapCategories.find(
          (group) => group.id === "conflicts",
        );
        expect(freshHybridConflicts?.ids).toContain(railId);
        expectExactLiveMapProjection({
          object: freshHybrid.getObject(railId),
          rawId: candidateNodeId,
          title: openItem.title,
          confidence: confirmed.confidence,
          lastTouchedAt: openItem.lastTouchedAt,
          evidenceCount: confirmed.evidenceCount,
        });
        expectExactLiveMapProjection({
          object: freshHybrid.getObject(candidateNodeId),
          rawId: candidateNodeId,
          title: openItem.title,
          confidence: confirmed.confidence,
          lastTouchedAt: openItem.lastTouchedAt,
          evidenceCount: confirmed.evidenceCount,
        });
      } finally {
        await fresh.$disconnect();
      }

      prisma = new PrismaClient({
        datasources: { db: { url: safeUrl } },
      });

      // Cleanup + assert zero fixture rows
      await cleanupContradictionRtFixtureUser(prisma, fixture.userId);
      trackedUserIds.delete(fixture.userId);
      const finalCounts = await contradictionRtFixtureCounts(
        prisma,
        fixture.userId,
      );
      expect(finalCounts.contradictionNodes).toBe(0);
      expect(finalCounts.evidenceSpans).toBe(0);
      expect(finalCounts.referenceItems).toBe(0);
      expect(finalCounts.messages).toBe(0);
      expect(finalCounts.sessions).toBe(0);
      expect(networkSentinelHits).toEqual([]);
    });
  },
);
