import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REFERENCE_TYPE_TO_PROFILE_SECTION,
  UNSUPPORTED_MAP_PROFILE_REFERENCE_TYPES,
  attachMapProfileFactsToDataApi,
  buildMapProfileFactsFromActiveReferences,
  countBackgroundContextRailEntries,
  groupMapProfileFactsBySection,
  matchesProfileSectionIdentity,
  parseActiveReferenceProfileRowsFromListPayload,
  profileSectionMappingForObject,
  resolveExistingProfileSectionId,
  type MapProfileFact,
} from "../map-profile-facts";
import { createMockOrvekDataApi } from "../orvek-v0/mock-api";
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

const CHICKEN: MapProfileFact = {
  id: "ri-pref-1",
  statement: "I think prefer chicken burgers to beef burgers 😳",
  referenceType: "preference",
  confidence: "low",
  status: "active",
  provenanceLabel: "imported conversation",
  sourceSessionId: "session-1",
  sourceMessageId: "message-1",
  sessionOrigin: "IMPORTED_ARCHIVE",
};

function makeCompositionApi(remappedInterestsId: string): OrvekDataApi {
  const interests: OrvekObject = {
    id: remappedInterestsId,
    type: "context",
    title: "Preferences / interests",
    summary: ORIGINAL_SUMMARY,
    whyItMatters: ORIGINAL_WHY,
    supporting: [...ORIGINAL_SUPPORTING],
    inspectorObjectType: "context_profile",
    inspectorObjectId: remappedInterestsId,
  };
  const values: OrvekObject = {
    id: "dev-exact-rt-user-obj-ctx-values",
    type: "context",
    title: "Values / direction",
    summary: "Evidence, self-understanding, agency.",
    inspectorObjectType: "context_profile",
  };
  const current: OrvekObject = {
    id: "dev-exact-rt-user-obj-ctx-current",
    type: "context",
    title: "Current situation",
    summary: "Current situation summary.",
    inspectorObjectType: "context_profile",
  };
  const constraints: OrvekObject = {
    id: "dev-exact-rt-user-obj-ctx-constraints",
    type: "context",
    title: "Constraints",
    summary: "Limited time/energy.",
    inspectorObjectType: "context_profile",
  };
  const self: OrvekObject = {
    id: "dev-exact-rt-user-obj-ctx-self",
    type: "context",
    title: "Self-concept / identity context",
    summary: "Self-concept summary.",
    inspectorObjectType: "context_profile",
  };
  const objects: Record<string, OrvekObject> = {
    [interests.id]: interests,
    [values.id]: values,
    [current.id]: current,
    [constraints.id]: constraints,
    [self.id]: self,
  };
  const contextIds = [
    current.id,
    values.id,
    interests.id,
    constraints.id,
    self.id,
  ];

  return {
    ...EMPTY_ORVEK_DATA_API,
    referenceSurface: false as const,
    mapCategories: [
      {
        id: "context",
        label: "Background / Context",
        ids: contextIds,
      },
    ],
    getObject: (id: string | null | undefined) =>
      id ? objects[id] : undefined,
    getObjects: (ids: string[] | undefined) =>
      (ids ?? []).map((id) => objects[id]).filter(Boolean) as OrvekObject[],
  };
}

describe("map-profile-facts", () => {
  it("maps preference → Preferences / interests and constraint → Constraints", () => {
    expect(REFERENCE_TYPE_TO_PROFILE_SECTION.preference?.sectionObjectId).toBe(
      "ctx-interests",
    );
    expect(REFERENCE_TYPE_TO_PROFILE_SECTION.preference?.factsHeading).toBe(
      "KNOWN PREFERENCES",
    );
    expect(REFERENCE_TYPE_TO_PROFILE_SECTION.constraint?.sectionObjectId).toBe(
      "ctx-constraints",
    );
    expect(UNSUPPORTED_MAP_PROFILE_REFERENCE_TYPES).toContain("goal");
    expect(UNSUPPORTED_MAP_PROFILE_REFERENCE_TYPES).toContain("pattern");
  });

  it("builds facts only from active mapped types and dedupes by id", () => {
    const facts = buildMapProfileFactsFromActiveReferences([
      {
        id: "ri-pref-1",
        type: "preference",
        status: "active",
        statement: "I think prefer chicken burgers to beef burgers 😳",
        confidence: "low",
        sessionOrigin: "IMPORTED_ARCHIVE",
        sourceSessionId: "session-1",
        sourceMessageId: "message-1",
      },
      {
        id: "ri-pref-1",
        type: "preference",
        status: "active",
        statement: "I think prefer chicken burgers to beef burgers 😳",
        confidence: "low",
        sessionOrigin: "IMPORTED_ARCHIVE",
      },
      {
        id: "ri-cand",
        type: "preference",
        status: "candidate",
        statement: "Should not appear",
        confidence: "high",
      },
      {
        id: "ri-dismissed",
        type: "preference",
        status: "dismissed",
        statement: "Also should not appear",
        confidence: "high",
      },
      {
        id: "ri-goal",
        type: "goal",
        status: "active",
        statement: "Finish the book",
        confidence: "medium",
      },
      {
        id: "ri-constraint",
        type: "constraint",
        status: "active",
        statement: "Always optimise for objectivity",
        confidence: "low",
        sessionOrigin: "IMPORTED_ARCHIVE",
      },
    ]);

    expect(facts).toHaveLength(2);
    expect(facts.map((f) => f.id).sort()).toEqual([
      "ri-constraint",
      "ri-pref-1",
    ]);
    expect(facts.find((f) => f.id === "ri-pref-1")?.statement).toContain(
      "chicken burgers",
    );
    expect(facts.find((f) => f.id === "ri-pref-1")?.confidence).toBe("low");
    expect(facts.find((f) => f.id === "ri-pref-1")?.provenanceLabel).toBe(
      "imported conversation",
    );
  });

  it("section-count: exactly one Preferences / interests rail entry after attach", () => {
    const remappedId =
      "dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-obj-ctx-interests";
    const api = makeCompositionApi(remappedId);
    const beforeCount = countBackgroundContextRailEntries(api);
    expect(beforeCount).toBe(5);

    const enriched = attachMapProfileFactsToDataApi(api, [CHICKEN]);
    const afterCount = countBackgroundContextRailEntries(enriched);

    expect(afterCount).toBe(5);
    expect(afterCount).toBe(beforeCount);

    const contextCategory = enriched.mapCategories.find(
      (c) => c.id === "context",
    );
    expect(contextCategory?.ids).toHaveLength(5);

    const titles = (contextCategory?.ids ?? [])
      .map((id) => enriched.getObject(id)?.title)
      .filter(Boolean);
    expect(titles.filter((t) => t === "Preferences / interests")).toHaveLength(
      1,
    );

    // Must enrich the remapped existing section, not invent canonical ctx-interests.
    expect(enriched.getObject("ctx-interests")).toBeUndefined();
    const obj = enriched.getObject(remappedId);
    expect(obj?.id).toBe(remappedId);
    expect(obj?.title).toBe("Preferences / interests");
    expect(obj?.profileFacts).toHaveLength(1);
    expect(obj?.profileFacts?.[0]?.statement).toBe(CHICKEN.statement);
  });

  it("preserved-summary: existing summary and supporting evidence remain unchanged", () => {
    const remappedId =
      "dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-obj-ctx-interests";
    const api = makeCompositionApi(remappedId);
    const before = api.getObject(remappedId)!;
    const enriched = attachMapProfileFactsToDataApi(api, [CHICKEN]);
    const after = enriched.getObject(remappedId)!;

    expect(after.summary).toBe(before.summary);
    expect(after.summary).toBe(ORIGINAL_SUMMARY);
    expect(after.whyItMatters).toBe(before.whyItMatters);
    expect(after.supporting).toEqual(before.supporting);
    expect(after.supporting).toEqual(ORIGINAL_SUPPORTING);
    expect(after.title).toBe(before.title);
    expect(after.inspectorObjectType).toBe(before.inspectorObjectType);
    expect(after.inspectorObjectId).toBe(before.inspectorObjectId);
    expect(after.profileFactsHeading).toBe("KNOWN PREFERENCES");
    expect(after.profileFacts?.[0]?.statement).toBe(CHICKEN.statement);

    const serialized = JSON.stringify(after);
    expect(serialized).not.toContain(
      "Accepted profile facts for this area appear below",
    );
    expect(serialized).not.toContain("silent merge");
    expect(serialized).not.toContain("materialisation");
    expect(serialized).not.toContain("adapter");
  });

  it("dedupes duplicate fact inputs to a single accepted fact", () => {
    const remappedId =
      "dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-obj-ctx-interests";
    const api = makeCompositionApi(remappedId);
    const enriched = attachMapProfileFactsToDataApi(api, [CHICKEN, CHICKEN]);
    expect(enriched.getObject(remappedId)?.profileFacts).toHaveLength(1);
  });

  it("matches remapped densograph section ids", () => {
    const mapping = REFERENCE_TYPE_TO_PROFILE_SECTION.preference!;
    expect(
      matchesProfileSectionIdentity(
        "dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-obj-ctx-interests",
        "Preferences / interests",
        mapping,
      ),
    ).toBe(true);
    expect(
      matchesProfileSectionIdentity("ctx-interests", undefined, mapping),
    ).toBe(true);
    expect(
      matchesProfileSectionIdentity(
        "dev-exact-rt-user-obj-ctx-values",
        "Values / direction",
        mapping,
      ),
    ).toBe(false);
  });

  it("resolveExistingProfileSectionId finds remapped Preferences section", () => {
    const remappedId =
      "dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-obj-ctx-interests";
    const api = makeCompositionApi(remappedId);
    const mapping = REFERENCE_TYPE_TO_PROFILE_SECTION.preference!;
    expect(resolveExistingProfileSectionId(api, mapping)).toBe(remappedId);
  });

  it("excludes candidate and dismissed facts", () => {
    const facts = buildMapProfileFactsFromActiveReferences([
      {
        id: "ri-cand",
        type: "preference",
        status: "candidate",
        statement: "Should not appear",
        confidence: "high",
      },
      {
        id: "ri-dismissed",
        type: "preference",
        status: "dismissed",
        statement: "Also should not appear",
        confidence: "high",
      },
    ]);
    expect(facts).toEqual([]);
  });

  it("does not place goal facts into Preferences / interests", () => {
    const facts = buildMapProfileFactsFromActiveReferences([
      {
        id: "ri-goal",
        type: "goal",
        status: "active",
        statement: "Finish the book",
        confidence: "medium",
      },
    ]);
    const grouped = groupMapProfileFactsBySection(facts);
    expect(grouped.get("ctx-interests") ?? []).toEqual([]);
    expect(facts).toEqual([]);
  });

  it("does not attach live profile facts onto referenceSurface fixture APIs", () => {
    const mock = createMockOrvekDataApi();
    const withFlag = { ...mock, referenceSurface: true as const };
    const enriched = attachMapProfileFactsToDataApi(withFlag, [CHICKEN]);
    expect(enriched).toBe(withFlag);
    const interests = enriched.getObject("ctx-interests");
    expect(interests?.profileFacts).toBeUndefined();
  });

  it("creates a live Preferences shell only when no existing section exists", () => {
    const base: OrvekDataApi = {
      ...EMPTY_ORVEK_DATA_API,
      referenceSurface: false as const,
      mapCategories: [],
      getObject: () => undefined,
      getObjects: () => [],
    };
    const enriched = attachMapProfileFactsToDataApi(base, [CHICKEN]);
    expect(countBackgroundContextRailEntries(enriched)).toBe(1);
    expect(
      enriched.mapCategories.some((c) => c.ids.includes("ctx-interests")),
    ).toBe(true);
    const obj = enriched.getObject("ctx-interests");
    expect(obj?.summary).toBe(ORIGINAL_SUMMARY);
    expect(obj?.whyItMatters).toBe(ORIGINAL_WHY);
    expect(obj?.profileFacts?.[0]?.id).toBe("ri-pref-1");
    expect(JSON.stringify(obj)).not.toContain(
      "Accepted profile facts for this area appear below",
    );
  });

  it("parses list payload rows including provenance fields", () => {
    const rows = parseActiveReferenceProfileRowsFromListPayload([
      {
        id: "a",
        type: "preference",
        status: "active",
        statement: "Prefer quiet mornings",
        confidence: "medium",
        sourceSessionId: "s1",
        sourceMessageId: "m1",
        sessionOrigin: "IMPORTED_ARCHIVE",
      },
    ]);
    expect(rows[0]?.sourceMessageId).toBe("m1");
    expect(rows[0]?.sessionOrigin).toBe("IMPORTED_ARCHIVE");
  });
});

describe("map profile-fact wiring", () => {
  it("hybrid hook fetches and attaches profile facts on live path", () => {
    const hook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    expect(hook).toContain("fetchActiveMapProfileFacts");
    expect(hook).toContain("attachMapProfileFactsToDataApi");
    expect(hook).toContain("mapProfileFacts");
  });

  it("Map centre panel renders profile facts under mapped section heading", () => {
    // Production /your-map mounts canonical Map; quarantined parallel must stay in sync.
    for (const relative of [
      "components/orvek-v0-canonical/pages/map.tsx",
      "components/orvek-v0/pages/map.tsx",
    ]) {
      const mapPage = readSource(relative);
      expect(mapPage).toContain("profileSectionMappingForObject");
      expect(mapPage).toContain("map-profile-facts");
      expect(mapPage).toContain("profileFactsHeading");
      expect(mapPage).toContain("referenceSurface === true");
      expect(mapPage).not.toContain(
        "Accepted profile facts for this area appear below",
      );
      expect(mapPage).not.toContain("Accepted profile fact — not a ModelUpdate");
    }
    const factsModule = readSource("lib/map-profile-facts.ts");
    expect(factsModule).toContain('factsHeading: "KNOWN PREFERENCES"');
  });

  it("reference list exposes sourceMessageId for provenance", () => {
    const route = readSource("app/api/reference/list/route.ts");
    expect(route).toContain("sourceMessageId: true");
  });

  it("frozen reference Map page does not import live profile-fact fetch", () => {
    const frozen = readSource(
      "components/orvek-v0-reference-frozen/pages/map.tsx",
    );
    expect(frozen).not.toContain("fetchActiveMapProfileFacts");
    expect(frozen).not.toContain("attachMapProfileFactsToDataApi");
  });

  it("does not hard-code the chicken-burger campaign ReferenceItem id in product code", () => {
    const productFiles = [
      "lib/map-profile-facts.ts",
      "components/orvek-v0/pages/map.tsx",
      "components/orvek-v0-canonical/pages/map.tsx",
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
      "app/api/reference/list/route.ts",
    ];
    for (const file of productFiles) {
      const source = readSource(file);
      expect(source).not.toContain("3a6163dd-0f85-4bf5-8eb8-924579f1db62");
    }
  });

  it("shellObjectForSection does not use implementation-facing placeholder copy", () => {
    const source = readSource("lib/map-profile-facts.ts");
    expect(source).not.toContain(
      "Accepted profile facts for this area appear below",
    );
    expect(source).not.toContain("silent merge of each fact");
    expect(source).toContain("defaultSummary");
    expect(source).toContain(ORIGINAL_SUMMARY);
  });
});
