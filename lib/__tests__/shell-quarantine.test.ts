import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("reference shell quarantine", () => {
  it("keeps the active production shell on the canonical workbench", () => {
    const appLayout = readSource("app/(root)/layout.tsx");
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const runtime = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );
    const workbench = readSource("components/orvek-v0-canonical/workbench.tsx");

    expect(appLayout).toContain("AppShell");
    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(runtime).toContain("CanonicalWorkbench");
    expect(runtime).toContain("useOrvekHybridWorkbenchDataApi");
    expect(runtime).toContain("buildCanonicalLiveRuntimeData");
    expect(shell).not.toContain("RouteTopBar");
    expect(shell).not.toContain("RouteSidebar");
    expect(shell).not.toContain("OrvekTopBar");
    expect(shell).not.toContain("OrvekSidebar");
    expect(shell).not.toContain("OrvekEvidencePanel");
    expect(shell).not.toContain("ProductionInspectorAside");
    expect(workbench).toContain("OrvekShellLayout");
    expect(workbench).toContain("<TopBar");
    expect(workbench).toContain("<Sidebar />");
    expect(workbench).toContain("<EvidencePanel />");
    expect(workbench).toContain("<Overlays />");
  });

  it("keeps mock data confined to fixture / frozen baselines, not the production shell", () => {
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const runtime = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );
    const fixture = readSource("components/orvek-v0-canonical/fixture-provider.ts");
    const parallelWorkbench = readSource("components/orvek-v0/workbench.tsx");

    expect(fixture).toContain("createCanonicalFixtureRuntimeData");
    expect(parallelWorkbench).toContain("createMockOrvekDataApi");
    expect(shell).not.toContain("createMockOrvekDataApi");
    expect(runtime).toContain("OrvekPageHandlersProvider");
  });

  it("leaves the old shell files as quarantined backup code", () => {
    const legacyTopBar = readSource("components/orvek-workbench/OrvekTopBar.tsx");
    const legacySidebar = readSource("components/orvek-workbench/OrvekSidebar.tsx");
    const topBar = readSource("components/orvek-v0/production/RouteTopBar.tsx");
    const sidebar = readSource("components/orvek-v0/production/RouteSidebar.tsx");
    const evidence = readSource("components/orvek-workbench/OrvekEvidencePanel.tsx");

    expect(legacyTopBar).toContain("OrvekTopBar");
    expect(legacyTopBar).toContain("/import");
    expect(legacySidebar).toContain("OrvekSidebar");
    expect(legacySidebar).toContain("/your-map");
    expect(topBar).toContain("RouteTopBar");
    expect(topBar).toContain("Import unavailable in v0");
    expect(sidebar).toContain("RouteSidebar");
    expect(sidebar).toContain("Model movement");
    expect(evidence).toContain("ProductionInspectorAside");
    expect(evidence).toContain("@deprecated");
  });
});
