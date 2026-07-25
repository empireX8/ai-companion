/**
 * DEL-003 — production live-provider authority vs reference/composition authority.
 *
 * Authenticated production must never treat CanonicalTodayComposition /
 * fixture densographs as user data. Composition authority is allowed only on
 * explicit development / visual-reference / deterministic test paths.
 */

/** Dev live-candidate route that may exercise persisted composition round-trips. */
export const COMPOSITION_AUTHORITY_PATH_PREFIXES = [
  "/dev/orvek-v0-canonical-live",
] as const;

/**
 * Explicit visual-reference fixture route — uses the fixture provider, not
 * hybrid composition authority. Listed for documentation / freeze proofs.
 */
export const VISUAL_REFERENCE_PATH_PREFIXES = [
  "/dev/orvek-v0-canonical-reference",
  "/dev/orvek-v0-reference",
] as const;

export type HybridWorkbenchAuthorityOptions = {
  /**
   * When true, a full CanonicalTodayComposition workbench may own Map /
   * Timeline / Decisions / Explore rails (reference/dev/test only).
   * Production default: false — live providers win; empty live stays honest empty.
   */
  allowCompositionWorkbenchAuthority?: boolean;
};

export function allowsCompositionWorkbenchAuthority(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return COMPOSITION_AUTHORITY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isVisualReferencePath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return VISUAL_REFERENCE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** True when a Today API carries full workbench rails from composition. */
export function isCompositionWorkbenchApi(api: {
  mapCategories?: ReadonlyArray<unknown> | null;
} | null | undefined): boolean {
  return (api?.mapCategories?.length ?? 0) > 0;
}
