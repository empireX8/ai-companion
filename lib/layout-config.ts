/**
 * Layout configuration — secondary pane route membership
 *
 * Lists the route prefixes where the secondary pane (DomainListPanel)
 * should be rendered. On all other routes the pane is absent and the
 * main content expands into the recovered space.
 *
 * Add a prefix here when a route actively uses <DomainListSlot>.
 * Remove a prefix (or never add it) when the pane would be empty.
 */

export const SECONDARY_PANE_PREFIXES = [
  // V1 visible routes with real panel content
  "/chat",        // SessionListPanel
  "/import",      // ImportHistoryPanel
  "/memories",    // ReferenceListPanel (via CandidateMemoriesPage)

  // Hidden/internal routes with real panel content
  "/references",      // ReferenceListPanel
  "/contradictions",  // ContradictionListPanel
  "/audit",           // AuditListPanel
] as const;

/**
 * Returns true if the given pathname should render the secondary pane.
 * Matches the prefix exactly and all sub-routes (prefix + "/…").
 */
export function hasSecondaryPane(pathname: string): boolean {
  return SECONDARY_PANE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}
