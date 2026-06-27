import {
  filterDefined,
  mapTodayDataToV0Props,
  type MapTodayDataInput,
} from "../../orvek-adapters/today";
import type { V0TodayReceiptRow } from "../../orvek-adapters/types";
import {
  parseSelectableObjectFromHref,
  type InspectorSelectableObjectType,
} from "../../inspector-selection";
import { TODAY_REPORT_EMPTY_COPY } from "../../today-intelligence-updates";
import {
  buildTodayAttentionRows,
  buildTodayFieldworkRows,
  buildTodayOpenLoopRows,
  pickTodayHeroItem,
  type TodaySelectableTarget,
} from "../../today-reentry";

import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";

function selectionToOrvekObject(
  objectId: string,
  selection: TodaySelectableTarget,
  title: string,
  summary?: string
): OrvekObject {
  const type: OrvekObject["type"] =
    selection.objectType === "model_update"
      ? "model-update"
      : selection.objectType === "pattern_claim"
        ? "map-object"
        : selection.objectType === "contradiction_node"
          ? "map-object"
          : "map-object";

  return {
    id: objectId,
    type,
    title,
    summary,
    eventType: selection.objectType === "model_update" ? "Model update" : undefined,
    tags: selection.objectType === "model_update" ? ["Model update"] : undefined,
    inspectorObjectType: selection.objectType as InspectorSelectableObjectType,
    inspectorObjectId: selection.objectId,
  };
}

function registerSelectableTarget(
  objects: Record<string, OrvekObject>,
  objectId: string,
  selection: TodaySelectableTarget,
  title: string,
  summary?: string
): void {
  const entry = selectionToOrvekObject(objectId, selection, title, summary);
  objects[objectId] = entry;

  if (selection.objectType === "model_update" && selection.objectId !== objectId) {
    objects[selection.objectId] = {
      ...entry,
      id: selection.objectId,
    };
  }
}

function registerTodayAttentionObjects(
  objects: Record<string, OrvekObject>,
  input: MapTodayDataInput
): void {
  const hero = pickTodayHeroItem(input.snapshot);

  if (hero?.selection) {
    registerSelectableTarget(
      objects,
      hero.id,
      hero.selection,
      hero.title,
      hero.summary || hero.whyItMatters || undefined
    );
  }

  const attentionRows = [
    ...buildTodayAttentionRows(input.snapshot, hero),
    ...buildTodayFieldworkRows(input.snapshot, hero),
    ...buildTodayOpenLoopRows(input.snapshot),
  ].slice(0, 6);

  for (const row of attentionRows) {
    if (!row.selection) {
      continue;
    }
    registerSelectableTarget(objects, row.id, row.selection, row.title, row.reason);
  }
}

function receiptRowToOrvekObject(row: V0TodayReceiptRow): OrvekObject {
  const metaParts = row.meta
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const sourceOrigin = metaParts[0] || "Receipt";
  const date = metaParts.length > 1 ? metaParts[metaParts.length - 1] : undefined;
  const title = row.quote.trim() || "Receipt";
  const parsed = parseSelectableObjectFromHref(row.href);

  const base: OrvekObject = {
    id: row.id,
    type: "receipt",
    title,
    sourceText: row.quote.trim() || title,
    sourceOrigin,
    date,
    lastUpdated: date,
  };

  if (!parsed) {
    return base;
  }

  return {
    ...base,
    inspectorObjectType: parsed.objectType as InspectorSelectableObjectType,
    inspectorObjectId: parsed.objectId,
  };
}

export function buildTodayProductionDataApi(input: MapTodayDataInput): OrvekDataApi {
  const today = mapTodayDataToV0Props(input);
  const objects: Record<string, OrvekObject> = {};

  for (const receipt of today.receipts) {
    objects[receipt.id] = receiptRowToOrvekObject(receipt);
  }

  for (const update of input.snapshot.intelligenceUpdates) {
    const title =
      update.userFacingSummary.trim() ||
      `${update.updateTypeLabel} · ${update.affectedObjectTypeLabel}`;
    objects[update.id] = {
      id: update.id,
      type: "model-update",
      title,
      summary: `${update.updateTypeLabel} · ${update.affectedObjectTypeLabel}`,
      eventType: "Model update",
      tags: ["Model update"],
      inspectorObjectType: "model_update",
      inspectorObjectId: update.id,
    };
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

  registerTodayAttentionObjects(objects, input);

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
      todayReportEmpty: TODAY_REPORT_EMPTY_COPY,
    },
  });
}
