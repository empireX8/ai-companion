import type { FamilyKey } from "./patterns-api";
import {
  PATTERN_FAMILY_SECTIONS,
  type PatternClaimView as PatternClaimViewType,
} from "./patterns-api";
import type {
  ActionBucket,
  ActionEffortLevel,
  ActionPrioritySnapshot,
  ActionStatus,
  SurfacedActionView,
} from "./actions-api";

type VisibleClaim = PatternClaimViewType;

export type VisibleGoalReference = {
  id: string;
  statement: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BuildGoalAssessmentReason =
  | "accepted"
  | "empty"
  | "too_short"
  | "too_long"
  | "question_like"
  | "assistant_directed"
  | "procedural_chatter"
  | "missing_goal_shape";

export type BuildGoalAssessment = {
  normalized: string;
  eligible: boolean;
  reason: BuildGoalAssessmentReason;
};

type ActionTemplate = {
  id: string;
  title: string;
  whySuggested: string;
  effort: ActionEffortLevel;
};

export type SurfacedActionBlueprint = {
  surfaceKey: string;
  templateId: string;
  title: string;
  whySuggested: string;
  bucket: ActionBucket;
  effort: ActionEffortLevel;
  linkedFamily: FamilyKey | null;
  linkedClaimId: string | null;
  linkedClaimSummary: string | null;
  linkedGoalId: string | null;
  linkedGoalStatement: string | null;
  linkedSourceLabel: string;
};

type SurfacedActionStateRow = {
  id: string;
  userId: string;
  surfaceKey: string;
  templateId: string;
  bucket: ActionBucket;
  linkedFamily: FamilyKey | null;
  linkedClaimId: string | null;
  linkedGoalRefId: string | null;
  status: ActionStatus;
  note: string | null;
  surfacedAt: Date;
  updatedAt: Date;
};

type MinimalDb = {
  surfacedAction: {
    findMany: (args: {
      where: { userId: string; surfaceKey: { in: string[] } };
    }) => Promise<SurfacedActionStateRow[]>;
    create: (args: {
      data: {
        userId: string;
        surfaceKey: string;
        templateId: string;
        bucket: ActionBucket;
        linkedFamily: FamilyKey | null;
        linkedClaimId: string | null;
        linkedGoalRefId: string | null;
        status: ActionStatus;
      };
    }) => Promise<SurfacedActionStateRow>;
    update: (args: {
      where: { id: string };
      data: {
        templateId?: string;
        bucket?: ActionBucket;
        linkedFamily?: FamilyKey | null;
        linkedClaimId?: string | null;
        linkedGoalRefId?: string | null;
        status?: ActionStatus;
        note?: string | null;
      };
    }) => Promise<SurfacedActionStateRow>;
    findFirst: (args: {
      where: { id: string; userId: string };
    }) => Promise<SurfacedActionStateRow | null>;
  };
};

const FAMILY_LABELS = Object.fromEntries(
  PATTERN_FAMILY_SECTIONS.map((section) => [section.familyKey, section.sectionLabel])
) as Record<FamilyKey, string>;

const STABILIZE_LIBRARY: Record<string, ActionTemplate> = {
  s1: {
    id: "s1",
    title: "Wind down 20 minutes before bed",
    whySuggested:
      "A short evening buffer can reduce what spills into tomorrow.",
    effort: "Low",
  },
  s2: {
    id: "s2",
    title: "Write one sentence about what you're carrying into the day",
    whySuggested:
      "This helps catch pressure early, before the day gets crowded.",
    effort: "Low",
  },
  s3: {
    id: "s3",
    title: "Name one completion point before you start a task",
    whySuggested:
      "A named finish line makes scope easier to contain.",
    effort: "Low",
  },
  s4: {
    id: "s4",
    title: "Pause before agreeing — write down what you're saying yes to",
    whySuggested:
      "Useful when pressure makes a quick yes more likely than a clear one.",
    effort: "Low",
  },
  s5: {
    id: "s5",
    title: "Write the self-criticism in one sentence, then add one counter-fact",
    whySuggested:
      "Best when self-criticism is loud and needs one concrete answer.",
    effort: "Low",
  },
  s6: {
    id: "s6",
    title: "Write the recurring thought down as-is, without trying to resolve it",
    whySuggested:
      "Useful when the thought loop keeps restarting and needs somewhere to land.",
    effort: "Low",
  },
};

const BUILD_LIBRARY: Record<string, ActionTemplate> = {
  b1: {
    id: "b1",
    title: "Ship one small version before you review it twice",
    whySuggested:
      "Best when the goal is stalling at hesitation or over-polishing.",
    effort: "Medium",
  },
  b2: {
    id: "b2",
    title: "Choose one repeatable time for this goal this week",
    whySuggested:
      "A repeatable slot helps this move from intention to practice.",
    effort: "Low",
  },
  b3: {
    id: "b3",
    title: "Write the one sentence you want to say before that conversation",
    whySuggested:
      "Useful when progress depends on saying something clearly.",
    effort: "Medium",
  },
  b4: {
    id: "b4",
    title: "Define the smallest version you could finish this week",
    whySuggested:
      "A smaller finish line can make this move this week.",
    effort: "Low",
  },
  b5: {
    id: "b5",
    title: "Protect one block this week that supports recovery",
    whySuggested:
      "Protecting recovery time supports this without adding more pressure.",
    effort: "Low",
  },
};

const STABILIZE_TEMPLATE_ORDER: Record<FamilyKey, string[]> = {
  trigger_condition: ["s4", "s3", "s1", "s2"],
  inner_critic: ["s5", "s2", "s1", "s3"],
  repetitive_loop: ["s6", "s3", "s2", "s1"],
  contradiction_drift: ["s2", "s3", "s5", "s1"],
  recovery_stabilizer: ["s1", "s2", "s3", "s4"],
};

const STABILIZE_FALLBACK_ORDER = ["s3", "s2", "s1"];
const BUILD_FALLBACK_ORDER = ["b2", "b4", "b5"];
const MIN_BUILD_GOAL_WORDS = 4;
const MIN_BUILD_GOAL_LENGTH = 18;
const MAX_BUILD_GOAL_LENGTH = 140;
const MAX_STABILIZE_PRIORITY_CLAIMS = 3;

function normalizeBuildGoalStatement(statement: string): string {
  return statement.replace(/\s+/g, " ").trim();
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

const QUESTION_LIKE_REGEX =
  /\?|^(?:what|why|how|when|where|who|do|does|did|can|could|should|would|will|is|are|am)\b/i;
const ASSISTANT_DIRECTED_REGEX =
  /^(?:please\s+)?(?:show|tell|help|walk|give|explain|fix|open|run|check|look|review|debug|install)\b|\b(?:can you|could you|would you|help me|show me|tell me|walk me through)\b/i;
const PROCEDURAL_CHATTER_REGEX =
  /\b(?:terminal|finder|folder|directory|file|files|shell|command line|bash|zsh|git|npm|npx|pnpm|yarn|prisma|migration|schema|route|api|repo|repository)\b/i;
const TROUBLESHOOTING_REGEX =
  /\b(?:do i need to|can i|how do i|why is|what is|error|broken|install|run|open|click|use|do that|that myself|debug|fix)\b/i;
const STRONG_GOAL_CUE_REGEX =
  /\b(?:my goal is|i want to|i need to|i'm trying to|i am trying to|i plan to|i hope to|i aim to|i'd like to|i would like to|i'm working on|i am working on)\b/i;
const GOAL_FRAGMENT_START_REGEX =
  /^(?:build|finish|ship|publish|write|create|practice|learn|study|improve|recover|sleep|exercise|walk|talk|ask|set|protect|be|feel|become|get|launch|start|stop|share|spend)\b/i;
const GOAL_THEME_FRAGMENT_REGEX =
  /^(?:more|less|better|stronger|steadier)\b.*\b(?:confidence|confident|social|recovery|routine|habit|sleep|energy|focus|clarity|boundary|boundaries|writing|project|practice|discipline)\b/i;
const GOAL_TIME_ANCHOR_REGEX =
  /\b(?:today|tonight|tomorrow|this week|this month|daily|weekly|by\s+\w+|before\s+\w+|after\s+\w+)\b/i;
const GOAL_CONCRETE_ACTION_REGEX =
  /\b(?:finish|ship|publish|send|write|practice|train|walk|exercise|sleep|protect|set|schedule|launch|build|rebuild|share|study|learn|plan)\b/i;
const GOAL_VAGUE_CUE_REGEX = /\b(?:better|more|less|improve|improvement)\b/i;

type GoalSignalStrength = "strong" | "moderate" | "weak";

function sortVisibleClaims(claims: VisibleClaim[]): VisibleClaim[] {
  const statusRank = { active: 0, candidate: 1, paused: 2, dismissed: 3 } as const;
  const strengthRank = { established: 0, developing: 1, tentative: 2 } as const;
  const actionRank = (status: string | null | undefined): number => {
    if (status === "in_progress") return 0;
    if (status === "pending") return 1;
    return 2;
  };

  return [...claims].sort((left, right) => {
    const statusDelta =
      statusRank[left.status] - statusRank[right.status];
    if (statusDelta !== 0) return statusDelta;

    const leftActionRank = actionRank(left.action?.status);
    const rightActionRank = actionRank(right.action?.status);
    if (leftActionRank !== rightActionRank) {
      return leftActionRank - rightActionRank;
    }

    const updatedDelta =
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    if (updatedDelta !== 0) return updatedDelta;

    const strengthDelta =
      strengthRank[left.strengthLevel] - strengthRank[right.strengthLevel];
    if (strengthDelta !== 0) return strengthDelta;

    if (right.sessionCount !== left.sessionCount) {
      return right.sessionCount - left.sessionCount;
    }

    if (right.evidenceCount !== left.evidenceCount) {
      return right.evidenceCount - left.evidenceCount;
    }

    return left.id.localeCompare(right.id);
  });
}

function prioritizeClaimFamilyCoverage(
  claims: VisibleClaim[],
  maxClaims = MAX_STABILIZE_PRIORITY_CLAIMS
): VisibleClaim[] {
  const selected: VisibleClaim[] = [];
  const seenFamilies = new Set<FamilyKey>();

  for (const claim of claims) {
    if (selected.length >= maxClaims) break;
    if (seenFamilies.has(claim.patternType)) continue;
    selected.push(claim);
    seenFamilies.add(claim.patternType);
  }

  if (selected.length >= maxClaims) {
    return selected;
  }

  for (const claim of claims) {
    if (selected.length >= maxClaims) break;
    if (selected.some((entry) => entry.id === claim.id)) continue;
    selected.push(claim);
  }

  return selected;
}

function pickPriorityClaims(claims: VisibleClaim[]): VisibleClaim[] {
  const active = sortVisibleClaims(claims.filter((claim) => claim.status === "active"));
  if (active.length > 0) return prioritizeClaimFamilyCoverage(active);
  return prioritizeClaimFamilyCoverage(
    sortVisibleClaims(claims.filter((claim) => claim.status === "candidate"))
  );
}

function toPriorityClaim(claim: VisibleClaim) {
  return {
    id: claim.id,
    summary: claim.summary,
    patternType: claim.patternType,
    status: claim.status as "candidate" | "active",
  };
}

export function buildCurrentPrioritySnapshot(
  claims: VisibleClaim[],
  hasData = true
): ActionPrioritySnapshot {
  const active = claims.filter((claim) => claim.status === "active");
  const candidate = claims.filter((claim) => claim.status === "candidate");
  const featuredPool = active.length > 0 ? sortVisibleClaims(active) : sortVisibleClaims(candidate);

  return {
    featured: featuredPool.slice(0, 3).map(toPriorityClaim),
    totalActive: active.length,
    totalCandidate: candidate.length,
    hasData,
  };
}

function makeStabilizeBlueprint(
  templateId: string,
  claim: VisibleClaim | null
): SurfacedActionBlueprint {
  const template = STABILIZE_LIBRARY[templateId]!;
  const linkedFamily = claim?.patternType ?? null;
  const linkedClaimSummary = claim?.summary ?? null;

  return {
    surfaceKey: claim
      ? `stabilize:${template.id}:claim:${claim.id}`
      : `stabilize:${template.id}:fallback`,
    templateId: template.id,
    title: template.title,
    whySuggested: template.whySuggested,
    bucket: "stabilize",
    effort: template.effort,
    linkedFamily,
    linkedClaimId: claim?.id ?? null,
    linkedClaimSummary,
    linkedGoalId: null,
    linkedGoalStatement: null,
    linkedSourceLabel: claim
      ? linkedClaimSummary ?? FAMILY_LABELS[linkedFamily!]
      : "General stabilizer while live pattern signal is still sparse",
  };
}

function findBuildTemplateOrder(statement: string): string[] {
  const normalized = statement.toLowerCase();

  if (/\b(share|publish|post|ship|launch|submit|send|show|speak|say)\b/.test(normalized)) {
    return ["b1", "b4", "b2"];
  }

  if (/\b(sleep|rest|exercise|walk|health|healthy|recover|routine|habit|consistent)\b/.test(normalized)) {
    return ["b5", "b2", "b4"];
  }

  if (/\b(talk|ask|conversation|boundary|boundaries|relationship|family|partner|friend|team)\b/.test(normalized)) {
    return ["b3", "b4", "b2"];
  }

  if (/\b(learn|practice|study|improve|better|build|write|create|project|focus|clarity|decide|plan)\b/.test(normalized)) {
    return ["b2", "b4", "b1"];
  }

  return BUILD_FALLBACK_ORDER;
}

export function assessBuildGoalStatement(statement: string): BuildGoalAssessment {
  const normalized = normalizeBuildGoalStatement(statement);

  if (!normalized) {
    return { normalized, eligible: false, reason: "empty" };
  }

  if (
    normalized.length < MIN_BUILD_GOAL_LENGTH ||
    countWords(normalized) < MIN_BUILD_GOAL_WORDS
  ) {
    return { normalized, eligible: false, reason: "too_short" };
  }

  if (normalized.length > MAX_BUILD_GOAL_LENGTH) {
    return { normalized, eligible: false, reason: "too_long" };
  }

  if (QUESTION_LIKE_REGEX.test(normalized)) {
    return { normalized, eligible: false, reason: "question_like" };
  }

  if (ASSISTANT_DIRECTED_REGEX.test(normalized)) {
    return { normalized, eligible: false, reason: "assistant_directed" };
  }

  if (
    PROCEDURAL_CHATTER_REGEX.test(normalized) &&
    TROUBLESHOOTING_REGEX.test(normalized)
  ) {
    return { normalized, eligible: false, reason: "procedural_chatter" };
  }

  if (
    !STRONG_GOAL_CUE_REGEX.test(normalized) &&
    !GOAL_FRAGMENT_START_REGEX.test(normalized) &&
    !GOAL_THEME_FRAGMENT_REGEX.test(normalized)
  ) {
    return { normalized, eligible: false, reason: "missing_goal_shape" };
  }

  return { normalized, eligible: true, reason: "accepted" };
}

export function selectEligibleBuildGoals(
  goals: VisibleGoalReference[]
): VisibleGoalReference[] {
  const uniqueByStatement = new Set<string>();
  const eligible: VisibleGoalReference[] = [];

  for (const goal of sortGoals(goals)) {
    const assessment = assessBuildGoalStatement(goal.statement);
    if (!assessment.eligible) continue;

    const dedupeKey = assessment.normalized
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (uniqueByStatement.has(dedupeKey)) continue;
    uniqueByStatement.add(dedupeKey);
    eligible.push({
      ...goal,
      statement: assessment.normalized,
    });
  }

  return eligible;
}

function sortGoals(goals: VisibleGoalReference[]): VisibleGoalReference[] {
  return [...goals].sort((left, right) => {
    const updatedDelta = right.updatedAt.getTime() - left.updatedAt.getTime();
    if (updatedDelta !== 0) return updatedDelta;

    const createdDelta = right.createdAt.getTime() - left.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta;

    return left.id.localeCompare(right.id);
  });
}

function scoreGoalSignal(statement: string): number {
  const normalized = statement.toLowerCase();
  const words = countWords(normalized);
  let score = 0;

  if (STRONG_GOAL_CUE_REGEX.test(normalized)) {
    score += 2;
  }

  if (words >= 5 && words <= 18) {
    score += 1;
  } else if (words <= 4 || words >= 26) {
    score -= 0.5;
  }

  if (GOAL_CONCRETE_ACTION_REGEX.test(normalized)) {
    score += 1;
  }

  if (GOAL_TIME_ANCHOR_REGEX.test(normalized)) {
    score += 0.75;
  }

  if (GOAL_VAGUE_CUE_REGEX.test(normalized) && !GOAL_CONCRETE_ACTION_REGEX.test(normalized)) {
    score -= 0.75;
  }

  return score;
}

function classifyGoalSignal(statement: string): GoalSignalStrength {
  const score = scoreGoalSignal(statement);
  if (score >= 3) return "strong";
  if (score >= 1.5) return "moderate";
  return "weak";
}

function strengthRank(value: GoalSignalStrength): number {
  switch (value) {
    case "strong":
      return 0;
    case "moderate":
      return 1;
    default:
      return 2;
  }
}

function maxSlotsForGoal(
  strength: GoalSignalStrength,
  goalCount: number,
  maxItems: number
): number {
  if (strength === "strong") {
    return goalCount === 1 ? maxItems : 2;
  }
  if (strength === "moderate") {
    return goalCount === 1 ? Math.min(2, maxItems) : 1;
  }
  return 1;
}

function makeBuildBlueprint(
  templateId: string,
  goal: VisibleGoalReference | null
): SurfacedActionBlueprint {
  const template = BUILD_LIBRARY[templateId]!;

  return {
    surfaceKey: goal
      ? `build:${template.id}:goal:${goal.id}`
      : `build:${template.id}:fallback`,
    templateId: template.id,
    title: template.title,
    whySuggested: template.whySuggested,
    bucket: "build",
    effort: template.effort,
    linkedFamily: null,
    linkedClaimId: null,
    linkedClaimSummary: null,
    linkedGoalId: goal?.id ?? null,
    linkedGoalStatement: goal?.statement ?? null,
    linkedSourceLabel:
      goal?.statement ??
      "A useful next step even before a clearer goal is locked in",
  };
}

export function selectStabilizeActionBlueprints(
  claims: VisibleClaim[],
  maxItems = 3
): SurfacedActionBlueprint[] {
  const priorityClaims = pickPriorityClaims(claims).slice(
    0,
    MAX_STABILIZE_PRIORITY_CLAIMS
  );

  if (priorityClaims.length === 0) {
    return STABILIZE_FALLBACK_ORDER.slice(0, maxItems).map((templateId) =>
      makeStabilizeBlueprint(templateId, null)
    );
  }

  const cursors = new Map(priorityClaims.map((claim) => [claim.id, 0]));
  const usedTemplateIds = new Set<string>();
  const blueprints: SurfacedActionBlueprint[] = [];

  while (blueprints.length < maxItems) {
    let addedInPass = false;

    for (const claim of priorityClaims) {
      const order = STABILIZE_TEMPLATE_ORDER[claim.patternType] ?? STABILIZE_FALLBACK_ORDER;
      let cursor = cursors.get(claim.id) ?? 0;
      while (cursor < order.length && usedTemplateIds.has(order[cursor]!)) {
        cursor += 1;
      }
      cursors.set(claim.id, cursor + 1);

      const templateId = order[cursor];
      if (!templateId) continue;

      usedTemplateIds.add(templateId);
      blueprints.push(makeStabilizeBlueprint(templateId, claim));
      addedInPass = true;

      if (blueprints.length >= maxItems) break;
    }

    if (!addedInPass) break;
  }

  const leadClaim = priorityClaims[0] ?? null;
  const leadFillOrder = leadClaim
    ? (STABILIZE_TEMPLATE_ORDER[leadClaim.patternType] ?? STABILIZE_FALLBACK_ORDER)
    : STABILIZE_FALLBACK_ORDER;
  for (const templateId of leadFillOrder) {
    if (blueprints.length >= maxItems) break;
    if (usedTemplateIds.has(templateId)) continue;
    usedTemplateIds.add(templateId);
    blueprints.push(makeStabilizeBlueprint(templateId, leadClaim));
  }

  return blueprints;
}

export function selectBuildForwardActionBlueprints(
  goals: VisibleGoalReference[],
  maxItems = 3
): SurfacedActionBlueprint[] {
  const eligibleGoals = selectEligibleBuildGoals(goals);
  const goalProfiles = eligibleGoals
    .map((goal) => ({
      goal,
      strength: classifyGoalSignal(goal.statement),
    }))
    .sort((left, right) => {
      const strengthDelta =
        strengthRank(left.strength) - strengthRank(right.strength);
      if (strengthDelta !== 0) return strengthDelta;

      const updatedDelta =
        right.goal.updatedAt.getTime() - left.goal.updatedAt.getTime();
      if (updatedDelta !== 0) return updatedDelta;

      const createdDelta =
        right.goal.createdAt.getTime() - left.goal.createdAt.getTime();
      if (createdDelta !== 0) return createdDelta;

      return left.goal.id.localeCompare(right.goal.id);
    })
    .slice(0, maxItems);

  const orderedGoals = goalProfiles.map((profile) => profile.goal);

  if (orderedGoals.length === 0) {
    return BUILD_FALLBACK_ORDER.slice(0, maxItems).map((templateId) =>
      makeBuildBlueprint(templateId, null)
    );
  }

  const goalSlotCaps = new Map(
    goalProfiles.map((profile) => [
      profile.goal.id,
      maxSlotsForGoal(profile.strength, goalProfiles.length, maxItems),
    ])
  );
  const goalSlotUsage = new Map(orderedGoals.map((goal) => [goal.id, 0]));
  const orders = new Map(
    orderedGoals.map((goal) => [goal.id, findBuildTemplateOrder(goal.statement)])
  );
  const cursors = new Map(orderedGoals.map((goal) => [goal.id, 0]));
  const usedTemplateIds = new Set<string>();
  const blueprints: SurfacedActionBlueprint[] = [];

  while (blueprints.length < maxItems) {
    let addedInPass = false;

    for (const goal of orderedGoals) {
      const usedSlots = goalSlotUsage.get(goal.id) ?? 0;
      const maxSlots = goalSlotCaps.get(goal.id) ?? 1;
      if (usedSlots >= maxSlots) {
        continue;
      }

      const order = orders.get(goal.id) ?? BUILD_FALLBACK_ORDER;
      let cursor = cursors.get(goal.id) ?? 0;
      while (cursor < order.length && usedTemplateIds.has(order[cursor]!)) {
        cursor += 1;
      }
      cursors.set(goal.id, cursor + 1);

      const templateId = order[cursor];
      if (!templateId) continue;

      usedTemplateIds.add(templateId);
      blueprints.push(makeBuildBlueprint(templateId, goal));
      goalSlotUsage.set(goal.id, usedSlots + 1);
      addedInPass = true;

      if (blueprints.length >= maxItems) break;
    }

    if (!addedInPass) break;
  }

  for (const templateId of BUILD_FALLBACK_ORDER) {
    if (blueprints.length >= maxItems) break;
    if (usedTemplateIds.has(templateId)) continue;
    usedTemplateIds.add(templateId);
    blueprints.push(makeBuildBlueprint(templateId, null));
  }

  return blueprints;
}

function linkedFamilyLabel(family: FamilyKey | null): string | null {
  return family ? FAMILY_LABELS[family] : null;
}

function sameMetadata(
  row: SurfacedActionStateRow,
  blueprint: SurfacedActionBlueprint
): boolean {
  return (
    row.templateId === blueprint.templateId &&
    row.bucket === blueprint.bucket &&
    row.linkedFamily === blueprint.linkedFamily &&
    row.linkedClaimId === blueprint.linkedClaimId &&
    row.linkedGoalRefId === blueprint.linkedGoalId
  );
}

function blueprintToView(
  blueprint: SurfacedActionBlueprint,
  row: SurfacedActionStateRow
): SurfacedActionView {
  return {
    id: row.id,
    title: blueprint.title,
    whySuggested: blueprint.whySuggested,
    bucket: blueprint.bucket,
    effort: blueprint.effort,
    linkedFamily: blueprint.linkedFamily,
    linkedFamilyLabel: linkedFamilyLabel(blueprint.linkedFamily),
    linkedClaimId: blueprint.linkedClaimId,
    linkedClaimSummary: blueprint.linkedClaimSummary,
    linkedGoalId: blueprint.linkedGoalId,
    linkedGoalStatement: blueprint.linkedGoalStatement,
    linkedSourceLabel: blueprint.linkedSourceLabel,
    status: row.status,
    note: row.note,
    surfacedAt: row.surfacedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function syncSurfacedActions(
  {
    userId,
    blueprints,
  }: {
    userId: string;
    blueprints: SurfacedActionBlueprint[];
  },
  db: MinimalDb
): Promise<SurfacedActionView[]> {
  if (blueprints.length === 0) {
    return [];
  }

  const uniqueBlueprints = Array.from(
    new Map(blueprints.map((blueprint) => [blueprint.surfaceKey, blueprint])).values()
  );
  const surfaceKeys = uniqueBlueprints.map((blueprint) => blueprint.surfaceKey);
  const existingRows = await db.surfacedAction.findMany({
    where: { userId, surfaceKey: { in: surfaceKeys } },
  });
  const byKey = new Map(existingRows.map((row) => [row.surfaceKey, row]));

  const resolvedRows: SurfacedActionStateRow[] = [];
  for (const blueprint of uniqueBlueprints) {
    const existing = byKey.get(blueprint.surfaceKey);
    if (!existing) {
      const created = await db.surfacedAction.create({
        data: {
          userId,
          surfaceKey: blueprint.surfaceKey,
          templateId: blueprint.templateId,
          bucket: blueprint.bucket,
          linkedFamily: blueprint.linkedFamily,
          linkedClaimId: blueprint.linkedClaimId,
          linkedGoalRefId: blueprint.linkedGoalId,
          status: "not_started",
        },
      });
      resolvedRows.push(created);
      byKey.set(created.surfaceKey, created);
      continue;
    }

    if (!sameMetadata(existing, blueprint)) {
      const updated = await db.surfacedAction.update({
        where: { id: existing.id },
        data: {
          templateId: blueprint.templateId,
          bucket: blueprint.bucket,
          linkedFamily: blueprint.linkedFamily,
          linkedClaimId: blueprint.linkedClaimId,
          linkedGoalRefId: blueprint.linkedGoalId,
        },
      });
      resolvedRows.push(updated);
      byKey.set(updated.surfaceKey, updated);
      continue;
    }

    resolvedRows.push(existing);
  }

  const rowByKey = new Map(resolvedRows.map((row) => [row.surfaceKey, row]));
  return uniqueBlueprints.map((blueprint) =>
    blueprintToView(blueprint, rowByKey.get(blueprint.surfaceKey)!)
  );
}

export function normalizeSurfacedActionNote(
  note: string | null | undefined
): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateSurfacedActionState(
  {
    actionId,
    userId,
    status,
    note,
  }: {
    actionId: string;
    userId: string;
    status?: ActionStatus;
    note?: string | null;
  },
  db: MinimalDb
): Promise<SurfacedActionStateRow | null> {
  const existing = await db.surfacedAction.findFirst({
    where: { id: actionId, userId },
  });

  if (!existing) {
    return null;
  }

  return db.surfacedAction.update({
    where: { id: actionId },
    data: {
      ...(status ? { status } : {}),
      ...(note !== undefined ? { note: normalizeSurfacedActionNote(note) } : {}),
    },
  });
}

export function mergeActionStateIntoView(
  view: SurfacedActionView,
  row: Pick<SurfacedActionStateRow, "status" | "note" | "updatedAt">
): SurfacedActionView {
  return {
    ...view,
    status: row.status,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
  };
}
