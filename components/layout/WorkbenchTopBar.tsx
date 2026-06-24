"use client";

import Link from "next/link";
import { Download, PanelRight, Plus, Search } from "lucide-react";

import { useCommandPalette } from "@/components/command/CommandPaletteContext";
import { useInspector } from "@/components/inspector/InspectorContext";
import { cn } from "@/lib/utils";

export function WorkbenchTopBar() {
  const { open: openSearch } = useCommandPalette();
  const { toggle: toggleInspector, isOpen: inspectorOpen } = useInspector();

  return (
    <header className="ml-glass flex h-[56px] shrink-0 items-center gap-2.5 border-b ml-hairline px-4 sm:px-5">
      <div className="flex shrink-0 items-center gap-2 pr-1">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[hsl(187_100%_50%/0.25)] bg-[hsl(187_100%_50%/0.08)]">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan/90" />
        </div>
        <span className="text-[14px] font-medium tracking-tight">MindLab</span>
      </div>

      <span className="mx-0.5 hidden h-5 w-px bg-white/10 sm:block" aria-hidden />

      <Link
        href="/journal-chat"
        className="ml-calm inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--ml-action-foreground)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] hover:brightness-[1.05] active:scale-[0.98]"
        style={{ backgroundColor: "color-mix(in oklab, var(--ml-action) 92%, transparent)" }}
      >
        <Plus className="size-3.5" aria-hidden />
        Capture
      </Link>

      <button
        type="button"
        onClick={openSearch}
        className="ml-calm group flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-white/[0.08]"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">Search surfaces, memories, timeline…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-[5px] bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <Link
        href="/import"
        className="ml-calm inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-white/[0.08]"
      >
        <Download className="size-3.5 text-cyan/80" aria-hidden />
        <span className="hidden sm:inline">Import</span>
      </Link>

      <button
        type="button"
        onClick={toggleInspector}
        title="Toggle inspector"
        aria-label="Toggle inspector"
        className={cn(
          "ml-calm inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium",
          inspectorOpen
            ? "bg-white/[0.1] text-foreground"
            : "bg-white/[0.05] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
        )}
      >
        <PanelRight className="size-3.5" aria-hidden />
        <span className="hidden lg:inline">Inspector</span>
      </button>
    </header>
  );
}
