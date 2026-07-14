"use client";

import { useMemo } from "react";

import type { OrvekDataApi } from "@/lib/orvek-v0/data-provider";
import { OrvekDataProvider } from "@/lib/orvek-v0/data-provider";
import { createMockOrvekDataApi } from "@/lib/orvek-v0/mock-api";
import {
  OrvekPageHandlersProvider,
  type OrvekPageHandlers,
} from "@/lib/orvek-v0/page-handlers";

import { OrvekShellLayout } from "./OrvekShellLayout";
import { EvidencePanel } from "./evidence-panel";
import { Overlays } from "./overlays";
import { InspectorProvider } from "@/components/inspector/InspectorContext";
import { WorkbenchInspector } from "@/components/inspector/WorkbenchInspector";
import { ProductionInspectorBridge } from "./production/ProductionInspectorBridge";
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

function Layout({ productionInspector }: { productionInspector: boolean }) {
  return (
    <OrvekShellLayout
      topBar={<TopBar />}
      sidebar={<Sidebar />}
      inspector={productionInspector ? <WorkbenchInspector /> : <EvidencePanel />}
    >
      <PageContent />
    </OrvekShellLayout>
  );
}

export function Workbench({
  dataApi,
  handlers,
}: {
  dataApi?: OrvekDataApi;
  handlers?: OrvekPageHandlers;
} = {}) {
  const mockApi = useMemo(
    () => ({
      ...createMockOrvekDataApi(),
      referenceSurface: true,
    }),
    [],
  );
  const api = dataApi ?? mockApi;
  const pageHandlers = handlers ?? {};
  const productionInspector = Boolean(dataApi);
  const workbenchContent = (
    <>
      <Layout productionInspector={productionInspector} />
      <Overlays />
    </>
  );
  return (
    <WorkbenchProvider>
      <OrvekDataProvider value={api}>
        <OrvekPageHandlersProvider value={pageHandlers}>
          {productionInspector ? (
            <InspectorProvider syncNavigation={false}>
              <ProductionInspectorBridge>{workbenchContent}</ProductionInspectorBridge>
            </InspectorProvider>
          ) : (
            workbenchContent
          )}
        </OrvekPageHandlersProvider>
      </OrvekDataProvider>
    </WorkbenchProvider>
  );
}
