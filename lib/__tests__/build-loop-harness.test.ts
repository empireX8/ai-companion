import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  return join(process.cwd(), relativePath);
}

describe("AI build loop harness v0.1", () => {
  it("includes queue, templates, and orvek prompts", () => {
    for (const path of [
      "docs/agent-runs/README.md",
      "docs/agent-runs/slice-queue.md",
      "docs/agent-runs/templates/00-intake-receipt.md",
      "docs/agent-runs/templates/06-closeout-receipt.md",
      "prompts/orvek-slice-runner.md",
      "prompts/orvek-auditor.md",
      "prompts/orvek-visual-acceptance.md",
      "scripts/check-agent-closeout.ts",
      "scripts/check-legacy-inspector-routes.ts",
    ]) {
      expect(existsSync(repoPath(path)), path).toBe(true);
    }
  });

  it("seeds slice queue with inspector and loop entries", () => {
    const queue = readFileSync(repoPath("docs/agent-runs/slice-queue.md"), "utf8");
    expect(queue).toContain("INSPECTOR-001");
    expect(queue).toContain("INSPECTOR-002");
    expect(queue).toContain("LOOP-001");
  });

  it("forbids legacy inspector evidence Link patterns in panel sources", () => {
    const evidencePanel = readFileSync(
      repoPath("components/inspector/panels/SelectedObjectEvidencePanel.tsx"),
      "utf8"
    );
    expect(evidencePanel).toContain("InspectorEvidenceSelectionControl");
    expect(evidencePanel).not.toContain("<Link href={card.href}");
    expect(evidencePanel).not.toMatch(/<Link[^>]+href=\{[^}]*\/patterns/);
  });
});
