"use client";

import { type ReactNode } from "react";

import { Workbench } from "@/components/orvek-v0/workbench";
import { useOrvekHybridWorkbenchDataApi } from "./useOrvekHybridWorkbenchDataApi";

export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  void children;
  // Temporary hard swap: mount the accepted reference workbench directly.
  // Production adapter wiring can be restored after the UI is visually verified.
  const { dataApi, handlers } = useOrvekHybridWorkbenchDataApi();
  return <Workbench dataApi={dataApi} handlers={handlers} />;
}
