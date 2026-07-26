import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function explorePageTabStripBlock(source: string): string {
  return (
    source.match(/export function ExplorePage([\s\S]*?)\n\}\n\nfunction FreeExplore/)?.[1] ??
    ""
  );
}

describe("explore tab visual regression", () => {
  const explorePageSource = readSource("components/orvek-v0-canonical/pages/explore.tsx");
  const frozenExplore = readSource("components/orvek-v0-reference-frozen/pages/explore.tsx");
  const tabStripBlock = explorePageTabStripBlock(explorePageSource);
  const frozenTabStrip = explorePageTabStripBlock(frozenExplore);

  it("keeps canonical Explore tab chrome aligned with cold frozen authority", () => {
    expect(tabStripBlock).toContain("o-sunken");
    expect(tabStripBlock).toContain("segmented control");
    expect(tabStripBlock).toContain("bg-card");
    expect(frozenTabStrip).toContain("o-sunken");
    expect(frozenTabStrip).toContain("segmented control");
  });

  it("keeps all four Explore tab labels present", () => {
    expect(explorePageSource).toContain('"Free Explore"');
    expect(explorePageSource).toContain('"Investigations"');
    expect(explorePageSource).toContain('"Active Questions"');
    expect(explorePageSource).toContain('"Fieldwork Bridge"');
  });

  it("does not revive the parallel production underline tab strip as the active chrome", () => {
    expect(tabStripBlock).not.toContain("border-b border-border/40");
    expect(tabStripBlock).not.toContain('aria-label="Explore sections"');
  });

  it("keeps production shell on the canonical Explore page family", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const runtimeSource = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );
    expect(shellSource).toContain("CanonicalLiveRuntimeEntry");
    expect(runtimeSource).toContain("CanonicalWorkbench");
    expect(shellSource).not.toContain("orvek-v0/pages/explore");
  });
});
