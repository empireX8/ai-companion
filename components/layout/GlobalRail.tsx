"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Settings,
  Plus,
  ChartNoAxesColumn,
  Split,
  BookOpenText,
  Upload,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalRail } from "./GlobalRailContext";

const routes = [
  { icon: Plus, label: "Chat", href: "/chat" },
  { icon: Split, label: "Contradictions", href: "/contradictions" },
  { icon: BookOpenText, label: "References", href: "/references" },
  { icon: Upload, label: "Import", href: "/import" },
  { icon: ChartNoAxesColumn, label: "Audit", href: "/audit" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function GlobalRail() {
  const pathname = usePathname();
  const { isRailCollapsed, toggleRailCollapsed } = useGlobalRail();

  return (
    // Wrapper owns the fixed position, width transition, and hover group.
    // No overflow-hidden here so the border toggle button can bleed right.
    <div
      className={cn(
        "group/rail fixed top-0 bottom-0 left-0 z-40 hidden md:flex",
        "transition-[width] duration-200 ease-in-out",
        isRailCollapsed ? "w-14" : "w-56"
      )}
    >
      {/* Nav fills the wrapper; overflow-hidden clips content during animation */}
      <nav className="flex h-full w-full flex-col overflow-hidden border-r border-border/40 bg-secondary text-primary">
        {/* Logo — h-12 matches ContentTopBar so the border-b forms one continuous line */}
        <div className={cn(
          "flex h-12 shrink-0 items-center border-b border-border/40",
          isRailCollapsed ? "justify-center px-4" : "px-4"
        )}>
          {isRailCollapsed ? (
            <span className="text-sm font-bold text-foreground">M</span>
          ) : (
            <span className="text-sm font-semibold tracking-tight text-foreground">Mind Lab</span>
          )}
        </div>

        {/* Nav links */}
        <div className="flex flex-1 flex-col gap-0.5 pt-2">
          {routes.map((route) => {
            const active =
              pathname === route.href || pathname.startsWith(route.href + "/");
            const Icon = route.icon;
            return (
              <Link
                key={route.href}
                href={route.href}
                title={isRailCollapsed ? route.label : undefined}
                className={cn(
                  "flex items-center rounded-lg mx-2 transition-colors",
                  isRailCollapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2.5",
                  "hover:bg-panel-hover hover:text-foreground",
                  active ? "bg-panel-active text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isRailCollapsed && (
                  <span className="truncate text-sm font-medium">{route.label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating border toggle — appears on rail hover, sits on the border-r line */}
      <button
        type="button"
        onClick={toggleRailCollapsed}
        title={isRailCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute right-0 top-1/2 z-50 -translate-y-1/2 translate-x-1/2",
          "flex h-6 w-6 items-center justify-center rounded-full",
          "border border-border bg-background text-muted-foreground shadow-sm",
          "opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 hover:opacity-100",
          "hover:bg-muted hover:text-foreground"
        )}
      >
        <ChevronLeft
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isRailCollapsed && "rotate-180"
          )}
        />
      </button>
    </div>
  );
}
