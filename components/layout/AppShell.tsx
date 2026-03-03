"use client";

import { type ReactNode } from "react";

import { GlobalRail } from "./GlobalRail";
import { GlobalRailWrapper } from "./GlobalRailWrapper";
import { DomainListPanel } from "./DomainListPanel";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <GlobalRail />
      <GlobalRailWrapper>
        <DomainListPanel />
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          {children}
        </main>
      </GlobalRailWrapper>
    </div>
  );
}
