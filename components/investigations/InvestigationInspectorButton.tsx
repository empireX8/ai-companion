"use client";

import { useInspector } from "@/components/inspector/InspectorContext";

export function InvestigationInspectorButton({
  investigationId,
  title,
  className,
}: {
  investigationId: string;
  title: string;
  className?: string;
}) {
  const { selectObject } = useInspector();

  return (
    <button
      type="button"
      data-testid="investigation-open-inspector"
      onClick={() => {
        selectObject({
          objectType: "investigation",
          objectId: investigationId,
          title,
          sourceSurface: "unknown",
          tab: "evidence",
        });
      }}
      className={className}
    >
      Open in Inspector
    </button>
  );
}
