"use client";

import { type ReactNode } from "react";

import { Workbench } from "@/components/orvek-v0/workbench";
import { DurableActionsRefreshProvider } from "@/lib/orvek-v0/durable-actions-context";
import { useOrvekHybridWorkbenchDataApi } from "./useOrvekHybridWorkbenchDataApi";

export function OrvekWorkbenchShell({ children }: { children: ReactNode }) {
  void children;
  const { dataApi, handlers, durableActionsRevision, refreshAfterDurableWrite } =
    useOrvekHybridWorkbenchDataApi();

  return (
    <DurableActionsRefreshProvider
      value={{
        revision: durableActionsRevision,
        refreshAfterDurableWrite,
      }}
    >
      <Workbench dataApi={dataApi} handlers={handlers} />
    </DurableActionsRefreshProvider>
  );
}
