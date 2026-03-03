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
  PanelLeft,
  PanelLeftClose,
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
    // Width transitions between w-14 (56 px) collapsed and w-56 (224 px) expanded.
    // Must stay in sync with GlobalRailWrapper's md:ml-* classes.
    <nav
      className={cn(
        "fixed top-0 bottom-0 left-0 z-40 hidden flex-col bg-secondary py-3 text-primary md:flex",
        "overflow-hidden transition-[width] duration-200 ease-in-out",
        isRailCollapsed ? "w-14" : "w-56"
      )}
    >
      {/* Collapse / expand toggle — always at the top */}
      <button
        type="button"
        onClick={toggleRailCollapsed}
        aria-label={isRailCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "flex items-center rounded-lg mx-2 mb-2 py-2.5 text-muted-foreground",
          "transition-colors hover:bg-primary/10 hover:text-primary",
          isRailCollapsed ? "justify-center" : "gap-3 px-3"
        )}
      >
        {isRailCollapsed ? (
          <PanelLeft className="h-5 w-5 shrink-0" />
        ) : (
          <>
            <PanelLeftClose className="h-5 w-5 shrink-0" />
            <span className="truncate text-sm font-medium">Collapse</span>
          </>
        )}
      </button>

      {/* Divider */}
      <div className="mx-2 mb-2 h-px bg-border/40" />

      {/* Nav links */}
      <div className="flex flex-1 flex-col gap-0.5">
        {routes.map((route) => {
          const active =
            pathname === route.href || pathname.startsWith(route.href + "/");
          const Icon = route.icon;
          return (
            <Link
              key={route.href}
              href={route.href}
              // Show tooltip only when collapsed (label not visible)
              title={isRailCollapsed ? route.label : undefined}
              className={cn(
                "flex items-center rounded-lg mx-2 transition-colors",
                isRailCollapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2.5",
                "hover:bg-primary/10 hover:text-primary",
                active && "bg-primary/10 text-primary"
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
  );
}
