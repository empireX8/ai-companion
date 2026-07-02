"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { resolveInspectorEvidenceSelection } from "@/lib/inspector-evidence-presentation";
import { resolveInspectorSourceSurfaceFromPathname } from "@/lib/inspector-selection";

import { useInspector } from "./InspectorContext";

type InspectorEvidenceSelectionControlProps = {
  href: string | null | undefined;
  sourceType?: string | null;
  sourceId?: string | null;
  title: string;
  trailLabel?: string;
  className?: string;
  children: ReactNode;
};

export function InspectorEvidenceSelectionControl({
  href,
  sourceType,
  sourceId,
  title,
  trailLabel,
  className,
  children,
}: InspectorEvidenceSelectionControlProps) {
  const { pushObject, selection } = useInspector();
  const pathname = usePathname();
  const target = resolveInspectorEvidenceSelection({ href, sourceType, sourceId });

  if (!target) {
    return <div className={className}>{children}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        pushObject({
          objectType: target.objectType,
          objectId: target.objectId,
          title,
          sourceSurface:
            selection?.sourceSurface ?? resolveInspectorSourceSurfaceFromPathname(pathname),
          tab: "evidence",
          trailLabel: trailLabel ?? "Viewing linked evidence",
        });
      }}
    >
      {children}
    </button>
  );
}
