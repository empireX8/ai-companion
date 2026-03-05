"use client";

import { type ReactNode } from "react";

import { GlobalRail } from "./GlobalRail";
import { GlobalRailWrapper } from "./GlobalRailWrapper";
import { DomainListPanel } from "./DomainListPanel";
import { ContentTopBar } from "./ContentTopBar";
import { StatusBar } from "./StatusBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <GlobalRail />
      <GlobalRailWrapper>
        {/* Column: top bar + row of (domain panel | main content) */}
        <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
          <ContentTopBar />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <DomainListPanel />
            <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
              {children}
            </main>
          </div>
          <StatusBar />
        </div>
      </GlobalRailWrapper>
    </div>
  );
}
