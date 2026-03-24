/**
 * legacy-surface-registry.ts
 *
 * Typed registry of every route that is reachable by direct URL but is
 * either removed from V1 navigation or never appeared in it.
 *
 * Used by:
 *  - scripts/check-legacy-surfaces.sh  — trust-language audit
 *  - lib/__tests__/legacy-surface-registry.test.ts — regression protection
 *
 * Status values:
 *   "redirected" — page file exists but immediately redirects away; no rendered copy
 *   "active"     — page file renders content; must pass the legacy trust audit
 */

export type LegacySurfaceStatus = "redirected" | "active";

export type LegacySurface = {
  /** Exact route path as it appears in the browser. */
  path: string;
  status: LegacySurfaceStatus;
  /** Where the route redirects to (only meaningful when status === "redirected"). */
  redirectTo: string | null;
  /** Human-readable reason this route is in the legacy list. */
  reason: string;
};

/**
 * Routes that were removed from V1 navigation and should no longer render
 * content or serve as an entry point. Kept for data-preservation (existing
 * DB rows still exist) but visitors are silently redirected.
 */
export const REDIRECTED_LEGACY_ROUTES: readonly LegacySurface[] = [
  {
    path: "/projections",
    status: "redirected",
    redirectTo: "/patterns",
    reason: "Forecast feature removed from V1; no new projections can be created",
  },
  {
    path: "/projections/:id",
    status: "redirected",
    redirectTo: "/patterns",
    reason: "Forecast detail removed from V1",
  },
] as const;

/**
 * Routes that are NOT in the V1 primary nav but still render real content
 * accessible by direct URL.
 *
 * These must pass the legacy trust audit (check-legacy-surfaces.sh).
 */
export const ACTIVE_LEGACY_ROUTES: readonly LegacySurface[] = [
  {
    path: "/help",
    status: "active",
    redirectTo: null,
    reason: "Documentation surface; direct URL only, not in primary nav",
  },
] as const;

/**
 * Formally hidden internal routes — in V1_HIDDEN_INTERNAL_ROUTES in v1-nav.ts.
 * Reachable by direct URL; not surfaced in the legacy trust audit but
 * listed here for inventory completeness.
 */
export const HIDDEN_INTERNAL_ROUTES: readonly { path: string }[] = [
  { path: "/contradictions" },
  { path: "/references" },
  { path: "/audit" },
  { path: "/evidence" },
  { path: "/metrics" },
] as const;
