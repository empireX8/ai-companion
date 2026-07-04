import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import {
  resolveOrvekObjectFromGraph,
  resolveOrvekObjectsFromGraph,
} from "../../lib/orvek-v0/data-provider";
import { getObject as getZipObject } from "../../lib/orvek-v0/orvek-data";
import type { OrvekObject } from "../../lib/orvek-v0/orvek-types";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("evidence panel provider lookup", () => {
  it("EvidencePanel resolves objects through useOrvekObjectGraph", () => {
    const source = readSource("components/orvek-v0/evidence-panel.tsx");

    expect(source).toContain("useOrvekObjectGraph");
    expect(source).toContain('from "@/lib/orvek-v0/data-provider"');
    expect(source).not.toMatch(
      /import\s*\{[^}]*\bgetObject\b[^}]*\}\s*from\s*"@\/lib\/orvek-v0\/orvek-data"/,
    );
  });

  it("prefers provider-backed objects when present", () => {
    const providerObject: OrvekObject = {
      id: "conclusion-c-1",
      type: "map-object",
      title: "Provider-backed map object",
      summary: "Hydrated through OrvekDataProvider.",
    };
    const dataApi = {
      ...createMockOrvekDataApi(),
      getObject: (id: string | null | undefined) =>
        id === "conclusion-c-1" ? providerObject : undefined,
      getObjects: (ids: string[] | undefined) =>
        resolveOrvekObjectsFromGraph(
          {
            ...createMockOrvekDataApi(),
            getObject: (id) => (id === "conclusion-c-1" ? providerObject : undefined),
            getObjects: (ids) =>
              resolveOrvekObjectsFromGraph(null, ids).filter(
                (object) => object.id !== "conclusion-c-1",
              ),
          },
          ids,
        ),
    };

    expect(resolveOrvekObjectFromGraph(dataApi, "conclusion-c-1")).toEqual(providerObject);
  });

  it("falls back to reference zip objects when provider lookup misses", () => {
    const dataApi = createMockOrvekDataApi();

    expect(resolveOrvekObjectFromGraph(dataApi, "m-claim-1")).toMatchObject(
      getZipObject("m-claim-1") ?? {},
    );
    expect(resolveOrvekObjectFromGraph(dataApi, "r6")).toMatchObject(getZipObject("r6") ?? {});
  });

  it("falls back safely when provider and zip both miss", () => {
    expect(resolveOrvekObjectFromGraph(createMockOrvekDataApi(), "missing-object-id")).toBeUndefined();
    expect(resolveOrvekObjectFromGraph(null, "missing-object-id")).toBeUndefined();
  });

  it("keeps Today reference ids available through fallback", () => {
    const dataApi = createMockOrvekDataApi();

    expect(resolveOrvekObjectFromGraph(dataApi, "d1")?.title).toBe(
      getZipObject("d1")?.title,
    );
    expect(resolveOrvekObjectsFromGraph(dataApi, ["r6", "r5", "r2"]).map((object) => object.id)).toEqual([
      "r6",
      "r5",
      "r2",
    ]);
  });

  it("does not wire root Map production fetch in the hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).not.toContain("fetchYourMapConclusions");
    expect(hookSource).not.toContain("buildMapProductionDataApi");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(shellSource).not.toContain("OrvekEvidencePanel");
    expect(workbenchSource).toContain("<EvidencePanel />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});
