"use client";

import { type ReactNode } from "react";

import { WorkbenchProvider } from "@/components/orvek-v0/store";
import {
  OrvekDataProvider,
  type OrvekDataApi,
} from "@/lib/orvek-v0/data-provider";
import {
  OrvekPageHandlersProvider,
  type OrvekPageHandlers,
} from "@/lib/orvek-v0/page-handlers";

import { ProductionInspectorBridge } from "./ProductionInspectorBridge";

export function OrvekV0PageShell({
  data,
  handlers = {},
  children,
}: {
  data: OrvekDataApi;
  handlers?: OrvekPageHandlers;
  children: ReactNode;
}) {
  return (
    <WorkbenchProvider>
      <OrvekDataProvider value={data}>
        <ProductionInspectorBridge>
          <OrvekPageHandlersProvider value={handlers}>
            {children}
          </OrvekPageHandlersProvider>
        </ProductionInspectorBridge>
      </OrvekDataProvider>
    </WorkbenchProvider>
  );
}
