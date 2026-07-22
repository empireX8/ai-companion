/**
 * CEQR-017 legacy CLI — unconditional hard-stop.
 *
 * Must never invoke a live provider, query accounts, write claims, or overwrite
 * receipts. The only executable capable of the CEQR-017 provider run is:
 *   scripts/run-ceqr017-phase2-orchestrator.ts
 */

import { buildCeqr017LegacyCliHardStopMessage } from "../lib/ceqr017-phase2-orchestration";

function main(): void {
  console.error(buildCeqr017LegacyCliHardStopMessage());
  process.exitCode = 2;
}

main();
