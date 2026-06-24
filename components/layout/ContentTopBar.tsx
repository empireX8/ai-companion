"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { PanelRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { useInspector } from "@/components/inspector/InspectorContext";
import { resolveV1SectionLabel } from "@/lib/v1-nav";
import { useTopBarSlot } from "./TopBarSlotContext";

function getSectionLabel(pathname: string): string {
  return resolveV1SectionLabel(pathname);
}

export function ContentTopBar() {
  const pathname = usePathname();
  const { toggle, isOpen } = useInspector();
  const { slotRef } = useTopBarSlot();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 bg-card px-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {getSectionLabel(pathname)}
      </span>

      <div className="flex items-center gap-1.5">
        {/* Page-specific actions injected via TopBarSlot */}
        <div ref={slotRef} className="flex items-center gap-1" />
        <button
          type="button"
          onClick={toggle}
          title="Toggle inspector"
          aria-label="Toggle inspector"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            isOpen && "bg-muted text-foreground"
          )}
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <ModeToggle />
        <div className="flex h-7 w-7 items-center justify-center">
          {mounted ? (
            <UserButton />
          ) : (
            <span
              aria-hidden="true"
              className="h-7 w-7 rounded-full border border-border/40 bg-muted/40"
            />
          )}
        </div>
      </div>
    </div>
  );
}
