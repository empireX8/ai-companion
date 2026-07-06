import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function explorePageTabStripBlock(source: string): string {
  return (
    source.match(
      /export function ExplorePage\(\) \{([\s\S]*?)\n\}\n\nconst REFERENCE_FREE_EXPLORE_MESSAGES/,
    )?.[1] ?? ""
  );
}

describe("explore tab visual regression", () => {
  const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
  const tabStripBlock = explorePageTabStripBlock(explorePageSource);

  it("does not use o-sunken for the Explore tab chrome", () => {
    expect(tabStripBlock).not.toContain("o-sunken");
    expect(tabStripBlock).not.toContain("segmented control");
  });

  it("does not use filled pill/card background for the active tab", () => {
    expect(tabStripBlock).not.toContain("bg-card");
    expect(tabStripBlock).not.toMatch(/shadow-\[0_1px_2px/);
    expect(tabStripBlock).not.toContain("rounded-[9px] p-1");
    expect(tabStripBlock).not.toContain("rounded-[6px]");
    expect(tabStripBlock).not.toContain("o-calm");
  });

  it("uses a thin underline and quiet full-width divider for the tab row", () => {
    expect(tabStripBlock).toContain("border-b border-border/40");
    expect(tabStripBlock).toContain("border-b pb-2");
    expect(tabStripBlock).toContain("border-foreground");
    expect(tabStripBlock).toContain("border-transparent");
    expect(tabStripBlock).not.toContain("border-b-2");
    expect(tabStripBlock).toContain('aria-label="Explore sections"');
    expect(tabStripBlock).toContain("text-[12px]");
  });

  it("keeps all four Explore tab labels present", () => {
    expect(explorePageSource).toContain('"Free Explore"');
    expect(explorePageSource).toContain('"Investigations"');
    expect(explorePageSource).toContain('"Active Questions"');
    expect(explorePageSource).toContain('"Fieldwork Bridge"');
  });

  it("preserves tab switching state and panel routing", () => {
    expect(tabStripBlock).toContain('useState<Tab>("free")');
    expect(tabStripBlock).toContain("setTab(t.id)");
    expect(tabStripBlock).toContain('{tab === "free" && <FreeExplore />}');
    expect(tabStripBlock).toContain('{tab === "investigations" && <Investigations />}');
    expect(tabStripBlock).toContain('{tab === "questions" && <Questions />}');
    expect(tabStripBlock).toContain('{tab === "fieldwork" && <FieldworkBridge onSelect={select} />}');
  });

  it("keeps Free Explore read-only and send-disabled", () => {
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("freeExploreSendHandlerAvailable === true");
    expect(freeExploreBlock).toContain("hasLiveExploreChatFromProvider");
    expect(freeExploreBlock).toContain("disabled={!canSend}");
  });

  it("keeps Fieldwork Bridge unchanged", () => {
    const fieldworkBlock =
      explorePageSource.match(/function FieldworkBridge\([\s\S]*?\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      explorePageSource.match(/function FieldworkBridge\([\s\S]*?\) \{([\s\S]*?)\n\}/)?.[1] ??
      "";

    expect(explorePageSource).toContain("function FieldworkBridge");
    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(explorePageSource).toContain("resolveExperimentOpenSelectionId");
    expect(fieldworkBlock.length).toBeGreaterThan(0);
  });

  it("keeps Active Questions unchanged", () => {
    const questionsBlock =
      explorePageSource.match(/function Questions\(\) \{([\s\S]*?)\n\}\n\nfunction Investigations/)?.[1] ??
      "";

    expect(questionsBlock).toContain("hasLiveQuestions");
    expect(questionsBlock).toContain("resolveActiveQuestionsOpenSelectionId");
    expect(questionsBlock).not.toContain("border-b-2");
  });

  it("keeps Investigations unchanged", () => {
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";

    expect(investigationsBlock).toContain("hasLiveInvestigations");
    expect(investigationsBlock).toContain("resolveInvestigationsOpenSelectionId");
    expect(investigationsBlock).not.toContain("border-b-2");
  });

  it("keeps reference route on mock data only and production shell quarantined", () => {
    const referencePageSource = readSource("app/dev/orvek-v0-reference/page.tsx");
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const exploreRouteSource = readSource("app/(root)/(routes)/explore/page.tsx");

    expect(referencePageSource).toContain("<Workbench />");
    expect(referencePageSource).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(shellSource).toContain("useOrvekHybridWorkbenchDataApi");
    expect(shellSource).not.toContain("OrvekExplorePage");
    expect(exploreRouteSource).toContain("OrvekExplorePage");
    expect(workbenchSource).toContain("<ExplorePage />");
  });
});
