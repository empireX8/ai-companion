#!/usr/bin/env node
/**
 * check-legacy-inspector-routes.ts — static guard against legacy evidence navigation
 * in workbench inspector evidence surfaces (v0.1).
 *
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' scripts/check-legacy-inspector-routes.ts
 */

import { readFileSync } from "fs";
import { join, relative } from "path";

const REPO_ROOT = join(__dirname, "..");

const INSPECTOR_EVIDENCE_FILES = [
  "components/inspector/panels/SelectedObjectEvidencePanel.tsx",
  "components/inspector/panels/ModelMovementInspectorPanel.tsx",
  "components/inspector/InspectorEvidenceSelectionControl.tsx",
] as const;

const FORBIDDEN_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  { id: "link-card-href", regex: /<Link\s+href=\{card\.href\}/ },
  { id: "link-ref-href", regex: /<Link\s+href=\{ref\.href\}/ },
  {
    id: "link-literal-patterns",
    regex: /<Link[^>]+href=\{[^}]*["'`]\/patterns/,
  },
  {
    id: "link-literal-contradictions",
    regex: /<Link[^>]+href=\{[^}]*["'`]\/contradictions/,
  },
  {
    id: "href-literal-patterns",
    regex: /href=["'`]\/patterns\//,
  },
  {
    id: "href-literal-contradictions",
    regex: /href=["'`]\/contradictions\//,
  },
];

function main(): void {
  const violations: string[] = [];

  for (const relativePath of INSPECTOR_EVIDENCE_FILES) {
    const absolutePath = join(REPO_ROOT, relativePath);
    let source: string;
    try {
      source = readFileSync(absolutePath, "utf8");
    } catch {
      violations.push(`${relativePath}: file not found`);
      continue;
    }

    const lines = source.split("\n");
    for (const { id, regex } of FORBIDDEN_PATTERNS) {
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          violations.push(
            `${relative(relativePath)}:${index + 1} [${id}] ${line.trim()}`
          );
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error("check:legacy-inspector-routes FAIL");
    for (const violation of violations) {
      console.error(`  ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `check:legacy-inspector-routes PASS — scanned ${INSPECTOR_EVIDENCE_FILES.length} inspector evidence files`
  );
}

main();
