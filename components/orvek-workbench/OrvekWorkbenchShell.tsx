"use client";

import { type ReactNode } from "react";

import { Workbench } from "@/components/orvek-v0/workbench";

export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  void children;
  // Temporary hard swap: mount the accepted reference workbench directly.
  // Production adapter wiring can be restored after the UI is visually verified.
  return <Workbench />;
}
