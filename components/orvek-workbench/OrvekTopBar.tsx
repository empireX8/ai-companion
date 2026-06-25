"use client";

import Link from "next/link";
import { Download, Plus, Search } from "lucide-react";

import { useCommandPalette } from "@/components/command/CommandPaletteContext";

export function OrvekTopBar() {
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
    </header>
  );
}
