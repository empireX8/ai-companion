"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Sparkles,
  BookText,
  MessageCircle,
  Compass,
  Activity,
  Waves,
  GitBranch,
  Lightbulb,
  CircleDot,
  Library,
} from "lucide-react";

const primaryNav = [
  { href: "/", label: "Today", icon: Sparkles, end: true },
  { href: "/journal", label: "Journal", icon: BookText },
  { href: "/journal-chat", label: "Journal Chat", icon: MessageCircle },
  { href: "/explore", label: "Explore", icon: Compass },
];

const insightNav = [
  { href: "/timeline", label: "Timeline", icon: Activity },
  { href: "/patterns", label: "Patterns", icon: Waves },
  { href: "/contradictions", label: "Tensions", icon: GitBranch },
  { href: "/actions", label: "Actions", icon: Lightbulb },
  { href: "/check-ins", label: "Check-ins", icon: CircleDot },
];

const archiveNav = [
  { href: "/library", label: "Library", icon: Library },
];

function NavItem({
  href,
  label,
  icon: Icon,
  end,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  end?: boolean;
}) {
  const pathname = usePathname();
  const isActive = end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg px-3 h-9 text-[13px] transition-colors ${
        isActive
          ? "text-cyan bg-[hsl(187_100%_50%/0.06)] border border-[hsl(187_100%_50%/0.18)]"
          : "text-[hsl(216_11%_65%)] hover:text-white border border-transparent"
      }`}
    >
      <Icon
        className={`h-[16px] w-[16px] ${isActive ? "text-cyan" : "text-[hsl(209_18%_42%)] group-hover:text-[hsl(216_11%_65%)]"}`}
        strokeWidth={1.5}
      />
      <span className="truncate">{label}</span>
      {isActive && <span className="ml-auto h-1 w-1 rounded-full bg-cyan glow-cyan" />}
    </Link>
  );
}

export function GlobalRail() {
  const { isLoaded, isSignedIn, user } = useUser();

  // Safe initials — never crash on undefined access
  const initials = (() => {
    if (!user) return "ML";
    const first = user.firstName?.trim();
    const last = user.lastName?.trim();
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    return "ML";
  })();

  // Display name from real auth only — no fake fallback
  const displayName = (() => {
    if (!isLoaded) return "Loading…";
    if (!isSignedIn || !user) return "Signed out";
    return (
      user.fullName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.username ||
      "User"
    );
  })();

  return (
    <aside className="w-[224px] shrink-0 h-screen sticky top-0 border-r hairline bg-black z-10 flex flex-col">
      {/* Wordmark */}
      <div className="px-4 h-14 flex items-center gap-2 border-b hairline">
        <div className="h-6 w-6 rounded-md bg-[hsl(187_100%_50%/0.12)] border border-[hsl(187_100%_50%/0.4)] flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan glow-cyan" />
        </div>
        <span className="text-[13px] font-medium tracking-tight">MindLab</span>
        <span className="ml-auto label-meta text-[10px]">v2</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {primaryNav.map((n) => <NavItem key={n.href} {...n} />)}
        <div className="my-2 mx-3 h-px bg-white/5" />
        {insightNav.map((n) => <NavItem key={n.href} {...n} />)}
        <div className="my-2 mx-3 h-px bg-white/5" />
        {archiveNav.map((n) => <NavItem key={n.href} {...n} />)}
      </nav>

      {/* Account */}
      <div className="p-2 border-t hairline">
        <Link
          href="/account"
          className="flex items-center gap-3 rounded-lg px-2 h-11 transition-colors hover:bg-white/[0.02]"
        >
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[hsl(187_100%_50%/0.3)] to-[hsl(187_100%_50%/0.05)] border border-[hsl(187_100%_50%/0.4)] flex items-center justify-center text-[11px] font-medium">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[12.5px] truncate">{displayName}</div>
            <div className="label-meta text-[9.5px]">Account</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
