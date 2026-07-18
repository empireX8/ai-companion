/**
 * Production-backed semantic twin of the frozen reference densograph.
 * DEV/TEST ONLY — mirrors live-evidence-depth safety gates.
 */

import { createHash } from "node:crypto";
import {
  FieldworkStatus,
  InvestigationSeedType,
  InvestigationStatus,
  InvestigationVisibility,
  ModelUpdateType,
  ModelUpdateVisibility,
  PatternClaimStatus,
  PatternType,
  Role,
  SessionOrigin,
  StrengthLevel,
  SurfacedActionBucket,
  SurfacedActionStatus,
  SurfacedEvidencePointerKind,
  SurfacedEvidencePointerSurface,
  SurfacedEvidencePointerStatus,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
  type PrismaClient,
} from "@prisma/client";
import {
  assessLiveEvidenceDepthFixtureSafety,
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
  EVIDENCE_DEPTH_FIXTURE_USER_ENV,
} from "./live-evidence-depth-runtime-fixture";
import { buildSurfacedEvidencePointerId } from "./live-evidence-depth-write-path";
import { encodeMovementRationaleInInternalNotes } from "./model-movement-rationale";
import { materializePublishedModelUpdateSnapshots } from "./model-movement-snapshot";
import { publishModelUpdateCandidate } from "./model-update-candidate-publish-helper";
import { normalizeSummary } from "./pattern-claim-lifecycle";

export const SEMANTIC_TWIN_PREFIX = "dev-semantic-twin";
export const SEMANTIC_TWIN_MARKER = "devFixture:semantic-twin-runtime";
export { assessLiveEvidenceDepthFixtureSafety, EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV, EVIDENCE_DEPTH_FIXTURE_USER_ENV };

export const SEMANTIC_TWIN_EXPECTED_TITLES = [
  "Let it express itself visually before design.",
  "You often need visual expression before locking architecture.",
  "Speed vs depth",
  "Scope reopening under uncertainty",
  "Build Orvek into a private intelligence system",
  "Does public visibility trigger overbuilding?",
  "Does visual prototyping reduce architecture uncertainty?",
  "Which features are essential for first public value?",
  "How should Explore extract model-relevant gold from conversation?",
  "Decision pressure is now linked to scope reopening.",
  "User Background / Context Profile added as core model layer",
  "Small public test — narrow version before reopening",
  "Use v0 architecture prototype before final design",
  "Why do I reopen scope before design?",
  "Need to see everything expressed.",
  "A previous note about avoiding shipping.",
] as const;

const RECEIPT_KEYS = ["r1", "r2", "r3", "r5", "r6"] as const;
type ReceiptKey = (typeof RECEIPT_KEYS)[number];

type ReceiptSeed = {
  key: ReceiptKey;
  title: string;
  text: string;
  origin: string;
  why: string;
  resurfaced?: string;
};

const RECEIPTS: ReceiptSeed[] = [
  { key: "r1", title: "Let it express itself visually before design.", text: "Let it express itself visually before we lock the design. I need to see the whole thing standing up first.", origin: "Voice note · captured", why: "Direct evidence for the pattern that visual confirmation precedes architecture lock." },
  { key: "r2", title: "We need to see everything and see it expressed.", text: "We need to see everything and see it expressed — every object, every panel — before I trust the shape.", origin: "ChatGPT archive", why: "Reinforces demand for full feature visibility before commitment." },
  { key: "r3", title: "I'm not concerned with colours right now.", text: "I'm not concerned with colours right now. I want the architecture honest before any polish.", origin: "ChatGPT archive", why: "Separates architecture proof from branding polish in decision framing." },
  { key: "r5", title: "A previous note about avoiding shipping.", text: "Maybe I keep refining because shipping makes it real and I'm not ready for it to be judged.", origin: "ChatGPT archive", why: "Connects decision avoidance to fear of public judgement.", resurfaced: "Resurfaced because of a similar decision pattern around the prototype." },
  { key: "r6", title: "Need to see everything expressed.", text: "Need to see everything expressed before I can stop reopening it.", origin: "Explore conversation", why: "Links visual expression to the scope-reopening loop." },
];

type ConclusionSeed = [slot: string, title: string, summary: string, area: UserMapConclusionArea, status: UserMapConclusionStatus, evidence: number];
const CONCLUSIONS: ConclusionSeed[] = [
  ["claim-visual", "You often need visual expression before locking architecture.", "A recurring requirement that the system express itself visually before you commit to a structure.", UserMapConclusionArea.operating_logic, UserMapConclusionStatus.supported, 3],
  ["claim-receipts", "You trust systems more when receipts and lineage are visible.", "Confidence rises when conclusions can be traced back to source evidence.", UserMapConclusionArea.operating_logic, UserMapConclusionStatus.supported, 5],
  ["claim-positioning", "You resist generic AI / journal positioning.", "Strong aversion to being categorised as a generic AI or journaling product.", UserMapConclusionArea.meaning_system, UserMapConclusionStatus.supported, 4],
  ["conflict-speed-depth", "Speed vs depth", "Pressure to move fast pulls against the need for architectural depth.", UserMapConclusionArea.tension_architecture, UserMapConclusionStatus.disputed, 6],
  ["conflict-design-lock", "Design exploration vs architecture lock", "Wanting to explore freely conflicts with the desire to commit a structure.", UserMapConclusionArea.tension_architecture, UserMapConclusionStatus.disputed, 4],
  ["conflict-build-research", "Build now vs research more", "Pressure to ship competes with the need to research before committing.", UserMapConclusionArea.tension_architecture, UserMapConclusionStatus.disputed, 3],
  ["conflict-polish-proof", "Polish vs proof", "Pull toward visual polish competes with the need for architectural proof.", UserMapConclusionArea.tension_architecture, UserMapConclusionStatus.disputed, 4],
  ["loop-scope-reopen", "Scope reopening under uncertainty", "When uncertainty rises, scope reopens rather than narrows — extending the build.", UserMapConclusionArea.state_ecology, UserMapConclusionStatus.emerging, 6],
  ["loop-visual-recheck", "Rechecking decisions before visual confirmation", "Decisions get re-examined until the system can be seen, not just described.", UserMapConclusionArea.state_ecology, UserMapConclusionStatus.emerging, 4],
  ["loop-generic-strategy", "Rejecting generic strategy when it feels amateur", "Generic positioning gets rejected when it feels shallow or amateur.", UserMapConclusionArea.state_ecology, UserMapConclusionStatus.emerging, 3],
  ["goal-intelligence", "Build Orvek into a private intelligence system", "Make Orvek a durable private intelligence system.", UserMapConclusionArea.developmental_vector, UserMapConclusionStatus.supported, 8],
  ["goal-category", "Create a defensible product category", "The product category should be defensible and inspectable.", UserMapConclusionArea.current_frontier, UserMapConclusionStatus.supported, 5],
  ["goal-prototype-depth", "Move from architecture to prototype without losing depth", "Ship a prototype without flattening the underlying model.", UserMapConclusionArea.current_frontier, UserMapConclusionStatus.supported, 6],
];

const OPEN_QUESTIONS: [slot: string, title: string, question: string][] = [
  ["aq-1", "Does public visibility trigger overbuilding?", "Testing whether anticipated visibility drives scope reopening."],
  ["aq-2", "Does visual prototyping reduce architecture uncertainty?", "Whether a v0 prototype meaningfully lowers uncertainty before design."],
  ["aq-3", "Which features are essential for first public value?", "Which features are essential for first public value?"],
  ["aq-4", "How should Explore extract model-relevant gold from conversation?", "How should Explore extract model-relevant gold from conversation?"],
];

const RESOLVED_INVESTIGATIONS: [slot: string, title: string, question: string][] = [
  ["inv-1", "Why do I reopen scope before design?", "Understanding the trigger could break the most expensive loop."],
  ["inv-2", "Does visual prototyping reduce architecture uncertainty?", "If prototyping reliably reduces uncertainty, it should become a standard pre-design step."],
  ["inv-3", "How should Explore extract useful model data from conversation?", "Extraction quality determines how much conversation becomes model movement."],
];

/** Exact fixture today.movements texts (previous / evidence explanation / updated). */
const MOVEMENTS: [slot: string, summary: string, before: string, after: string, rationale: string, type: ModelUpdateType, conclusion: string][] = [
  ["mu-1", "Decision pressure is now linked to scope reopening.", "Decision pressure was treated as an isolated state.", "Pressure is now modeled as an output of the scope-reopening loop.", "6 receipts tied pressure to repeated scope reopening.", ModelUpdateType.link_detected, "loop-scope-reopen"],
  ["mu-2", "User Background / Context Profile added as core model layer", "Background context was held as loose metadata.", "Context Profile promoted to a first-class, correctable model layer.", "Recent captures referenced current build constraints directly.", ModelUpdateType.conclusion_added, "goal-intelligence"],
  ["aq-1-movement", "Avoidance appears strongest when social consequence is uncertain.", "Avoidance read as a general tendency under pressure.", "Avoidance appears strongest when social consequence is uncertain.", "A decision review added social-consequence detail.", ModelUpdateType.investigation_progressed, "loop-scope-reopen"],
];

const token = (userId: string) => userId.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
export const twinId = (userId: string, slot: string) => `${SEMANTIC_TWIN_PREFIX}-${token(userId)}-${slot}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type SemanticTwinIds = {
  sessionId: string;
  messageIds: Record<ReceiptKey, string>;
  evidenceSpanIds: Record<ReceiptKey, string>;
  patternClaimIds: { visual: string; loop: string; resurfacedR2: string; resurfacedR6: string };
  conclusionIds: Record<string, string>;
  openInvestigationIds: Record<string, string>;
  resolvedInvestigationIds: Record<string, string>;
  fieldworkIds: { primary: string; secondary: string };
  modelUpdateIds: Record<string, string>;
  surfacedActionSurfaceKeys: Record<"primary" | "chosen" | "outcomeDue" | "reviewed", string>;
  surfacedPointerIds: string[];
  allIds: string[];
};

export type SemanticTwinTitleMap = {
  receipts: Record<ReceiptKey, string>;
  conclusions: Record<string, string>;
  openQuestions: Record<string, string>;
  resolvedInvestigations: Record<string, string>;
  movements: Record<string, string>;
  fieldworkPrimaryPrompt: string;
  decisionPrimaryClaimSummary: string;
};

export type SemanticTwinFixtureSeedResult = {
  ids: SemanticTwinIds;
  titles: SemanticTwinTitleMap;
  modelUpdateIds: string[];
  reportCandidateId: string;
};

export type SemanticTwinFixtureCleanupResult = {
  deletedLinks: number;
  deletedPointers: number;
  deletedModelUpdates: number;
  deletedEvidenceSpans: number;
  deletedMessages: number;
  deletedSessions: number;
  deletedPatternEvidence: number;
  deletedClaims: number;
  deletedConclusions: number;
  deletedInvestigations: number;
  deletedFieldwork: number;
  deletedActions: number;
};

export function resolveSemanticTwinIds(userId: string): SemanticTwinIds {
  const messageIds = Object.fromEntries(RECEIPT_KEYS.map((k) => [k, twinId(userId, `message-${k}`)])) as Record<ReceiptKey, string>;
  const evidenceSpanIds = Object.fromEntries(RECEIPT_KEYS.map((k) => [k, twinId(userId, `span-${k}`)])) as Record<ReceiptKey, string>;
  const patternClaimIds = { visual: twinId(userId, "claim-visual"), loop: twinId(userId, "claim-loop"), resurfacedR2: twinId(userId, "claim-resurfaced-r2"), resurfacedR6: twinId(userId, "claim-resurfaced-r6") };
  const conclusionIds = Object.fromEntries(CONCLUSIONS.map(([slot]) => [slot, twinId(userId, `conclusion-${slot}`)]));
  const openInvestigationIds = Object.fromEntries(OPEN_QUESTIONS.map(([slot]) => [slot, twinId(userId, `investigation-${slot}`)]));
  const resolvedInvestigationIds = Object.fromEntries(RESOLVED_INVESTIGATIONS.map(([slot]) => [slot, twinId(userId, `investigation-resolved-${slot}`)]));
  const modelUpdateIds = Object.fromEntries(MOVEMENTS.map(([slot]) => [slot, twinId(userId, `model-update-${slot}`)]));
  const surfacedPointerIds = [patternClaimIds.loop, patternClaimIds.resurfacedR2, patternClaimIds.resurfacedR6]
    .map((claimId) => buildSurfacedEvidencePointerId({ sourceObjectType: UnderstandingLinkSourceType.pattern_claim, sourceObjectId: claimId }))
    .filter((value): value is string => Boolean(value));
  const surfacedActionSurfaceKeys = { primary: twinId(userId, "decision-primary"), chosen: twinId(userId, "decision-chosen"), outcomeDue: twinId(userId, "decision-outcome-due"), reviewed: twinId(userId, "decision-reviewed") };
  const allIds = [twinId(userId, "session-receipts"), ...Object.values(messageIds), ...Object.values(evidenceSpanIds), ...Object.values(patternClaimIds), ...Object.values(conclusionIds), ...Object.values(openInvestigationIds), ...Object.values(resolvedInvestigationIds), twinId(userId, "fieldwork-primary"), twinId(userId, "fieldwork-secondary"), ...Object.values(modelUpdateIds), ...surfacedPointerIds];
  return { sessionId: twinId(userId, "session-receipts"), messageIds, evidenceSpanIds, patternClaimIds, conclusionIds, openInvestigationIds, resolvedInvestigationIds, fieldworkIds: { primary: twinId(userId, "fieldwork-primary"), secondary: twinId(userId, "fieldwork-secondary") }, modelUpdateIds, surfacedActionSurfaceKeys, surfacedPointerIds, allIds };
}

export const assessSemanticTwinFixtureSafety = assessLiveEvidenceDepthFixtureSafety;
export const semanticTwinFixtureAllowed = (env: NodeJS.ProcessEnv = process.env) =>
  assessSemanticTwinFixtureSafety(env).allowed && env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] === "1";

type SeedCtx = { userId: string; db: PrismaClient; now: Date; ids: SemanticTwinIds; receipts: Record<ReceiptKey, ReceiptSeed> };

async function link(ctx: SeedCtx, sourceType: UnderstandingLinkSourceType, sourceId: string, targetType: UnderstandingLinkTargetType, targetId: string, summary?: string) {
  await ctx.db.understandingEvidenceLink.deleteMany({ where: { userId: ctx.userId, sourceType, sourceId, targetType, targetId } });
  await ctx.db.understandingEvidenceLink.create({ data: { userId: ctx.userId, sourceType, sourceId, targetType, targetId, role: UnderstandingLinkRole.supports, summary: summary ?? null } });
}

async function claim(ctx: SeedCtx, id: string, summary: string, quotes: string[]) {
  await ctx.db.patternClaim.upsert({
    where: { id },
    create: { id, userId: ctx.userId, patternType: PatternType.repetitive_loop, strengthLevel: StrengthLevel.tentative, status: PatternClaimStatus.active, summary, summaryNorm: normalizeSummary(summary), journalEvidenceCount: quotes.length, createdAt: ctx.now, updatedAt: ctx.now },
    update: { summary, summaryNorm: normalizeSummary(summary), status: PatternClaimStatus.active, journalEvidenceCount: quotes.length, updatedAt: ctx.now },
  });
  await ctx.db.patternClaimEvidence.deleteMany({ where: { claimId: id } });
  await ctx.db.patternClaimEvidence.createMany({ data: quotes.map((quote, index) => ({ id: `${id}-evidence-${index + 1}`, claimId: id, quote, source: "user_input", createdAt: ctx.now })) });
}

async function pointer(ctx: SeedCtx, claimId: string, receipt: ReceiptSeed, conclusionId: string) {
  const pointerId = buildSurfacedEvidencePointerId({ sourceObjectType: UnderstandingLinkSourceType.pattern_claim, sourceObjectId: claimId });
  if (!pointerId) return;
  await ctx.db.surfacedEvidencePointer.upsert({
    where: { id: pointerId },
    create: { id: pointerId, userId: ctx.userId, pointerKind: SurfacedEvidencePointerKind.pattern, surface: SurfacedEvidencePointerSurface.today_evidence_pointer, sourceObjectType: UnderstandingLinkSourceType.pattern_claim, sourceObjectId: claimId, sourceText: receipt.text, sourceOrigin: receipt.origin, whyItMatters: receipt.why, whyResurfaced: receipt.resurfaced ?? null, surfacedAt: ctx.now, publicEligible: true, status: SurfacedEvidencePointerStatus.active, materializedFrom: SEMANTIC_TWIN_MARKER },
    update: { sourceText: receipt.text, sourceOrigin: receipt.origin, whyItMatters: receipt.why, whyResurfaced: receipt.resurfaced ?? null, surfacedAt: ctx.now, publicEligible: true, status: SurfacedEvidencePointerStatus.active, materializedFrom: SEMANTIC_TWIN_MARKER },
  });
  await link(ctx, UnderstandingLinkSourceType.pattern_claim, claimId, UnderstandingLinkTargetType.usermap_conclusion, conclusionId, receipt.text);
}

async function publishMovement(ctx: SeedCtx, slot: string, seed: (typeof MOVEMENTS)[number], evidenceSpanId: string, evidenceSummary: string, createdAt: Date) {
  const modelUpdateId = ctx.ids.modelUpdateIds[slot]!;
  const conclusionId = ctx.ids.conclusionIds[seed[6]]!;
  const [, summary, before, after, rationale, updateType] = seed;
  await ctx.db.modelUpdate.upsert({
    where: { id: modelUpdateId },
    create: { id: modelUpdateId, userId: ctx.userId, updateType, visibility: ModelUpdateVisibility.internal_only, affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion, affectedObjectId: conclusionId, userFacingSummary: summary, beforeSummary: before, afterSummary: after, isMeaningful: false, internalNotes: `${SEMANTIC_TWIN_MARKER};candidateLane:internal_only`, createdAt },
    update: { updateType, visibility: ModelUpdateVisibility.internal_only, affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion, affectedObjectId: conclusionId, userFacingSummary: summary, beforeSummary: before, afterSummary: after, isMeaningful: false, internalNotes: `${SEMANTIC_TWIN_MARKER};candidateLane:internal_only` },
  });
  await link(ctx, UnderstandingLinkSourceType.evidence_span, evidenceSpanId, UnderstandingLinkTargetType.model_update, modelUpdateId, evidenceSummary);
  await publishModelUpdateCandidate(ctx.userId, modelUpdateId, { db: ctx.db, skipEvidenceDepthMaterialization: true });
  await materializePublishedModelUpdateSnapshots({ userId: ctx.userId, modelUpdateId, db: ctx.db as never, movementRationale: rationale, force: true });
  await ctx.db.modelUpdate.update({ where: { id: modelUpdateId }, data: { visibility: ModelUpdateVisibility.user_visible, isMeaningful: true, beforeSummary: before, afterSummary: after, userFacingSummary: summary, internalNotes: encodeMovementRationaleInInternalNotes(SEMANTIC_TWIN_MARKER, rationale), createdAt } });
  return modelUpdateId;
}

export async function seedSemanticTwinRuntimeFixture(args: { userId: string; db: PrismaClient; now?: Date }): Promise<SemanticTwinFixtureSeedResult> {
  const now = args.now ?? new Date();
  const ids = resolveSemanticTwinIds(args.userId);
  const receipts = Object.fromEntries(RECEIPTS.map((r) => [r.key, r])) as Record<ReceiptKey, ReceiptSeed>;
  const ctx: SeedCtx = { userId: args.userId, db: args.db, now, ids, receipts };

  await args.db.session.upsert({ where: { id: ids.sessionId }, create: { id: ids.sessionId, userId: args.userId, origin: SessionOrigin.APP, surfaceType: "journal_chat", label: `${SEMANTIC_TWIN_MARKER} receipt session`, startedAt: now, createdAt: now, updatedAt: now }, update: { label: `${SEMANTIC_TWIN_MARKER} receipt session`, updatedAt: now } });

  for (const receipt of RECEIPTS) {
    const messageId = ids.messageIds[receipt.key];
    const spanId = ids.evidenceSpanIds[receipt.key];
    await args.db.message.upsert({ where: { id: messageId }, create: { id: messageId, sessionId: ids.sessionId, userId: args.userId, role: Role.user, content: receipt.text, createdAt: now, updatedAt: now }, update: { content: receipt.text, updatedAt: now } });
    await args.db.evidenceSpan.upsert({ where: { id: spanId }, create: { id: spanId, userId: args.userId, messageId, charStart: 0, charEnd: receipt.text.length, contentHash: hash(receipt.text), createdAt: now }, update: { messageId, charStart: 0, charEnd: receipt.text.length, contentHash: hash(receipt.text) } });
  }

  for (const [slot, title, summary, area, status, evidenceCount] of CONCLUSIONS) {
    const id = ids.conclusionIds[slot]!;
    await args.db.userMapConclusion.upsert({ where: { id }, create: { id, userId: args.userId, area, status, visibility: UserMapConclusionVisibility.user_visible, title, summary, confidenceScore: 0.72, confidenceLevel: UserMapConfidenceLevel.medium, evidenceCount, sourceDiversity: 2, timeSpreadDays: 5, notes: SEMANTIC_TWIN_MARKER, createdAt: now, updatedAt: now }, update: { area, status, title, summary, evidenceCount, notes: SEMANTIC_TWIN_MARKER, updatedAt: now } });
  }

  await claim(ctx, ids.patternClaimIds.visual, receipts.r1.title, [receipts.r1.text, receipts.r2.text, receipts.r6.text]);
  await claim(ctx, ids.patternClaimIds.loop, "Scope reopening under uncertainty", [receipts.r5.text, receipts.r6.text]);
  await claim(ctx, ids.patternClaimIds.resurfacedR2, receipts.r2.title, [receipts.r2.text]);
  await claim(ctx, ids.patternClaimIds.resurfacedR6, receipts.r6.title, [receipts.r6.text]);

  for (const [claimId, receiptKey, conclusionSlot] of [[ids.patternClaimIds.visual, "r1", "claim-visual"], [ids.patternClaimIds.loop, "r5", "loop-scope-reopen"], [ids.patternClaimIds.loop, "r6", "loop-scope-reopen"], [ids.patternClaimIds.visual, "r2", "claim-receipts"], [ids.patternClaimIds.visual, "r3", "claim-positioning"]] as const) {
    await link(ctx, UnderstandingLinkSourceType.evidence_span, ids.evidenceSpanIds[receiptKey], UnderstandingLinkTargetType.pattern_claim, claimId, receipts[receiptKey].text);
    await link(ctx, UnderstandingLinkSourceType.evidence_span, ids.evidenceSpanIds[receiptKey], UnderstandingLinkTargetType.usermap_conclusion, ids.conclusionIds[conclusionSlot]!, receipts[receiptKey].text);
  }

  for (const [slot, title, question] of OPEN_QUESTIONS) {
    const id = ids.openInvestigationIds[slot]!;
    await args.db.investigation.upsert({ where: { id }, create: { id, userId: args.userId, title, organizingQuestion: question, status: InvestigationStatus.open, visibility: InvestigationVisibility.user_visible, seedType: InvestigationSeedType.model_uncertainty, competingTheories: [], evidenceNeeded: [], createdAt: now, updatedAt: now }, update: { title, organizingQuestion: question, status: InvestigationStatus.open, updatedAt: now } });
    await link(ctx, UnderstandingLinkSourceType.evidence_span, ids.evidenceSpanIds.r5, UnderstandingLinkTargetType.investigation, id, receipts.r5.text);
  }

  for (const [slot, title, question] of RESOLVED_INVESTIGATIONS) {
    const id = ids.resolvedInvestigationIds[slot]!;
    await args.db.investigation.upsert({ where: { id }, create: { id, userId: args.userId, title, organizingQuestion: question, status: InvestigationStatus.resolved, visibility: InvestigationVisibility.user_visible, seedType: InvestigationSeedType.pattern, competingTheories: [], evidenceNeeded: [], resolutionSummary: `${title} — resolved during semantic twin seed.`, resolvedAt: now, createdAt: now, updatedAt: now }, update: { title, organizingQuestion: question, status: InvestigationStatus.resolved, resolutionSummary: `${title} — resolved during semantic twin seed.`, resolvedAt: now, updatedAt: now } });
  }

  await args.db.fieldworkAssignment.upsert({ where: { id: ids.fieldworkIds.primary }, create: { id: ids.fieldworkIds.primary, userId: args.userId, prompt: "Small public test — narrow version before reopening", reason: "Test one narrow version before reopening the whole system.", status: FieldworkStatus.assigned, linkedObjectType: UnderstandingLinkTargetType.investigation, linkedObjectId: ids.openInvestigationIds["aq-1"]!, observationNote: SEMANTIC_TWIN_MARKER, createdAt: now, updatedAt: now }, update: { prompt: "Small public test — narrow version before reopening", status: FieldworkStatus.assigned, linkedObjectId: ids.openInvestigationIds["aq-1"]!, observationNote: SEMANTIC_TWIN_MARKER, updatedAt: now } });
  await args.db.fieldworkAssignment.upsert({ where: { id: ids.fieldworkIds.secondary }, create: { id: ids.fieldworkIds.secondary, userId: args.userId, prompt: "Test architecture visually in v0", reason: "Generate a v0 architecture prototype and review against feature architecture.", status: FieldworkStatus.active, linkedObjectType: UnderstandingLinkTargetType.investigation, linkedObjectId: ids.openInvestigationIds["aq-2"]!, observationNote: SEMANTIC_TWIN_MARKER, createdAt: now, updatedAt: now }, update: { prompt: "Test architecture visually in v0", status: FieldworkStatus.active, linkedObjectId: ids.openInvestigationIds["aq-2"]!, observationNote: SEMANTIC_TWIN_MARKER, updatedAt: now } });

  const decisionClaimId = twinId(args.userId, "decision-claim-primary");
  const decisionClaimSummary = "Use v0 architecture prototype before final design";
  await claim(ctx, decisionClaimId, decisionClaimSummary, [receipts.r1.text, receipts.r2.text, receipts.r3.text]);
  for (const [key, templateId, status, note] of [["primary", "s6", SurfacedActionStatus.not_started, null], ["chosen", "s2", SurfacedActionStatus.done, "Chose the narrow public test path."], ["outcomeDue", "s4", SurfacedActionStatus.done, null], ["reviewed", "s1", SurfacedActionStatus.helped, "Removing Calendar sharpened the product's identity."]] as const) {
    const surfaceKey = ids.surfacedActionSurfaceKeys[key];
    await args.db.surfacedAction.upsert({ where: { userId_surfaceKey: { userId: args.userId, surfaceKey } }, create: { userId: args.userId, surfaceKey, templateId, bucket: SurfacedActionBucket.stabilize, linkedFamily: PatternType.repetitive_loop, linkedClaimId: decisionClaimId, status, note, surfacedAt: now, updatedAt: now }, update: { templateId, linkedClaimId: decisionClaimId, status, note, updatedAt: now } });
  }

  await pointer(ctx, ids.patternClaimIds.loop, receipts.r5, ids.conclusionIds["loop-scope-reopen"]!);
  await pointer(ctx, ids.patternClaimIds.resurfacedR2, receipts.r2, ids.conclusionIds["claim-receipts"]!);
  await pointer(ctx, ids.patternClaimIds.resurfacedR6, receipts.r6, ids.conclusionIds["loop-scope-reopen"]!);

  const modelUpdateIds: string[] = [];
  const base = now.getTime();
  for (const [index, movement] of MOVEMENTS.entries()) {
    const span = movement[0] === "mu-2" ? ids.evidenceSpanIds.r2 : ids.evidenceSpanIds.r5;
    const text = movement[0] === "mu-2" ? receipts.r2.text : receipts.r5.text;
    modelUpdateIds.push(await publishMovement(ctx, movement[0], movement, span, text, new Date(base + index * 60_000)));
  }

  return {
    ids,
    titles: {
      receipts: Object.fromEntries(RECEIPTS.map((r) => [r.key, r.title])) as Record<ReceiptKey, string>,
      conclusions: Object.fromEntries(CONCLUSIONS.map(([slot, title]) => [slot, title])),
      openQuestions: Object.fromEntries(OPEN_QUESTIONS.map(([slot, title]) => [slot, title])),
      resolvedInvestigations: Object.fromEntries(RESOLVED_INVESTIGATIONS.map(([slot, title]) => [slot, title])),
      movements: Object.fromEntries(MOVEMENTS.map(([slot, summary]) => [slot, summary])),
      fieldworkPrimaryPrompt: "Small public test — narrow version before reopening",
      decisionPrimaryClaimSummary: decisionClaimSummary,
    },
    modelUpdateIds,
    reportCandidateId: ids.modelUpdateIds["mu-1"]!,
  };
}

export async function cleanupSemanticTwinRuntimeFixture(args: { userId: string; db: PrismaClient; ids?: SemanticTwinIds }): Promise<SemanticTwinFixtureCleanupResult> {
  const ids = args.ids ?? resolveSemanticTwinIds(args.userId);
  const claimIds = [...Object.values(ids.patternClaimIds), twinId(args.userId, "decision-claim-primary")];
  const conclusionIds = Object.values(ids.conclusionIds);
  const investigationIds = [...Object.values(ids.openInvestigationIds), ...Object.values(ids.resolvedInvestigationIds)];
  const modelUpdateIds = Object.values(ids.modelUpdateIds);
  const spanIds = Object.values(ids.evidenceSpanIds);
  const messageIds = Object.values(ids.messageIds);
  const surfaceKeys = Object.values(ids.surfacedActionSurfaceKeys);
  const whereUser = { userId: args.userId };

  const deletedPointers = (await args.db.surfacedEvidencePointer.deleteMany({ where: { ...whereUser, OR: [{ id: { in: ids.surfacedPointerIds } }, { materializedFrom: SEMANTIC_TWIN_MARKER }, { sourceObjectId: { in: claimIds } }] } })).count;
  const deletedLinks = (await args.db.understandingEvidenceLink.deleteMany({ where: { ...whereUser, OR: [{ sourceId: { in: [...spanIds, ...claimIds] } }, { targetId: { in: [...conclusionIds, ...investigationIds, ...modelUpdateIds] } }] } })).count;
  const deletedModelUpdates = (await args.db.modelUpdate.deleteMany({ where: { ...whereUser, OR: [{ id: { in: modelUpdateIds } }, { internalNotes: { contains: SEMANTIC_TWIN_MARKER } }, { id: { startsWith: `${SEMANTIC_TWIN_PREFIX}-` } }] } })).count;
  const deletedPatternEvidence = (await args.db.patternClaimEvidence.deleteMany({ where: { OR: [{ claimId: { in: claimIds } }, { id: { startsWith: SEMANTIC_TWIN_PREFIX } }] } })).count;
  const deletedClaims = (await args.db.patternClaim.deleteMany({ where: { ...whereUser, id: { in: claimIds } } })).count;
  const deletedConclusions = (await args.db.userMapConclusion.deleteMany({ where: { ...whereUser, OR: [{ id: { in: conclusionIds } }, { notes: SEMANTIC_TWIN_MARKER }] } })).count;
  const deletedInvestigations = (await args.db.investigation.deleteMany({ where: { ...whereUser, id: { in: investigationIds } } })).count;
  const deletedFieldwork = (await args.db.fieldworkAssignment.deleteMany({ where: { ...whereUser, OR: [{ id: { in: Object.values(ids.fieldworkIds) } }, { observationNote: SEMANTIC_TWIN_MARKER }] } })).count;
  const deletedActions = (await args.db.surfacedAction.deleteMany({ where: { ...whereUser, OR: [{ surfaceKey: { in: surfaceKeys } }, { surfaceKey: { startsWith: SEMANTIC_TWIN_PREFIX } }] } })).count;
  const deletedEvidenceSpans = (await args.db.evidenceSpan.deleteMany({ where: { ...whereUser, id: { in: spanIds } } })).count;
  const deletedMessages = (await args.db.message.deleteMany({ where: { ...whereUser, id: { in: messageIds } } })).count;
  const deletedSessions = (await args.db.session.deleteMany({ where: { ...whereUser, id: ids.sessionId } })).count;

  return { deletedLinks, deletedPointers, deletedModelUpdates, deletedEvidenceSpans, deletedMessages, deletedSessions, deletedPatternEvidence, deletedClaims, deletedConclusions, deletedInvestigations, deletedFieldwork, deletedActions };
}
