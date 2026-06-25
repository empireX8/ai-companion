"use client";

import { PanelRight, X } from "lucide-react";

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

export function OrvekEvidencePanel() {
  const { isOpen, close, tab, setTab, selection } = useInspector();
  const { label } = useInspectorContextFromPathname();

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="lg:hidden">
        <MobileInspectorDrawer />
      </div>
      <aside className="hidden h-full w-[392px] shrink-0 flex-col lg:flex">
        <div className="o-float flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <header className="flex items-center gap-2 px-5 pt-4">
            <PanelRight className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold leading-tight text-foreground">Inspector</h2>
            {selection?.selectedTitle ? (
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
            <InspectorPanelBody />
          </div>
        </div>
      </aside>
    </>
  );
}
