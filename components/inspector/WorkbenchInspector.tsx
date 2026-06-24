"use client";

import { PanelRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ORVEK_COPY } from "@/lib/trust-language";
import {
  InspectorPanelBody,
  MobileInspectorDrawer,
  useInspectorContextFromPathname,
} from "./MemoryInspectorDrawer";
import { useInspector } from "./InspectorContext";

const INSPECTOR_TABS = [
  { id: "evidence" as const, label: `Evidence / ${ORVEK_COPY.mindContext}` },
  { id: "movement" as const, label: ORVEK_COPY.mindModelMovementTab },
] as const;

function InspectorChrome({ className }: { className?: string }) {
  const { isOpen, close, tab, setTab, selection } = useInspector();
  const { label } = useInspectorContextFromPathname();

  if (!isOpen) {
    return null;
  }

  return (
    <aside className={cn("flex h-full shrink-0 flex-col p-2 pl-1", className)}>
      <div className="ml-float flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <header className="flex items-center gap-2 px-4 pt-3.5">
          <PanelRight className="size-4 text-cyan/80" aria-hidden />
          <h2 className="text-sm font-semibold leading-tight text-foreground">Inspector</h2>
          {selection?.selectedTitle ? (
            <p className="ml-1 min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {selection.selectedTitle}
            </p>
          ) : (
            <span className="ml-auto text-[11px] font-medium text-muted-foreground">{label}</span>
          )}
          <button
            type="button"
            onClick={close}
            className="ml-calm ml-auto rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground lg:hidden"
            aria-label="Close inspector"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="ml-segmented mx-3 mt-3">
          {INSPECTOR_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex-1 px-2 py-1.5 text-[11px] font-medium",
                  active ? "ml-segment-active" : "ml-segment-inactive"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          key={`${tab}-${selection?.selectedObjectId ?? "none"}`}
          className="ml-inspector-body min-h-0 flex-1 overflow-y-auto"
        >
          <InspectorPanelBody />
        </div>
      </div>
    </aside>
  );
}

/** Desktop: persistent floating sheet beside main content. */
export function WorkbenchInspector() {
  const { isOpen } = useInspector();

  return (
    <>
      {/* Mobile overlay drawer — keeps touch-friendly full-width panel */}
      <div className="lg:hidden">
        <MobileInspectorDrawer />
      </div>

      {/* Desktop embedded inspector */}
      {isOpen ? (
        <InspectorChrome className="hidden w-[min(100%,380px)] lg:flex" />
      ) : (
        <div className="hidden w-0 lg:block" aria-hidden />
      )}
    </>
  );
}
