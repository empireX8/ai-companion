import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { MapMapDataInput } from "../orvek-adapters/map";
import { mapMapDataToV0Props } from "../orvek-adapters/map";
import { resolveInspectorObjectType } from "../inspector-selection";
import type { MapOpenContradictionItem } from "../map-open-contradictions";
import { mapContradictionObjectId } from "../map-open-contradictions";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
import {
  buildHybridWorkbenchDataApi,
  mergeLiveContradictionConflicts,
} from "../orvek-v0/production/hybrid-workbench-api";
import { buildMapProductionDataApi } from "../orvek-v0/production/map-api";
import { resolveMapWorkbenchSelectedId } from "../orvek-v0/production/map-selection";
import { withProductionContract } from "../orvek-v0/display-contract";
import { buildCanonicalLiveRuntimeData } from "../../components/orvek-v0-canonical/live-provider";
import {
  createMapContradictionProjectionFixtureInput,
  createMapContradictionProjectionMapApi,
  MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID,
  MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAW_ID,
  MAP_CONTRADICTION_PROJECTION_FIXTURE_CONTRADICTION_RAIL_ID,
  MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID,
} from "../map-contradiction-projection-fixture";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const OPEN_CN: MapOpenContradictionItem = {
  id: "cn-live-1",
  title: "Speed vs care",
  sideA: "Move quickly",
  sideB: "Protect quality",
  status: "open",
  confidence: "medium",
  evidenceCount: 2,
  lastTouchedAt: "2026-07-19T10:00:00.000Z",
  sessionOrigin: "IMPORTED_ARCHIVE",
};

function baseInput(
  overrides: Partial<MapMapDataInput> = {},
): MapMapDataInput {
  return {
    items: [
      {
        id: "umc-disputed",
        title: "Disputed UMC conflict",
        summary: "Existing disputed conclusion",
        area: "operating_logic",
        status: "disputed",
        confidenceLevel: "medium",
        evidenceCount: 4,
        updatedAt: "2026-07-18T10:00:00.000Z",
      },
    ],
    openContradictions: [OPEN_CN],
    isLoading: false,
    loadError: null,
    selectedId: null,
    detail: null,
    isDetailLoading: false,
    evidence: [],
    openQuestionsCount: 0,
    mindContext: {
      isLoading: false,
      items: [],
      summaryCounts: { memories: 0, patterns: 0 },
    },
    movementPreview: { isLoading: false, items: [] },
    openQuestionsPreview: { isLoading: false, items: [] },
    ...overrides,
  };
}

describe("Wave 1.1 ContradictionNode → Map Active conflicts projection", () => {
  it("adapter: open CN appears in Active conflicts with explicit kind and prefixed id", () => {
    const view = mapMapDataToV0Props(baseInput());
    const conflicts = view.ontologyGroups.find((group) => group.key === "conflicts");
    expect(conflicts?.label).toBe("Active conflicts");
    expect(conflicts?.items.map((item) => item.id)).toEqual([
      "conclusion-umc-disputed",
      "contradiction-cn-live-1",
    ]);
    const cn = conflicts?.items.find((item) => item.kind === "contradiction");
    expect(cn).toMatchObject({
      rawId: "cn-live-1",
      kind: "contradiction",
      inspectorObjectId: "cn-live-1",
      recentlyMoved: false,
      statusLabel: "Open",
    });
  });

  it("adapter: candidate CN is absent; disputed UMC preserved; ids unique", () => {
    const view = mapMapDataToV0Props(
      baseInput({
        openContradictions: [
          OPEN_CN,
          { ...OPEN_CN, id: "cn-live-1" },
          {
            ...OPEN_CN,
            id: "cn-candidate",
            status: "candidate",
          },
        ],
      }),
    );
    // candidate status rows must be filtered before MapMapDataInput; duplicate ids dedupe in rail.
    const conflicts = view.ontologyGroups.find((group) => group.key === "conflicts");
    const ids = conflicts?.items.map((item) => item.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("conclusion-umc-disputed");
    expect(ids).toContain("contradiction-cn-live-1");
    expect(ids.filter((id) => id === "contradiction-cn-live-1")).toHaveLength(1);
  });

  it("production object: contradiction_node inspector metadata and no UMC masquerade", () => {
    const api = buildMapProductionDataApi(baseInput({ selectedId: "contradiction-cn-live-1" }));
    const rail = api.getObject("contradiction-cn-live-1");
    const raw = api.getObject("cn-live-1");

    expect(api.mapSelectedId).toBe("contradiction-cn-live-1");
    expect(rail?.inspectorObjectType).toBe("contradiction_node");
    expect(rail?.inspectorObjectId).toBe("cn-live-1");
    expect(rail?.subtype).toBe("conflict");
    expect(rail?.confidence).toBe("Medium");
    expect(rail?.summary).toContain("Move quickly");
    expect(rail?.summary).toContain("Protect quality");
    expect(rail?.before).toBeUndefined();
    expect(rail?.after).toBeUndefined();
    expect(resolveInspectorObjectType(rail!)).toBe("contradiction_node");
    expect(raw?.inspectorObjectType).toBe("contradiction_node");

    const umc = api.getObject("conclusion-umc-disputed");
    expect(umc?.inspectorObjectType).toBe("usermap_conclusion");
  });

  it("composition-safe merge overlays live CN without replacing unrelated rails or seed conflicts", () => {
    const liveMapApi = buildMapProductionDataApi(baseInput({ items: [] }));
    const compositionConflicts = ["m-conflict-1", "m-conflict-2"];
    const compositionPatterns = ["m-pattern-1"];
    const compositionApi = withProductionContract({
      ...createMockOrvekDataApi(),
      mapCategories: [
        { id: "patterns", label: "Patterns", ids: compositionPatterns },
        { id: "conflicts", label: "Active conflicts", ids: compositionConflicts },
        { id: "claims", label: "Claims", ids: ["m-claim-1"] },
      ],
      mapHasContent: true,
      getObject: (id) => {
        if (!id) return undefined;
        if (compositionConflicts.includes(id) || id === "m-pattern-1" || id === "m-claim-1") {
          return {
            id,
            type: "map-object",
            title: id,
            inspectorObjectType: "usermap_conclusion",
            inspectorObjectId: id,
          };
        }
        return undefined;
      },
      getObjects: () => [],
    });

    const beforePatterns = compositionApi.mapCategories.find((c) => c.id === "patterns");
    const beforeClaims = compositionApi.mapCategories.find((c) => c.id === "claims");

    const merged = mergeLiveContradictionConflicts(compositionApi, liveMapApi);
    const conflicts = merged.mapCategories.find((c) => c.id === "conflicts");
    expect(conflicts?.ids).toEqual([
      "m-conflict-1",
      "m-conflict-2",
      "contradiction-cn-live-1",
    ]);
    expect(merged.mapCategories.find((c) => c.id === "patterns")).toEqual(beforePatterns);
    expect(merged.mapCategories.find((c) => c.id === "claims")).toEqual(beforeClaims);
    expect(merged.getObject("contradiction-cn-live-1")?.inspectorObjectType).toBe(
      "contradiction_node",
    );
    expect(merged.getObject("m-conflict-1")?.inspectorObjectType).toBe("usermap_conclusion");
    expect(merged.getObject("cn-live-1")?.inspectorObjectType).toBe("contradiction_node");

    const again = mergeLiveContradictionConflicts(merged, liveMapApi);
    expect(again.mapCategories.find((c) => c.id === "conflicts")?.ids).toEqual(
      conflicts?.ids,
    );
  });

  it("composition-safe merge: no live CN leaves composition byte-identical for categories", () => {
    const emptyLive = buildMapProductionDataApi(baseInput({ openContradictions: [] }));
    const compositionApi = withProductionContract({
      ...createMockOrvekDataApi(),
      mapCategories: [
        { id: "conflicts", label: "Active conflicts", ids: ["m-conflict-1"] },
      ],
      mapHasContent: true,
    });
    const merged = mergeLiveContradictionConflicts(compositionApi, emptyLive);
    expect(merged).toBe(compositionApi);
  });

  it("composition-safe merge: adds Active conflicts category when absent and live CN exists", () => {
    const liveMapApi = buildMapProductionDataApi(baseInput({ items: [] }));
    const compositionApi = withProductionContract({
      ...createMockOrvekDataApi(),
      mapCategories: [{ id: "patterns", label: "Patterns", ids: ["m-pattern-1"] }],
      mapHasContent: true,
    });
    const merged = mergeLiveContradictionConflicts(compositionApi, liveMapApi);
    expect(merged.mapCategories.find((c) => c.id === "patterns")?.ids).toEqual([
      "m-pattern-1",
    ]);
    expect(merged.mapCategories.find((c) => c.id === "conflicts")?.ids).toEqual([
      "contradiction-cn-live-1",
    ]);
  });

  it("hybrid composition workbench still runs conflicts overlay after rail ownership", () => {
    const liveMapApi = buildMapProductionDataApi(baseInput({ items: [] }));
    const todayWithComposition = withProductionContract({
      ...createMockOrvekDataApi(),
      mapCategories: [
        { id: "conflicts", label: "Active conflicts", ids: ["m-conflict-1"] },
        { id: "goals", label: "Model Goals", ids: ["m-goal-1"] },
      ],
      mapHasContent: true,
      getObject: (id) =>
        id
          ? {
              id,
              type: "map-object",
              title: id,
            }
          : undefined,
      getObjects: () => [],
    });

    const hybrid = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      todayWithComposition,
      liveMapApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { allowCompositionWorkbenchAuthority: true },
    );

    expect(hybrid.mapCategories.find((c) => c.id === "goals")?.ids).toEqual(["m-goal-1"]);
    expect(hybrid.mapCategories.find((c) => c.id === "conflicts")?.ids).toContain(
      "contradiction-cn-live-1",
    );
    expect(hybrid.mapCategories.find((c) => c.id === "conflicts")?.ids).toContain(
      "m-conflict-1",
    );
    expect(hybrid.getObject("contradiction-cn-live-1")?.inspectorObjectType).toBe(
      "contradiction_node",
    );
  });

  it("canonical live runtime receives contradiction rail and Inspector type", () => {
    const api = buildMapProductionDataApi(
      createMapContradictionProjectionFixtureInput(),
    );
    const runtime = buildCanonicalLiveRuntimeData(api);
    const conflicts = runtime.mapCategories.find((c) => c.id === "conflicts");
    const railId = mapContradictionObjectId(MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID);
    expect(conflicts?.label).toBe("Active conflicts");
    expect(conflicts?.ids).toContain(railId);
    const obj = runtime.getObject(railId);
    expect(obj?.inspectorObjectType).toBe("contradiction_node");
    expect(obj?.inspectorObjectId).toBe(MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID);
    expect(resolveInspectorObjectType(obj!)).toBe("contradiction_node");
  });

  it("dev fixture initialises on claim, not contradiction; click target keeps contradiction_node metadata", () => {
    const input = createMapContradictionProjectionFixtureInput();
    expect(input.selectedId).toBe(MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAW_ID);
    expect(input.selectedId).not.toBe(MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID);

    const api = createMapContradictionProjectionMapApi();
    expect(api.mapSelectedId).toBe(MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID);
    expect(api.mapSelectedId).not.toBe(
      MAP_CONTRADICTION_PROJECTION_FIXTURE_CONTRADICTION_RAIL_ID,
    );

    const claim = api.getObject(MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID);
    expect(claim?.title).toBe("Fixture claim (dev only)");
    expect(claim?.inspectorObjectType).toBe("usermap_conclusion");

    const conflicts = api.mapCategories.find((c) => c.id === "conflicts");
    expect(conflicts?.ids).toContain(
      MAP_CONTRADICTION_PROJECTION_FIXTURE_CONTRADICTION_RAIL_ID,
    );

    // Selecting the conflict row (human click) resolves stable id + Inspector metadata.
    const selected = api.getObject(
      MAP_CONTRADICTION_PROJECTION_FIXTURE_CONTRADICTION_RAIL_ID,
    );
    expect(selected?.id).toBe(MAP_CONTRADICTION_PROJECTION_FIXTURE_CONTRADICTION_RAIL_ID);
    expect(selected?.title).toBe("Fixture open contradiction (dev only)");
    expect(selected?.inspectorObjectType).toBe("contradiction_node");
    expect(selected?.inspectorObjectId).toBe(MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID);
    expect(resolveInspectorObjectType(selected!)).toBe("contradiction_node");

    const runtime = buildCanonicalLiveRuntimeData(api);
    expect(runtime.mapDefaultSelectedId).toBe(
      MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID,
    );
    expect(runtime.mapDefaultSelectedId).not.toBe(
      MAP_CONTRADICTION_PROJECTION_FIXTURE_CONTRADICTION_RAIL_ID,
    );
  });

  it("selection prefers contradiction rail id from URL preferred selection", () => {
    expect(
      resolveMapWorkbenchSelectedId({
        items: [],
        preferredSelectionId: OPEN_CN.id,
        mindContextItems: [],
        openContradictions: [OPEN_CN],
      }),
    ).toBe("contradiction-cn-live-1");
  });

  it("provider wiring uses fetchMapOpenContradictions and mounted canonical Map", () => {
    const hybridHook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    expect(hybridHook).toContain("fetchMapOpenContradictions");
    expect(hybridHook).toContain("openContradictions");
    expect(hybridHook).not.toContain("fake contradiction");

    const workbench = readSource("components/orvek-v0-canonical/workbench.tsx");
    expect(workbench).toContain('from "./pages/map"');
    expect(workbench).not.toContain("orvek-v0/pages/map");

    const quarantineMap = readSource("components/orvek-v0/pages/map.tsx");
    expect(quarantineMap).toContain("m-conflict-1");
  });

  it("dev fixture route is isolated and mounts canonical Map + production bridge", () => {
    const page = readSource("app/dev/contradiction-map-projection/page.tsx");
    expect(page).toContain("ContradictionMapProjectionFixtureEntry");
    expect(page).not.toContain("useOrvekHybridWorkbenchDataApi");

    const entry = readSource(
      "components/orvek-v0-canonical/contradiction-map-projection-fixture-entry.tsx",
    );
    expect(entry).toContain("enableProductionBridge");
    expect(entry).toContain("createMapContradictionProjectionRuntimeData");
    expect(entry).toContain('data-testid="contradiction-map-projection-fixture"');
    expect(entry).toContain("ForceMapInitialClaimSelection");
    expect(entry).toContain("MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID");
    expect(entry).not.toContain("ForceMapContradictionSelection");
    // Must not auto-select the contradiction rail on bootstrap.
    expect(entry).not.toMatch(
      /select\(\s*mapContradictionObjectId\(MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID\)/,
    );
  });
});
