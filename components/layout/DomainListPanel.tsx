"use client";

import { useDomainListPanel } from "./DomainListContext";

export function DomainListPanel() {
  const { panelRef, isCollapsed, toggleCollapsed } = useDomainListPanel();

  return (
    // Outer flex-row: [panel content | divider handle]
    // The handle stays visible even when the panel collapses to w-0.
    <div className="hidden md:flex shrink-0">
      {/* Panel */}
      <aside
        className={`flex flex-col bg-sidebar overflow-hidden transition-[width] duration-200 ${
          isCollapsed ? "w-0" : "w-64"
        }`}
      >
        <div ref={panelRef} className="flex h-full flex-col overflow-y-auto w-64" />
      </aside>

      {/* Divider handle — always 8 px wide, acts as the collapse/expand trigger */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={isCollapsed ? "Expand sessions panel" : "Collapse sessions panel"}
        className="group flex w-2 shrink-0 cursor-col-resize flex-col items-center justify-center border-r border-border/60 bg-sidebar transition-colors hover:border-border"
      >
        <div className="h-8 w-0.5 rounded bg-border/60 group-hover:bg-border transition-colors" />
      </button>
    </div>
  );
}
