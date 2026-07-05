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
import {
  buildLinkedClaimAliasObject,
  mapDecisionStatusToReferenceGroup,
  referenceTagsForDecisionGroup,
} from "./decisions-presentation";

function actionToObject(
  action: SurfacedActionView,
  groupHeading: ReturnType<typeof mapDecisionStatusToReferenceGroup>,
): OrvekObject {
  const tags = groupHeading ? referenceTagsForDecisionGroup(groupHeading) : [toDecisionStatusLabel(action.status)];

  return {
    id: action.id,
    type: "decision",
    title: action.title,
    summary: action.whySuggested,
    recommendation: action.whySuggested,
    receiptIds: action.linkedClaimId ? [action.linkedClaimId] : [],
    contextIds: [],
    tags,
    outcomeWindow:
      action.status === "done" && !action.note ? "Outcome review due" : undefined,
    actualOutcome:
      action.status === "helped" || action.status === "didnt_help"
        ? action.note ?? undefined
        : undefined,
    outcomeState:
      groupHeading === "Outcome due"
        ? "due"
        : groupHeading === "Reviewed"
          ? "recorded"
          : undefined,
    inspectorObjectType: action.linkedClaimId ? "pattern_claim" : undefined,
    inspectorObjectId: action.linkedClaimId ?? action.id,
    lastUpdated: action.updatedAt,
  };
}

function groupHeadingForAction(action: SurfacedActionView): ReturnType<typeof mapDecisionStatusToReferenceGroup> {
  return mapDecisionStatusToReferenceGroup(action.status, action.note);
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
    const groupHeading = groupHeadingForAction(action);
    objects[action.id] = actionToObject(action, groupHeading);

    if (action.linkedClaimId && action.linkedClaimSummary) {
      objects[action.linkedClaimId] = buildLinkedClaimAliasObject({
        claimId: action.linkedClaimId,
        claimSummary: action.linkedClaimSummary,
      });
    }
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
