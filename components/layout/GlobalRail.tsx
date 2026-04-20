"use client";

/**
 * GlobalRail — V1 product navigation (P1-02)
 *
 * Core section:      Chat · Check-ins · Patterns · History
 * Secondary section: Actions · Context · Memories · Import · Settings
 *
 * Hidden from nav (routes preserved for internal access):
 *   /contradictions · /references · /audit · /evidence · /metrics
 *
 * Source of truth: lib/v1-nav.ts
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ClipboardList,
  Brain,
  History,
  Activity,
  Clock3,
  BookOpen,
  Upload,
  Settings,
  ChevronLeft,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalRail } from "./GlobalRailContext";
import { V1_CORE_ROUTES, V1_SECONDARY_ROUTES } from "@/lib/v1-nav";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ROUTE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/chat": Plus,
  "/check-ins": ClipboardList,
  "/timeline": Activity,
  "/patterns": Brain,
  "/history": History,
  "/actions": Lightbulb,
  "/context": Clock3,
  "/memories": BookOpen,
  "/import": Upload,
  "/settings": Settings,
};

// ── Rail link ─────────────────────────────────────────────────────────────────

function RailLink({
  href,
  label,
  isCollapsed,
  active,
}: {
  href: string;
  label: string;
  isCollapsed: boolean;
  active: boolean;
}) {
  const Icon = ROUTE_ICONS[href] ?? Plus;

  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={cn(
        "relative flex items-center rounded-lg mx-2 transition-colors",
        isCollapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2.5",
        "hover:bg-panel-hover hover:text-foreground",
        active ? "bg-panel-active text-primary" : "text-muted-foreground"
      )}
    >
      <span className="relative shrink-0">
        <Icon className="h-5 w-5" />
      </span>
      {!isCollapsed && (
        <span className="truncate text-sm font-medium">{label}</span>
      )}
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GlobalRail() {
  const pathname = usePathname();
  const { isRailCollapsed, toggleRailCollapsed } = useGlobalRail();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      className={cn(
        "group/rail fixed top-0 bottom-0 left-0 z-40 hidden md:flex",
        "transition-[width] duration-200 ease-in-out",
        isRailCollapsed ? "w-14" : "w-56"
      )}
    >
      <nav className="flex h-full w-full flex-col overflow-hidden border-r border-border/40 bg-secondary text-primary">
        {/* Logo */}
        <div
          className={cn(
            "flex h-12 shrink-0 items-center border-b border-border/40",
            isRailCollapsed ? "justify-center px-4" : "px-4"
          )}
        >
          {isRailCollapsed ? (
            <span className="text-sm font-bold text-foreground">M</span>
          ) : (
            <span className="text-sm font-semibold tracking-tight text-foreground">
              MindLab
            </span>
          )}
        </div>

        {/* Core nav — Chat, Check-ins, Patterns, History */}
        <div className="flex flex-1 flex-col gap-0.5 pt-2">
          {V1_CORE_ROUTES.map((route) => (
            <RailLink
              key={route.href}
              href={route.href}
              label={route.label}
              isCollapsed={isRailCollapsed}
              active={isActive(route.href)}
            />
          ))}

          {/* Divider between core and secondary */}
          <div
            className={cn(
              "my-1.5 border-t border-border/30",
              isRailCollapsed ? "mx-3" : "mx-4"
            )}
          />

          {/* Secondary nav — Actions, Context, Memories, Import, Settings */}
          {V1_SECONDARY_ROUTES.map((route) => (
            <RailLink
              key={route.href}
              href={route.href}
              label={route.label}
              isCollapsed={isRailCollapsed}
              active={isActive(route.href)}
            />
          ))}
        </div>
      </nav>

      {/* Floating border toggle */}
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
