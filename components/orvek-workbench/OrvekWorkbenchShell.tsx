"use client";

import { type ReactNode } from "react";

import { EvidencePanel } from "@/components/orvek-v0/evidence-panel";
import { RouteSidebar } from "@/components/orvek-v0/production/RouteSidebar";
import { RouteTopBar } from "@/components/orvek-v0/production/RouteTopBar";
import { WorkbenchProvider } from "@/components/orvek-v0/store";

export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  return (
    <WorkbenchProvider>
      <div className="o-ambient flex h-dvh w-full overflow-hidden p-3 text-foreground sm:p-5 lg:p-6">
        <div className="o-shell flex min-h-0 w-full flex-col overflow-hidden rounded-[28px]">
          <RouteTopBar />
          <div className="flex min-h-0 flex-1">
            <RouteSidebar />
            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
            <EvidencePanel />
          </div>
        </div>
      </div>
    </WorkbenchProvider>
  );
}
