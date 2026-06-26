"use client";

import { usePathname } from "next/navigation";
import { PanelRight, ScrollText, X } from "lucide-react";

import {
  InspectorPanelBody,
  MobileInspectorDrawer,
  useInspectorContextFromPathname,
} from "@/components/inspector/MemoryInspectorDrawer";
import { useInspector } from "@/components/inspector/InspectorContext";
import { ORVEK_COPY } from "@/lib/trust-language";
import { cn } from "@/lib/utils";

const INSPECTOR_TABS = [
  { id: "evidence" as const, label: "Evidence / Context" },
  { id: "movement" as const, label: ORVEK_COPY.mindModelMovementTab },
] as const;

function InspectorEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <ScrollText className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">Nothing selected</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Select any object to inspect its evidence, supporting and conflicting signals, related
        objects, and what would change Orvek&apos;s read.
      </p>
    </div>
  );
}

function InspectorAsideChrome() {
  const pathname = usePathname();
  const { close, tab, setTab, selection } = useInspector();
  const { label } = useInspectorContextFromPathname();
  const isExploreLive = pathname === "/explore" || pathname.startsWith("/explore/");

  return (
    <div className="o-float flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center gap-2 px-5 pt-4">
        <PanelRight className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold leading-tight text-foreground">Inspector</h2>
        {isExploreLive ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-semibold text-action-foreground">
            <span className="o-breathe size-1.5 rounded-full bg-action" />
            Live
          </span>
        ) : selection?.selectedTitle ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Synced
          </span>
        ) : null}
        <button
          type="button"
          onClick={close}
          className="o-calm rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground lg:hidden"
          aria-label="Close inspector"
        >
          <X className="size-4" />
        </button>
      </header>
      {selection?.selectedTitle ? (
        <p className="truncate px-5 pt-1 text-[12px] leading-tight text-muted-foreground">
          {selection.selectedTitle}
        </p>
      ) : (
        <span className="px-5 pt-1 text-[11px] font-medium text-muted-foreground">{label}</span>
      )}

      <div className="o-sunken mx-4 mt-3 inline-flex rounded-[10px] p-1">
        {INSPECTOR_TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "o-calm flex-1 rounded-[7px] px-2.5 py-1.5 text-xs font-medium",
                active
                  ? "bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(30,41,59,0.18)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        key={`${tab}-${selection?.selectedObjectId ?? "none"}`}
        className="o-inspector-body min-h-0 flex-1 overflow-y-auto"
      >
        {selection?.selectedObjectId || tab === "movement" ? (
          <InspectorPanelBody />
        ) : (
          <InspectorEmptyState />
        )}
      </div>
    </div>
  );
}

/** Desktop inspector rail — mounted like reference `EvidencePanel` (direct flex sibling of main). */
export function ProductionInspectorAside() {
  return (
    <aside className="flex h-full w-[392px] shrink-0 flex-col max-lg:hidden pr-5 pb-5">
      <InspectorAsideChrome />
    </aside>
  );
}

export function OrvekMobileInspector() {
  const { isOpen } = useInspector();

  return <div className="lg:hidden">{isOpen ? <MobileInspectorDrawer /> : null}</div>;
}

/** @deprecated Prefer ProductionInspectorAside mounted directly in OrvekWorkbenchShell. */
export function OrvekEvidencePanel() {
  return (
    <>
      <OrvekMobileInspector />
      <ProductionInspectorAside />
    </>
  );
}
