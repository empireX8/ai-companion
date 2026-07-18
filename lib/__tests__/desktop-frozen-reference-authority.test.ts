import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("desktop frozen reference authority", () => {
  it("mounts the frozen workbench on /dev/orvek-v0-reference", () => {
    const source = readSource("app/dev/orvek-v0-reference/page.tsx");

    expect(source).toContain("FrozenReferenceWorkbench");
    expect(source).not.toContain('from "@/components/orvek-v0/workbench"');
    expect(source).not.toContain("OrvekWorkbenchShell");
    expect(source).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(source).not.toContain("WorkbenchInspector");
    expect(source).not.toContain("RouteTopBar");
  });

  it("keeps the frozen reference package isolated from hybrid production hooks", () => {
    const source = readSource("components/orvek-v0-reference-frozen/workbench.tsx");

    expect(source).toContain("createFrozenReferenceDataApi");
    expect(source).toContain('from "./pages/today"');
    expect(source).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(source).not.toContain("OrvekWorkbenchShell");
    expect(source).not.toContain("WorkbenchInspector");
    expect(source).not.toContain("RouteTopBar");
  });

  it("keeps production shell on the shared reference-style chrome via canonical workbench", () => {
    const source = readSource("components/orvek-v0-canonical/workbench.tsx");

    expect(source).toContain("topBar={<TopBar />}");
    expect(source).toContain("inspector={<EvidencePanel />}");
    expect(source).not.toContain("RouteTopBar");
    expect(source).not.toContain("WorkbenchInspector");
  });

  it("routes the workbench EvidencePanel through the shared authority file", () => {
    const source = readSource("components/orvek-v0/evidence-panel.tsx");
    const authority = readSource("components/orvek-v0-authority/evidence-panel.tsx");

    expect(source.trim()).toBe(
      'export { EvidencePanel } from "@/components/orvek-v0-authority/evidence-panel"'
    );
    expect(authority).toContain("pushSelection");
    expect(authority).toContain("openReport(reportId)");
    expect(authority).toContain('"rep-weekly"');
    expect(authority).toContain("data.exploreGrounding ?? []");
  });

  it("keeps one inspector body scroll container in the shared authority panel", () => {
    const source = readSource("components/orvek-v0-authority/evidence-panel.tsx");
    const matches = source.match(/overflow-y-auto/g) ?? [];

    expect(matches).toHaveLength(1);
    expect(source).toContain("InspectorReturnBanner");
  });
});
