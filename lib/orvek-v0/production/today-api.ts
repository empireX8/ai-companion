import {
  filterDefined,
  mapTodayDataToV0Props,
  type MapTodayDataInput,
} from "../../orvek-adapters/today";
import type { V0TodayReceiptRow } from "../../orvek-adapters/types";

import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";

function receiptRowToOrvekObject(row: V0TodayReceiptRow): OrvekObject {
  const metaParts = row.meta
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const sourceOrigin = metaParts[0] || "Receipt";
  const date = metaParts.length > 1 ? metaParts[metaParts.length - 1] : undefined;
  const title = row.quote.trim() || "Receipt";

  return {
    id: row.id,
    type: "receipt",
    title,
    sourceText: row.quote.trim() || title,
    sourceOrigin,
    date,
    lastUpdated: date,
  };
}

export function buildTodayProductionDataApi(input: MapTodayDataInput): OrvekDataApi {
  const today = mapTodayDataToV0Props(input);
  const objects: Record<string, OrvekObject> = {};

  for (const receipt of today.receipts) {
    objects[receipt.id] = receiptRowToOrvekObject(receipt);
  }

  for (const movement of today.movements) {
    objects[movement.id] = {
      id: movement.id,
      type: "model-update",
      title: movement.updated,
      summary: movement.evidence,
      eventType: "Model update",
      tags: ["Model update"],
      inspectorObjectType: "model_update",
      inspectorObjectId: movement.id,
    };
  }

  const todayResurfacedIds = today.receipts.map((receipt) => receipt.id);

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      filterDefined((ids ?? []).map((id) => (id ? objects[id] : undefined))),
    todayCopy: {
      briefingLine: `${today.briefingDate} · since your last visit`,
      briefingTitle: today.briefingTitle,
      briefingMeta: today.briefingMeta,
    },
    today,
    todayResurfacedIds,
    todayIsLoading: input.isLoading,
    emptyCopyBySlot: {
      todayHeroEmpty: today.heroEmptyCopy,
      todayNowEmpty: today.nowEmptyCopy,
      todayMovementEmpty: today.movementEmptyCopy,
      todayPriorReadEmpty: today.priorReadEmptyCopy,
      todayResurfacedEmpty: "No receipts resurfaced in this window yet.",
    },
  });
}
