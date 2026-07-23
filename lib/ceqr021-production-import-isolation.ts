/**
 * CEQR-021 — production import isolation for the controlled-live harness.
 */

import { existsSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

export const CEQR_021_HARNESS_MODULE_BASENAME =
  "contradiction-schema-v4-controlled-live-proof" as const;

export const CEQR_021_RUNNER_SCRIPT_BASENAME =
  "run-contradiction-schema-v4-controlled-live-proof" as const;

export const CEQR_021_PRODUCTION_SCAN_ROOTS = [
  "app",
  "components",
  "hooks",
  "middleware.ts",
] as const;

const EXCLUDE_GLOBS = [
  "!**/__tests__/**",
  "!**/node_modules/**",
  "!**/docs/agent-runs/receipts/**",
];

export type Ceqr021ImportIsolationScanResult =
  | { status: "clean" }
  | { status: "matches"; paths: string[] }
  | { status: "error"; message: string; exitStatus: number | null };

export function scanProductionRootsForCeqr021Needle(args: {
  cwd: string;
  needle: string;
  roots?: readonly string[];
}): Ceqr021ImportIsolationScanResult {
  const requested = args.roots ?? CEQR_021_PRODUCTION_SCAN_ROOTS;
  const roots = requested.filter((root) => {
    const absolute = root.startsWith("/") ? root : join(args.cwd, root);
    return existsSync(absolute);
  });
  if (roots.length === 0) {
    return {
      status: "error",
      message: "No production scan roots exist.",
      exitStatus: null,
    };
  }

  const result = spawnSync(
    "rg",
    [
      "-l",
      "--glob",
      "*.{ts,tsx,js,jsx,mjs,cjs}",
      ...EXCLUDE_GLOBS.flatMap((g) => ["--glob", g]),
      args.needle,
      ...roots,
    ],
    { cwd: args.cwd, encoding: "utf8" },
  );

  if (result.error) {
    return {
      status: "error",
      message: `rg executable error: ${result.error.message}`,
      exitStatus: null,
    };
  }
  if (result.status === 0) {
    const paths = (result.stdout ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return { status: "matches", paths };
  }
  if (result.status === 1) return { status: "clean" };
  return {
    status: "error",
    message: `rg failed with status ${String(result.status)}: ${result.stderr ?? ""}`,
    exitStatus: result.status,
  };
}

export function proveCeqr021IsolationScannerDetectsInjectedImport(args: {
  cwd: string;
}): Ceqr021ImportIsolationScanResult & { probeDir: string } {
  const probeDir = mkdtempSync(join(tmpdir(), "ceqr021-import-probe-"));
  const probeFile = join(probeDir, "leaky-import.ts");
  writeFileSync(
    probeFile,
    `import { CEQR_021_SLICE_ID } from "${args.cwd}/lib/${CEQR_021_HARNESS_MODULE_BASENAME}";\n`,
    "utf8",
  );
  const scan = scanProductionRootsForCeqr021Needle({
    cwd: args.cwd,
    needle: CEQR_021_HARNESS_MODULE_BASENAME,
    roots: [probeDir],
  });
  return { ...scan, probeDir };
}

export function cleanupCeqr021ImportProbeDir(probeDir: string): void {
  rmSync(probeDir, { recursive: true, force: true });
}
