"use client";

import { type ReactNode } from "react";

import { WorkbenchProvider } from "@/components/orvek-v0/store";

import { ProductionInspectorBridge } from "./ProductionInspectorBridge";

export function OrvekV0PageShell({ children }: { children: ReactNode }) {
  return (
    <WorkbenchProvider>
      <ProductionInspectorBridge>{children}</ProductionInspectorBridge>
    </WorkbenchProvider>
  );
}
