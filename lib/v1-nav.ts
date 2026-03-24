/**
 * V1 Information Architecture — locked product structure (P1-01)
 *
 * Single source of truth for nav visibility in V1.
 * Imported by GlobalRail and nav regression tests.
 *
 * LOCKED: Do not add top-level destinations without a new packet.
 * LOCKED: Do not move hidden routes into visible nav without explicit design decision.
 */

// ── Visible core nav ─────────────────────────────────────────────────────────
// Shown to all users in the primary rail. These are the V1 product surfaces.

export const V1_CORE_ROUTES = [
  { label: "Chat", href: "/chat" },
  { label: "Patterns", href: "/patterns" },
  { label: "History", href: "/history" },
] as const;

// ── Visible secondary nav ────────────────────────────────────────────────────
// Shown below a divider. Supporting surfaces, not primary product destinations.

export const V1_SECONDARY_ROUTES = [
  { label: "Context", href: "/context" },
  { label: "Import", href: "/import" },
  { label: "Settings", href: "/settings" },
] as const;

// ── Hidden internal routes ───────────────────────────────────────────────────
// NOT in the user-facing main nav. Routes remain reachable by direct URL for
// internal tooling, debugging, and legacy data access. Do not surface these
// in any visible nav or promotion copy.

export const V1_HIDDEN_INTERNAL_ROUTES = [
  { href: "/contradictions", reason: "Internal: contradiction/tension tracking (pre-V1 surface)" },
  { href: "/references", reason: "Internal: reference/memory management (pre-V1 surface)" },
  { href: "/audit", reason: "Internal: weekly audit tool (internal analytics)" },
  { href: "/evidence", reason: "Internal: evidence browser (engineering tool)" },
  { href: "/metrics", reason: "Internal: metrics inspector (engineering tool)" },
] as const;

export type CoreRoute = (typeof V1_CORE_ROUTES)[number];
export type SecondaryRoute = (typeof V1_SECONDARY_ROUTES)[number];
export type HiddenRoute = (typeof V1_HIDDEN_INTERNAL_ROUTES)[number];

// ── Derived sets for guards ───────────────────────────────────────────────────

export const V1_VISIBLE_HREFS = new Set<string>([
  ...V1_CORE_ROUTES.map((r) => r.href),
  ...V1_SECONDARY_ROUTES.map((r) => r.href),
]);

export const V1_HIDDEN_HREFS = new Set<string>(
  V1_HIDDEN_INTERNAL_ROUTES.map((r) => r.href)
);
