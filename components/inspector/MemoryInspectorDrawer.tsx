"use client";

import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { PanelBar } from "@/components/ui/PanelBar";
import { useInspector } from "./InspectorContext";
import { ChatInspectorPanel } from "./panels/ChatInspectorPanel";
import { ContradictionsInspectorPanel } from "./panels/ContradictionsInspectorPanel";
import { ReferencesInspectorPanel } from "./panels/ReferencesInspectorPanel";
import { AuditInspectorPanel } from "./panels/AuditInspectorPanel";
import { ImportInspectorPanel } from "./panels/ImportInspectorPanel";
import { DefaultInspectorPanel } from "./panels/DefaultInspectorPanel";

// ── Domain detection ──────────────────────────────────────────────────────────

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
  if (pathname.startsWith("/contradictions"))
    return { domain: "contradictions", label: "Contradictions" };
  if (pathname.startsWith("/references"))
    return { domain: "references", label: "References" };
  if (pathname.startsWith("/audit")) return { domain: "audit", label: "Audit" };
  if (pathname.startsWith("/import")) return { domain: "import", label: "Import" };
  return { domain: "default", label: "Inspector" };
}

// ── Panel map ─────────────────────────────────────────────────────────────────

const PANELS: Record<Domain, React.ComponentType> = {
  chat: ChatInspectorPanel,
  contradictions: ContradictionsInspectorPanel,
  references: ReferencesInspectorPanel,
  audit: AuditInspectorPanel,
  import: ImportInspectorPanel,
  default: DefaultInspectorPanel,
};

// ── Drawer ────────────────────────────────────────────────────────────────────

export function MemoryInspectorDrawer() {
  const { isOpen, close } = useInspector();
  const { domain, label } = useInspectorContextFromPathname();

  const Panel = PANELS[domain];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={close}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background md:w-80",
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <PanelBar
          left={<span className="text-sm font-medium text-foreground">{label}</span>}
          right={
            <button
              type="button"
              onClick={close}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" />
            </button>
          }
        />

        {/* Body — panel mounts only when open, unmounts on close (fresh data each open) */}
        <div className="flex-1 overflow-y-auto">
          {isOpen && <Panel />}
        </div>
      </aside>
    </>
  );
}
