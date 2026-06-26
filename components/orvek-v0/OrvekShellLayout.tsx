"use client";

import type { ReactNode } from "react";

/**
 * Shared workbench chrome — full-bleed web shell (sidebar, top bar, main, inspector).
 * Reference and production differ only in slot content (top bar, sidebar, inspector, page).
 */
export function OrvekShellLayout({
  topBar,
  sidebar,
  inspector,
  children,
  beforeBody,
}: {
  topBar: ReactNode;
  sidebar: ReactNode;
  inspector: ReactNode;
  children: ReactNode;
  beforeBody?: ReactNode;
}) {
  return (
    <div className="o-ambient flex h-dvh w-full flex-col overflow-hidden text-foreground">
      {topBar}
      {beforeBody}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        {inspector}
      </div>
    </div>
  );
}
