import { mapWhatChangedDataToV0Props } from "../../orvek-adapters/what-changed";
import type { PublicEvidenceContinuityItem } from "../../public-evidence-continuity";
import type { WhatChangedListItem } from "../../public-intelligence-safe-slice";
import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";

export type BuildWhatChangedProductionInput = {
  primary: WhatChangedListItem | null;
  earlier: WhatChangedListItem[];
  evidenceItems: PublicEvidenceContinuityItem[];
};

export function buildWhatChangedProductionDataApi(
  input: BuildWhatChangedProductionInput
): OrvekDataApi {
  const whatChanged = mapWhatChangedDataToV0Props(input);

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    whatChanged,
    emptyCopyBySlot: {
      whatChangedEmptyPrimary: whatChanged.emptyPrimary,
      whatChangedEmptySecondary: whatChanged.emptySecondary,
    },
  });
}
