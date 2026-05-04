"use client";

import { type ReactNode } from "react";
import { GlobalRail } from "./GlobalRail";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex bg-background relative">
      <div className="atmosphere" />
      <GlobalRail />
      <main className="flex-1 min-w-0 relative z-[1]">
        {children}
      </main>
    </div>
  );
}
