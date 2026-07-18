import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("root cutover — canonical runtime is production desktop", () => {
  it("production shell mounts shared CanonicalLiveRuntimeEntry", () => {
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const appShell = readSource("components/layout/AppShell.tsx");
    const entry = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );

    expect(appShell).toContain("OrvekWorkbenchShell");
    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(shell).toContain('data-testid="orvek-v0-production-canonical-root"');
    expect(shell).not.toContain('from "@/components/orvek-v0/workbench"');
    expect(shell).not.toContain("orvek-v0/pages/");
    expect(entry).toContain("buildCanonicalLiveRuntimeData");
    expect(entry).toContain("CanonicalWorkbench");
    expect(entry).toContain("useOrvekHybridWorkbenchDataApi");
  });

  it("canonical-live and production share the same runtime entry module", () => {
    const liveEntry = readSource(
      "components/orvek-v0-canonical/canonical-live-entry.tsx",
    );
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");

    expect(liveEntry).toContain("CanonicalLiveRuntimeEntry");
    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(liveEntry).toContain("syncRoutesFromPathname={false}");
    expect(shell).toContain("syncRoutesFromPathname");
  });

  it("does not mount parallel production workbench on the root shell", () => {
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    expect(shell).not.toContain('from "@/components/orvek-v0/workbench"');
    expect(shell).not.toContain("<Workbench");
  });

  it("preserves parallel presentation behind a non-authoritative rollback route", () => {
    const page = readSource(
      "app/dev/orvek-v0-parallel-production-rollback/page.tsx",
    );
    const entry = readSource(
      "components/orvek-v0/parallel-production-rollback-entry.tsx",
    );

    expect(page).toContain("ParallelProductionRollbackEntry");
    expect(page).toMatch(/rollback|debug|NOT.*reference|Not a reference/i);
    expect(entry).toContain('from "@/components/orvek-v0/workbench"');
    expect(entry).toContain("Workbench");
    expect(entry).toContain('data-testid="orvek-v0-parallel-production-rollback-route"');
    expect(entry).toContain("useOrvekHybridWorkbenchDataApi");
  });

  it("keeps cold and fixture routes unchanged", () => {
    const cold = readSource("app/dev/orvek-v0-reference/page.tsx");
    const fixture = readSource("app/dev/orvek-v0-canonical-reference/page.tsx");

    expect(cold).toContain("FrozenReferenceWorkbench");
    expect(cold).not.toContain("CanonicalLiveRuntimeEntry");
    expect(fixture).toContain("CanonicalFixtureEntry");
    expect(fixture).not.toContain("CanonicalLiveRuntimeEntry");
  });

  it("records attach-evidence controls as post-cutover product decision, not restored", () => {
    const explore = readSource("components/orvek-v0-canonical/pages/explore.tsx");
    expect(explore).not.toContain("ProductionInvestigationWorkbenchDetail");
    expect(explore).not.toContain("InvestigationDetailActions");
  });
});
