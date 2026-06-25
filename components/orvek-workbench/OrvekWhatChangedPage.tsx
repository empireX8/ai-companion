"use client";

import { useMemo } from "react";

import { WhatChangedPage } from "@/components/orvek-v0/pages/what-changed";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { mapWhatChangedDataToV0Props } from "@/lib/orvek-adapters/what-changed";
import { EMPTY_ORVEK_DATA_API } from "@/lib/orvek-v0/empty-api";
import type { PublicEvidenceContinuityItem } from "@/lib/public-evidence-continuity";
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice";

import { useOrvekInspector } from "./useOrvekInspector";

export type OrvekWhatChangedViewProps = {
  primary: WhatChangedListItem | null;
  earlier: WhatChangedListItem[];
  evidenceItems: PublicEvidenceContinuityItem[];
};

export function OrvekWhatChangedView({
  primary,
  earlier,
  evidenceItems,
}: OrvekWhatChangedViewProps) {
  const { select, setInspectorTab } = useOrvekInspector();

  const whatChanged = useMemo(
    () => mapWhatChangedDataToV0Props({ primary, earlier, evidenceItems }),
    [primary, earlier, evidenceItems]
  );

  const dataApi = useMemo(
    () => ({
      ...EMPTY_ORVEK_DATA_API,
      whatChanged,
    }),
    [whatChanged]
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
    <OrvekV0PageShell data={dataApi} handlers={pageHandlers}>
      <WhatChangedPage />
    </OrvekV0PageShell>
  );
}
