/**
 * Production Today may link only to routes that render integrated Orvek v0 workbench
 * surfaces (shared shell + v0 page components). Legacy MindLab pages are excluded.
 *
 * A route must preserve the current workbench shell and Inspector context — "route exists"
 * alone is not sufficient. `/what-changed` is excluded until it matches that bar.
 */
export const INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES = [
  "/your-map",
  "/actions",
  "/timeline",
  "/explore",
] as const;

export function isIntegratedOrvekWorkbenchHref(href: string | null | undefined): boolean {
  if (!href || href === "#") {
    return false;
  }

  const path = (href.split("?")[0] ?? href).replace(/\/$/, "") || "/";
  if (path === "/") {
    return true;
  }

  return INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
