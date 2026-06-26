"use client";

import { type ReactNode } from "react";

import { OrvekMobileInspector, ProductionInspectorAside } from "@/components/orvek-workbench/OrvekEvidencePanel";
import { OrvekShellLayout } from "@/components/orvek-v0/OrvekShellLayout";
import { RouteSidebar } from "@/components/orvek-v0/production/RouteSidebar";
import { RouteTopBar } from "@/components/orvek-v0/production/RouteTopBar";
import { WorkbenchProvider } from "@/components/orvek-v0/store";

export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  return (
    <WorkbenchProvider>
      <OrvekShellLayout
        topBar={<RouteTopBar />}
        beforeBody={<OrvekMobileInspector />}
        sidebar={<RouteSidebar />}
        inspector={<ProductionInspectorAside />}
      >
        {children}
      </OrvekShellLayout>
    </WorkbenchProvider>
  );
}
