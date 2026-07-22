/**
 * CEQR-017 — scan untracked/new files for trailing whitespace, CRLF, JSON parse.
 * git diff --check alone does not cover untracked files.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";

export type Ceqr017WhitespaceScanFinding = {
  file: string;
  kind: "trailing_whitespace" | "crlf" | "json_parse" | "extra_eof_blank_lines";
  detail: string;
};

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

export function listCeqr017NewFiles(cwd: string = process.cwd()): string[] {
  const fixed = [
    "lib/contradiction-controlled-live-authority-reproof.ts",
    "lib/ceqr017-readonly-account-gate.ts",
    "lib/ceqr017-account-gate-path.ts",
    "lib/ceqr017-phase2-orchestration.ts",
    "lib/ceqr017-whitespace-scan.ts",
    "scripts/run-contradiction-controlled-live-authority-reproof.ts",
    "scripts/run-ceqr017-phase2-orchestrator.ts",
    "lib/__tests__/contradiction-controlled-live-authority-reproof.test.ts",
  ];
  const receiptDir = join(
    cwd,
    "docs/agent-runs/receipts/CONTRADICTION-CONTROLLED-LIVE-AUTHORITY-REPROOF-001",
  );
  const receipts = listFilesRecursive(receiptDir).map((p) =>
    relative(cwd, p),
  );
  const fromGit = execSync("git status --porcelain -u", {
    cwd,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\?\? /, "").replace(/^ M /, "").replace(/^M  /, "").replace(/^A  /, ""))
    .filter((p) => p.length > 0);

  return Array.from(new Set([...fixed, ...receipts, ...fromGit])).filter((p) =>
    existsSync(join(cwd, p)),
  );
}

export function scanFileForWhitespaceIssues(
  absPath: string,
  relPath: string,
): Ceqr017WhitespaceScanFinding[] {
  const findings: Ceqr017WhitespaceScanFinding[] = [];
  const raw = readFileSync(absPath);
  if (raw.includes(0x0d)) {
    findings.push({
      file: relPath,
      kind: "crlf",
      detail: "CRLF or bare CR detected",
    });
  }
  const text = raw.toString("utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/[ \t]+$/.test(line)) {
      findings.push({
        file: relPath,
        kind: "trailing_whitespace",
        detail: `line ${i + 1}`,
      });
    }
  }
  if (text.endsWith("\n\n") || text.endsWith("\n\n\n")) {
    findings.push({
      file: relPath,
      kind: "extra_eof_blank_lines",
      detail: "more than one trailing newline at EOF",
    });
  }
  if (relPath.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (error) {
      findings.push({
        file: relPath,
        kind: "json_parse",
        detail: error instanceof Error ? error.message : "json parse failed",
      });
    }
  }
  return findings;
}

export function scanCeqr017NewFiles(cwd: string = process.cwd()): {
  ok: boolean;
  filesScanned: number;
  findings: Ceqr017WhitespaceScanFinding[];
} {
  const files = listCeqr017NewFiles(cwd);
  const findings: Ceqr017WhitespaceScanFinding[] = [];
  for (const rel of files) {
    findings.push(...scanFileForWhitespaceIssues(join(cwd, rel), rel));
  }
  return { ok: findings.length === 0, filesScanned: files.length, findings };
}
