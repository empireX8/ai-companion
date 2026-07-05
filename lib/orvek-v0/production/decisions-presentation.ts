import type { ActionStatus } from "../../actions-api";
import type { OrvekDataApi, OrvekDecisionListGroup } from "../data-provider";
import { ORVEK_DISPLAY_CONTRACT_PRODUCTION } from "../display-contract";
import type { DecisionOption, LabeledValue, OrvekObject } from "../orvek-types";

export const DECISIONS_TITLE_MAX_LENGTH = 120;
export const DECISIONS_SUMMARY_MAX_LENGTH = 200;
export const DECISIONS_OPTION_TEXT_MAX_LENGTH = 180;
export const DECISIONS_RAW_TEXT_REJECT_LENGTH = 320;
export const MIN_DECISIONS_READY_ROW_COUNT = 1;

export const REFERENCE_DECISION_GROUP_HEADINGS = [
  "Active",
  "Chosen",
  "Outcome due",
  "Reviewed",
] as const;

export type ReferenceDecisionGroupHeading = (typeof REFERENCE_DECISION_GROUP_HEADINGS)[number];

const KNOWN_ACTION_STATUSES: ActionStatus[] = [
  "not_started",
  "done",
  "helped",
  "didnt_help",
];

const RAW_TEXT_PATTERNS = [
  /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/,
  /^[$%#>]\s/m,
];

export function collapseDecisionsDisplayWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeDecisionsTitle(value: string | null | undefined): string | null {
  const collapsed = collapseDecisionsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= DECISIONS_TITLE_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, DECISIONS_TITLE_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > DECISIONS_TITLE_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function normalizeDecisionsSummary(value: string | null | undefined): string | null {
  const collapsed = collapseDecisionsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= DECISIONS_SUMMARY_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, DECISIONS_SUMMARY_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > DECISIONS_SUMMARY_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function looksLikeUnsafeRawDecisionsText(value: string | null | undefined): boolean {
  const collapsed = collapseDecisionsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > DECISIONS_RAW_TEXT_REJECT_LENGTH) {
    return true;
  }

  return RAW_TEXT_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function areDecisionsTextsNearIdentical(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = collapseDecisionsDisplayWhitespace(left ?? "").toLowerCase();
  const normalizedRight = collapseDecisionsDisplayWhitespace(right ?? "").toLowerCase();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function isKnownDecisionActionStatus(status: string | null | undefined): status is ActionStatus {
  return KNOWN_ACTION_STATUSES.includes(status as ActionStatus);
}

export function mapDecisionStatusToReferenceGroup(
  status: ActionStatus,
  note: string | null | undefined,
): ReferenceDecisionGroupHeading | null {
  if (status === "not_started") {
    return "Active";
  }

  if (status === "done") {
    return note ? "Chosen" : "Outcome due";
  }

  if (status === "helped" || status === "didnt_help") {
    return "Reviewed";
  }

  return null;
}

export function referenceTagsForDecisionGroup(
  heading: ReferenceDecisionGroupHeading,
): string[] {
  return ["Decision", heading];
}

function normalizeDecisionOption(option: DecisionOption): DecisionOption | null {
  const label = normalizeDecisionsTitle(option.label);
  const text = normalizeDecisionsSummary(option.text);
  if (!label || !text || looksLikeUnsafeRawDecisionsText(text)) {
    return null;
  }

  const pros = option.pros
    ?.map((item) => normalizeDecisionsSummary(item))
    .filter((item): item is string => Boolean(item));
  const cons = option.cons
    ?.map((item) => normalizeDecisionsSummary(item))
    .filter((item): item is string => Boolean(item));

  return {
    label,
    text:
      text.length <= DECISIONS_OPTION_TEXT_MAX_LENGTH
        ? text
        : `${text.slice(0, DECISIONS_OPTION_TEXT_MAX_LENGTH - 1).trimEnd()}…`,
    pros: pros?.length ? pros : undefined,
    cons: cons?.length ? cons : undefined,
  };
}

export function normalizeDecisionOptions(
  options: DecisionOption[] | null | undefined,
): DecisionOption[] | undefined {
  const normalized = (options ?? [])
    .map((option) => normalizeDecisionOption(option))
    .filter((option): option is DecisionOption => Boolean(option));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeDecisionContextEntry(entry: LabeledValue): LabeledValue | null {
  const label = normalizeDecisionsTitle(entry.label);
  const value = normalizeDecisionsSummary(entry.value);
  if (!label || !value || looksLikeUnsafeRawDecisionsText(value)) {
    return null;
  }

  return { label, value };
}

export function normalizeDecisionContext(
  context: LabeledValue[] | null | undefined,
): LabeledValue[] | undefined {
  const normalized = (context ?? [])
    .map((entry) => normalizeDecisionContextEntry(entry))
    .filter((entry): entry is LabeledValue => Boolean(entry));

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMeaningfulTextField(value: string | null | undefined): string | undefined {
  const normalized = normalizeDecisionsSummary(value);
  if (!normalized || looksLikeUnsafeRawDecisionsText(normalized)) {
    return undefined;
  }

  return normalized;
}

export function buildLinkedClaimAliasObject(input: {
  claimId: string;
  claimSummary: string;
}): OrvekObject {
  const summary = normalizeDecisionsSummary(input.claimSummary);

  return {
    id: input.claimId,
    type: "receipt",
    title: "Linked pattern",
    summary: summary ?? undefined,
    sourceText: summary ?? undefined,
    inspectorObjectType: "pattern_claim",
    inspectorObjectId: input.claimId,
  };
}

export function normalizeDecisionsOrvekObject(
  object: OrvekObject,
  groupHeading?: ReferenceDecisionGroupHeading,
): OrvekObject {
  const title = normalizeDecisionsTitle(object.title) ?? object.title;
  const summary = normalizeDecisionsSummary(object.summary);
  const recommendation =
    object.recommendation && !areDecisionsTextsNearIdentical(object.recommendation, summary)
      ? normalizeDecisionsSummary(object.recommendation) ?? undefined
      : undefined;
  const projection = normalizeMeaningfulTextField(object.projection);
  const confidence = normalizeMeaningfulTextField(object.confidence);
  const outcomeWindow = normalizeMeaningfulTextField(object.outcomeWindow);
  const expectedOutcome = normalizeMeaningfulTextField(object.expectedOutcome);
  const actualOutcome = normalizeMeaningfulTextField(object.actualOutcome);
  const tags = groupHeading
    ? referenceTagsForDecisionGroup(groupHeading)
    : object.tags?.filter((tag) => !looksLikeUnsafeRawDecisionsText(tag));

  return {
    ...object,
    title,
    summary: summary ?? undefined,
    recommendation,
    options: normalizeDecisionOptions(object.options),
    decisionContext: normalizeDecisionContext(object.decisionContext),
    projection,
    confidence,
    outcomeWindow,
    expectedOutcome,
    actualOutcome,
    tags,
    outcomeState:
      groupHeading === "Outcome due"
        ? "due"
        : groupHeading === "Reviewed"
          ? "recorded"
          : object.outcomeState,
    receiptIds: object.receiptIds?.filter((id) => Boolean(id?.trim())),
    contextIds: object.contextIds?.filter((id) => Boolean(id?.trim())),
  };
}

export function hasPartialButInvalidDecisionRichFields(object: OrvekObject): boolean {
  if (object.options !== undefined && !normalizeDecisionOptions(object.options)?.length) {
    return true;
  }

  if (
    object.decisionContext !== undefined &&
    !normalizeDecisionContext(object.decisionContext)?.length
  ) {
    return true;
  }

  if (object.projection !== undefined && !normalizeMeaningfulTextField(object.projection)) {
    return true;
  }

  if (object.confidence !== undefined && !normalizeMeaningfulTextField(object.confidence)) {
    return true;
  }

  if (
    (object.outcomeWindow !== undefined && !normalizeMeaningfulTextField(object.outcomeWindow)) ||
    (object.expectedOutcome !== undefined &&
      !normalizeMeaningfulTextField(object.expectedOutcome)) ||
    (object.actualOutcome !== undefined && !normalizeMeaningfulTextField(object.actualOutcome))
  ) {
    return true;
  }

  return false;
}

export function isDecisionsRowPresentationReady(
  object: OrvekObject,
  groupHeading?: ReferenceDecisionGroupHeading,
): boolean {
  if (looksLikeUnsafeRawDecisionsText(object.title)) {
    return false;
  }

  if (object.summary && looksLikeUnsafeRawDecisionsText(object.summary)) {
    return false;
  }

  if (hasPartialButInvalidDecisionRichFields(object)) {
    return false;
  }

  const normalized = normalizeDecisionsOrvekObject(object, groupHeading);

  if (!normalizeDecisionsTitle(normalized.title)) {
    return false;
  }

  if (!normalizeDecisionsSummary(normalized.summary)) {
    return false;
  }

  if (groupHeading && normalized.tags?.[1] !== groupHeading) {
    return false;
  }

  return true;
}

export function hasValidDecisionGroupStructure(
  groups: OrvekDecisionListGroup[] | undefined,
): boolean {
  if (!groups || groups.length !== REFERENCE_DECISION_GROUP_HEADINGS.length) {
    return false;
  }

  for (let index = 0; index < REFERENCE_DECISION_GROUP_HEADINGS.length; index += 1) {
    const expectedHeading = REFERENCE_DECISION_GROUP_HEADINGS[index];
    const group = groups[index];

    if (group.heading !== expectedHeading) {
      return false;
    }

    if (expectedHeading === "Outcome due" && group.tone !== "action") {
      return false;
    }
  }

  return groups.some((group) => group.ids.length > 0);
}

function collectDecisionRowIds(api: OrvekDataApi): string[] {
  return Array.from(new Set(api.decisionListGroups?.flatMap((group) => group.ids) ?? []));
}

export function findDuplicateDecisionRowIds(api: OrvekDataApi): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const group of api.decisionListGroups ?? []) {
    for (const id of group.ids) {
      if (seen.has(id)) {
        duplicates.add(id);
      } else {
        seen.add(id);
      }
    }
  }

  return Array.from(duplicates);
}

function dedupeDecisionGroupIds(groups: OrvekDecisionListGroup[]): OrvekDecisionListGroup[] {
  const seen = new Set<string>();

  return groups.map((group) => ({
    ...group,
    ids: group.ids.filter((id) => {
      if (!id?.trim() || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    }),
  }));
}

function resolveGroupHeadingForId(
  api: OrvekDataApi,
  id: string,
): ReferenceDecisionGroupHeading | undefined {
  for (const group of api.decisionListGroups ?? []) {
    if (group.ids.includes(id) && REFERENCE_DECISION_GROUP_HEADINGS.includes(group.heading as ReferenceDecisionGroupHeading)) {
      return group.heading as ReferenceDecisionGroupHeading;
    }
  }

  return undefined;
}

function canResolveDecisionReceiptIds(api: OrvekDataApi, object: OrvekObject): boolean {
  for (const receiptId of object.receiptIds ?? []) {
    const receipt = api.getObject(receiptId);
    if (!receipt) {
      return false;
    }

    if (looksLikeUnsafeRawDecisionsText(receipt.summary ?? receipt.sourceText)) {
      return false;
    }
  }

  return true;
}

export function hasProductionDisplayContractLeak(api: OrvekDataApi | undefined): boolean {
  return api?.displayContract === ORVEK_DISPLAY_CONTRACT_PRODUCTION;
}

export function isDecisionsPresentationReady(api: OrvekDataApi | undefined): boolean {
  if (!api || api.decisionsIsLoading) {
    return false;
  }

  if (hasProductionDisplayContractLeak(api)) {
    return false;
  }

  if (!hasValidDecisionGroupStructure(api.decisionListGroups)) {
    return false;
  }

  const rowIds = collectDecisionRowIds(api);
  if (rowIds.length < MIN_DECISIONS_READY_ROW_COUNT) {
    return false;
  }

  if (findDuplicateDecisionRowIds(api).length > 0) {
    return false;
  }

  for (const id of rowIds) {
    const object = api.getObject(id);
    const groupHeading = resolveGroupHeadingForId(api, id);

    if (!object || object.type !== "decision" || !groupHeading) {
      return false;
    }

    if (!isDecisionsRowPresentationReady(object, groupHeading)) {
      return false;
    }

    if (!canResolveDecisionReceiptIds(api, object)) {
      return false;
    }
  }

  return true;
}

export function shouldMergeDecisionsProductionApi(api: OrvekDataApi | undefined): boolean {
  if (!api || api.decisionsIsLoading) {
    return false;
  }

  return isDecisionsPresentationReady(normalizeDecisionsProductionDataApi(api));
}

export function resolveDecisionsOpenSelectionId(
  rowId: string,
  getObject: (id: string | null | undefined) => OrvekObject | undefined,
): string {
  const row = getObject(rowId);
  const inspectorObjectId = row?.inspectorObjectId?.trim();

  if (!inspectorObjectId || inspectorObjectId === rowId) {
    return rowId;
  }

  return getObject(inspectorObjectId) ? inspectorObjectId : rowId;
}

export function normalizeDecisionsProductionDataApi(api: OrvekDataApi): OrvekDataApi {
  const decisionListGroups = dedupeDecisionGroupIds(api.decisionListGroups ?? []);
  const objectIds = new Set(collectDecisionRowIds({ ...api, decisionListGroups }));
  const normalizedObjects = new Map<string, OrvekObject>();

  for (const id of objectIds) {
    const object = api.getObject(id);
    const groupHeading = resolveGroupHeadingForId({ ...api, decisionListGroups }, id);
    if (object && groupHeading) {
      normalizedObjects.set(id, normalizeDecisionsOrvekObject(object, groupHeading));
    }
  }

  for (const id of objectIds) {
    const object = normalizedObjects.get(id);
    if (!object) {
      continue;
    }

    for (const receiptId of object.receiptIds ?? []) {
      if (normalizedObjects.has(receiptId) || api.getObject(receiptId)) {
        const existing = normalizedObjects.get(receiptId) ?? api.getObject(receiptId);
        if (existing) {
          normalizedObjects.set(receiptId, existing);
        }
        continue;
      }
    }
  }

  const mergedGetObject = (id: string | null | undefined): OrvekObject | undefined => {
    if (!id) {
      return undefined;
    }

    if (normalizedObjects.has(id)) {
      return normalizedObjects.get(id);
    }

    const object = api.getObject(id);
    if (!object) {
      return undefined;
    }

    if (object.type === "decision") {
      const groupHeading = resolveGroupHeadingForId({ ...api, decisionListGroups }, id);
      return groupHeading ? normalizeDecisionsOrvekObject(object, groupHeading) : undefined;
    }

    return object.type === "receipt" ? object : undefined;
  };

  const { displayContract: _displayContract, decisions: _decisions, ...apiWithoutProductionShell } = api;

  return {
    ...apiWithoutProductionShell,
    decisionListGroups,
    getObject: mergedGetObject,
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = mergedGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
  };
}
