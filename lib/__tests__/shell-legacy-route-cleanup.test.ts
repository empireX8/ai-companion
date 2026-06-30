import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("shell legacy route cleanup", () => {
  it("keeps the route top bar import button unavailable instead of linking to /import", () => {
    const source = readSource("components/orvek-v0/production/RouteTopBar.tsx");

    expect(source).toContain("Import unavailable in v0");
    expect(source).toContain("disabled");
    expect(source).not.toContain('href="/import"');
  });

  it("keeps the command palette on visible v0 destinations only", () => {
    const source = readSource("components/command/CommandPalette.tsx");

    expect(source).toContain('route.href === "/what-changed"');
    expect(source).toContain('route.href === "/watch-for"');
    expect(source).toContain('route.href === "/journal-chat"');

    for (const blockedHref of [
      "/import",
      "/context",
      "/memories",
      "/patterns",
      "/history",
      "/contradictions",
      "/check-ins",
      "/active-questions",
      "/library",
      "/settings",
      "/account",
    ]) {
      expect(source).not.toContain(blockedHref);
    }

    expect(source).not.toContain('href="/chat"');
  });

  it("renders journal-chat pattern surfacing as an unavailable affordance", () => {
    const source = readSource("app/(root)/(routes)/journal-chat/page.tsx");

    expect(source).toContain("Patterns view is unavailable in v0");
    expect(source).toContain("disabled");
    expect(source).not.toContain('href="/patterns"');
  });

  it("keeps mind context off blocked governance and memory routes", () => {
    const source = readSource("components/your-map/YourMapMindContextPanel.tsx");

    expect(source).toContain("Context is unavailable in v0");
    expect(source).toContain("Memories management is unavailable in v0");
    expect(source).not.toContain("/context");
    expect(source).not.toContain("/memories");
    expect(source).not.toContain("/references/");
  });

  it("keeps your-map preview open questions non-linkable", () => {
    const source = readSource("components/your-map/YourMapPreviewBands.tsx");
    const workbenchSource = readSource("components/your-map/YourMapWorkbench.tsx");

    expect(source).toContain("viewAllHref={null}");
    expect(source).toContain("Unavailable in v0");
    expect(source).not.toContain("/active-questions/");
    expect(workbenchSource).not.toContain('href="/active-questions"');
  });

  it("keeps watch-for footer off active-questions", () => {
    const source = readSource("app/(root)/(routes)/watch-for/page.tsx");

    expect(source).toContain("Unavailable in v0");
    expect(source).not.toContain('href="/active-questions"');
  });

  it("keeps decisions add outcome disabled in production", () => {
    const source = readSource("components/orvek-v0/pages/decisions.tsx");

    expect(source).toContain("disabled={isProduction}");
    expect(source).toContain("ORVEK_DEFERRED_ACTION_CLASS");
    expect(source).toContain('a.label === "Add outcome"');
  });
});
