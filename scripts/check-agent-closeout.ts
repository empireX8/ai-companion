#!/usr/bin/env node
/**
 * check-agent-closeout.ts — closeout markdown validator (v0.2 — LOOP-002)
 *
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-agent-closeout.ts path/to/06-closeout-receipt.md
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const REQUIRED_HEADINGS = [
  "Files changed",
  "Verification results",
  "Product Intelligence Score",
  "Build Loop Score",
  "Golden object tested",
  "Screenshot proof status",
  "Regression status",
  "Time spent",
  "Manual orchestration level",
  "Regressions",
  "Manual acceptance",
  "Classification",
  "Remaining risks",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main(): void {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: check-agent-closeout.ts <closeout-markdown-file>");
    process.exitCode = 1;
    return;
  }

  const filePath = resolve(process.cwd(), fileArg);
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(
      `Could not read closeout file: ${filePath}`,
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
    return;
  }

  const normalized = content.toLowerCase();
  const missing: string[] = [];

  for (const heading of REQUIRED_HEADINGS) {
    const pattern = new RegExp(`^#+\\s+${escapeRegExp(heading.toLowerCase())}\\b`, "m");
    if (!pattern.test(normalized)) {
      missing.push(heading);
    }
  }

  if (missing.length > 0) {
    console.error("check:agent-closeout FAIL — missing required headings:");
    for (const heading of missing) {
      console.error(`  - ${heading}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`check:agent-closeout PASS — ${filePath}`);
}

main();
