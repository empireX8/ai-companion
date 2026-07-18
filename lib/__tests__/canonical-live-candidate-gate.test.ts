import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("canonical live candidate blue/green gate", () => {
  it("mounts a dedicated live candidate route sharing production runtime entry", () => {
    const livePage = readSource("app/dev/orvek-v0-canonical-live/page.tsx");
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const fixturePage = readSource("app/dev/orvek-v0-canonical-reference/page.tsx");
    const coldPage = readSource("app/dev/orvek-v0-reference/page.tsx");

    expect(livePage).toContain("CanonicalLiveEntry");
    expect(livePage).not.toContain("createCanonicalFixtureRuntimeData");
    expect(fixturePage).toContain("CanonicalFixtureEntry");
    expect(coldPage).toContain("FrozenReferenceWorkbench");
    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(shell).toContain('data-testid="orvek-v0-production-canonical-root"');
  });

  it("live entry uses hybrid live provider + same CanonicalWorkbench as fixture", () => {
    const entry = readSource("components/orvek-v0-canonical/canonical-live-entry.tsx");
    const runtime = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );
    const fixtureEntry = readSource(
      "components/orvek-v0-canonical/canonical-fixture-entry.tsx",
    );

    expect(entry).toContain("CanonicalLiveRuntimeEntry");
    expect(entry).toContain('testId="orvek-v0-canonical-live-route"');
    expect(runtime).toMatch(/^["']use client["']/m);
    expect(runtime).toContain("useOrvekHybridWorkbenchDataApi");
    expect(runtime).toContain("buildCanonicalLiveRuntimeData");
    expect(runtime).toContain("CanonicalWorkbench");
    expect(runtime).toContain("enableProductionBridge");
    expect(runtime).toContain("OrvekPageHandlersProvider");
    expect(runtime).toContain("DurableActionsRefreshProvider");
    expect(runtime).not.toContain("createCanonicalFixtureRuntimeData");

    expect(fixtureEntry).toContain("CanonicalWorkbench");
    expect(fixtureEntry).toContain("createCanonicalFixtureRuntimeData");
    expect(fixtureEntry).not.toContain("useOrvekHybridWorkbenchDataApi");
  });

  it("live provider marks canonicalRuntime and never enables referenceSurface", () => {
    const live = readSource("components/orvek-v0-canonical/live-provider.ts");

    expect(live).toContain("canonicalRuntime: true");
    expect(live).toContain("referenceSurface: false");
    expect(live).not.toContain('leadId: "d1"');
    expect(live).not.toContain('reportId: "rep-weekly"');
    expect(live).not.toContain("createCanonicalFixtureRuntimeData");
  });

  it("canonical pages remain the only active page family for live and fixture", () => {
    const workbench = readSource("components/orvek-v0-canonical/workbench.tsx");
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");

    expect(workbench).toContain('from "./pages/today"');
    expect(workbench).toContain('from "./pages/map"');
    expect(workbench).toContain('from "./pages/decisions"');
    expect(workbench).toContain('from "./pages/explore"');
    expect(workbench).toContain('from "./pages/timeline"');
    expect(shell).not.toContain("orvek-v0/pages/");
    expect(shell).not.toContain('from "@/components/orvek-v0/workbench"');
  });

  it("cold and fixture routes are untouched by the live candidate mount", () => {
    const cold = readSource("app/dev/orvek-v0-reference/page.tsx");
    const fixture = readSource("app/dev/orvek-v0-canonical-reference/page.tsx");
    const live = readSource("app/dev/orvek-v0-canonical-live/page.tsx");

    expect(cold).not.toContain("CanonicalLiveEntry");
    expect(fixture).not.toContain("CanonicalLiveEntry");
    expect(live).toContain("CanonicalLiveEntry");
  });
});
