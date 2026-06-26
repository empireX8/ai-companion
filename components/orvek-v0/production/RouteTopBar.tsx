"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Clock, Download, Plus, Search } from "lucide-react";

import { useCommandPalette } from "@/components/command/CommandPaletteContext";

export function RouteTopBar() {
  const router = useRouter();
  const { open: openSearch } = useCommandPalette();

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 px-4 sm:px-5">
      <div className="flex shrink-0 items-center gap-2 pr-1">
        <span className="font-serif text-[22px] italic leading-none tracking-tight text-foreground">
          Orvek
        </span>
      </div>

      <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" aria-hidden />

      <Link
        href="/journal-chat"
        className="o-calm inline-flex items-center gap-1.5 rounded-full bg-action px-3.5 py-1.5 text-sm font-semibold text-action-foreground shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] hover:brightness-[1.05] active:scale-[0.98]"
      >
        <Plus className="size-4" aria-hidden />
        Capture
      </Link>

      <button
        type="button"
        onClick={openSearch}
        className="o-calm group flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-white/[0.08]"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search receipts, decisions, reports, timeline…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-[5px] bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <Link
        href="/import"
        className="o-calm inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-foreground hover:bg-white/[0.08]"
      >
        <Download className="size-4 text-primary" aria-hidden />
        <span className="hidden sm:inline">Import</span>
      </Link>

      <div className="hidden items-stretch gap-1.5 lg:flex">
        <Link
          href="/your-map"
          className="o-calm flex items-center gap-2 rounded-[10px] bg-action-muted/70 px-2.5 py-1.5 text-left ring-1 ring-inset ring-action/15 hover:bg-action-muted"
        >
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-action/40" />
            <span className="o-breathe relative inline-flex size-2 rounded-full bg-action" />
          </span>
          <span className="leading-tight">
            <span className="block text-[11px] font-semibold text-action-foreground">
              Model movement
            </span>
            <span className="block text-[10px] text-muted-foreground">Open your map</span>
          </span>
        </Link>
        <Link
          href="/timeline"
          className="o-calm flex items-center gap-1.5 rounded-[10px] bg-secondary/60 px-2.5 py-1.5 text-left hover:bg-secondary"
        >
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="leading-tight">
            <span className="block text-[11px] font-medium text-foreground">Timeline</span>
            <span className="block text-[10px] text-muted-foreground">How the model evolved</span>
          </span>
        </Link>
      </div>

      <button
        type="button"
        onClick={() => router.push("/your-map")}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-action-muted px-2.5 py-1 text-xs font-medium text-action-foreground ring-1 ring-inset ring-action/15 lg:hidden"
      >
        <Activity className="size-3.5" aria-hidden />
        Map
      </button>
    </header>
  );
}
