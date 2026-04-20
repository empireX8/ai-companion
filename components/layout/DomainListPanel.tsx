"use client";

import { usePathname } from "next/navigation";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDomainListPanel } from "./DomainListContext";
import { hasSecondaryPane } from "@/lib/layout-config";

export function DomainListPanel() {
  const pathname = usePathname();
  const { panelRef, isCollapsed, toggleCollapsed } = useDomainListPanel();

  // No panel on routes that don't use DomainListSlot — let main content expand.
  if (!hasSecondaryPane(pathname)) return null;

  return (
    // Wrapper is the hover zone and positioning context for the toggle button.
    // It must NOT have overflow-hidden so the button can bleed onto the divider line.
    <div className="group/panel relative hidden md:flex shrink-0">
      <aside
        className={cn(
          "flex flex-col bg-sidebar border-r border-border/40",
          "overflow-hidden transition-[width] duration-200",
          isCollapsed ? "w-14" : "w-64"
        )}
      >
        {/* Stub rail — visible only when collapsed */}
        {isCollapsed && (
          <div className="flex flex-col items-center gap-1 py-3">
            <div className="flex h-9 w-9 items-center justify-center text-muted-foreground/30">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
        )}

        {/* Portal mount — always in DOM so DomainListSlot can portal into it.
            Hidden via display:none when collapsed so the stub rail shows instead. */}
        <div
          ref={panelRef}
          className={cn(
            "flex h-full w-64 flex-col overflow-y-auto",
            isCollapsed && "hidden"
          )}
        />
      </aside>

      {/* Toggle button — floats on the border line, appears on panel hover */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={isCollapsed ? "Expand panel" : "Collapse panel"}
        className={cn(
          "absolute right-0 top-1/2 z-20 -translate-y-1/2 translate-x-1/2",
          "flex h-6 w-6 items-center justify-center rounded-full",
          "border border-border bg-background text-muted-foreground shadow-sm",
          "opacity-0 transition-opacity duration-150 group-hover/panel:opacity-100 hover:opacity-100",
          "hover:bg-muted hover:text-foreground"
        )}
      >
        <ChevronLeft
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isCollapsed && "rotate-180"
          )}
        />
      </button>
    </div>
  );
}
