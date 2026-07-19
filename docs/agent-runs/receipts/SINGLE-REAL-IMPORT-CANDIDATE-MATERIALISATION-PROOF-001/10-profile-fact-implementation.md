# 10 — Profile-fact implementation (duplicate-section repair)

## Exact root cause of duplicate Preferences / interests

Composition remaps densograph object ids (`ctx-interests` → `dev-exact-rt-…-obj-ctx-interests`). Attachment looked up only the canonical id, missed the remapped section, created a new shell with implementation-facing summary copy, and appended it to the Background / Context rail.

## Repair change

`lib/map-profile-facts.ts` — `attachMapProfileFactsToDataApi` now:

1. Resolves the existing section via `resolveExistingProfileSectionId` (canonical id, remapped `…-obj-ctx-interests` / `…-ctx-interests` suffix, or exact title).
2. Enriches **that** object additively (`profileFacts` / heading / empty copy only).
3. Preserves title, summary, whyItMatters, supporting, inspector metadata.
4. Creates a live-only shell **only** when no Preferences / interests section exists at all (and only with canonical fixture summary copy — never implementation placeholder text).
5. Dedupes facts by ReferenceItem id.

`components/orvek-v0/pages/map.tsx` — `profileSectionMappingForObject` matches remapped ids/titles so **KNOWN PREFERENCES** renders inside the existing centre panel. User-facing fact meta is `type` / `confidence` / `provenance: imported conversation` only.

## Section heading

**KNOWN PREFERENCES**

## Inspector

Same existing Preferences / interests `context_profile` selection target (remapped id preserved). No second selection target. Dedicated `reference_item` inspector fetch still unsupported — provenance stays inline.
