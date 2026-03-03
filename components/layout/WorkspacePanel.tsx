import type { ReactNode } from "react";

export function WorkspacePanel({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
      {children}
    </main>
  );
}
