/**
 * Actual `/your-map` runtime path for accepted Map profile facts.
 *
 * Production does NOT mount quarantined `orvek-v0/pages/map.tsx`.
 * The live shell voids route children and renders
 * `orvek-v0-canonical/pages/map.tsx` via CanonicalLiveRuntimeEntry.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  attachMapProfileFactsToDataApi,
  buildMapProfileFactsFromActiveReferences,
  countBackgroundContextRailEntries,
  parseActiveReferenceProfileRowsFromListPayload,
} from "../map-profile-facts";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import type { OrvekDataApi } from "../orvek-v0/data-provider";
import type { OrvekObject } from "../orvek-v0/orvek-types";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const ORIGINAL_SUMMARY =
  "Private intelligence, systems architecture, AI workflows, decision clarity, philosophy, performance.";
const ORIGINAL_WHY =
  "Interests bias the product toward depth and systems thinking.";
const ORIGINAL_SUPPORTING = [
  "Recurring systems-architecture language across receipts",
];
const CHICKEN_STATEMENT =
  "I think prefer chicken burgers to beef burgers 😳";
const REMAPPED_INTERESTS_ID =
  "dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-obj-ctx-interests";

function makeYourMapCompositionApi(): OrvekDataApi {
  const interests: OrvekObject = {
    id: REMAPPED_INTERESTS_ID,
    type: "context",
    title: "Preferences / interests",
    summary: ORIGINAL_SUMMARY,
    whyItMatters: ORIGINAL_WHY,
    supporting: [...ORIGINAL_SUPPORTING],
    inspectorObjectType: "context_profile",
    inspectorObjectId: REMAPPED_INTERESTS_ID,
  };
  const others: OrvekObject[] = [
    {
      id: "dev-exact-rt-user-obj-ctx-values",
      type: "context",
      title: "Values / direction",
      summary: "Evidence, self-understanding, agency.",
      inspectorObjectType: "context_profile",
    },
    {
      id: "dev-exact-rt-user-obj-ctx-current",
      type: "context",
      title: "Current situation",
      summary: "Current situation summary.",
      inspectorObjectType: "context_profile",
    },
    {
      id: "dev-exact-rt-user-obj-ctx-constraints",
      type: "context",
      title: "Constraints",
      summary: "Limited time/energy.",
      inspectorObjectType: "context_profile",
    },
    {
      id: "dev-exact-rt-user-obj-ctx-self",
      type: "context",
      title: "Self-concept / identity context",
      summary: "Self-concept summary.",
      inspectorObjectType: "context_profile",
    },
  ];
  const objects: Record<string, OrvekObject> = {
    [interests.id]: interests,
  };
  for (const o of others) objects[o.id] = o;

  return {
    ...EMPTY_ORVEK_DATA_API,
    referenceSurface: false as const,
    mapCategories: [
      {
        id: "context",
        label: "Background / Context",
        ids: [
          "dev-exact-rt-user-obj-ctx-current",
          "dev-exact-rt-user-obj-ctx-values",
          REMAPPED_INTERESTS_ID,
          "dev-exact-rt-user-obj-ctx-constraints",
          "dev-exact-rt-user-obj-ctx-self",
        ],
      },
    ],
    mapSelectedId: REMAPPED_INTERESTS_ID,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? []).map((id) => objects[id]).filter(Boolean) as OrvekObject[],
  };
}

/**
 * Mirrors `buildCanonicalLiveRuntimeData` object resolution:
 * canonical Map reads `getObject` from the live hybrid api (post-attach).
 */
function canonicalGetObjectFromLiveApi(liveApi: OrvekDataApi) {
  return (id: string | null | undefined) => liveApi.getObject(id);
}

describe("actual /your-map runtime profile facts", () => {
  it("production chain voids route children and mounts canonical MapPage", () => {
    const shell = readSource(
      "components/orvek-workbench/OrvekWorkbenchShell.tsx",
    );
    const entry = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );
    const workbench = readSource(
      "components/orvek-v0-canonical/workbench.tsx",
    );
    const liveProvider = readSource(
      "components/orvek-v0-canonical/live-provider.ts",
    );
    const route = readSource("app/(root)/(routes)/your-map/page.tsx");

    expect(shell).toContain("void children");
    expect(shell).toContain("CanonicalLiveRuntimeEntry");
    expect(entry).toContain("useOrvekHybridWorkbenchDataApi");
    expect(entry).toContain("buildCanonicalLiveRuntimeData");
    expect(workbench).toMatch(/case "map":\s*return <MapPage \/>/);
    expect(workbench).toContain('from "./pages/map"');
    expect(liveProvider).toContain(
      "const getObject = (id: string | null | undefined) => liveApi.getObject(id)",
    );
    expect(route).toContain("OrvekMapPage");
    // Quarantined route container is never the live Map UI.
    expect(shell).not.toContain("OrvekMapPage");
  });

  it("canonical Map centre panel renders KNOWN PREFERENCES from profileFacts", () => {
    const canonicalMap = readSource(
      "components/orvek-v0-canonical/pages/map.tsx",
    );
    expect(canonicalMap).toContain("profileSectionMappingForObject");
    expect(canonicalMap).toContain("map-profile-facts");
    expect(canonicalMap).toContain("profileFacts");
    expect(canonicalMap).toContain("profileFactsHeading");
    expect(canonicalMap).toContain("referenceSurface === true");
    expect(canonicalMap).not.toContain(
      "Accepted profile facts for this area appear below",
    );
    expect(canonicalMap).not.toContain("3a6163dd-0f85-4bf5-8eb8-924579f1db62");
  });

  it("live provider path: active preference attaches to rendered ctx-interests and reaches canonical getObject", () => {
    const listPayload = [
      {
        id: "ri-pref-live-1",
        type: "preference",
        status: "active",
        statement: CHICKEN_STATEMENT,
        confidence: "low",
        sessionOrigin: "IMPORTED_ARCHIVE",
        sourceSessionId: "sess-1",
        sourceMessageId: "msg-1",
      },
      {
        id: "ri-pref-candidate",
        type: "preference",
        status: "candidate",
        statement: "Should stay excluded",
        confidence: "high",
        sessionOrigin: "IMPORTED_ARCHIVE",
      },
      {
        id: "ri-pref-dismissed",
        type: "preference",
        status: "dismissed",
        statement: "Also excluded",
        confidence: "high",
      },
    ];

    const rows = parseActiveReferenceProfileRowsFromListPayload(listPayload);
    const facts = buildMapProfileFactsFromActiveReferences(rows);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.statement).toBe(CHICKEN_STATEMENT);

    const before = makeYourMapCompositionApi();
    expect(countBackgroundContextRailEntries(before)).toBe(5);

    // Same order as production: hybrid attach, then canonical live getObject forward.
    const attached = attachMapProfileFactsToDataApi(before, facts);
    const getObject = canonicalGetObjectFromLiveApi(attached);

    expect(countBackgroundContextRailEntries(attached)).toBe(5);

    const titles = (
      attached.mapCategories.find((c) => c.id === "context")?.ids ?? []
    )
      .map((id) => getObject(id)?.title)
      .filter(Boolean);
    expect(titles.filter((t) => t === "Preferences / interests")).toHaveLength(
      1,
    );

    const rendered = getObject(REMAPPED_INTERESTS_ID);
    expect(rendered?.summary).toBe(ORIGINAL_SUMMARY);
    expect(rendered?.whyItMatters).toBe(ORIGINAL_WHY);
    expect(rendered?.supporting).toEqual(ORIGINAL_SUPPORTING);
    expect(rendered?.profileFactsHeading).toBe("KNOWN PREFERENCES");
    expect(rendered?.profileFacts).toHaveLength(1);
    expect(rendered?.profileFacts?.[0]?.statement).toBe(CHICKEN_STATEMENT);
    expect(rendered?.profileFacts?.[0]?.provenanceLabel).toBe(
      "imported conversation",
    );

    // Fixture/reference surfaces must not leak live facts into frozen Map.
    const fixtureSurface: OrvekDataApi = {
      ...before,
      referenceSurface: true as const,
    };
    const fixtureAttached = attachMapProfileFactsToDataApi(
      fixtureSurface,
      facts,
    );
    expect(
      fixtureAttached.getObject(REMAPPED_INTERESTS_ID)?.profileFacts,
    ).toBeUndefined();
  });

  it("hybrid hook still fetches and attaches on the live /your-map path", () => {
    const hook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    expect(hook).toContain("fetchActiveMapProfileFacts");
    expect(hook).toContain("attachMapProfileFactsToDataApi");
    expect(hook).not.toContain("3a6163dd-0f85-4bf5-8eb8-924579f1db62");
  });
});
