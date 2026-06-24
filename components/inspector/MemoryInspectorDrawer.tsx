"use client";

import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { PanelBar } from "@/components/ui/PanelBar";
import { useInspector } from "./InspectorContext";
import { InspectorPanelRouter } from "./InspectorPanelRouter";

type Domain =
  | "chat"
  | "contradictions"
  | "references"
  | "audit"
  | "import"
  | "default";

export function useInspectorContextFromPathname(): {
  domain: Domain;
  label: string;
} {
  const pathname = usePathname();
  if (pathname.startsWith("/chat")) return { domain: "chat", label: "Chat" };
  if (pathname.startsWith("/explore")) return { domain: "chat", label: "Explore" };
  if (pathname.startsWith("/contradictions"))
    return { domain: "contradictions", label: "Contradictions" };
  if (pathname.startsWith("/memories"))
    return { domain: "references", label: "Memories" };
  if (pathname.startsWith("/references"))
    return { domain: "references", label: "Memories" };
  if (pathname.startsWith("/audit")) return { domain: "audit", label: "Audit" };
  if (pathname.startsWith("/import")) return { domain: "import", label: "Import" };
  if (pathname.startsWith("/your-map")) return { domain: "default", label: "Map" };
  if (pathname.startsWith("/actions")) return { domain: "default", label: "Decisions" };
  if (pathname === "/") return { domain: "default", label: "Today" };
  if (pathname.startsWith("/timeline")) return { domain: "default", label: "Timeline" };
  if (pathname.startsWith("/what-changed")) return { domain: "default", label: "Reports" };
  if (pathname.startsWith("/watch-for")) return { domain: "default", label: "Fieldwork" };
  if (pathname.startsWith("/context")) return { domain: "default", label: "Context" };
  return { domain: "default", label: "Context" };
}

const INSPECTOR_TABS = [
  { id: "evidence" as const, label: "Evidence / Context" },
  { id: "movement" as const, label: "Model Movement" },
];

function InspectorTabContent() {
  return <InspectorPanelRouter />;
}

/** Inspector body for desktop workbench chrome. */
export function InspectorPanelBody() {
  return <InspectorPanelRouter />;
}

/** Mobile-only slide-over drawer with tabs. */
export function MobileInspectorDrawer() {
  const { isOpen, close, tab, setTab, selection } = useInspector();
  const { label } = useInspectorContextFromPathname();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 flex w-full flex-col lg:hidden",
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="ml-float m-2 flex h-[calc(100%-1rem)] flex-col overflow-hidden rounded-2xl">
          <PanelBar
            left={<span className="text-sm font-medium text-foreground">{label}</span>}
            right={
              <button
                type="button"
                onClick={close}
                className="rounded p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                aria-label="Close inspector"
              >
                <X className="h-4 w-4" />
              </button>
            }
          />

          <div className="ml-segmented mx-3 mt-2">
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

          <div key={`${tab}-${selection?.selectedObjectId ?? "none"}`} className="ml-inspector-body flex-1 overflow-y-auto">
            {isOpen && <InspectorTabContent />}
          </div>
        </div>
      </aside>
    </>
  );
}

/**
 * @deprecated Desktop inspector lives in WorkbenchInspector. Mobile drawer only.
 */
export function MemoryInspectorDrawer() {
  return <MobileInspectorDrawer />;
}
