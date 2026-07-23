/**
 * Child-process race worker for CEQR-021 one-shot lock consumption.
 * Invoked only from offline vitest. Never touches canonical receipt paths.
 *
 * Args:
 *   --receiptDir=...
 *   --claimPath=...
 *   --frozenPlanSha256=...
 *   --committedExecutionHead=...
 *   --markerDir=...
 *   --workerId=...
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { acquireCeqr021ExecutionLockAndConsumeClaim } from "../../ceqr021-oneshot-safety";

function arg(name: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) {
    throw new Error(`Missing ${prefix}`);
  }
  return hit.slice(prefix.length);
}

async function main(): Promise<void> {
  const receiptDir = arg("receiptDir");
  const claimPath = arg("claimPath");
  const frozenPlanSha256 = arg("frozenPlanSha256");
  const committedExecutionHead = arg("committedExecutionHead");
  const markerDir = arg("markerDir");
  const workerId = arg("workerId");

  if (!existsSync(markerDir)) {
    mkdirSync(markerDir, { recursive: true });
  }

  const locked = acquireCeqr021ExecutionLockAndConsumeClaim({
    receiptDir,
    claimPath,
    frozenPlanSha256,
    committedExecutionHead,
  });

  if (!locked.ok) {
    writeFileSync(
      join(markerDir, `${workerId}.result.json`),
      `${JSON.stringify(
        {
          workerId,
          consumptionOk: false,
          providerConstructed: false,
          code: locked.code,
          message: locked.message,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    process.stdout.write(
      JSON.stringify({
        workerId,
        consumptionOk: false,
        providerConstructed: false,
        code: locked.code,
        message: locked.message,
      }),
    );
    return;
  }

  // Winner only: simulate provider factory invocation.
  writeFileSync(
    join(markerDir, `${workerId}.provider-constructed`),
    "1\n",
    "utf8",
  );
  writeFileSync(
    join(markerDir, `${workerId}.result.json`),
    `${JSON.stringify(
      {
        workerId,
        consumptionOk: true,
        providerConstructed: true,
        lockPath: locked.lockPath,
        consumedAt: locked.claim.consumedAt,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write(
    JSON.stringify({
      workerId,
      consumptionOk: true,
      providerConstructed: true,
      lockPath: locked.lockPath,
      consumedAt: locked.claim.consumedAt,
    }),
  );
}

main().catch((error) => {
  process.stderr.write(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
