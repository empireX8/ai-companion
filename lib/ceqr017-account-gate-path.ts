/**
 * Shared CEQR-017 account-gate path validation.
 * Production: exact realpath. Tests: explicit allowTestReceiptDir + real basename.
 */

import { existsSync, lstatSync, realpathSync } from "fs";
import { basename, join, resolve, sep } from "path";

/** Keep literal to avoid import cycles with the main CEQR-017 module. */
export const CEQR_017_RECEIPT_DIR_BASENAME =
  "CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001" as const;

export const CEQR_017_PRODUCTION_ACCOUNT_GATE_RECEIPT_DIR =
  "/Users/user/ai-companion-worktrees/desktop-contradiction-controlled-live-authority-reproof-001/docs/agent-runs/receipts/CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001" as const;

export const CEQR_017_ACCOUNT_GATE_BEFORE_FILENAME =
  "account-gate-before.json" as const;
export const CEQR_017_ACCOUNT_GATE_AFTER_FILENAME =
  "account-gate-after.json" as const;

function realPathOrResolve(dir: string): string {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) {
    return resolved;
  }
  // Reject symlink-named slice dirs that escape via realpath basename mismatch.
  return realpathSync.native ? realpathSync.native(resolved) : realpathSync(resolved);
}

export function assertCeqr017AccountGateWriteTarget(args: {
  receiptDir: string;
  label: "before" | "after";
  /** Test-only: permit temporary dirs whose real basename equals the slice ID. */
  allowTestReceiptDir?: boolean;
}): { resolvedDir: string; outPath: string; filename: string } {
  const resolvedInput = resolve(args.receiptDir);
  if (existsSync(resolvedInput) && lstatSync(resolvedInput).isSymbolicLink()) {
    // Still resolve through realpath below; basename of real target must match.
  }

  const resolvedDir = realPathOrResolve(args.receiptDir);

  if (args.allowTestReceiptDir === true) {
    if (basename(resolvedDir) !== CEQR_017_RECEIPT_DIR_BASENAME) {
      throw new Error(
        "CEQR-017 account gate refuses to write outside its receipt directory.",
      );
    }
  } else {
    const productionReal = realPathOrResolve(
      CEQR_017_PRODUCTION_ACCOUNT_GATE_RECEIPT_DIR,
    );
    if (resolvedDir !== productionReal) {
      throw new Error(
        "CEQR-017 account gate refuses to write outside the exact production receipt directory.",
      );
    }
  }

  if (resolvedDir.includes(`${sep}..${sep}`) || resolvedDir.endsWith(`${sep}..`)) {
    throw new Error(
      "CEQR-017 account gate refuses path traversal in receipt directory.",
    );
  }

  const filename =
    args.label === "before"
      ? CEQR_017_ACCOUNT_GATE_BEFORE_FILENAME
      : CEQR_017_ACCOUNT_GATE_AFTER_FILENAME;
  const outPath = join(resolvedDir, filename);
  if (basename(outPath) !== filename) {
    throw new Error("CEQR-017 account gate filename must be exact.");
  }
  if (!outPath.startsWith(resolvedDir + sep)) {
    throw new Error("CEQR-017 account gate path escaped receipt directory.");
  }
  return { resolvedDir, outPath, filename };
}
