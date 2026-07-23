/**
 * CEQR-019 controlled live semantic reproof entry.
 *
 * Requires BOTH:
 *   CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED=YES
 *   RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1|true
 *
 * Ordinary vitest discovery must never execute this path.
 * Do not run during offline preparation.
 *
 * Uses only the production orchestration entry (canonical receipt dir + cwd).
 * Test-only orchestration is not reachable from this script.
 */

import {
  CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV,
  CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE,
  assertCeqr019LiveGuards,
  assertCeqr019ProductionLivePaths,
  buildCeqr019FrozenLivePlan,
  runCeqr019ControlledLiveSemanticReproof,
  serializeCeqr019FrozenLivePlan,
} from "../lib/contradiction-controlled-live-semantic-reproof";

async function main(): Promise<void> {
  const pathGate = assertCeqr019ProductionLivePaths();
  if (!pathGate.ok) {
    console.error(pathGate.message);
    console.error("No provider calls were made.");
    process.exitCode = 5;
    return;
  }

  const guards = assertCeqr019LiveGuards(process.env);
  if (!guards.ok) {
    console.error(guards.message);
    console.error(
      `Required: ${CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_ENV}=${CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED_VALUE}`,
    );
    console.error("No provider calls were made.");
    process.exitCode = 3;
    return;
  }

  const plan = buildCeqr019FrozenLivePlan();
  console.log("--- CEQR-019 FROZEN LIVE PLAN ---");
  console.log(serializeCeqr019FrozenLivePlan(plan));
  console.log("--- END FROZEN LIVE PLAN ---");

  const result = await runCeqr019ControlledLiveSemanticReproof({
    env: process.env,
    writeReceipts: true,
  });

  console.log(JSON.stringify(result.receipt, null, 2));
  console.log(
    JSON.stringify(
      {
        providerCalls: result.providerCalls,
        providerConstructionAttempted: result.providerConstructionAttempted,
        claimCreated: result.claimCreated,
        liveRunnerInvoked: result.liveRunnerInvoked,
        boundaryCounters: result.boundaryCounters,
        exitCode: result.exitCode,
      },
      null,
      2,
    ),
  );
  process.exitCode = result.exitCode;
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "CEQR-019 controlled live semantic reproof failed",
  );
  process.exitCode = 1;
});
