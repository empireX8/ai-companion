/**
 * V1 Information Architecture — Orvek workbench (locked primary surfaces)
 *
 * Single source of truth for shell rail, command palette, and nav regression tests.
 * Primary surfaces: Today, Map, Decisions, Timeline, Explore.
 * Layer utilities: What Changed, Watch For, Import, Search, Context, References.
 * Legacy/support routes remain reachable but are not primary IA.
 */

import { PRODUCT_NAME } from "./trust-language";

export type V1NavRoute = {
  href: string;
  label: string;
};

export type V1NavAction = {
  id: string;
  label: string;
};

/** Primary V1 workbench surfaces — equal top-level product destinations. */
export const V1_PRIMARY_ROUTES = [
  { href: "/", label: "Today" },
  { href: "/your-map", label: "Map" },
  { href: "/actions", label: "Decisions" },
  { href: "/timeline", label: "Timeline" },
  { href: "/explore", label: "Explore" },
] as const satisfies readonly V1NavRoute[];

/** Layer / utility surfaces — supporting tools, not primary nav peers. */
export const V1_LAYER_ROUTES = [
  { href: "/what-changed", label: "What Changed" },
  { href: "/watch-for", label: "Watch For" },
  { href: "/import", label: "Import" },
  { href: "/context", label: "Context" },
  { href: "/memories", label: "References" },
] as const satisfies readonly V1NavRoute[];

/** Palette-only layer actions (no dedicated primary route). */
export const V1_LAYER_ACTIONS = [{ id: "search", label: "Search" }] as const satisfies readonly V1NavAction[];

/**
 * Legacy / support surfaces — still reachable, grouped below primary in command palette.
 * Includes pre-V1 MindLab routes and deep links users may bookmark.
 */
export const V1_LEGACY_SUPPORT_ROUTES = [
  { href: "/journal-chat", label: "Journal" },
  { href: "/chat", label: "Chat" },
  { href: "/patterns", label: "Patterns" },
  { href: "/history", label: "History" },
  { href: "/contradictions", label: "Tensions" },
  { href: "/check-ins", label: "Check-ins" },
  { href: "/active-questions", label: "Active Questions" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
  { href: "/account", label: "Account" },
] as const satisfies readonly V1NavRoute[];

/** Internal / engineering routes — not promoted in shell IA. */
export const V1_HIDDEN_INTERNAL_ROUTES = [
  { href: "/references", reason: "Alias of /memories; not a separate V1 destination" },
  { href: "/audit", reason: "Internal: weekly audit tool (internal analytics)" },
  { href: "/evidence", reason: "Internal: evidence browser (engineering tool)" },
  { href: "/metrics", reason: "Internal: metrics inspector (engineering tool)" },
] as const;

export type PrimaryRoute = (typeof V1_PRIMARY_ROUTES)[number];
export type LayerRoute = (typeof V1_LAYER_ROUTES)[number];
export type LegacySupportRoute = (typeof V1_LEGACY_SUPPORT_ROUTES)[number];
export type HiddenRoute = (typeof V1_HIDDEN_INTERNAL_ROUTES)[number];

/** @deprecated Use V1_PRIMARY_ROUTES — kept for gradual migration of older imports. */
export const V1_CORE_ROUTES = V1_PRIMARY_ROUTES;

/** @deprecated Use V1_LAYER_ROUTES + V1_LEGACY_SUPPORT_ROUTES. */
export const V1_SECONDARY_ROUTES = V1_LAYER_ROUTES;

export const V1_SHELL_PRIMARY_HREFS = new Set<string>(
  V1_PRIMARY_ROUTES.map((route) => route.href)
);

export const V1_SHELL_LAYER_HREFS = new Set<string>(
  V1_LAYER_ROUTES.map((route) => route.href)
);

export const V1_VISIBLE_HREFS = new Set<string>([
  ...V1_PRIMARY_ROUTES.map((route) => route.href),
  ...V1_LAYER_ROUTES.map((route) => route.href),
  ...V1_LEGACY_SUPPORT_ROUTES.map((route) => route.href),
]);

export const V1_HIDDEN_HREFS = new Set<string>(
  V1_HIDDEN_INTERNAL_ROUTES.map((route) => route.href)
);

export function isV1PrimaryHref(href: string): boolean {
  if (href === "/") {
    return true;
  }
  return V1_PRIMARY_ROUTES.some(
    (route) => route.href !== "/" && (href === route.href || href.startsWith(`${route.href}/`))
  );
}

export function resolveV1SectionLabel(pathname: string): string {
  for (const route of V1_PRIMARY_ROUTES) {
    if (route.href === "/") {
      if (pathname === "/") {
        return route.label;
      }
      continue;
    }
    if (pathname === route.href || pathname.startsWith(`${route.href}/`)) {
      return route.label;
    }
  }

  for (const route of V1_LAYER_ROUTES) {
    if (pathname === route.href || pathname.startsWith(`${route.href}/`)) {
      return route.label;
    }
  }

  for (const route of V1_LEGACY_SUPPORT_ROUTES) {
    if (pathname === route.href || pathname.startsWith(`${route.href}/`)) {
      return route.label;
    }
  }

  for (const route of V1_HIDDEN_INTERNAL_ROUTES) {
    if (pathname === route.href || pathname.startsWith(`${route.href}/`)) {
      if (route.href === "/references") {
        return "References";
      }
      if (route.href === "/audit") {
        return "Review";
      }
      if (route.href === "/metrics") {
        return "Metrics";
      }
      return route.href.slice(1);
    }
  }

  return PRODUCT_NAME;
}

/** Global rail primary nav — icons assigned in GlobalRail. */
export const V1_GLOBAL_RAIL_PRIMARY = V1_PRIMARY_ROUTES;

/** Global rail layer shortcuts — Search/Inspector are actions in the shell. */
export const V1_GLOBAL_RAIL_LAYER = [
  { href: "/what-changed", label: "Reports" },
  { href: "/watch-for", label: "Fieldwork" },
  { href: "/import", label: "Import" },
  { href: "/context", label: "Context" },
] as const satisfies readonly V1NavRoute[];
