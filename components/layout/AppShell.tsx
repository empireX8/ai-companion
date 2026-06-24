"use client";

import { type ReactNode } from "react";

import { WorkbenchInspector } from "@/components/inspector/WorkbenchInspector";
import { GlobalRail } from "./GlobalRail";
import { WorkbenchTopBar } from "./WorkbenchTopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="ml-workbench ml-ambient flex h-dvh w-full overflow-hidden p-2.5 text-foreground sm:p-4 lg:p-5">
      <div className="ml-shell flex min-h-0 w-full flex-col overflow-hidden rounded-[22px] sm:rounded-[26px] lg:rounded-[28px]">
        <WorkbenchTopBar />
        <div className="flex min-h-0 flex-1">
          <GlobalRail />
          <div className="flex min-h-0 min-w-0 flex-1">
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
            <WorkbenchInspector />
          </div>
        </div>
      </div>
    </div>
  );
}
