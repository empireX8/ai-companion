"use client";

import { type ReactNode } from "react";
import { useGlobalRail } from "./GlobalRailContext";

/**
 * Wraps the main content area and shifts its left margin to match the
 * current rail width so content never overlaps the fixed rail.
 *
 * Only applied at md+ breakpoints (rail is hidden on mobile).
 */
export function GlobalRailWrapper({ children }: { children: ReactNode }) {
  const { isRailCollapsed } = useGlobalRail();

  return (
    <div
      className={`flex flex-1 min-h-0 overflow-hidden transition-[margin-left] duration-200 ease-in-out ${
        isRailCollapsed ? "md:ml-14" : "md:ml-56"
      }`}
    >
      {children}
    </div>
  );
}
