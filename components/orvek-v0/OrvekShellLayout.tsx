"use client";

import type { ReactNode } from "react";

/**
 * Shared workbench chrome — keep identical to `.reference/v0-orvek-workbench` layout.
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
    <div className="o-ambient flex h-dvh w-full overflow-hidden p-3 text-foreground sm:p-5 lg:p-6">
      <div className="o-shell flex min-h-0 w-full flex-col overflow-hidden rounded-[28px]">
        {topBar}
        {beforeBody}
        <div className="flex min-h-0 flex-1">
          {sidebar}
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          {inspector}
        </div>
      </div>
    </div>
  );
}
