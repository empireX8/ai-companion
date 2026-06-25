"use client";

import { type ReactNode } from "react";

import { OrvekEvidencePanel } from "./OrvekEvidencePanel";
import { OrvekSidebar } from "./OrvekSidebar";
import { OrvekTopBar } from "./OrvekTopBar";

export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  return (
    <div className="o-ambient flex h-dvh w-full overflow-hidden p-3 text-foreground sm:p-5 lg:p-6">
      <div className="o-shell flex min-h-0 w-full flex-col overflow-hidden rounded-[28px]">
        <OrvekTopBar />
        <div className="flex min-h-0 flex-1">
          <OrvekSidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          <OrvekEvidencePanel />
        </div>
      </div>
    </div>
  );
}
