/**
 * Production contradiction ingestion boundary for persisted app messages.
 *
 * Gate (default OFF):
 *   RUN_PRODUCTION_CONTRADICTION_INGESTION=1
 *
 * When gated off: zero provider construction, provider calls, referee calls,
 * and contradiction writes.
 *
 * When enabled: Side B from persisted current Message → bounded same-session
 * ReferenceItem retrieval → schema-v4 adjudicator (≤3 candidates) → sole
 * Objectivity Referee call → exact dual-side lineage → confidence → repaired
 * writer → exact duplicate reuse.
 *
 * Provider-call bound (hard defaults):
 *   ≤3 adjudicator candidates / calls
 *   ≤1 referee call
 *   ≤4 total provider calls
 *
 * Never exposes the authorised WeakSet persistence capability.
 * Never logs credentials, raw provider objects, or unsanitised provider errors.
 * Does not wire ChatGPT import.
 */

import {
  createOpenAiContradictionLiveAdapters,
  openaiApiKeyPresent,
  resolveContradictionLiveProviderConfig,
  type ContradictionLiveAdapterBundle,
} from "./contradiction-live-provider-adapters";
import {
  runContradictionNaturalEntry,
  type ContradictionNaturalEntryOutcome,
  type ContradictionNaturalEntryResult,
} from "./contradiction-natural-entry";
import type { ContradictionProductionDb } from "./contradiction-production-db-adapter";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";
import type { ObjectivityReferee } from "./orvek-intelligence-kernel/objectivity-referee";

export const RUN_PRODUCTION_CONTRADICTION_INGESTION_ENV =
  "RUN_PRODUCTION_CONTRADICTION_INGESTION" as const;

/** Hard production adjudicator candidate / call cap. */
export const PRODUCTION_MAX_ADJUDICATOR_CANDIDATES = 3 as const;

/** Hard production referee call cap (sole winner only). */
export const PRODUCTION_MAX_REFEREE_CALLS = 1 as const;

/** Hard production total provider-call ceiling for one message. */
export const PRODUCTION_MAX_TOTAL_PROVIDER_CALLS = 4 as const;

export const CONTRADICTION_PRODUCTION_INGESTION_VERSION =
  "contradiction-production-ingestion-v1" as const;

const MIN_MESSAGE_LENGTH = 15;

export type ProductionContradictionIngestionProviders = {
  modelRunner: StructuredModelRunner;
  objectivityReferee: ObjectivityReferee;
};

export type ProductionContradictionIngestionInput = {
  userId: string;
  session: { id: string };
  /** Authoritative persisted current user Message (Side B). */
  currentMessage: {
    id: string;
    content: string;
    role?: string;
  };
  db: ContradictionProductionDb;
  /**
   * Injected adjudicator + referee (tests / harness).
   * When omitted and the gate is on, providers are constructed from env.
   */
  providers?: ProductionContradictionIngestionProviders;
  /**
   * Optional provider factory for tests that assert construction counts.
   * Only invoked when the gate is enabled and `providers` is omitted.
   */
  createProviders?: () => Promise<ProductionContradictionIngestionProviders>;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  abortSignal?: AbortSignal;
};

export type ProductionContradictionIngestionResult = {
  version: typeof CONTRADICTION_PRODUCTION_INGESTION_VERSION;
  gatedOff: boolean;
  outcome: ContradictionNaturalEntryOutcome | "gated_off" | "skipped_short_message";
  failureCode: string | null;
  /** Compact sanitised failure code/message only — never raw provider errors. */
  failureMessage: string | null;
  providerConstructionCount: number;
  adjudicatorCallCount: number;
  refereeCallCount: number;
  totalProviderCalls: number;
  writerInvoked: boolean;
  writeExecuted: boolean;
  contradictionNodeId: string | null;
  sideASourceSpanId: string | null;
  sideBSourceSpanId: string | null;
  contradictionNodeOutcome: "created" | "reused" | null;
  selectedCandidateCount: number;
  /** Inspectable natural-entry result when the pipeline ran; never includes plans. */
  naturalEntry: ContradictionNaturalEntryResult | null;
};

/**
 * True only for explicit gate values "1" or "true" (case-insensitive).
 * Missing / false / other → OFF.
 */
export function isProductionContradictionIngestionEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env[RUN_PRODUCTION_CONTRADICTION_INGESTION_ENV];
  if (typeof raw !== "string") return false;
  const normalised = raw.trim().toLowerCase();
  return normalised === "1" || normalised === "true";
}

function gatedOffResult(): ProductionContradictionIngestionResult {
  return {
    version: CONTRADICTION_PRODUCTION_INGESTION_VERSION,
    gatedOff: true,
    outcome: "gated_off",
    failureCode: null,
    failureMessage: null,
    providerConstructionCount: 0,
    adjudicatorCallCount: 0,
    refereeCallCount: 0,
    totalProviderCalls: 0,
    writerInvoked: false,
    writeExecuted: false,
    contradictionNodeId: null,
    sideASourceSpanId: null,
    sideBSourceSpanId: null,
    contradictionNodeOutcome: null,
    selectedCandidateCount: 0,
    naturalEntry: null,
  };
}

function skippedShortMessageResult(): ProductionContradictionIngestionResult {
  return {
    version: CONTRADICTION_PRODUCTION_INGESTION_VERSION,
    gatedOff: false,
    outcome: "skipped_short_message",
    failureCode: null,
    failureMessage: null,
    providerConstructionCount: 0,
    adjudicatorCallCount: 0,
    refereeCallCount: 0,
    totalProviderCalls: 0,
    writerInvoked: false,
    writeExecuted: false,
    contradictionNodeId: null,
    sideASourceSpanId: null,
    sideBSourceSpanId: null,
    contradictionNodeOutcome: null,
    selectedCandidateCount: 0,
    naturalEntry: null,
  };
}

function failClosedResult(args: {
  failureCode: string;
  failureMessage: string;
  providerConstructionCount?: number;
}): ProductionContradictionIngestionResult {
  return {
    version: CONTRADICTION_PRODUCTION_INGESTION_VERSION,
    gatedOff: false,
    outcome: "failed_safely",
    failureCode: args.failureCode,
    failureMessage: args.failureMessage,
    providerConstructionCount: args.providerConstructionCount ?? 0,
    adjudicatorCallCount: 0,
    refereeCallCount: 0,
    totalProviderCalls: 0,
    writerInvoked: false,
    writeExecuted: false,
    contradictionNodeId: null,
    sideASourceSpanId: null,
    sideBSourceSpanId: null,
    contradictionNodeOutcome: null,
    selectedCandidateCount: 0,
    naturalEntry: null,
  };
}

/**
 * Compact sanitised log payload for message-route background logging.
 * Never includes credentials, raw provider objects, or unsanitised errors.
 */
export function compactProductionIngestionLog(
  result: ProductionContradictionIngestionResult,
): Record<string, string | number | boolean | null> {
  return {
    version: result.version,
    gatedOff: result.gatedOff,
    outcome: result.outcome,
    code: result.failureCode,
    providerConstructionCount: result.providerConstructionCount,
    adjudicatorCalls: result.adjudicatorCallCount,
    refereeCalls: result.refereeCallCount,
    totalProviderCalls: result.totalProviderCalls,
    writerInvoked: result.writerInvoked,
    writeExecuted: result.writeExecuted,
    nodeOutcome: result.contradictionNodeOutcome,
    nodeIdPresent: result.contradictionNodeId != null,
  };
}

async function constructDefaultProductionProviders(
  env: Record<string, string | undefined>,
): Promise<
  | { ok: true; providers: ProductionContradictionIngestionProviders; bundle: ContradictionLiveAdapterBundle }
  | { ok: false; failureCode: string; failureMessage: string }
> {
  if (!openaiApiKeyPresent(env)) {
    return {
      ok: false,
      failureCode: "missing_credential",
      failureMessage:
        "Provider credentials are absent; production contradiction ingestion failed closed.",
    };
  }

  const config = resolveContradictionLiveProviderConfig(env);
  if (!config.ok) {
    return {
      ok: false,
      failureCode: config.errorCode,
      failureMessage:
        "Provider configuration is invalid; production contradiction ingestion failed closed.",
    };
  }

  try {
    const bundle = await createOpenAiContradictionLiveAdapters({
      adjudicatorModelId: config.config.adjudicatorModelId,
      refereeModelId: config.config.refereeModelId,
      timeoutMs: config.config.timeoutMs,
      maxTotalCalls: PRODUCTION_MAX_TOTAL_PROVIDER_CALLS,
    });
    return {
      ok: true,
      providers: {
        modelRunner: bundle.adjudicatorRunner,
        objectivityReferee: bundle.objectivityReferee,
      },
      bundle,
    };
  } catch {
    return {
      ok: false,
      failureCode: "provider_construction_failed",
      failureMessage:
        "Provider construction failed; production contradiction ingestion failed closed.",
    };
  }
}

/**
 * Production ingestion entry for one persisted app message.
 *
 * Inspectable result only — never returns authorised persistence plans.
 */
export async function runProductionContradictionIngestion(
  input: ProductionContradictionIngestionInput,
): Promise<ProductionContradictionIngestionResult> {
  const env = input.env ?? process.env;

  if (!isProductionContradictionIngestionEnabled(env)) {
    return gatedOffResult();
  }

  const content = input.currentMessage.content ?? "";
  if (content.trim().length < MIN_MESSAGE_LENGTH) {
    return skippedShortMessageResult();
  }

  let providerConstructionCount = 0;
  let providers = input.providers;

  if (!providers) {
    if (input.createProviders) {
      providerConstructionCount = 1;
      try {
        providers = await input.createProviders();
      } catch {
        return failClosedResult({
          failureCode: "provider_construction_failed",
          failureMessage:
            "Provider construction failed; production contradiction ingestion failed closed.",
          providerConstructionCount,
        });
      }
    } else {
      providerConstructionCount = 1;
      const constructed = await constructDefaultProductionProviders(env);
      if (!constructed.ok) {
        return failClosedResult({
          failureCode: constructed.failureCode,
          failureMessage: constructed.failureMessage,
          providerConstructionCount,
        });
      }
      providers = constructed.providers;
    }
  }

  let references;
  try {
    references = await input.db.loadSameSessionReferences({
      userId: input.userId,
      sessionId: input.session.id,
    });
  } catch {
    return failClosedResult({
      failureCode: "reference_load_failed",
      failureMessage:
        "Same-session reference load failed; production contradiction ingestion failed closed.",
      providerConstructionCount,
    });
  }

  const naturalEntry = await runContradictionNaturalEntry({
    userId: input.userId,
    sessionId: input.session.id,
    currentMessage: {
      sourceId: `message:${input.currentMessage.id}`,
      sessionId: input.session.id,
      messageId: input.currentMessage.id,
      role: input.currentMessage.role ?? "user",
      sourceText: content,
      label: "side_b_current_message",
    },
    references,
    modelRunner: providers.modelRunner,
    objectivityReferee: providers.objectivityReferee,
    messageResolver: input.db.messageResolver,
    persistenceDb: input.db.persistenceDb,
    maxAdjudicatorCandidates: PRODUCTION_MAX_ADJUDICATOR_CANDIDATES,
    refereeMode: "sole_winner_only",
    now: input.now,
    abortSignal: input.abortSignal,
  });

  const totalProviderCalls =
    naturalEntry.adjudicatorCallCount + naturalEntry.refereeCallCount;

  return {
    version: CONTRADICTION_PRODUCTION_INGESTION_VERSION,
    gatedOff: false,
    outcome: naturalEntry.outcome,
    failureCode: naturalEntry.failureCode,
    failureMessage: naturalEntry.failureMessage
      ? sanitiseFailureMessage(naturalEntry.failureCode, naturalEntry.failureMessage)
      : null,
    providerConstructionCount,
    adjudicatorCallCount: naturalEntry.adjudicatorCallCount,
    refereeCallCount: naturalEntry.refereeCallCount,
    totalProviderCalls,
    writerInvoked: naturalEntry.writerInvoked,
    writeExecuted: naturalEntry.writeExecuted,
    contradictionNodeId: naturalEntry.contradictionNodeId,
    sideASourceSpanId: naturalEntry.sideASourceSpanId,
    sideBSourceSpanId: naturalEntry.sideBSourceSpanId,
    contradictionNodeOutcome: naturalEntry.contradictionNodeOutcome,
    selectedCandidateCount: naturalEntry.selection.eligibleCount,
    naturalEntry,
  };
}

/**
 * Prefer stable failure codes over raw provider/exception text in egress.
 */
function sanitiseFailureMessage(
  code: string | null,
  message: string,
): string {
  if (
    code === "model_failed" ||
    code === "adjudication_failed" ||
    code === "provider_construction_failed" ||
    code === "missing_credential" ||
    code === "invalid_timeout" ||
    code === "invalid_call_budget"
  ) {
    return `Production contradiction ingestion failed closed (${code}).`;
  }
  // Strip credential-shaped substrings if any leaked into a message.
  return message
    .replace(/\b(sk-[A-Za-z0-9_\-]{8,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/g, "[REDACTED]")
    .slice(0, 240);
}
