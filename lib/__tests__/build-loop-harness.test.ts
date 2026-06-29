import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  return join(process.cwd(), relativePath);
}

describe("AI build loop harness", () => {
  it("includes queue, chapter queue, templates, benchmark, and orvek prompts", () => {
    for (const path of [
      "docs/agent-runs/README.md",
      "docs/agent-runs/chapter-queue.md",
      "docs/agent-runs/slice-queue.md",
      "docs/agent-runs/product-intelligence-benchmark.md",
      "docs/agent-runs/golden-objects.md",
      "docs/agent-runs/templates/00-intake-receipt.md",
      "docs/agent-runs/templates/06-closeout-receipt.md",
      "docs/agent-runs/templates/07-product-intelligence-scorecard.md",
      "prompts/orvek-chapter-runner.md",
      "prompts/orvek-slice-runner.md",
      "prompts/orvek-auditor.md",
      "prompts/orvek-visual-acceptance.md",
      "prompts/cursor-automation-orvek-chapter-slice.md",
      "scripts/check-agent-closeout.ts",
      "scripts/check-legacy-inspector-routes.ts",
    ]) {
      expect(existsSync(repoPath(path)), path).toBe(true);
    }
  });

  it("seeds CHAPTER-INSPECTOR-001 in chapter queue", () => {
    const chapterQueue = readFileSync(repoPath("docs/agent-runs/chapter-queue.md"), "utf8");
    expect(chapterQueue).toContain("CHAPTER-INSPECTOR-001");
    expect(chapterQueue).toContain("GOLDEN-INSPECTOR-001");
    expect(chapterQueue).toContain("2 → 3");
    expect(chapterQueue).toContain("SLICE-001");
    expect(chapterQueue).toContain("800");
    expect(chapterQueue).toContain("Max slices: 4");
  });

  it("cursor automation prompt includes required guardrails", () => {
    const automation = readFileSync(
      repoPath("prompts/cursor-automation-orvek-chapter-slice.md"),
      "utf8"
    );
    expect(automation).toMatch(/manual/i);
    expect(automation).toContain("do not merge");
    expect(automation).toContain("one slice");
    expect(automation).toContain("staging");
    expect(automation).toMatch(/screenshot/i);
    expect(automation).toContain("800");
  });

  it("seeds golden object record ids", () => {
    const golden = readFileSync(repoPath("docs/agent-runs/golden-objects.md"), "utf8");
    expect(golden).toContain("cmq6h8ewn0000qlbwlg485jx1");
    expect(golden).toContain("cmq6frqdx0000ql8h6nkavzue");
    expect(golden).toContain("CHAPTER-INSPECTOR-001");
  });

  it("requires benchmark regression in scorecard template", () => {
    const scorecard = readFileSync(
      repoPath("docs/agent-runs/templates/07-product-intelligence-scorecard.md"),
      "utf8"
    );
    expect(scorecard).toContain("Regression tracking");
    expect(scorecard).toContain("Planned slice prediction");
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
