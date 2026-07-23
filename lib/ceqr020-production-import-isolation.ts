/**
 * CEQR-020 — production import isolation for the offline forensic helper.
 *
 * Must not be used as a production feature surface. Exists so the isolation
 * gate can distinguish tool failure from a clean scan.
 */

import { existsSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

export const CEQR_020_FORENSIC_MODULE_BASENAME =
  "ceqr020-offset-forensics" as const;

/** Production surfaces scanned for accidental forensic-helper imports. */
export const CEQR_020_PRODUCTION_SCAN_ROOTS = [
  "app",
  "components",
  "hooks",
  "lib",
  "middleware.ts",
  "scripts",
  "types",
] as const;

const EXCLUDE_GLOBS = [
  // Tests / fixtures / receipts / the forensic helper itself.
  "!**/__tests__/**",
  "!**/node_modules/**",
  "!**/docs/agent-runs/receipts/**",
  "!**/ceqr020-offset-forensics.ts",
  "!**/ceqr020-production-import-isolation.ts",
  "!**/contradiction-live-evidence-offset-forensic-repair.test.ts",
];

export type ImportIsolationScanResult =
  | { status: "clean" }
  | { status: "matches"; paths: string[] }
  | { status: "error"; message: string; exitStatus: number | null };

/**
 * Scan production roots for a forbidden import needle using ripgrep.
 * Distinguishes clean (exit 1), matches (exit 0), and tool errors (other).
 */
export function scanProductionRootsForImportNeedle(args: {
  cwd: string;
  needle: string;
  roots?: readonly string[];
}): ImportIsolationScanResult {
  const requested = args.roots ?? CEQR_020_PRODUCTION_SCAN_ROOTS;
  const roots = requested.filter((root) => {
    const absolute = root.startsWith("/") ? root : join(args.cwd, root);
    return existsSync(absolute);
  });
  if (roots.length === 0) {
    return {
      status: "error",
      message:
        "No production scan roots exist; repository structure unexpected.",
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
    {
      cwd: args.cwd,
      encoding: "utf8",
    },
  );

  if (result.error) {
    return {
      status: "error",
      message: `rg executable error: ${result.error.message}`,
      exitStatus: null,
    };
  }

  const status = result.status;
  if (status === 0) {
    const paths = (result.stdout ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return { status: "matches", paths };
  }
  if (status === 1) {
    return { status: "clean" };
  }
  return {
    status: "error",
    message: `rg failed with status ${String(status)}: ${result.stderr ?? ""}`,
    exitStatus: status,
  };
}

/**
 * Deterministic probe: write a temp file that imports the forensic module and
 * prove the scanner reports matches (so a real leak would fail the gate).
 */
export function proveIsolationScannerDetectsInjectedImport(args: {
  cwd: string;
}): ImportIsolationScanResult & { probeDir: string } {
  const probeDir = mkdtempSync(join(tmpdir(), "ceqr020-import-probe-"));
  const probeFile = join(probeDir, "leaky-import.ts");
  writeFileSync(
    probeFile,
    `import { CEQR_020_SLICE_ID } from "${args.cwd}/lib/${CEQR_020_FORENSIC_MODULE_BASENAME}";\n`,
    "utf8",
  );
  const scan = scanProductionRootsForImportNeedle({
    cwd: args.cwd,
    needle: CEQR_020_FORENSIC_MODULE_BASENAME,
    roots: [probeDir],
  });
  return { ...scan, probeDir };
}

export function cleanupImportProbeDir(probeDir: string): void {
  rmSync(probeDir, { recursive: true, force: true });
}
