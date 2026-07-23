/**
 * CEQR-021 controlled live schema-v4 proof entry.
 *
 * Requires BOTH:
 *   ORVEK_CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF=ALLOW_SCHEMA_V4_CONTROLLED_LIVE_PROOF
 *   ORVEK_CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT=CONFIRM_SYNTHETIC_ONLY_ONE_SHOT
 *
 * Offline preparation does not arm the claim or execute a provider.
 * This script refuses to construct a provider until a separately authorised
 * armed claim and freeze exist.
 */

import {
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV,
  CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV,
  CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE,
  assertCeqr021LiveGuards,
  assertCeqr021ProductionLivePaths,
  buildCeqr021PreLivePlanTemplate,
  runCeqr021ControlledLiveSchemaV4Proof,
} from "../lib/contradiction-schema-v4-controlled-live-proof";

async function main(): Promise<void> {
  const paths = assertCeqr021ProductionLivePaths();
  if (!paths.ok) {
    console.error(paths.message);
    process.exitCode = 3;
    return;
  }

  const guards = assertCeqr021LiveGuards(process.env);
  if (!guards.ok) {
    console.error(guards.message);
    console.error(
      `Required: ${CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_ENV}=${CEQR021_ALLOW_CONTROLLED_LIVE_SCHEMA_V4_PROOF_VALUE}`,
    );
    console.error(
      `Required: ${CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_ENV}=${CEQR021_CONFIRM_SYNTHETIC_ONLY_ONE_SHOT_VALUE}`,
    );
    process.exitCode = 3;
    return;
  }

  console.log("--- CEQR-021 PRE-LIVE PLAN TEMPLATE (not final frozen plan) ---");
  console.log(JSON.stringify(buildCeqr021PreLivePlanTemplate(), null, 2));

  const result = await runCeqr021ControlledLiveSchemaV4Proof({
    cwd: process.cwd(),
    env: process.env,
  });

  console.log("--- CEQR-021 RESULT ---");
  console.log(JSON.stringify(result, null, 2));
  console.log("CEQR-021 live provider attempts remain gated; production readiness: NO");
  process.exitCode = result.exitCode;
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "CEQR-021 controlled live schema-v4 proof failed",
  );
  process.exitCode = 5;
});
