"use client";

import { useMemo } from "react";

import { OrvekDataProvider } from "@/lib/orvek-v0/data-provider";
import { createMockOrvekDataApi } from "@/lib/orvek-v0/mock-api";

import { OrvekShellLayout } from "./OrvekShellLayout";
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
    <OrvekShellLayout
      topBar={<TopBar />}
      sidebar={<Sidebar />}
      inspector={<EvidencePanel />}
    >
      <PageContent />
    </OrvekShellLayout>
  );
}

export function Workbench() {
  const api = useMemo(() => createMockOrvekDataApi(), []);
  return (
    <WorkbenchProvider>
      <OrvekDataProvider value={api}>
        <Layout />
        <Overlays />
      </OrvekDataProvider>
    </WorkbenchProvider>
  );
}
