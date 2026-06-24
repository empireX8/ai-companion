"use client";

import { InspectorSelectButton } from "@/components/inspector/InspectorSelectButton";
import { getWatchForInspectorSelection } from "@/lib/watch-for-surface";

export function WatchForInspectorAction({
  linkedObjectHref,
  title,
}: {
  linkedObjectHref: string | null;
  title: string;
}) {
  const selection = getWatchForInspectorSelection({ linkedObjectHref, title });
  if (!selection) {
    return null;
  }

  return (
    <InspectorSelectButton
      objectType={selection.objectType}
      objectId={selection.objectId}
      title={selection.title}
      sourceSurface="unknown"
      tab="evidence"
      className="ml-calm mt-3 inline-flex rounded-lg px-3 py-2 text-[12px] font-medium text-cyan hover:bg-white/[0.04]"
    >
      Open linked object in Inspector
    </InspectorSelectButton>
  );
}
