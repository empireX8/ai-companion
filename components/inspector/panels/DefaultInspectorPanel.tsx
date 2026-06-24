"use client";

import { useInspectorContextFromPathname } from "../MemoryInspectorDrawer";

const SURFACE_EMPTY_COPY: Record<string, { title: string; body: string }> = {
  Today: {
    title: "Select something to inspect",
    body: "Open a receipt, movement item, or attention row on Today to see evidence and context here.",
  },
  Map: {
    title: "Select a map item",
    body: "Choose a conclusion in the list to inspect its evidence and supporting signals.",
  },
  Decisions: {
    title: "Select a linked pattern",
    body: "Open a linked pattern or receipt from a decision card to inspect supporting evidence.",
  },
  Timeline: {
    title: "Select a timeline item",
    body: "Choose a movement or linked activity entry to inspect evidence or published movement.",
  },
  Explore: {
    title: "Review conversation drafts",
    body: "Draft review items appear here during Explore. Published movement is on the Model Movement tab.",
  },
  Reports: {
    title: "Inspect from the list",
    body: "Open a published change from What Changed or select movement on Today or Timeline to inspect it here.",
  },
  Fieldwork: {
    title: "Inspect linked evidence",
    body: "Open a watch prompt or its linked object to inspect supporting evidence here.",
  },
  Import: {
    title: "Import status",
    body: "Recent upload history appears here while you are on Import.",
  },
  Context: {
    title: "Inspector",
    body: "Select an object from a workbench surface to inspect evidence, context, or published movement.",
  },
};

export function DefaultInspectorPanel() {
  const { label } = useInspectorContextFromPathname();
  const copy = SURFACE_EMPTY_COPY[label] ?? SURFACE_EMPTY_COPY.Context;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{copy.title}</p>
      <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">{copy.body}</p>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {label}
      </p>
    </div>
  );
}
