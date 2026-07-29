import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const ACTIVE_ROOT_CHAIN = [
  "app/(root)/layout.tsx",
  "components/layout/AppShell.tsx",
  "components/orvek-workbench/OrvekWorkbenchShell.tsx",
  "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
  "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
  "components/orvek-v0-canonical/workbench.tsx",
] as const;

const OLD_SHELL_COMPONENTS = [
  "RouteSidebar",
  "ProductionInspectorAside",
  "OrvekTopBar",
  "OrvekSidebar",
  "OrvekEvidencePanel",
] as const;

const QUARANTINED_ROUTE_CONTAINERS = [
  "OrvekTodayPage",
  "OrvekMapPage",
  "OrvekExplorePage",
  "OrvekTimelinePage",
  "OrvekDecisionsPage",
  "OrvekWhatChangedPage",
] as const;

const QUARANTINED_LEGACY_ROUTE_PAGES = [
  "app/(root)/page.tsx",
  "app/(root)/(routes)/journal-chat/page.tsx",
  "app/(root)/(routes)/your-map/page.tsx",
  "app/(root)/(routes)/timeline/page.tsx",
  "app/(root)/(routes)/actions/page.tsx",
  "app/(root)/(routes)/watch-for/page.tsx",
  "app/(root)/(routes)/active-questions/page.tsx",
  "app/(root)/(routes)/explore/page.tsx",
] as const;

const ACTIVE_V0_PAGES = [
  "components/orvek-v0-canonical/pages/today.tsx",
  "components/orvek-v0-canonical/pages/map.tsx",
  "components/orvek-v0-canonical/pages/timeline.tsx",
  "components/orvek-v0-canonical/pages/decisions.tsx",
  "components/orvek-v0-canonical/pages/explore.tsx",
] as const;

const STORE_NAV_ACTIONS = [
  "setPage",
  "select",
  "setInspectorTab",
  "setOverlay",
  "openReport",
] as const;

const ROUTE_FIRST_HREFS = [
  'router.push("/journal-chat")',
  'router.push("/your-map")',
  'router.push("/timeline")',
  'router.push("/actions")',
  'router.push("/watch-for")',
  'router.push("/active-questions")',
  'router.push("/investigations")',
  'router.push("/explore")',
] as const;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") {
        continue;
      }
      collectSourceFiles(absolute, acc);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry)) {
      acc.push(absolute);
    }
  }
  return acc;
}

function relativeFromRoot(absolutePath: string): string {
  return absolutePath.slice(ROOT.length + 1);
}

describe("desktop old-route / old-shell quarantine audit", () => {
  it("1 — root hard-swap chain mounts CanonicalWorkbench only for workbench-owned routes", () => {
    const layout = readSource("app/(root)/layout.tsx");
    const appShell = readSource("components/layout/AppShell.tsx");
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const runtime = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );
    const hybridHook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    const workbench = readSource("components/orvek-v0-canonical/workbench.tsx");

    expect(layout).toContain("AppShell");
    expect(appShell).toContain("OrvekWorkbenchShell");
    expect(shell).toContain("usePathname");
    expect(shell).toContain("isCanonicalWorkbenchRoute");
    expect(shell).toContain('pathname === "/"');
    expect(shell).toContain('return <>{children}</>');
    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(runtime).toContain("useOrvekHybridWorkbenchDataApi");
    expect(runtime).toContain("CanonicalWorkbench");
    expect(runtime).toContain("buildCanonicalLiveRuntimeData");
    expect(hybridHook).toContain("buildHybridWorkbenchDataApi");
    expect(workbench).toContain("OrvekShellLayout");
    expect(workbench).toContain("<PageContent />");
  });

  it("2 — active root chain does not mount old shell components", () => {
    for (const file of ACTIVE_ROOT_CHAIN) {
      const source = readSource(file);
      for (const marker of OLD_SHELL_COMPONENTS) {
        expect(source).not.toContain(marker);
      }
    }
  });

  it("3 — root shell does not mount quarantined route-first page containers", () => {
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbench = readSource("components/orvek-v0-canonical/workbench.tsx");

    for (const container of QUARANTINED_ROUTE_CONTAINERS) {
      expect(shell).not.toContain(container);
    }

    expect(shell).not.toContain("OrvekV0PageShell");
    expect(workbench).not.toContain("OrvekV0PageShell");
    expect(workbench).not.toContain("OrvekExplorePage");
  });

  it("4 — active v0 pages and chrome use store navigation, not route-first pushes", () => {
    const store = readSource("components/orvek-v0/store.tsx");

    for (const action of STORE_NAV_ACTIONS) {
      expect(store).toContain(action);
    }

    for (const pagePath of ACTIVE_V0_PAGES) {
      const source = readSource(pagePath);
      expect(source).not.toContain("router.push");
      expect(source).not.toMatch(/useRouter\s*\(/);
      expect(source).not.toMatch(/from ["']next\/navigation["']/);
      expect(source).toContain("useWorkbench");
    }

    const sidebar = readSource("components/orvek-v0/sidebar.tsx");
    const topBar = readSource("components/orvek-v0/top-bar.tsx");

    expect(sidebar).toContain("setPage");
    expect(sidebar).not.toContain("router.push");
    expect(topBar).toContain("useRouter");
    expect(topBar).toContain("setPage");
    expect(topBar).toContain("setOverlay");
    expect(topBar).toContain('router.push("/journal-chat")');
    expect(topBar).toContain('router.push("/your-map")');
    expect(topBar).toContain('router.push("/timeline")');
    expect(topBar).toContain("openCommandPalette");
  });

  it("5 — legacy route files exist but remain quarantined from root ownership", () => {
    for (const routePage of QUARANTINED_LEGACY_ROUTE_PAGES) {
      expect(() => readSource(routePage)).not.toThrow();
    }

    const rootPage = readSource("app/(root)/page.tsx");
    const exploreRoute = readSource("app/(root)/(routes)/explore/page.tsx");
    const mapRoute = readSource("app/(root)/(routes)/your-map/page.tsx");

    expect(rootPage).toContain("OrvekTodayPage");
    expect(exploreRoute).toContain("OrvekExplorePage");
    expect(mapRoute).toContain("OrvekMapPage");

    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    expect(shell).not.toContain("OrvekTodayPage");
    expect(shell).not.toContain("OrvekExplorePage");
    expect(shell).not.toContain("OrvekMapPage");
  });

  it("6 — Map production bridge lives in hybrid hook, not active OrvekMapPage ownership", () => {
    const hybridHook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    const quarantinedMapPage = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");

    expect(hybridHook).toContain("buildMapProductionDataApi");
    expect(hybridHook).toContain("fetchYourMapConclusions");
    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(shell).not.toContain("OrvekMapPage");
    expect(quarantinedMapPage).toContain("OrvekV0PageShell");
    expect(quarantinedMapPage).not.toContain("useOrvekHybridWorkbenchDataApi");
  });

  it("7 — reference route remains bare mock Workbench without hybrid wiring", () => {
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");
    const frozenWorkbench = readSource("components/orvek-v0-reference-frozen/workbench.tsx");

    expect(referenceRoute).toContain('data-testid="orvek-v0-reference-route"');
    expect(referenceRoute).toContain("<FrozenReferenceWorkbench />");
    expect(referenceRoute).toContain("FrozenReferenceWorkbench");
    expect(referenceRoute).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(referenceRoute).not.toContain("handlers=");
    expect(referenceRoute).not.toContain("buildHybridWorkbenchDataApi");
    expect(frozenWorkbench).toContain("createFrozenReferenceDataApi");
    expect(frozenWorkbench).not.toContain("ProductionInspectorBridge");
  });

  it("8 — production hybrid hook starts from the empty API while inactive parallel workbench keeps mock fallback", () => {
    const mockApi = readSource("lib/orvek-v0/mock-api.ts");
    const parallelWorkbench = readSource("components/orvek-v0/workbench.tsx");
    const hybridHook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );

    expect(mockApi).toContain("export function createMockOrvekDataApi");
    expect(parallelWorkbench).toContain("createMockOrvekDataApi");
    expect(hybridHook).toContain("EMPTY_ORVEK_DATA_API");
    expect(hybridHook).not.toContain("createMockOrvekDataApi");
  });

  it("9 — no global displayContract production in active root chain", () => {
    for (const file of ACTIVE_ROOT_CHAIN) {
      expect(readSource(file)).not.toMatch(/displayContract:\s*["']production["']/);
    }
  });

  it("10 — Free Explore honesty guards from PR #97/#99 remain intact", () => {
    const explorePage = readSource("components/orvek-v0-canonical/pages/explore.tsx");
    const evidencePanel = readSource("components/orvek-v0-authority/evidence-panel.tsx");
    const hybridApi = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");

    expect(explorePage).toContain("referenceSurface === true");
    expect(explorePage).toContain("freeExploreSendHandlerAvailable");
    expect(evidencePanel).toContain("showReferenceConversationMovement = exploreActive && !hasLiveExploreChat");
    expect(evidencePanel).toContain("showLiveConversationMovementEmpty");
    expect(evidencePanel).toContain("referenceConversationMovement = data.exploreMovement ?? []");
    expect(hybridApi).toContain("mergeFreeExploreChatShellState");
    expect(hybridApi).toContain("looksLikeAuthOrSessionBootError");
  });

  it("11 — direct workbench routes sync the shared shell page from the pathname", () => {
    const workbench = readSource("components/orvek-v0-canonical/workbench.tsx");

    expect(workbench).toContain("usePathname");
    expect(workbench).toContain("resolveWorkbenchPageFromPathname");
    expect(workbench).toContain('pathname === "/your-map"');
    expect(workbench).toContain('pathname === "/actions"');
    expect(workbench).toContain('pathname === "/timeline"');
    expect(workbench).toContain('pathname === "/explore"');
    expect(workbench).toContain("<RoutePageSync />");
    expect(workbench).toContain("setPage(nextPage)");
  });

  it("old shell components are not imported anywhere in app/components/lib source", () => {
    const sourceFiles = collectSourceFiles(ROOT).filter((file) => {
      const relative = relativeFromRoot(file);
      return (
        relative.startsWith("app/") ||
        relative.startsWith("components/") ||
        relative.startsWith("lib/")
      );
    });

    const importers: Record<string, string[]> = {
      RouteTopBar: [],
      RouteSidebar: [],
      OrvekTopBar: [],
      OrvekSidebar: [],
      OrvekEvidencePanel: [],
    };

    for (const file of sourceFiles) {
      const relative = relativeFromRoot(file);
      const source = readFileSync(file, "utf8");
      for (const component of Object.keys(importers)) {
        if (
          source.includes(`from "@/components/orvek-v0/production/${component}"`) ||
          source.includes(`from "@/components/orvek-workbench/${component}"`) ||
          source.includes(`from "./${component}"`) ||
          source.includes(`from '../${component}'`)
        ) {
          importers[component].push(relative);
        }
      }
    }

    for (const [component, files] of Object.entries(importers)) {
      expect(files, `${component} must remain unimported quarantine code`).toEqual([]);
    }
  }, 15_000);

  it("route-first navigation pushes stay confined to quarantined shell/reference files", () => {
    const allowedRoutePushFiles = new Set([
      "components/orvek-v0/production/RouteTopBar.tsx",
      "components/orvek-v0/reference/ReferencePageHandlersProvider.tsx",
    ]);

    const offenders: string[] = [];
    for (const pagePath of ACTIVE_V0_PAGES) {
      const source = readSource(pagePath);
      for (const push of ROUTE_FIRST_HREFS) {
        if (source.includes(push)) {
          offenders.push(`${pagePath} contains ${push}`);
        }
      }
    }

    expect(offenders).toEqual([]);

    for (const file of allowedRoutePushFiles) {
      expect(() => readSource(file)).not.toThrow();
    }
  });
});
