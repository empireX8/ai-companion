/**
 * CEQR-011 — explicit opt-in live contradiction provider + referee proof.
 *
 * Does not run during unit tests, build, or ordinary app startup.
 *
 * Usage:
 *   set -a && source /Users/user/ai-companion/.env && set +a
 *   RUN_LIVE_CONTRADICTION_PROVIDER_PROOF=1 \
 *     npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
 *     scripts/run-contradiction-live-provider-referee-proof.ts
 */

import { writeFileSync } from "fs";
import { join } from "path";

import {
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  isLiveContradictionProviderProofOptedIn,
} from "../lib/contradiction-live-provider-adapters";
import {
  liveProofResultToExitCode,
  runContradictionLiveProviderRefereeProof,
  type LiveProofResult,
} from "../lib/contradiction-live-provider-referee-proof";

function receiptDir(): string {
  return join(
    process.cwd(),
    "docs/agent-runs/receipts/CONTRADICTION-LIVE-PROVIDER-REFEREE-EXECUTION-001",
  );
}

async function main(): Promise<void> {
  if (!isLiveContradictionProviderProofOptedIn()) {
    const skipped = {
      ran: false as const,
      reason: "opt_in_missing" as const,
      message: `${CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV} must be set to 1 or true.`,
      optInEnv: CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
    };
    console.log(JSON.stringify(skipped, null, 2));
    process.exitCode = liveProofResultToExitCode(skipped);
    return;
  }

  const result: LiveProofResult =
    await runContradictionLiveProviderRefereeProof();

  const outPath = join(receiptDir(), "live-execution-receipt.json");
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log(`Wrote ${outPath}`);

  process.exitCode = liveProofResultToExitCode(result);
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Live proof script failed",
  );
  process.exitCode = 1;
});
