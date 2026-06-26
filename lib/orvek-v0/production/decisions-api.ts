import type { SurfacedActionView } from "../../actions-api";
import {
  DECISIONS_EMPTY_COPY,
  toDecisionStatusLabel,
} from "../../decisions-surface";
import {
  V0_DECISIONS_CONTEXT_EMPTY_COPY,
  V0_DECISIONS_OPTIONS_EMPTY_COPY,
  V0_DECISIONS_OUTCOME_REVIEW_EMPTY_COPY,
  V0_DECISIONS_PROJECTION_EMPTY_COPY,
} from "../../orvek-adapters/decisions";
import type { OrvekDataApi, OrvekDecisionListGroup } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";

function actionToObject(action: SurfacedActionView): OrvekObject {
  return {
    id: action.id,
    type: "decision",
    title: action.title,
    summary: action.whySuggested,
    recommendation: action.whySuggested,
    receiptIds: action.linkedClaimId ? [action.linkedClaimId] : [],
    contextIds: [],
    tags: [toDecisionStatusLabel(action.status)],
    inspectorObjectType: action.linkedClaimId ? "pattern_claim" : undefined,
    inspectorObjectId: action.linkedClaimId ?? action.id,
  };
}

function buildGroups(list: SurfacedActionView[]): OrvekDecisionListGroup[] {
  return [
    {
      heading: "Active",
      ids: list.filter((item) => item.status === "not_started").map((item) => item.id),
    },
    {
      heading: "Chosen",
      ids: list.filter((item) => item.status === "done" && Boolean(item.note)).map((item) => item.id),
    },
    {
      heading: "Outcome due",
      tone: "action",
      ids: list.filter((item) => item.status === "done" && !item.note).map((item) => item.id),
    },
    {
      heading: "Reviewed",
      ids: list
        .filter((item) => item.status === "helped" || item.status === "didnt_help")
        .map((item) => item.id),
    },
  ];
}

export function buildDecisionsProductionDataApi(list: SurfacedActionView[]): OrvekDataApi {
  const objects: Record<string, OrvekObject> = {};
  for (const action of list) {
    objects[action.id] = actionToObject(action);
  }

  const decisionListGroups = buildGroups(list);
  const firstId = decisionListGroups.flatMap((group) => group.ids)[0] ?? null;
  const outcomesDue = decisionListGroups.find((group) => group.heading === "Outcome due")?.ids.length ?? 0;
  const reviewed = decisionListGroups.find((group) => group.heading === "Reviewed")?.ids.length ?? 0;

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? [])
        .map((id) => objects[id])
        .filter((object): object is OrvekObject => Boolean(object)),
    decisionListGroups,
    decisionsSelectedId: firstId,
    decisionsHeaderStats: {
      outcomesDue,
      reviewed,
    },
    decisionsIsLoading: false,
    emptyCopyBySlot: {
      decisionsEmpty: DECISIONS_EMPTY_COPY,
      decisionsOptionsEmpty: V0_DECISIONS_OPTIONS_EMPTY_COPY,
      decisionsProjectionEmpty: V0_DECISIONS_PROJECTION_EMPTY_COPY,
      decisionsOutcomeEmpty: V0_DECISIONS_OUTCOME_REVIEW_EMPTY_COPY,
      decisionsContextEmpty: V0_DECISIONS_CONTEXT_EMPTY_COPY,
    },
  });
}
