"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

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
import { ProductionInspectorBridge } from "./production/ProductionInspectorBridge";
import { DecisionsPage } from "@/components/orvek-v0/pages/decisions";
import { ExplorePage } from "@/components/orvek-v0/pages/explore";
import { MapPage } from "@/components/orvek-v0/pages/map";
import { TimelinePage } from "@/components/orvek-v0/pages/timeline";
import { TodayPage } from "@/components/orvek-v0/pages/today";
import { Sidebar } from "./sidebar";
import { WorkbenchProvider, useWorkbench, type OrvekPage } from "./store";
import { TopBar } from "./top-bar";

function resolveWorkbenchPageFromPathname(pathname: string | null): OrvekPage | null {
  if (!pathname || pathname === "/") {
    return "today";
  }
  if (pathname === "/your-map" || pathname.startsWith("/your-map/")) {
    return "map";
  }
  if (pathname === "/actions" || pathname.startsWith("/actions/")) {
    return "decisions";
  }
  if (pathname === "/timeline" || pathname.startsWith("/timeline/")) {
    return "timeline";
  }
  if (pathname === "/explore" || pathname.startsWith("/explore/")) {
    return "explore";
  }
  return null;
}

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

function RoutePageSync() {
  const pathname = usePathname();
  const { setPage } = useWorkbench();

  useEffect(() => {
    const nextPage = resolveWorkbenchPageFromPathname(pathname);
    if (nextPage) {
      setPage(nextPage);
    }
  }, [pathname, setPage]);

  return null;
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
  const productionDisplay = Boolean(dataApi);
  const workbenchContent = (
    <>
      <Layout />
      <Overlays />
    </>
  );
  return (
    <WorkbenchProvider>
      <RoutePageSync />
      <OrvekDataProvider value={api}>
        <OrvekPageHandlersProvider value={pageHandlers}>
          {productionDisplay ? (
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
