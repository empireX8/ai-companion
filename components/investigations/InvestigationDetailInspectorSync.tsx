"use client";

import { useEffect } from "react";

import { useInspector } from "@/components/inspector/InspectorContext";

export function InvestigationDetailInspectorSync({
  investigationId,
  title,
}: {
  investigationId: string;
  title: string;
}) {
  const { selectObject } = useInspector();

  useEffect(() => {
    selectObject({
      objectType: "investigation",
      objectId: investigationId,
      title,
      sourceSurface: "unknown",
      tab: "evidence",
    });
  }, [investigationId, selectObject, title]);

  return null;
}
