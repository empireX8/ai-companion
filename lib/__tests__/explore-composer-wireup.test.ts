import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("explore composer wireup", () => {
  it("routes ask and quick prompts through explore chat handlers", () => {
    const pageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const routeSource = readSource("components/orvek-workbench/OrvekExplorePage.tsx");
    const hookSource = readSource("components/orvek-workbench/useOrvekExploreChat.ts");

    expect(pageSource).toContain("const exploreHandlers = useOrvekPageHandlers().explore");
    expect(pageSource).toContain("const composerDraft = exploreView?.composerDraft ?? localDraft");
    expect(pageSource).toContain("exploreHandlers?.onSend?.()");
    expect(pageSource).toContain("exploreHandlers.onQuickPrompt(q)");
    expect(pageSource).toMatch(/\/\* composer \*\/[\s\S]*value=\{composerDraft\}/);
    expect(pageSource).not.toMatch(
      /\/\* composer \*\/[\s\S]*onClick=\{\(\) => setInspectorTab\("movement"\)\}/
    );
    expect(pageSource).not.toMatch(
      /\/\* quick prompts \*\/[\s\S]*onClick=\{\(\) => setInspectorTab\("movement"\)\}/
    );

    expect(routeSource).toContain("onQuickPrompt: (prompt: string) => {");
    expect(routeSource).toContain("void sendMessage(prompt);");

    expect(hookSource).toContain("async (overrideContent?: string)");
    expect(hookSource).toContain("const content = (overrideContent ?? draft).trim()");
  });
});
