import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const CANONICAL_PAGES = [
  "components/orvek-v0-canonical/pages/today.tsx",
  "components/orvek-v0-canonical/pages/map.tsx",
  "components/orvek-v0-canonical/pages/timeline.tsx",
  "components/orvek-v0-canonical/pages/decisions.tsx",
  "components/orvek-v0-canonical/pages/explore.tsx",
] as const;

const PARALLEL_PAGES = [
  "components/orvek-v0/pages/today.tsx",
  "components/orvek-v0/pages/map.tsx",
  "components/orvek-v0/pages/timeline.tsx",
  "components/orvek-v0/pages/decisions.tsx",
  "components/orvek-v0/pages/explore.tsx",
] as const;

describe("canonical hard-swap path equivalence", () => {
  it("production shell mounts canonical runtime + live provider, not parallel workbench", () => {
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const runtime = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );

    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(runtime).toContain("CanonicalWorkbench");
    expect(runtime).toContain("buildCanonicalLiveRuntimeData");
    expect(runtime).toContain("enableProductionBridge");
    expect(runtime).toContain("DurableActionsRefreshProvider");
    expect(runtime).toContain("OrvekPageHandlersProvider");
    expect(runtime).toContain("useOrvekHybridWorkbenchDataApi");
    expect(shell).not.toContain('from "@/components/orvek-v0/workbench"');
    expect(shell).not.toContain("<Workbench ");
    expect(shell).not.toContain("orvek-v0/pages/");
  });

  it("canonical workbench routes the same page family as frozen authority", () => {
    const canonical = readSource("components/orvek-v0-canonical/workbench.tsx");
    const frozen = readSource("components/orvek-v0-reference-frozen/workbench.tsx");

    for (const page of ["TodayPage", "MapPage", "TimelinePage", "DecisionsPage", "ExplorePage"]) {
      expect(canonical).toContain(page);
      expect(frozen).toContain(page);
    }

    expect(canonical).toContain("OrvekShellLayout");
    expect(frozen).toContain("OrvekShellLayout");
    expect(canonical).toContain('from "./pages/today"');
    expect(frozen).toContain('from "./pages/today"');
    expect(canonical).not.toContain("orvek-v0/pages/");
  });

  it("fixture route and cold authority remain separate mounts", () => {
    const cold = readSource("app/dev/orvek-v0-reference/page.tsx");
    const fixture = readSource("app/dev/orvek-v0-canonical-reference/page.tsx");
    const fixtureEntry = readSource(
      "components/orvek-v0-canonical/canonical-fixture-entry.tsx",
    );

    expect(cold).toContain("FrozenReferenceWorkbench");
    expect(cold).toContain('data-testid="orvek-v0-reference-route"');
    expect(fixture).toContain("CanonicalFixtureEntry");
    expect(fixture).not.toContain("createCanonicalFixtureRuntimeData");
    expect(fixture).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(fixtureEntry).toContain("createCanonicalFixtureRuntimeData");
    expect(fixtureEntry).toContain("CanonicalWorkbench");
    expect(fixtureEntry).toContain('data-testid="orvek-v0-canonical-reference-route"');
  });

  it("canonical pages consume provider seam; frozen pages keep hard imports", () => {
    for (const page of CANONICAL_PAGES) {
      const source = readSource(page);
      expect(source).toContain("useCanonicalData");
      expect(source).not.toContain(
        'from "@/components/orvek-v0-reference-frozen/reference-data"',
      );
    }

    const frozenToday = readSource("components/orvek-v0-reference-frozen/pages/today.tsx");
    expect(frozenToday).toContain(
      'from "@/components/orvek-v0-reference-frozen/reference-data"',
    );
  });

  it("parallel production pages remain on disk but are inactive from the shell", () => {
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const quarantine = readSource(
      "docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/12-canonical-hard-swap-quarantine.md",
    );

    for (const page of PARALLEL_PAGES) {
      expect(() => readSource(page)).not.toThrow();
      expect(shell).not.toContain(page);
      expect(quarantine).toContain(page);
    }

    expect(quarantine).toContain("components/orvek-v0/workbench.tsx");
  });

  it("ModelUpdate production compose hydrates under canonicalRuntime via live inspector APIs", () => {
    const evidence = readSource("components/orvek-v0-authority/evidence-panel.tsx");
    // Live contract repair: compose runs for production display (including canonicalRuntime).
    // Depth is owned inspector data — not fixture injection and not a presentation redesign.
    expect(evidence).toContain("composeProductionModelUpdateCanonicalViewModel");
    expect(evidence).toContain("isProductionDisplay(data)");
    expect(evidence).not.toContain("canonicalRuntime !== true");
  });

  it("canonical explore preserves live send handlers without mounting parallel explore page", () => {
    const explore = readSource("components/orvek-v0-canonical/pages/explore.tsx");
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");

    expect(explore).toContain("freeExploreSendHandlerAvailable");
    expect(explore).toContain("useOrvekPageHandlers");
    expect(explore).toContain("onSend");
    expect(shell).not.toContain("pages/explore");
  });
});
