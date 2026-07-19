/**
 * Map profile-fact layer — accepted active ReferenceItems as readable profile facts.
 *
 * Product contract: Preferences / interests (and mapped sections) show concrete
 * accepted facts under the high-level "Current understanding" summary.
 * Does not fabricate ModelUpdates or UnderstandingEvidenceLinks.
 *
 * Attachment must enrich the existing canonical profile section by stable
 * section identity (canonical id, remapped densograph id suffix, or title).
 * Never append a duplicate rail entry with the same title.
 */

import type { OrvekDataApi } from "@/lib/orvek-v0/data-provider";
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types";

export type MapProfileReferenceType =
  | "constraint"
  | "pattern"
  | "goal"
  | "preference"
  | "assumption"
  | "hypothesis"
  | "rule"
  | "source";

export type MapProfileFactConfidence = "low" | "medium" | "high";

export type MapProfileFact = {
  /** ReferenceItem.id — never a hard-coded campaign id. */
  id: string;
  statement: string;
  referenceType: MapProfileReferenceType;
  confidence: MapProfileFactConfidence;
  status: "active";
  /** Honest user-facing provenance (not a ModelUpdate claim). */
  provenanceLabel: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  sessionOrigin: string | null;
};

export type MapProfileSectionMapping = {
  /** Stable canonical fixture id (e.g. ctx-interests). */
  sectionObjectId: string;
  sectionTitle: string;
  factsHeading: string;
  emptyFactsCopy: string;
  /** Canonical fixture summary used only when creating a live-only shell. */
  defaultSummary: string;
  defaultWhyItMatters: string;
};

/** Truthful destinations only — unsupported types are recorded as gaps. */
export const REFERENCE_TYPE_TO_PROFILE_SECTION: Partial<
  Record<MapProfileReferenceType, MapProfileSectionMapping>
> = {
  preference: {
    sectionObjectId: "ctx-interests",
    sectionTitle: "Preferences / interests",
    factsHeading: "KNOWN PREFERENCES",
    emptyFactsCopy: "No accepted preferences in your model yet.",
    defaultSummary:
      "Private intelligence, systems architecture, AI workflows, decision clarity, philosophy, performance.",
    defaultWhyItMatters:
      "Interests bias the product toward depth and systems thinking.",
  },
  constraint: {
    sectionObjectId: "ctx-constraints",
    sectionTitle: "Constraints",
    factsHeading: "KNOWN CONSTRAINTS",
    emptyFactsCopy: "No accepted constraints in your model yet.",
    defaultSummary:
      "Limited time/energy, pressure to move fast, risk of scope reopening.",
    defaultWhyItMatters:
      "Constraints raise the cost of the scope-reopening loop.",
  },
};

/**
 * Types with no truthful Map profile-section destination today.
 * Goals remain UserMap / Decisions destinations, not this profile-fact layer.
 */
export const UNSUPPORTED_MAP_PROFILE_REFERENCE_TYPES: readonly MapProfileReferenceType[] =
  [
    "goal",
    "pattern",
    "assumption",
    "hypothesis",
    "rule",
    "source",
  ];

export type ActiveReferenceProfileRow = {
  id: string;
  type: string;
  status: string;
  statement: string;
  confidence: string;
  sourceSessionId?: string | null;
  sourceMessageId?: string | null;
  sessionOrigin?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const ACTIVE_REFERENCE_LIST_ENDPOINT =
  "/api/reference/list?status=active&limit=50";

function isProfileConfidence(value: string): value is MapProfileFactConfidence {
  return value === "low" || value === "medium" || value === "high";
}

function isProfileReferenceType(value: string): value is MapProfileReferenceType {
  return (
    value === "constraint" ||
    value === "pattern" ||
    value === "goal" ||
    value === "preference" ||
    value === "assumption" ||
    value === "hypothesis" ||
    value === "rule" ||
    value === "source"
  );
}

function isBackgroundContextCategory(category: {
  id: string;
  label: string;
}): boolean {
  return (
    category.id === "context" || category.label === "Background / Context"
  );
}

function countBackgroundContextEntries(api: OrvekDataApi): number {
  for (const category of api.mapCategories ?? []) {
    if (isBackgroundContextCategory(category)) {
      return category.ids.length;
    }
  }
  return 0;
}

export function provenanceLabelForSessionOrigin(
  sessionOrigin: string | null | undefined,
): string {
  if (sessionOrigin === "IMPORTED_ARCHIVE") {
    return "imported conversation";
  }
  if (sessionOrigin === "APP") {
    return "in-app capture";
  }
  if (sessionOrigin) {
    return sessionOrigin;
  }
  return "source unavailable";
}

/**
 * Build profile facts from active ReferenceItem rows only.
 * Candidate / dismissed / superseded / inactive never become facts.
 */
export function buildMapProfileFactsFromActiveReferences(
  rows: ActiveReferenceProfileRow[],
): MapProfileFact[] {
  const seen = new Set<string>();
  const facts: MapProfileFact[] = [];

  for (const row of rows) {
    if (row.status !== "active") continue;
    if (!isProfileReferenceType(row.type)) continue;
    if (!REFERENCE_TYPE_TO_PROFILE_SECTION[row.type]) continue;
    const statement = String(row.statement ?? "").trim();
    if (!statement) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);

    const confidence = isProfileConfidence(row.confidence)
      ? row.confidence
      : "low";

    facts.push({
      id: row.id,
      statement,
      referenceType: row.type,
      confidence,
      status: "active",
      provenanceLabel: provenanceLabelForSessionOrigin(row.sessionOrigin ?? null),
      sourceSessionId: row.sourceSessionId ?? null,
      sourceMessageId: row.sourceMessageId ?? null,
      sessionOrigin: row.sessionOrigin ?? null,
    });
  }

  return facts;
}

export function groupMapProfileFactsBySection(
  facts: MapProfileFact[],
): Map<string, MapProfileFact[]> {
  const grouped = new Map<string, MapProfileFact[]>();
  for (const fact of facts) {
    const mapping = REFERENCE_TYPE_TO_PROFILE_SECTION[fact.referenceType];
    if (!mapping) continue;
    const list = grouped.get(mapping.sectionObjectId) ?? [];
    list.push(fact);
    grouped.set(mapping.sectionObjectId, list);
  }
  return grouped;
}

/** Canonical id, remapped densograph id (...-obj-ctx-interests), or exact title. */
export function matchesProfileSectionIdentity(
  objectId: string,
  objectTitle: string | undefined,
  mapping: MapProfileSectionMapping,
): boolean {
  if (objectId === mapping.sectionObjectId) return true;
  if (objectId.endsWith(`-obj-${mapping.sectionObjectId}`)) return true;
  if (objectId.endsWith(`-${mapping.sectionObjectId}`)) return true;
  if (objectTitle === mapping.sectionTitle) return true;
  return false;
}

export function profileSectionMappingForObject(
  object: OrvekObject | null | undefined,
): MapProfileSectionMapping | null {
  if (!object) return null;
  for (const mapping of Object.values(REFERENCE_TYPE_TO_PROFILE_SECTION)) {
    if (!mapping) continue;
    if (matchesProfileSectionIdentity(object.id, object.title, mapping)) {
      return mapping;
    }
  }
  return null;
}

/** Test helper: count Background / Context rail entries. */
export function countBackgroundContextRailEntries(api: OrvekDataApi): number {
  return countBackgroundContextEntries(api);
}

/**
 * Resolve the actual rail object id for a canonical profile section.
 * Handles remapped densograph ids (e.g. dev-exact-rt-…-obj-ctx-interests).
 */
export function resolveExistingProfileSectionId(
  api: OrvekDataApi,
  mapping: MapProfileSectionMapping,
): string | null {
  const baseGetObject = api.getObject.bind(api);

  for (const category of api.mapCategories ?? []) {
    if (!isBackgroundContextCategory(category)) continue;

    for (const objectId of category.ids) {
      const object = baseGetObject(objectId);
      if (matchesProfileSectionIdentity(objectId, object?.title, mapping)) {
        return objectId;
      }
    }
  }

  // Fallback: direct canonical id lookup (non-remapped live shells).
  const direct = baseGetObject(mapping.sectionObjectId);
  if (
    direct &&
    matchesProfileSectionIdentity(direct.id, direct.title, mapping)
  ) {
    return direct.id;
  }

  return null;
}

function shellObjectForSection(mapping: MapProfileSectionMapping): OrvekObject {
  return {
    id: mapping.sectionObjectId,
    type: "context",
    subtype: "context",
    title: mapping.sectionTitle,
    summary: mapping.defaultSummary,
    whyItMatters: mapping.defaultWhyItMatters,
    inspectorObjectType: "context_profile",
    inspectorObjectId: mapping.sectionObjectId,
    profileFacts: [],
    profileFactsHeading: mapping.factsHeading,
    profileFactsEmptyCopy: mapping.emptyFactsCopy,
  };
}

function dedupeProfileFacts(facts: MapProfileFact[]): MapProfileFact[] {
  const seen = new Set<string>();
  const out: MapProfileFact[] = [];
  for (const fact of facts) {
    if (seen.has(fact.id)) continue;
    seen.add(fact.id);
    out.push(fact);
  }
  return out;
}

function withProfileFacts(
  object: OrvekObject,
  facts: MapProfileFact[],
  mapping: MapProfileSectionMapping,
): OrvekObject {
  // Additive only — preserve title, summary, whyItMatters, supporting, inspector metadata.
  return {
    ...object,
    profileFacts: dedupeProfileFacts(facts),
    profileFactsHeading: mapping.factsHeading,
    profileFactsEmptyCopy: mapping.emptyFactsCopy,
  };
}

function ensureBackgroundContextCategory(
  categories: OrvekDataApi["mapCategories"],
  sectionObjectId: string,
): OrvekDataApi["mapCategories"] {
  const next = categories.map((category) => {
    if (!isBackgroundContextCategory(category)) return category;
    if (category.ids.includes(sectionObjectId)) return category;
    return { ...category, ids: [...category.ids, sectionObjectId] };
  });

  const hasContext = next.some((category) =>
    isBackgroundContextCategory(category),
  );
  if (hasContext) return next;

  return [
    ...next,
    {
      id: "context",
      label: "Background / Context",
      ids: [sectionObjectId],
    },
  ];
}

/**
 * Attach live DB-backed profile facts onto existing Map profile section objects
 * by stable section identity. Never appends a duplicate Preferences / interests
 * (or Constraints) rail entry when one already exists under a remapped id.
 */
export function attachMapProfileFactsToDataApi(
  api: OrvekDataApi,
  facts: MapProfileFact[],
): OrvekDataApi {
  if (api.referenceSurface === true) {
    return api;
  }

  const groupedByCanonical = groupMapProfileFactsBySection(facts);
  const baseGetObject = api.getObject.bind(api);
  const enrichedByActualId = new Map<string, OrvekObject>();
  let mapCategories = (api.mapCategories ?? []).map((c) => ({
    ...c,
    ids: [...c.ids],
  }));

  for (const mapping of Object.values(REFERENCE_TYPE_TO_PROFILE_SECTION)) {
    if (!mapping) continue;
    const sectionFacts = groupedByCanonical.get(mapping.sectionObjectId) ?? [];
    const existingId = resolveExistingProfileSectionId(api, mapping);

    if (existingId) {
      const existing = baseGetObject(existingId);
      if (!existing) {
        // Rail lists the id but object graph missed it — still do not append a duplicate title.
        continue;
      }
      enrichedByActualId.set(
        existingId,
        withProfileFacts(existing, sectionFacts, mapping),
      );
      continue;
    }

    // No existing Preferences/Constraints section in the rail: only create a
    // shell when we have facts to show (live path without composition).
    if (sectionFacts.length === 0) continue;

    const shell = withProfileFacts(
      shellObjectForSection(mapping),
      sectionFacts,
      mapping,
    );
    enrichedByActualId.set(shell.id, shell);
    mapCategories = ensureBackgroundContextCategory(mapCategories, shell.id);
  }

  return {
    ...api,
    mapCategories,
    mapHasContent:
      api.mapHasContent ||
      mapCategories.some((category) => category.ids.length > 0),
    getObject: (id) => {
      if (!id) return undefined;
      if (enrichedByActualId.has(id)) return enrichedByActualId.get(id);
      return baseGetObject(id);
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];
      for (const id of ids ?? []) {
        if (!id) continue;
        const object = enrichedByActualId.get(id) ?? baseGetObject(id);
        if (object) resolved.push(object);
      }
      return resolved;
    },
  };
}

export function parseActiveReferenceProfileRowsFromListPayload(
  payload: unknown,
): ActiveReferenceProfileRow[] {
  const items = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items as unknown[])
      : [];

  const rows: ActiveReferenceProfileRow[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string") continue;
    if (typeof row.type !== "string") continue;
    if (typeof row.status !== "string") continue;
    if (typeof row.statement !== "string") continue;
    rows.push({
      id: row.id,
      type: row.type,
      status: row.status,
      statement: row.statement,
      confidence: typeof row.confidence === "string" ? row.confidence : "low",
      sourceSessionId:
        typeof row.sourceSessionId === "string" ? row.sourceSessionId : null,
      sourceMessageId:
        typeof row.sourceMessageId === "string" ? row.sourceMessageId : null,
      sessionOrigin:
        typeof row.sessionOrigin === "string" ? row.sessionOrigin : null,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
    });
  }
  return rows;
}

export async function fetchActiveMapProfileFacts(): Promise<MapProfileFact[]> {
  try {
    const response = await fetch(ACTIVE_REFERENCE_LIST_ENDPOINT, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as unknown;
    const rows = parseActiveReferenceProfileRowsFromListPayload(payload);
    return buildMapProfileFactsFromActiveReferences(rows);
  } catch {
    return [];
  }
}
