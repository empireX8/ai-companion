"use client";

import { useMemo } from "react";

import { OrvekDataProvider } from "@/lib/orvek-v0/data-provider";
import { createMockOrvekDataApi } from "@/lib/orvek-v0/mock-api";

import { EvidencePanel } from "./evidence-panel";
import { Overlays } from "./overlays";
import { DecisionsPage } from "@/components/orvek-v0/pages/decisions";
import { ExplorePage } from "@/components/orvek-v0/pages/explore";
import { MapPage } from "@/components/orvek-v0/pages/map";
import { TimelinePage } from "@/components/orvek-v0/pages/timeline";
import { TodayPage } from "@/components/orvek-v0/pages/today";
import { Sidebar } from "./sidebar";
import { WorkbenchProvider, useWorkbench } from "./store";
import { TopBar } from "./top-bar";

function PageContent() {
  const { page } = useWorkbench();
  switch (page) {
    case "today":
      return <TodayPage />;
    case "map":
      return <MapPage />;
    case "decisions":
      return <DecisionsPage />;
    case "timeline":
      return <TimelinePage />;
    case "explore":
      return <ExplorePage />;
    default:
      return <TodayPage />;
  }
}

function Layout() {
  return (
    <div className="o-ambient flex h-dvh w-full overflow-hidden p-3 text-foreground sm:p-5 lg:p-6">
      <div className="o-shell flex min-h-0 w-full flex-col overflow-hidden rounded-[28px]">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <PageContent />
          </main>
          <EvidencePanel />
        </div>
      </div>
      <Overlays />
    </div>
  );
}

export function Workbench() {
  const api = useMemo(() => createMockOrvekDataApi(), []);
  return (
    <WorkbenchProvider>
      <OrvekDataProvider value={api}>
        <Layout />
      </OrvekDataProvider>
    </WorkbenchProvider>
  );
}
