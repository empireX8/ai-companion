import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  return join(process.cwd(), relativePath);
}

describe("AI build loop harness", () => {
  it("includes queue, templates, benchmark, and orvek prompts", () => {
    for (const path of [
      "docs/agent-runs/README.md",
      "docs/agent-runs/slice-queue.md",
      "docs/agent-runs/product-intelligence-benchmark.md",
      "docs/agent-runs/golden-objects.md",
      "docs/agent-runs/templates/00-intake-receipt.md",
      "docs/agent-runs/templates/06-closeout-receipt.md",
      "docs/agent-runs/templates/07-product-intelligence-scorecard.md",
      "prompts/orvek-slice-runner.md",
      "prompts/orvek-auditor.md",
      "prompts/orvek-visual-acceptance.md",
      "scripts/check-agent-closeout.ts",
      "scripts/check-legacy-inspector-routes.ts",
    ]) {
      expect(existsSync(repoPath(path)), path).toBe(true);
    }
  });

  it("seeds golden object and loop slices in queue", () => {
    const queue = readFileSync(repoPath("docs/agent-runs/slice-queue.md"), "utf8");
    expect(queue).toContain("INSPECTOR-001");
    expect(queue).toContain("LOOP-001");
    expect(queue).toContain("LOOP-002");
    expect(queue).toContain("GOLDEN-INSPECTOR-001");

    const golden = readFileSync(repoPath("docs/agent-runs/golden-objects.md"), "utf8");
    expect(golden).toContain("cmq6h8ewn0000qlbwlg485jx1");
    expect(golden).toContain("cmq6frqdx0000ql8h6nkavzue");
  });

  it("requires benchmark regression and golden object sections in scorecard template", () => {
    const scorecard = readFileSync(
      repoPath("docs/agent-runs/templates/07-product-intelligence-scorecard.md"),
      "utf8"
    );
    expect(scorecard).toContain("Regression tracking");
    expect(scorecard).toContain("Planned slice prediction");
    expect(scorecard).toContain("Can the user tell **what changed**?");
  });

  it("forbids legacy inspector evidence Link patterns in panel sources", () => {
    const evidencePanel = readFileSync(
      repoPath("components/inspector/panels/SelectedObjectEvidencePanel.tsx"),
      "utf8"
    );
    expect(evidencePanel).toContain("InspectorEvidenceSelectionControl");
    expect(evidencePanel).not.toContain("<Link href={card.href}");
  });
});
