"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Activity,
  Compass,
  Download,
  GitBranch,
  Home,
  Layers,
  Map,
  PanelRight,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useCommandPalette } from "@/components/command/CommandPaletteContext";
import { useInspector } from "@/components/inspector/InspectorContext";
import { V1_GLOBAL_RAIL_LAYER, V1_GLOBAL_RAIL_PRIMARY } from "@/lib/v1-nav";
import { cn } from "@/lib/utils";

const PRIMARY_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/your-map": Map,
  "/actions": GitBranch,
  "/timeline": Activity,
  "/explore": Compass,
};

const LAYER_ICONS: Record<string, LucideIcon> = {
  "/what-changed": Sparkles,
  "/watch-for": Layers,
  "/import": Download,
  "/context": User,
};

const LAYER_NAV: {
  href?: string;
  label: string;
  icon: LucideIcon;
  action?: "search" | "inspector";
}[] = [
  ...V1_GLOBAL_RAIL_LAYER.map((route) => ({
    href: route.href,
    label: route.label,
    icon: LAYER_ICONS[route.href] ?? Sparkles,
  })),
  { label: "Search", icon: Search, action: "search" as const },
  { label: "Inspector", icon: PanelRight, action: "inspector" as const },
];

function PrimaryNavItem({
  href,
  label,
  icon: Icon,
  end,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  const pathname = usePathname();
  const isActive = end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <li className="w-full">
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        title={label}
        className={cn(
          "ml-calm group relative flex aspect-square w-full items-center justify-center rounded-[13px]",
          isActive
            ? "bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
        )}
      >
        <Icon
          className={cn(
            "ml-calm size-[19px]",
            isActive ? "text-cyan" : "text-muted-foreground group-hover:text-foreground"
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="sr-only">{label}</span>
      </Link>
    </li>
  );
}

function LayerNavItem({
  item,
  onSearch,
  onInspector,
}: {
  item: (typeof LAYER_NAV)[number];
  onSearch: () => void;
  onInspector: () => void;
}) {
  const pathname = usePathname();
  const Icon = item.icon;

  const className = cn(
    "ml-calm flex w-full items-center justify-center rounded-[10px] p-2 text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
    item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))
      ? "bg-white/[0.06] text-foreground"
      : ""
  );

  if (item.action === "search") {
    return (
      <button type="button" title={item.label} onClick={onSearch} className={className}>
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
        <span className="sr-only">{item.label}</span>
      </button>
    );
  }

  if (item.action === "inspector") {
    return (
      <button type="button" title={item.label} onClick={onInspector} className={className}>
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
        <span className="sr-only">{item.label}</span>
      </button>
    );
  }

  return (
    <Link href={item.href!} title={item.label} className={className}>
      <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      <span className="sr-only">{item.label}</span>
    </Link>
  );
}

export function GlobalRail() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { open: openSearch } = useCommandPalette();
  const { toggle: toggleInspector } = useInspector();

  const initials = (() => {
    if (!user) return "ML";
    const first = user.firstName?.trim();
    const last = user.lastName?.trim();
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    return "ML";
  })();

  return (
    <nav className="flex h-full w-[68px] shrink-0 flex-col items-center border-r ml-hairline pb-3 pt-1">
      <ul className="flex w-full flex-col items-center gap-1.5 px-2.5">
        {V1_GLOBAL_RAIL_PRIMARY.map((item) => (
          <PrimaryNavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={PRIMARY_ICONS[item.href] ?? Home}
            end={item.href === "/"}
          />
        ))}
      </ul>

      <div className="my-3 h-px w-8 bg-white/[0.06]" aria-hidden />

      <div className="flex w-full flex-col items-center gap-1 px-2">
        {LAYER_NAV.map((item) => (
          <LayerNavItem
            key={item.label}
            item={item}
            onSearch={openSearch}
            onInspector={toggleInspector}
          />
        ))}
      </div>

      <div className="mt-auto px-2">
        <Link
          href="/account"
          title={
            isLoaded && isSignedIn && user
              ? user.fullName?.trim() || user.username || "Account"
              : "Account"
          }
          className="ml-calm flex size-9 items-center justify-center rounded-full border border-[hsl(187_100%_50%/0.25)] bg-gradient-to-br from-[hsl(187_100%_50%/0.2)] to-transparent text-[10px] font-medium"
        >
          {initials}
        </Link>
      </div>
    </nav>
  );
}
