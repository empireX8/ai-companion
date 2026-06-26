"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Compass, GitBranch, Home, Telescope } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { href: "/", label: "Today", icon: Home, end: true },
  { href: "/your-map", label: "Map", icon: Compass },
  { href: "/actions", label: "Decisions", icon: GitBranch },
  { href: "/timeline", label: "Timeline", icon: CalendarClock },
  { href: "/explore", label: "Explore", icon: Telescope },
];

export function RouteSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-[68px] shrink-0 flex-col items-center pb-4 pt-1">
      <ul className="flex w-full flex-col items-center gap-1.5 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.end
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="w-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={cn(
                  "o-calm group relative flex aspect-square w-full items-center justify-center rounded-[13px]",
                  active
                    ? "bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "o-calm size-[20px]",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                  aria-hidden
                />
                <span className="sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto">
        <div
          className="relative flex size-9 items-center justify-center rounded-full bg-action-muted/40 ring-1 ring-inset ring-action/25"
          title="Model movement"
        >
          <span className="o-breathe size-1.5 rounded-full bg-action" />
          <span className="absolute inset-0 animate-ping rounded-full border border-action/20" />
        </div>
      </div>
    </nav>
  );
}
