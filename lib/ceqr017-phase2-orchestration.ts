/**
 * CEQR-017 Phase-2 orchestration (injectable).
 *
 * Sole exported production Phase-2 operation: runCeqr017Phase2Orchestration.
 * Claim capability + post-claim live runner are module-private.
 */

import { closeSync, existsSync, mkdirSync, openSync, writeFileSync } from "fs";
import { join } from "path";

import {
  writeCeqr017AccountGateResult,
  type Ceqr017AccountGateResult,
} from "./ceqr017-readonly-account-gate";
import {
  assertCeqr015FixturesExact,
  assertCeqr017PinnedLiveEnv,
  assertLandedConstantsMatchExpected,
  buildCeqr017LiveExecutionReceiptFromResult,
  buildCeqr017Phase1LiveExecutionReceipt,
  buildCeqr017ProposedPhase2OrchestratorCommand,
  buildCeqr017CaseDiagnosticFromObserver,
  CEQR_017_CAMPAIGN_SLICE,
  CEQR_017_CONTROLLED_CASES,
  CEQR_017_EXPECTED_ADJUDICATOR_MODEL,
  CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS,
  CEQR_017_EXPECTED_MAX_RETRIES,
  CEQR_017_EXPECTED_PROVIDER_ID,
  CEQR_017_EXPECTED_REFEREE_MODEL,
  CEQR_017_EXPECTED_TIMEOUT_MS,
  CEQR_017_SLICE_ID,
  ceqr017LiveResultToExitCode,
  ceqr017Phase2ClaimPath,
  ceqr017ReceiptDir,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  isCeqr017LiveOptedIn,
  proveRawProviderObjectImmutability,
  wrapAdjudicatorRunnerForImmutableCapture,
  type Ceqr017CaseDiagnostic,
  type Ceqr017LiveExecutionReceipt,
  type Ceqr017LiveRunClaim,
  type Ceqr017TransportCapture,
} from "./contradiction-controlled-live-authority-reproof";
import type { ContradictionLiveAdapterBundle } from "./contradiction-live-provider-adapters";
import {
  runContradictionLiveProviderRefereeProof,
  type LiveSyntheticCaseId,
} from "./contradiction-live-provider-referee-proof";

type Ceqr017Phase2LiveRunCapability = {
  readonly __ceqr017Phase2LiveRunCapability: true;
};

const PHASE2_LIVE_CAPABILITIES = new WeakSet<object>();

function mintPhase2LiveRunCapability(): Ceqr017Phase2LiveRunCapability {
  const capability: Ceqr017Phase2LiveRunCapability = {
    __ceqr017Phase2LiveRunCapability: true,
  };
  PHASE2_LIVE_CAPABILITIES.add(capability);
  return capability;
}

function consumePhase2LiveRunCapability(
  capability: Ceqr017Phase2LiveRunCapability,
): boolean {
  if (!PHASE2_LIVE_CAPABILITIES.has(capability)) {
    return false;
  }
  PHASE2_LIVE_CAPABILITIES.delete(capability);
  return true;
}

type ClaimLiveRunResult =
  | {
      ok: true;
      claim: Ceqr017LiveRunClaim;
      capability: Ceqr017Phase2LiveRunCapability;
    }
  | { ok: false; code: "claim_exists" | "io_error"; message: string };

function claimCeqr017Phase2LiveRun(args: {
  claimPath: string;
  now?: () => Date;
}): ClaimLiveRunResult {
  const claim: Ceqr017LiveRunClaim = {
    slice: CEQR_017_SLICE_ID,
    campaignSlice: CEQR_017_CAMPAIGN_SLICE,
    claimedAt: (args.now ?? (() => new Date()))().toISOString(),
    purpose: "exactly_one_phase2_live_provider_run",
    providerId: CEQR_017_EXPECTED_PROVIDER_ID,
    adjudicatorModelId: CEQR_017_EXPECTED_ADJUDICATOR_MODEL,
    refereeModelId: CEQR_017_EXPECTED_REFEREE_MODEL,
    timeoutMs: CEQR_017_EXPECTED_TIMEOUT_MS,
    maxTotalCalls: CEQR_017_EXPECTED_MAX_PROVIDER_ATTEMPTS,
    maxRetries: CEQR_017_EXPECTED_MAX_RETRIES,
    neverAutoDelete: true,
  };
  try {
    const fd = openSync(args.claimPath, "wx");
    try {
      writeFileSync(fd, `${JSON.stringify(claim, null, 2)}\n`, "utf8");
    } finally {
      closeSync(fd);
    }
    return { ok: true, claim, capability: mintPhase2LiveRunCapability() };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return {
        ok: false,
        code: "claim_exists",
        message: `CEQR-017 Phase-2 live-run claim already exists at ${args.claimPath}`,
      };
    }
    return {
      ok: false,
      code: "io_error",
      message: error instanceof Error ? error.message : "claim write failed",
    };
  }
}

async function runCeqr017LiveWithPhase2Capability(args: {
  capability: Ceqr017Phase2LiveRunCapability;
  env: Record<string, string | undefined>;
  createAdapters?: (config: {
    adjudicatorModelId: string;
    refereeModelId: string;
    timeoutMs: number;
    maxTotalCalls: number;
  }) => Promise<ContradictionLiveAdapterBundle>;
}): Promise<Ceqr017LiveExecutionReceipt> {
  if (!consumePhase2LiveRunCapability(args.capability)) {
    throw new Error(
      "CEQR-017 live runner requires a valid one-shot Phase-2 claim capability.",
    );
  }

  const fixtures = assertCeqr015FixturesExact(CEQR_017_CONTROLLED_CASES);
  if (!fixtures.ok) {
    throw new Error(
      `CEQR-017 fixture contract broken: ${JSON.stringify(fixtures.differences)}`,
    );
  }
  const landed = assertLandedConstantsMatchExpected();
  if (!landed.ok) {
    throw new Error(
      `CEQR-017 landed constants mismatch: ${landed.mismatches.join(",")}`,
    );
  }
  if (!isCeqr017LiveOptedIn(args.env)) {
    return buildCeqr017Phase1LiveExecutionReceipt();
  }
  const pin = assertCeqr017PinnedLiveEnv(args.env);
  if (!pin.ok) {
    return {
      ...buildCeqr017Phase1LiveExecutionReceipt(),
      classification: "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH",
      notes: [
        `Pinned runtime preflight failed: ${pin.message}`,
        "No provider calls were made.",
      ],
    };
  }

  const diagnostics: Ceqr017CaseDiagnostic[] = [];
  const capture = new Map<string, Ceqr017TransportCapture>();
  let currentCaseId: LiveSyntheticCaseId = "clear_contradiction_candidate";

  const result = await runContradictionLiveProviderRefereeProof({
    env: args.env,
    cases: CEQR_017_CONTROLLED_CASES,
    createAdapters: args.createAdapters,
    instrumentAdapters: (adapters) => ({
      ...adapters,
      adjudicatorRunner: wrapAdjudicatorRunnerForImmutableCapture(
        adapters.adjudicatorRunner,
        capture,
        () => currentCaseId,
      ),
    }),
    beforeCase: (synthetic) => {
      currentCaseId = synthetic.id;
    },
    caseObserver: {
      afterCase(event) {
        const captured = capture.get(event.synthetic.id);
        const rawUnchanged = proveRawProviderObjectImmutability(captured);
        const sideASourceId =
          event.references?.[0] != null
            ? `reference:live-ref-${event.synthetic.id}:message:live-msg-a-${event.synthetic.id}`
            : null;
        const sideBSourceId = event.currentMessage
          ? `message:${event.currentMessage.messageId}`
          : null;
        const node = event.harnessNodes.find(
          (n) => n.id === event.caseReceipt.contradictionNodeId,
        );
        const spanA = node
          ? event.harnessSpans.find((s) => s.id === node.sideASourceSpanId) ??
            null
          : null;
        const spanB = node
          ? event.harnessSpans.find((s) => s.id === node.sideBSourceSpanId) ??
            null
          : null;

        diagnostics.push(
          buildCeqr017CaseDiagnosticFromObserver({
            caseId: event.synthetic.id,
            liveResult: null,
            caseReceipt: event.caseReceipt,
            authoritativeSideASourceId: sideASourceId,
            authoritativeSideBSourceId: sideBSourceId,
            sideASourceTextLength: event.synthetic.sideAText.length,
            sideBSourceTextLength: event.synthetic.sideBText.length,
            capturedTransport: captured?.snapshot ?? null,
            rawUnchanged,
            injectedSideASpan: spanA,
            injectedSideBSpan: spanB,
            injectedNode: node ?? null,
            naturalEntryResult: event.result,
          }),
        );
      },
    },
  });

  const executed = result.ran ? result : null;
  const enriched = diagnostics.map((d) => ({
    ...d,
    providerId: executed?.providerId ?? d.providerId,
    adjudicatorModelId: executed?.adjudicatorModelId ?? d.adjudicatorModelId,
    refereeModelId: executed?.refereeModelId ?? d.refereeModelId,
    liveAddendumVersion:
      executed?.adjudicatorPromptAddendumVersion ?? d.liveAddendumVersion,
  }));

  return buildCeqr017LiveExecutionReceiptFromResult({
    result,
    caseDiagnostics: enriched,
  });
}

export type Ceqr017Phase2OrchestrationDeps = {
  env?: Record<string, string | undefined>;
  receiptDir?: string;
  now?: () => Date;
  isOptedIn?: (env: Record<string, string | undefined>) => boolean;
  assertPinnedEnv?: typeof assertCeqr017PinnedLiveEnv;
  claimExists?: (claimPath: string) => boolean;
  /**
   * Test seam for concurrency only. Must not mint real capabilities outside
   * this module's private claim implementation when omitted.
   */
  claimLiveRun?: (args: {
    claimPath: string;
    now?: () => Date;
  }) => ClaimLiveRunResult;
  runAccountGate?: (args: {
    label: "before" | "after";
    receiptDir: string;
    write: boolean;
  }) => Promise<Ceqr017AccountGateResult>;
  writeAccountGateResult?: (args: {
    result: Ceqr017AccountGateResult;
    receiptDir: string;
  }) => void;
  /**
   * Test seam: replace post-claim live execution. Production path uses the
   * private capability-gated runner and never exports it.
   */
  runLiveAfterClaim?: (args: {
    env: Record<string, string | undefined>;
  }) => Promise<Ceqr017LiveExecutionReceipt>;
  createAdapters?: (config: {
    adjudicatorModelId: string;
    refereeModelId: string;
    timeoutMs: number;
    maxTotalCalls: number;
  }) => Promise<ContradictionLiveAdapterBundle>;
  writeFile?: (path: string, contents: string) => void;
  disconnect?: () => Promise<void>;
  allowTestReceiptDir?: boolean;
};

export type Ceqr017Phase2OrchestrationResult = {
  receipt: Ceqr017LiveExecutionReceipt;
  exitCode: number;
  liveRunnerInvoked: boolean;
  liveRunnerInvocationCount: number;
  claimCreated: boolean;
  claimPath: string;
  beforeAccountGateExecuted: boolean;
  afterAccountGateExecuted: boolean;
  finalReceiptWritten: boolean;
};

function sanitisedTerminalFailure(args: {
  base?: Ceqr017LiveExecutionReceipt | null;
  accountGateError: string | null;
  beforeMatched: boolean | null;
  afterMatched: boolean | null;
  aggregatesUnchanged: boolean | null;
  beforeExecuted: boolean;
  afterExecuted: boolean;
  claimCreated: boolean;
  claimPath: string;
  liveRunnerInvoked: boolean;
  liveRunnerInvocationCount: number;
}): Ceqr017LiveExecutionReceipt {
  const base = args.base ?? buildCeqr017Phase1LiveExecutionReceipt();
  return {
    ...base,
    phase: "phase2_live",
    classification: "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH",
    beforeAccountGateExecuted: args.beforeExecuted,
    beforeAccountGateMatched: args.beforeMatched,
    afterAccountGateExecuted: args.afterExecuted,
    afterAccountGateMatched: args.afterMatched,
    accountAggregatesUnchanged: args.aggregatesUnchanged,
    accountGateError: args.accountGateError,
    claimCreated: args.claimCreated,
    claimPath: args.claimPath,
    liveRunnerInvoked: args.liveRunnerInvoked,
    liveRunnerInvocationCount: args.liveRunnerInvocationCount,
    notes: [
      ...base.notes,
      "Terminal orchestration failure.",
      args.accountGateError ?? "Account gate mismatch or unsafe mutation.",
    ],
  };
}

/**
 * Injectable Phase-2 orchestration. Only exported production Phase-2 entry.
 */
export async function runCeqr017Phase2Orchestration(
  deps: Ceqr017Phase2OrchestrationDeps = {},
): Promise<Ceqr017Phase2OrchestrationResult> {
  const env = deps.env ?? process.env;
  const receiptDir = deps.receiptDir ?? ceqr017ReceiptDir();
  const claimPath = ceqr017Phase2ClaimPath(receiptDir);
  const outPath = join(receiptDir, "live-execution-receipt.json");
  const writeFile = deps.writeFile ?? writeFileSync;
  const isOptedIn = deps.isOptedIn ?? isCeqr017LiveOptedIn;
  const assertPinned = deps.assertPinnedEnv ?? assertCeqr017PinnedLiveEnv;
  const claimExists =
    deps.claimExists ?? ((path: string) => existsSync(path));
  const claimFn = deps.claimLiveRun ?? claimCeqr017Phase2LiveRun;
  const allowTestReceiptDir = deps.allowTestReceiptDir === true;
  const persistGate =
    deps.writeAccountGateResult ??
    ((args: { result: Ceqr017AccountGateResult; receiptDir: string }) => {
      writeCeqr017AccountGateResult({
        ...args,
        allowTestReceiptDir,
      });
    });

  let beforeAccountGateExecuted = false;
  let afterAccountGateExecuted = false;
  let beforeMatched: boolean | null = null;
  let afterMatched: boolean | null = null;
  let aggregatesUnchanged: boolean | null = null;
  let accountGateError: string | null = null;
  let claimCreated = false;
  let liveRunnerInvoked = false;
  let liveRunnerInvocationCount = 0;
  let provisional: Ceqr017LiveExecutionReceipt | null = null;
  let terminalReceipt: Ceqr017LiveExecutionReceipt | null = null;
  let terminalExitCode = 5;
  let shouldRunAfterGate = false;
  let shouldWriteFinalReceipt = false;
  let before: Ceqr017AccountGateResult | null = null;
  let after: Ceqr017AccountGateResult | null = null;

  const finish = (
    receipt: Ceqr017LiveExecutionReceipt,
    exitCode: number,
    written: boolean,
  ): Ceqr017Phase2OrchestrationResult => ({
    receipt,
    exitCode,
    liveRunnerInvoked,
    liveRunnerInvocationCount,
    claimCreated,
    claimPath,
    beforeAccountGateExecuted,
    afterAccountGateExecuted,
    finalReceiptWritten: written,
  });

  if (!isOptedIn(env)) {
    const skipped = {
      ...buildCeqr017Phase1LiveExecutionReceipt(),
      notes: [
        ...buildCeqr017Phase1LiveExecutionReceipt().notes,
        `${CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV} not set — no provider calls.`,
      ],
    };
    if (claimExists(claimPath)) {
      return finish(skipped, 3, false);
    }
    writeFile(outPath, `${JSON.stringify(skipped, null, 2)}\n`);
    return finish(skipped, 3, true);
  }

  if (claimExists(claimPath)) {
    const blocked = {
      ...buildCeqr017Phase1LiveExecutionReceipt(),
      classification: "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH" as const,
      notes: [
        `Phase-2 claim already exists at ${claimPath}`,
        "No account queries, provider construction, or receipt overwrites performed.",
        "Original claim and receipts left untouched.",
      ],
    };
    return finish(blocked, 5, false);
  }

  const pin = assertPinned(env);
  if (!pin.ok) {
    const failed = {
      ...buildCeqr017Phase1LiveExecutionReceipt(),
      classification: "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH" as const,
      notes: [`Pinned runtime preflight failed: ${pin.message}`],
    };
    writeFile(outPath, `${JSON.stringify(failed, null, 2)}\n`);
    return finish(failed, 5, true);
  }

  if (!existsSync(receiptDir)) {
    mkdirSync(receiptDir, { recursive: true });
  }

  if (!deps.runAccountGate) {
    throw new Error(
      "CEQR-017 Phase-2 orchestration requires an injected runAccountGate dependency.",
    );
  }

  try {
    before = await deps.runAccountGate({
      label: "before",
      receiptDir,
      write: false,
    });
    beforeAccountGateExecuted = true;
    beforeMatched = before.matchesExpected;

    if (!before.matchesExpected) {
      accountGateError = "before-account gate mismatch";
      terminalReceipt = sanitisedTerminalFailure({
        accountGateError,
        beforeMatched,
        afterMatched: null,
        aggregatesUnchanged: null,
        beforeExecuted: true,
        afterExecuted: false,
        claimCreated: false,
        claimPath,
        liveRunnerInvoked: false,
        liveRunnerInvocationCount: 0,
      });
      terminalExitCode = 5;
      shouldRunAfterGate = false;
      shouldWriteFinalReceipt = true;
    } else {
      const claim = claimFn({
        claimPath,
        now: deps.now,
      });

      if (!claim.ok) {
        accountGateError = claim.message;
        terminalReceipt = sanitisedTerminalFailure({
          accountGateError,
          beforeMatched,
          afterMatched: null,
          aggregatesUnchanged: null,
          beforeExecuted: true,
          afterExecuted: false,
          claimCreated: false,
          claimPath,
          liveRunnerInvoked: false,
          liveRunnerInvocationCount: 0,
        });
        terminalExitCode = 5;
        shouldRunAfterGate = false;
        // Claim loser: no permanent writes.
        shouldWriteFinalReceipt = false;
      } else {
        claimCreated = true;
        persistGate({
          result: { ...before, label: "before" },
          receiptDir,
        });

        try {
          liveRunnerInvoked = true;
          liveRunnerInvocationCount = 1;
          if (deps.runLiveAfterClaim) {
            provisional = await deps.runLiveAfterClaim({ env });
          } else {
            provisional = await runCeqr017LiveWithPhase2Capability({
              capability: claim.capability,
              env,
              createAdapters: deps.createAdapters,
            });
          }
        } catch (error) {
          provisional = sanitisedTerminalFailure({
            accountGateError:
              error instanceof Error ? error.message : "live runner threw",
            beforeMatched,
            afterMatched: null,
            aggregatesUnchanged: null,
            beforeExecuted: true,
            afterExecuted: false,
            claimCreated: true,
            claimPath,
            liveRunnerInvoked: true,
            liveRunnerInvocationCount: 1,
          });
        }

        shouldRunAfterGate = true;
        shouldWriteFinalReceipt = true;
      }
    }
  } finally {
    if (shouldRunAfterGate) {
      try {
        after = await deps.runAccountGate!({
          label: "after",
          receiptDir,
          write: true,
        });
        afterAccountGateExecuted = true;
        afterMatched = after.matchesExpected;
        if (before) {
          aggregatesUnchanged =
            JSON.stringify(before.observed) === JSON.stringify(after.observed);
        }
        if (!after.matchesExpected || aggregatesUnchanged === false) {
          accountGateError =
            accountGateError ??
            "after-account gate mismatch or aggregates changed";
        }
      } catch (error) {
        afterAccountGateExecuted = true;
        afterMatched = false;
        aggregatesUnchanged = false;
        accountGateError =
          error instanceof Error
            ? error.message
            : "after-account gate exception";
      }
    }
    if (deps.disconnect) {
      await deps.disconnect();
    }
  }

  const afterGateUnsafe =
    accountGateError != null ||
    afterMatched === false ||
    aggregatesUnchanged === false;

  if (terminalReceipt == null) {
    if (afterGateUnsafe) {
      terminalReceipt = sanitisedTerminalFailure({
        base: provisional,
        accountGateError: accountGateError ?? "after-account gate failed",
        beforeMatched,
        afterMatched,
        aggregatesUnchanged,
        beforeExecuted: beforeAccountGateExecuted,
        afterExecuted: afterAccountGateExecuted,
        claimCreated,
        claimPath,
        liveRunnerInvoked,
        liveRunnerInvocationCount,
      });
      terminalExitCode = 5;
    } else if (provisional == null) {
      terminalReceipt = sanitisedTerminalFailure({
        accountGateError: "live result missing after orchestration",
        beforeMatched,
        afterMatched,
        aggregatesUnchanged,
        beforeExecuted: beforeAccountGateExecuted,
        afterExecuted: afterAccountGateExecuted,
        claimCreated,
        claimPath,
        liveRunnerInvoked,
        liveRunnerInvocationCount,
      });
      terminalExitCode = 5;
    } else {
      terminalReceipt = provisional;
      terminalExitCode = ceqr017LiveResultToExitCode(provisional);
    }
  } else if (afterGateUnsafe && shouldRunAfterGate) {
    terminalReceipt = sanitisedTerminalFailure({
      base: terminalReceipt,
      accountGateError: accountGateError ?? "after-account gate failed",
      beforeMatched,
      afterMatched,
      aggregatesUnchanged,
      beforeExecuted: beforeAccountGateExecuted,
      afterExecuted: afterAccountGateExecuted,
      claimCreated,
      claimPath,
      liveRunnerInvoked,
      liveRunnerInvocationCount,
    });
    terminalExitCode = 5;
  }

  const finalReceipt: Ceqr017LiveExecutionReceipt = {
    ...terminalReceipt,
    beforeAccountGateExecuted,
    beforeAccountGateMatched: beforeMatched,
    afterAccountGateExecuted,
    afterAccountGateMatched: afterMatched,
    accountAggregatesUnchanged: aggregatesUnchanged,
    accountGateError,
    claimCreated,
    claimPath,
    liveRunnerInvoked,
    liveRunnerInvocationCount,
    classification:
      terminalExitCode === 5
        ? "FAIL_UNSAFE_MUTATION_OR_BUDGET_BREACH"
        : terminalReceipt.classification,
  };

  if (shouldWriteFinalReceipt) {
    writeFile(outPath, `${JSON.stringify(finalReceipt, null, 2)}\n`);
  }

  return finish(finalReceipt, terminalExitCode, shouldWriteFinalReceipt);
}

export function buildCeqr017LegacyCliHardStopMessage(): string {
  return [
    "CEQR-017 direct live CLI is disabled.",
    "Phase 2 must use the orchestrator only:",
    buildCeqr017ProposedPhase2OrchestratorCommand(),
    "This entry performs zero provider construction, account queries, claim writes, or receipt overwrites.",
  ].join("\n");
}
