import type {
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
} from "@prisma/client";

export const REALITY_TRACKING_OUTPUT_CONTRACT_VERSION =
  "orvek-reality-tracking-output-v0.9";
export const REALITY_TRACKING_OUTPUT_PROMPT_VERSION =
  "orvek-reality-tracking-model-movement-v1";

export const REALITY_TRACKING_OUTPUT_RULES = [
  "Separate facts, supported claims, inference, and speculation.",
  "Do not produce fake reassurance, flattery, or motivational padding.",
  "Do not use therapy framing unless the user supplied it as evidence.",
  "Do not make unsupported identity claims or deep-cause explanations.",
  "Emotional intensity is not proof.",
  "Prefer behavioral language over character language.",
  "If evidence is insufficient, say so directly.",
  "Convert uncertainty into fieldwork or watch-for where useful.",
  "Include what would change the conclusion.",
  "Every major behavioral claim must carry an evidence status marker.",
] as const;

export const REALITY_TRACKING_BANNED_LANGUAGE_PATTERNS = [
  /\bit'?s understandable\b/i,
  /\byou deserve\b/i,
  /\bgrowth mindset\b/i,
  /\bhealing journey\b/i,
  /\bjust believe\b/i,
  /\bhave you considered\b/i,
  /\byou are sabotaging\b/i,
  /\bchildhood\b/i,
] as const;

export const REALITY_TRACKING_REQUIRED_SECTION_KEYS = [
  "facts",
  "stronglySupportedClaims",
  "inferences",
  "speculations",
  "overreachGuardrails",
  "loopPatternDetection",
  "modelMovement",
  "realityGate",
  "fieldworkWatchFor",
  "reentryAction",
  "whatWouldChangeThisConclusion",
] as const;

export type RealityTrackingClaimClassification =
  | "fact"
  | "supported_claim"
  | "inference"
  | "speculation"
  | "guardrail"
  | "loop"
  | "movement"
  | "reality_gate"
  | "fieldwork"
  | "reentry"
  | "change_condition";

export type RealityTrackingEvidenceStatus =
  | "direct"
  | "corroborated"
  | "mixed"
  | "insufficient";

export type RealityTrackingEvidenceRef = {
  id: string;
  sourceType: UnderstandingLinkSourceType | string;
  sourceTypeLabel: string;
  sourceId: string;
  role: UnderstandingLinkRole | string;
  label: string;
  href: string | null;
  createdAt: string;
};

export type RealityTrackingClaim = {
  text: string;
  classification: RealityTrackingClaimClassification;
  evidenceStatus: RealityTrackingEvidenceStatus;
  evidenceRefs: RealityTrackingEvidenceRef[];
};

export type RealityTrackingClaimSection = {
  items: RealityTrackingClaim[];
  emptyState: string | null;
};

export type RealityTrackingModelMovementSection = RealityTrackingClaimSection & {
  before: string | null;
  after: string | null;
  confidenceShift: number | null;
};

export type RealityTrackingEvidencePacketSummary = {
  targetLabel: string;
  targetObjectTypeLabel: string;
  dateRangeLabel: string | null;
  receiptCount: number;
  sourceTypeCount: number;
  linkedObjectCount: number;
  linkedDecisionCount: number;
  activeQuestionCount: number;
  fieldworkCount: number;
  correctionCount: number;
  recentMovementCount: number;
};

export type RealityTrackingModelMovementReport = {
  contractVersion: typeof REALITY_TRACKING_OUTPUT_CONTRACT_VERSION;
  promptVersion: typeof REALITY_TRACKING_OUTPUT_PROMPT_VERSION;
  generatedAt: string;
  generator: "deterministic_fallback";
  evidencePacketSummary: RealityTrackingEvidencePacketSummary;
  facts: RealityTrackingClaimSection;
  stronglySupportedClaims: RealityTrackingClaimSection;
  inferences: RealityTrackingClaimSection;
  speculations: RealityTrackingClaimSection;
  overreachGuardrails: RealityTrackingClaimSection;
  loopPatternDetection: RealityTrackingClaimSection;
  modelMovement: RealityTrackingModelMovementSection;
  realityGate: RealityTrackingClaimSection;
  fieldworkWatchFor: RealityTrackingClaimSection;
  reentryAction: RealityTrackingClaimSection;
  whatWouldChangeThisConclusion: RealityTrackingClaimSection;
};

export function normalizeRealityTrackingText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function collectRealityTrackingClaimTexts(
  report: RealityTrackingModelMovementReport
): string[] {
  const sections = [
    report.facts,
    report.stronglySupportedClaims,
    report.inferences,
    report.speculations,
    report.overreachGuardrails,
    report.loopPatternDetection,
    report.modelMovement,
    report.realityGate,
    report.fieldworkWatchFor,
    report.reentryAction,
    report.whatWouldChangeThisConclusion,
  ];

  return sections.flatMap((section) => section.items.map((item) => item.text));
}

export function reportContainsBannedLanguage(
  report: RealityTrackingModelMovementReport
): boolean {
  const body = collectRealityTrackingClaimTexts(report).join("\n");
  return REALITY_TRACKING_BANNED_LANGUAGE_PATTERNS.some((pattern) =>
    pattern.test(body)
  );
}
