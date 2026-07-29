"use client";

import { useMemo } from "react";

import { WorkbenchInspector } from "@/components/inspector/WorkbenchInspector";
import { WhatChangedPage } from "@/components/orvek-v0/pages/what-changed";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { buildWhatChangedProductionDataApi } from "@/lib/orvek-v0/production/what-changed-api";
import type { PublicEvidenceContinuityItem } from "@/lib/public-evidence-continuity";
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice";

import { useOrvekInspector } from "./useOrvekInspector";

export type OrvekWhatChangedViewProps = {
  primary: WhatChangedListItem | null;
  earlier: WhatChangedListItem[];
  evidenceItems: PublicEvidenceContinuityItem[];
  primaryBefore?: string | null;
  primaryAfter?: string | null;
};

export function OrvekWhatChangedView({
  primary,
  earlier,
  evidenceItems,
  primaryBefore = null,
  primaryAfter = null,
}: OrvekWhatChangedViewProps) {
  const { select, setInspectorTab } = useOrvekInspector();

  const dataApi = useMemo(
    () =>
      buildWhatChangedProductionDataApi({
        primary,
        earlier,
        evidenceItems,
        primaryBefore,
        primaryAfter,
      }),
    [primary, earlier, evidenceItems, primaryBefore, primaryAfter]
  );

  const pageHandlers = useMemo(
    () => ({
      whatChanged: {
        onMovementSelect: (id: string, title: string) => {
          select({
            objectType: "model_update",
            objectId: id,
            modelUpdateId: id,
            title,
            tab: "movement",
          });
          setInspectorTab("movement");
        },
      },
    }),
    [select, setInspectorTab]
  );

  return (
    <div
      className="flex h-[100dvh] min-h-0 w-full"
      data-testid="orvek-what-changed-with-inspector"
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <OrvekV0PageShell data={dataApi} handlers={pageHandlers}>
          <WhatChangedPage />
        </OrvekV0PageShell>
      </div>
      <WorkbenchInspector />
    </div>
  );
}
