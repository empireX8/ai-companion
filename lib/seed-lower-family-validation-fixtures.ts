import {
  InvestigationSeedType,
  InvestigationVisibility,
  ModelUpdateType,
  ModelUpdateVisibility,
  FieldworkAssignmentVisibility,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import { persistInternalFieldworkCandidate } from "./understanding-dark-engine/fieldwork-candidate-persistence";
import { persistInternalInvestigationCandidate } from "./understanding-dark-engine/investigation-candidate-persistence";
import { persistInternalModelUpdateCandidate } from "./understanding-dark-engine/model-update-candidate-persistence";
import { assembleEvidencePacketV1 } from "./understanding-dark-engine/evidence-packet";
import type { StructuredFieldworkCandidateProposal } from "./understanding-dark-engine/fieldwork-candidate-proposal";
import { usesFieldworkCandidateSafeWording } from "./understanding-dark-engine/fieldwork-candidate-proposal";
import type { StructuredInvestigationCandidateProposal } from "./understanding-dark-engine/investigation-candidate-proposal";
import { usesInvestigationCandidateSafeWording } from "./understanding-dark-engine/investigation-candidate-proposal";
import type { StructuredModelUpdateCandidateProposal } from "./understanding-dark-engine/model-update-candidate-proposal";
import { usesModelUpdateCandidateSafeWording } from "./understanding-dark-engine/model-update-candidate-proposal";
import type { EvidencePacket, EvidencePacketItem } from "./understanding-dark-engine/types";
import {
  applyPersistableEvidenceLinkPolicyChecks,
  buildPersistableEvidenceLinksFromPacket,
  curatePersistableEvidenceLinksForCandidate,
  type UserMapCandidateEvidenceSelection,
} from "./understanding-dark-engine/user-map-candidate-persistence";
import {
  verifyUnderstandingEvidenceLinkSourceOwnership,
  verifyUnderstandingEvidenceLinkTargetOwnership,
} from "./understanding-evidence-link-writer";

export const DEV_FIXTURE_MARKER = "[DEV FIXTURE]";

export const LOWER_FAMILY_FIXTURE_FAMILIES = [
  "investigation",
  "fieldwork",
  "model-update",
] as const;

export type LowerFamilyFixtureFamily = (typeof LOWER_FAMILY_FIXTURE_FAMILIES)[number];

export type SeedLowerFamilyValidationFixturesCliArgs = {
  userId: string;
  families: LowerFamilyFixtureFamily[];
  execute: boolean;
};

export type FamilyFixtureExecuteStatus =
  | "created"
  | "skipped_already_exists"
  | "skipped_not_ready"
  | "skipped_helper_blocked"
  | "error";

export type FamilyFixtureExecuteOutcome = {
  family: LowerFamilyFixtureFamily;
  status: FamilyFixtureExecuteStatus;
  candidateId: string | null;
  evidenceLinksWritten: number | null;
  candidatesWritten: number | null;
  blockedWriteReasons: string[];
  skipReason: string | null;
  errorMessage: string | null;
  persistenceHelper: string;
};

export type LowerFamilyFixtureExecuteReport = Omit<
  LowerFamilyFixturePreflightReport,
  "dryRun" | "writesPerformed" | "diagnosticMessage"
> & {
  dryRun: false;
  writesPerformed: boolean;
  executeMode: true;
  transactionIsolation: "per-family";
  investigationExecute: FamilyFixtureExecuteOutcome | null;
  fieldworkExecute: FamilyFixtureExecuteOutcome | null;
  modelUpdateExecute: FamilyFixtureExecuteOutcome | null;
  skippedFamilies: Array<{ family: LowerFamilyFixtureFamily; reason: string }>;
  laterValidationCommands: string[];
  diagnosticMessage: string;
};

export type LowerFamilyFixtureSeedReport =
  | LowerFamilyFixturePreflightReport
  | LowerFamilyFixtureExecuteReport;

export type ParseSeedLowerFamilyValidationFixturesCliResult =
  | { ok: true; args: SeedLowerFamilyValidationFixturesCliArgs }
  | { ok: false; message: string };

export type SelectedFixtureEvidence = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  linkable: boolean;
  ownershipResolvable: boolean;
  userOwnedVerified: boolean;
};

export type FamilyFixtureValidationPath = {
  lifecycleSteps: string[];
  publishHelper: string;
  publicSurface: string;
  modelUpdateSideEffect: string | null;
};

export type InvestigationFixturePreflight = {
  family: "investigation";
  enoughEvidence: boolean;
  selectedEvidence: SelectedFixtureEvidence[];
  preflightReady: boolean;
  blockers: string[];
  proposalPreview: StructuredInvestigationCandidateProposal;
  expectedOnCreate: {
    visibility: "internal_only";
    candidateLifecycleStatus: "proposed";
    status: "open";
  };
  laterExecuteHelper: "persistInternalInvestigationCandidate";
  laterValidationPath: FamilyFixtureValidationPath;
};

export type FieldworkFixturePreflight = {
  family: "fieldwork";
  enoughEvidence: boolean;
  selectedEvidence: SelectedFixtureEvidence[];
  linkedObject: {
    type: UnderstandingLinkTargetType;
    id: string;
    userOwnedVerified: boolean;
  } | null;
  preflightReady: boolean;
  blockers: string[];
  proposalPreview: StructuredFieldworkCandidateProposal;
  expectedOnCreate: {
    visibility: "internal_only";
    candidateLifecycleStatus: "proposed";
    status: "assigned";
  };
  laterExecuteHelper: "persistInternalFieldworkCandidate";
  laterValidationPath: FamilyFixtureValidationPath;
};

export type ModelUpdateFixturePreflight = {
  family: "model-update";
  enoughEvidence: boolean;
  selectedEvidence: SelectedFixtureEvidence[];
  affectedObject: {
    type: UnderstandingLinkTargetType;
    id: string;
    userOwnedVerified: boolean;
  } | null;
  preflightReady: boolean;
  blockers: string[];
  proposalPreview: StructuredModelUpdateCandidateProposal;
  expectedOnCreate: {
    visibility: "internal_only";
    isMeaningful: false;
    updateType: typeof ModelUpdateType.link_detected;
    hasCandidateLifecycleStatus: false;
  };
  laterExecuteHelper: "persistInternalModelUpdateCandidate";
  laterValidationPath: FamilyFixtureValidationPath;
};

export type LowerFamilyFixturePreflightReport = {
  dryRun: true;
  writesPerformed: false;
  devFixtureOnly: true;
  naturalValidation: false;
  generatedAt: string;
  userId: string;
  familiesRequested: LowerFamilyFixtureFamily[];
  evidenceInventory: {
    patternClaimCount: number;
    messageCount: number;
    contradictionNodeCount: number;
    packetItemCount: number;
    linkablePacketItemCount: number;
  };
  investigation: InvestigationFixturePreflight | null;
  fieldwork: FieldworkFixturePreflight | null;
  modelUpdate: ModelUpdateFixturePreflight | null;
  diagnosticMessage: string;
};

const DISALLOWED_PERSISTED_SOURCE_TYPES = new Set<UnderstandingLinkSourceType>([
  "timeline_aggregation",
  "user_correction",
]);

const PREFERRED_SOURCE_TYPE_ORDER: UnderstandingLinkSourceType[] = [
  "pattern_claim",
  "message",
  "contradiction_node",
  "evidence_span",
  "pattern_claim_evidence",
];

const PREFLIGHT_WINDOW_DAYS = 365;

const INVESTIGATION_LATER_VALIDATION_PATH: FamilyFixtureValidationPath = {
  lifecycleSteps: ["proposed", "held_for_more_evidence", "promoted", "publish"],
  publishHelper: "publishInvestigationCandidate",
  publicSurface: "Active Questions (user_visible + active-question status)",
  modelUpdateSideEffect: "investigation_opened ModelUpdate (user_visible, isMeaningful: true)",
};

const FIELDWORK_LATER_VALIDATION_PATH: FamilyFixtureValidationPath = {
  lifecycleSteps: ["proposed", "held_for_more_evidence", "promoted", "publish"],
  publishHelper: "publishFieldworkCandidate",
  publicSurface: "Watch For (user_visible + promoted/null lifecycle)",
  modelUpdateSideEffect: "fieldwork_assigned ModelUpdate (user_visible, isMeaningful: true)",
};

const MODEL_UPDATE_LATER_VALIDATION_PATH: FamilyFixtureValidationPath = {
  lifecycleSteps: ["internal_only + isMeaningful:false", "publish"],
  publishHelper: "publishModelUpdateCandidate",
  publicSurface: "What Changed / Today / Timeline meaningful feeds",
  modelUpdateSideEffect:
    "No additional ModelUpdate row; publish flips visibility and isMeaningful on the candidate row",
};

export function parseSeedLowerFamilyValidationFixturesCliArgs(
  argv: string[]
): ParseSeedLowerFamilyValidationFixturesCliResult {
  let userId: string | undefined;
  let families: LowerFamilyFixtureFamily[] = [...LOWER_FAMILY_FIXTURE_FAMILIES];
  let execute = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === "--user-id" && argv[index + 1]) {
      userId = argv[index + 1]!.trim();
      index += 1;
      continue;
    }

    if (arg === "--execute") {
      execute = true;
      continue;
    }

    if (arg === "--families" && argv[index + 1]) {
      const parsedFamilies = argv[index + 1]!
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const normalizedFamilies: LowerFamilyFixtureFamily[] = [];
      for (const family of parsedFamilies) {
        if (
          family === "investigation" ||
          family === "fieldwork" ||
          family === "model-update"
        ) {
          normalizedFamilies.push(family);
          continue;
        }

        return {
          ok: false,
          message:
            `--families must be a comma-separated list of investigation, fieldwork, model-update. Unknown value: ${family}`,
        };
      }

      if (normalizedFamilies.length === 0) {
        return { ok: false, message: "--families must include at least one family." };
      }

      families = normalizedFamilies;
      index += 1;
      continue;
    }

  }

  if (!userId) {
    return { ok: false, message: "--user-id is required." };
  }

  return {
    ok: true,
    args: {
      userId,
      families,
      execute,
    },
  };
}

export function containsDevFixtureMarker(value: string): boolean {
  return value.includes(DEV_FIXTURE_MARKER);
}

export async function findExistingDevFixtureInvestigationId(args: {
  userId: string;
  db: PrismaClient;
}): Promise<string | null> {
  const existing = await args.db.investigation.findFirst({
    where: {
      userId: args.userId,
      visibility: InvestigationVisibility.internal_only,
      OR: [
        { title: { contains: DEV_FIXTURE_MARKER } },
        { organizingQuestion: { contains: DEV_FIXTURE_MARKER } },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  return existing?.id ?? null;
}

export async function findExistingDevFixtureFieldworkId(args: {
  userId: string;
  db: PrismaClient;
}): Promise<string | null> {
  const existing = await args.db.fieldworkAssignment.findFirst({
    where: {
      userId: args.userId,
      visibility: FieldworkAssignmentVisibility.internal_only,
      OR: [
        { prompt: { contains: DEV_FIXTURE_MARKER } },
        { reason: { contains: DEV_FIXTURE_MARKER } },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  return existing?.id ?? null;
}

export async function findExistingDevFixtureModelUpdateId(args: {
  userId: string;
  db: PrismaClient;
}): Promise<string | null> {
  const existing = await args.db.modelUpdate.findFirst({
    where: {
      userId: args.userId,
      visibility: ModelUpdateVisibility.internal_only,
      isMeaningful: false,
      userFacingSummary: { contains: DEV_FIXTURE_MARKER },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  return existing?.id ?? null;
}

function isEligiblePacketItem(item: EvidencePacketItem): boolean {
  return (
    item.linkable &&
    item.ownershipResolvable &&
    !DISALLOWED_PERSISTED_SOURCE_TYPES.has(item.sourceType)
  );
}

export function selectFixtureEvidenceFromPacket(
  packet: EvidencePacket
): EvidencePacketItem[] | null {
  const eligible = packet.items.filter(isEligiblePacketItem);
  if (eligible.length < 2) {
    return null;
  }

  const byType = new Map<UnderstandingLinkSourceType, EvidencePacketItem[]>();
  for (const item of eligible) {
    const bucket = byType.get(item.sourceType) ?? [];
    bucket.push(item);
    byType.set(item.sourceType, bucket);
  }

  if (byType.size < 2) {
    return null;
  }

  const selected: EvidencePacketItem[] = [];
  for (const sourceType of PREFERRED_SOURCE_TYPE_ORDER) {
    const bucket = byType.get(sourceType);
    if (!bucket || bucket.length === 0) {
      continue;
    }

    selected.push(bucket[0]!);
    if (selected.length >= 2 && new Set(selected.map((item) => item.sourceType)).size >= 2) {
      break;
    }
  }

  if (selected.length < 2 || new Set(selected.map((item) => item.sourceType)).size < 2) {
    const fallbackTypes = [...byType.keys()].sort();
    const fallback = fallbackTypes.slice(0, 2).map((sourceType) => byType.get(sourceType)![0]!);
    if (fallback.length < 2) {
      return null;
    }
    return fallback;
  }

  return selected;
}

export function toEvidenceSelections(
  items: EvidencePacketItem[]
): UserMapCandidateEvidenceSelection[] {
  return items.map((item) => ({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
  }));
}

async function verifySelectedEvidenceOwnership(args: {
  userId: string;
  items: EvidencePacketItem[];
  db: PrismaClient;
}): Promise<SelectedFixtureEvidence[]> {
  const verified: SelectedFixtureEvidence[] = [];

  for (const item of args.items) {
    const userOwnedVerified = await verifyUnderstandingEvidenceLinkSourceOwnership({
      userId: args.userId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      db: args.db as never,
    });

    verified.push({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      linkable: item.linkable,
      ownershipResolvable: item.ownershipResolvable,
      userOwnedVerified,
    });
  }

  return verified;
}

export function evaluateEvidencePolicyBlockers(
  packet: EvidencePacket,
  evidenceSelections: UserMapCandidateEvidenceSelection[]
): string[] {
  const blockedWriteReasons: string[] = [];
  const builtLinks = buildPersistableEvidenceLinksFromPacket({
    packet,
    evidenceSelections,
    blockedWriteReasons,
  });
  const curated = curatePersistableEvidenceLinksForCandidate(builtLinks);
  applyPersistableEvidenceLinkPolicyChecks({
    links: curated.links,
    blockedWriteReasons,
  });
  return blockedWriteReasons;
}

function buildInvestigationFixtureProposal(
  evidenceSelections: UserMapCandidateEvidenceSelection[]
): StructuredInvestigationCandidateProposal {
  return {
    seedType: InvestigationSeedType.pattern,
    title: `Worth exploring: ${DEV_FIXTURE_MARKER} lower-family validation candidate`,
    organizingQuestion: `What would clarify whether ${DEV_FIXTURE_MARKER} lower-family validation?`,
    summary:
      "This looks worth watching as an open question. Dev-only fixture for Investigation review/publish validation.",
    abstainReasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
    evidenceSelections,
  };
}

function buildFieldworkFixtureProposal(args: {
  evidenceSelections: UserMapCandidateEvidenceSelection[];
  linkedObjectType: UnderstandingLinkTargetType;
  linkedObjectId: string;
}): StructuredFieldworkCandidateProposal {
  return {
    prompt: `Notice whether ${DEV_FIXTURE_MARKER} energy shifts after meetings.`,
    reason:
      "This may be worth watching in practice. Dev-only fixture for Fieldwork review/publish validation.",
    linkedObjectType: args.linkedObjectType,
    linkedObjectId: args.linkedObjectId,
    abstainReasons: ["PROFILE_ARTIFACT_CAP"],
    evidenceSelections: args.evidenceSelections,
  };
}

function buildModelUpdateFixtureProposal(args: {
  evidenceSelections: UserMapCandidateEvidenceSelection[];
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
}): StructuredModelUpdateCandidateProposal {
  return {
    updateType: ModelUpdateType.link_detected,
    userFacingSummary: `There is early evidence that ${DEV_FIXTURE_MARKER} lower-family validation link exists.`,
    affectedObjectType: args.affectedObjectType,
    affectedObjectId: args.affectedObjectId,
    evidenceSelections: args.evidenceSelections,
  };
}

function resolveAnchorObject(
  items: EvidencePacketItem[]
): { type: UnderstandingLinkTargetType; id: string } | null {
  const patternClaim = items.find((item) => item.sourceType === "pattern_claim");
  if (patternClaim) {
    return {
      type: UnderstandingLinkTargetType.pattern_claim,
      id: patternClaim.sourceId,
    };
  }

  const contradiction = items.find((item) => item.sourceType === "contradiction_node");
  if (contradiction) {
    return {
      type: UnderstandingLinkTargetType.contradiction_node,
      id: contradiction.sourceId,
    };
  }

  return null;
}

async function buildInvestigationPreflight(args: {
  userId: string;
  packet: EvidencePacket;
  selectedItems: EvidencePacketItem[] | null;
  db: PrismaClient;
}): Promise<InvestigationFixturePreflight> {
  const blockers: string[] = [];
  const selectedItems = args.selectedItems;
  const enoughEvidence = selectedItems !== null && selectedItems.length >= 2;

  if (!selectedItems || selectedItems.length < 2) {
    blockers.push("INSUFFICIENT_LINKABLE_PACKET_EVIDENCE");
    return {
      family: "investigation",
      enoughEvidence: false,
      selectedEvidence: [],
      preflightReady: false,
      blockers,
      proposalPreview: buildInvestigationFixtureProposal([]),
      expectedOnCreate: {
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        status: "open",
      },
      laterExecuteHelper: "persistInternalInvestigationCandidate",
      laterValidationPath: INVESTIGATION_LATER_VALIDATION_PATH,
    };
  }

  const selectedEvidence = await verifySelectedEvidenceOwnership({
    userId: args.userId,
    items: selectedItems,
    db: args.db,
  });

  if (selectedEvidence.some((item) => !item.userOwnedVerified)) {
    blockers.push("UNRESOLVED_SOURCE_OWNERSHIP");
  }

  const evidenceSelections = toEvidenceSelections(selectedItems);
  blockers.push(...evaluateEvidencePolicyBlockers(args.packet, evidenceSelections));

  const proposalPreview = buildInvestigationFixtureProposal(evidenceSelections);
  if (!usesInvestigationCandidateSafeWording(proposalPreview)) {
    blockers.push("UNSAFE_INVESTIGATION_WORDING");
  }
  if (!proposalPreview.organizingQuestion.endsWith("?")) {
    blockers.push("ORGANIZING_QUESTION_NOT_A_QUESTION");
  }

  const uniqueBlockers = [...new Set(blockers)];

  return {
    family: "investigation",
    enoughEvidence,
    selectedEvidence,
    preflightReady: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    proposalPreview,
    expectedOnCreate: {
      visibility: "internal_only",
      candidateLifecycleStatus: "proposed",
      status: "open",
    },
    laterExecuteHelper: "persistInternalInvestigationCandidate",
    laterValidationPath: INVESTIGATION_LATER_VALIDATION_PATH,
  };
}

async function buildFieldworkPreflight(args: {
  userId: string;
  packet: EvidencePacket;
  selectedItems: EvidencePacketItem[] | null;
  db: PrismaClient;
}): Promise<FieldworkFixturePreflight> {
  const blockers: string[] = [];
  const selectedItems = args.selectedItems;
  const enoughEvidence = selectedItems !== null && selectedItems.length >= 2;

  if (!selectedItems || selectedItems.length < 2) {
    blockers.push("INSUFFICIENT_LINKABLE_PACKET_EVIDENCE");
    return {
      family: "fieldwork",
      enoughEvidence: false,
      selectedEvidence: [],
      linkedObject: null,
      preflightReady: false,
      blockers,
      proposalPreview: buildFieldworkFixtureProposal({
        evidenceSelections: [],
        linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
        linkedObjectId: "",
      }),
      expectedOnCreate: {
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        status: "assigned",
      },
      laterExecuteHelper: "persistInternalFieldworkCandidate",
      laterValidationPath: FIELDWORK_LATER_VALIDATION_PATH,
    };
  }

  const selectedEvidence = await verifySelectedEvidenceOwnership({
    userId: args.userId,
    items: selectedItems,
    db: args.db,
  });

  if (selectedEvidence.some((item) => !item.userOwnedVerified)) {
    blockers.push("UNRESOLVED_SOURCE_OWNERSHIP");
  }

  const anchor = resolveAnchorObject(selectedItems);
  let linkedObject: FieldworkFixturePreflight["linkedObject"] = null;
  if (!anchor) {
    blockers.push("MISSING_LINKED_OBJECT_ANCHOR");
  } else {
    const userOwnedVerified = await verifyUnderstandingEvidenceLinkTargetOwnership({
      userId: args.userId,
      targetType: anchor.type,
      targetId: anchor.id,
      db: args.db as never,
    });
    linkedObject = {
      type: anchor.type,
      id: anchor.id,
      userOwnedVerified,
    };
    if (!userOwnedVerified) {
      blockers.push("UNRESOLVED_LINKED_OBJECT_OWNERSHIP");
    }
  }

  const evidenceSelections = toEvidenceSelections(selectedItems);
  blockers.push(...evaluateEvidencePolicyBlockers(args.packet, evidenceSelections));

  const proposalPreview = buildFieldworkFixtureProposal({
    evidenceSelections,
    linkedObjectType: anchor?.type ?? UnderstandingLinkTargetType.pattern_claim,
    linkedObjectId: anchor?.id ?? "",
  });

  if (!usesFieldworkCandidateSafeWording(proposalPreview)) {
    blockers.push("UNSAFE_FIELDWORK_WORDING");
  }

  const uniqueBlockers = [...new Set(blockers)];

  return {
    family: "fieldwork",
    enoughEvidence,
    selectedEvidence,
    linkedObject,
    preflightReady: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    proposalPreview,
    expectedOnCreate: {
      visibility: "internal_only",
      candidateLifecycleStatus: "proposed",
      status: "assigned",
    },
    laterExecuteHelper: "persistInternalFieldworkCandidate",
    laterValidationPath: FIELDWORK_LATER_VALIDATION_PATH,
  };
}

async function buildModelUpdatePreflight(args: {
  userId: string;
  packet: EvidencePacket;
  selectedItems: EvidencePacketItem[] | null;
  db: PrismaClient;
}): Promise<ModelUpdateFixturePreflight> {
  const blockers: string[] = [];
  const selectedItems = args.selectedItems;
  const enoughEvidence = selectedItems !== null && selectedItems.length >= 2;

  if (!selectedItems || selectedItems.length < 2) {
    blockers.push("INSUFFICIENT_LINKABLE_PACKET_EVIDENCE");
    return {
      family: "model-update",
      enoughEvidence: false,
      selectedEvidence: [],
      affectedObject: null,
      preflightReady: false,
      blockers,
      proposalPreview: buildModelUpdateFixtureProposal({
        evidenceSelections: [],
        affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
        affectedObjectId: "",
      }),
      expectedOnCreate: {
        visibility: "internal_only",
        isMeaningful: false,
        updateType: ModelUpdateType.link_detected,
        hasCandidateLifecycleStatus: false,
      },
      laterExecuteHelper: "persistInternalModelUpdateCandidate",
      laterValidationPath: MODEL_UPDATE_LATER_VALIDATION_PATH,
    };
  }

  const selectedEvidence = await verifySelectedEvidenceOwnership({
    userId: args.userId,
    items: selectedItems,
    db: args.db,
  });

  if (selectedEvidence.some((item) => !item.userOwnedVerified)) {
    blockers.push("UNRESOLVED_SOURCE_OWNERSHIP");
  }

  const anchor = resolveAnchorObject(selectedItems);
  let affectedObject: ModelUpdateFixturePreflight["affectedObject"] = null;
  if (!anchor) {
    blockers.push("MISSING_AFFECTED_OBJECT_ANCHOR");
  } else {
    const userOwnedVerified = await verifyUnderstandingEvidenceLinkTargetOwnership({
      userId: args.userId,
      targetType: anchor.type,
      targetId: anchor.id,
      db: args.db as never,
    });
    affectedObject = {
      type: anchor.type,
      id: anchor.id,
      userOwnedVerified,
    };
    if (!userOwnedVerified) {
      blockers.push("UNRESOLVED_AFFECTED_OBJECT_OWNERSHIP");
    }
  }

  const evidenceSelections = toEvidenceSelections(selectedItems);
  blockers.push(...evaluateEvidencePolicyBlockers(args.packet, evidenceSelections));

  const proposalPreview = buildModelUpdateFixtureProposal({
    evidenceSelections,
    affectedObjectType: anchor?.type ?? UnderstandingLinkTargetType.pattern_claim,
    affectedObjectId: anchor?.id ?? "",
  });

  if (!usesModelUpdateCandidateSafeWording(proposalPreview)) {
    blockers.push("UNSAFE_MODEL_UPDATE_WORDING");
  }

  const uniqueBlockers = [...new Set(blockers)];

  return {
    family: "model-update",
    enoughEvidence,
    selectedEvidence,
    affectedObject,
    preflightReady: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    proposalPreview,
    expectedOnCreate: {
      visibility: "internal_only",
      isMeaningful: false,
      updateType: ModelUpdateType.link_detected,
      hasCandidateLifecycleStatus: false,
    },
    laterExecuteHelper: "persistInternalModelUpdateCandidate",
    laterValidationPath: MODEL_UPDATE_LATER_VALIDATION_PATH,
  };
}

function buildDiagnosticMessage(report: {
  familiesRequested: LowerFamilyFixtureFamily[];
  investigation: InvestigationFixturePreflight | null;
  fieldwork: FieldworkFixturePreflight | null;
  modelUpdate: ModelUpdateFixturePreflight | null;
}): string {
  const readyFamilies = [
    report.investigation?.preflightReady ? "investigation" : null,
    report.fieldwork?.preflightReady ? "fieldwork" : null,
    report.modelUpdate?.preflightReady ? "model-update" : null,
  ].filter(Boolean);

  if (readyFamilies.length === report.familiesRequested.length) {
    return (
      `Dry-run preflight ready for ${readyFamilies.join(", ")} on requested families. ` +
      "No writes performed. Re-run with --execute to seed internal fixture candidates."
    );
  }

  const blockedFamilies = report.familiesRequested.filter((family) => {
    if (family === "investigation") {
      return !report.investigation?.preflightReady;
    }
    if (family === "fieldwork") {
      return !report.fieldwork?.preflightReady;
    }
    return !report.modelUpdate?.preflightReady;
  });

  return (
    `Dry-run preflight blocked for: ${blockedFamilies.join(", ")}. ` +
    "Review per-family blockers before attempting execute-mode seeding in a later slice."
  );
}

type PreflightContext = {
  now: Date;
  familiesRequested: LowerFamilyFixtureFamily[];
  packet: EvidencePacket;
  evidenceInventory: LowerFamilyFixturePreflightReport["evidenceInventory"];
  investigation: InvestigationFixturePreflight | null;
  fieldwork: FieldworkFixturePreflight | null;
  modelUpdate: ModelUpdateFixturePreflight | null;
};

async function buildPreflightContext(args: {
  userId: string;
  families?: LowerFamilyFixtureFamily[];
  now?: Date;
  db: PrismaClient;
  assemblePacket?: typeof assembleEvidencePacketV1;
}): Promise<PreflightContext> {
  const now = args.now ?? new Date();
  const familiesRequested = args.families ?? [...LOWER_FAMILY_FIXTURE_FAMILIES];
  const assemblePacket = args.assemblePacket ?? assembleEvidencePacketV1;

  const [patternClaimCount, messageCount, contradictionNodeCount, packet] =
    await Promise.all([
      args.db.patternClaim.count({ where: { userId: args.userId } }),
      args.db.message.count({ where: { userId: args.userId } }),
      args.db.contradictionNode.count({ where: { userId: args.userId } }),
      assemblePacket({
        userId: args.userId,
        now,
        windowDays: PREFLIGHT_WINDOW_DAYS,
        db: args.db as never,
      }),
    ]);

  const linkablePacketItemCount = packet.items.filter(isEligiblePacketItem).length;
  const selectedItems = selectFixtureEvidenceFromPacket(packet);

  const investigation = familiesRequested.includes("investigation")
    ? await buildInvestigationPreflight({
        userId: args.userId,
        packet,
        selectedItems,
        db: args.db,
      })
    : null;

  const fieldwork = familiesRequested.includes("fieldwork")
    ? await buildFieldworkPreflight({
        userId: args.userId,
        packet,
        selectedItems,
        db: args.db,
      })
    : null;

  const modelUpdate = familiesRequested.includes("model-update")
    ? await buildModelUpdatePreflight({
        userId: args.userId,
        packet,
        selectedItems,
        db: args.db,
      })
    : null;

  return {
    now,
    familiesRequested,
    packet,
    evidenceInventory: {
      patternClaimCount,
      messageCount,
      contradictionNodeCount,
      packetItemCount: packet.items.length,
      linkablePacketItemCount,
    },
    investigation,
    fieldwork,
    modelUpdate,
  };
}

function toPreflightReport(context: PreflightContext): LowerFamilyFixturePreflightReport {
  return {
    dryRun: true,
    writesPerformed: false,
    devFixtureOnly: true,
    naturalValidation: false,
    generatedAt: context.now.toISOString(),
    userId: context.packet.userId,
    familiesRequested: context.familiesRequested,
    evidenceInventory: context.evidenceInventory,
    investigation: context.investigation,
    fieldwork: context.fieldwork,
    modelUpdate: context.modelUpdate,
    diagnosticMessage: buildDiagnosticMessage({
      familiesRequested: context.familiesRequested,
      investigation: context.investigation,
      fieldwork: context.fieldwork,
      modelUpdate: context.modelUpdate,
    }),
  };
}

function buildLaterValidationCommands(args: {
  userId: string;
  investigationId: string | null;
  fieldworkId: string | null;
  modelUpdateId: string | null;
}): string[] {
  const commands: string[] = [];

  if (args.investigationId) {
    commands.push(
      `npx tsx scripts/validate-investigation-candidate-review-publish-flow.ts --user-id ${args.userId} --candidate-id ${args.investigationId}`
    );
  }

  if (args.fieldworkId) {
    commands.push(
      `# Fieldwork review/publish validator not yet implemented — validate via internal workbench and publish helper for candidate ${args.fieldworkId}`
    );
  }

  if (args.modelUpdateId) {
    commands.push(
      `# ModelUpdate review/publish validator not yet implemented — validate via internal workbench and publishModelUpdateCandidate for candidate ${args.modelUpdateId}`
    );
  }

  return commands;
}

function buildExecuteDiagnosticMessage(args: {
  createdFamilies: LowerFamilyFixtureFamily[];
  skippedFamilies: Array<{ family: LowerFamilyFixtureFamily; reason: string }>;
  writesPerformed: boolean;
}): string {
  if (args.writesPerformed) {
    return (
      `Execute-mode fixture seed created internal candidates for: ${args.createdFamilies.join(", ")}. ` +
      "Fixture-backed only; natural production validation remains blocked. Review/publish validation is a later step."
    );
  }

  if (args.skippedFamilies.length > 0) {
    return (
      "Execute-mode fixture seed performed no new writes. " +
      `Skipped families: ${args.skippedFamilies.map((entry) => `${entry.family} (${entry.reason})`).join(", ")}.`
    );
  }

  return "Execute-mode fixture seed performed no writes.";
}

async function executeInvestigationFixture(args: {
  userId: string;
  preflight: InvestigationFixturePreflight;
  packet: EvidencePacket;
  now: Date;
  db: PrismaClient;
  persistInvestigation?: typeof persistInternalInvestigationCandidate;
  findExisting?: typeof findExistingDevFixtureInvestigationId;
}): Promise<FamilyFixtureExecuteOutcome> {
  const persistInvestigation = args.persistInvestigation ?? persistInternalInvestigationCandidate;
  const findExisting = args.findExisting ?? findExistingDevFixtureInvestigationId;
  const helperName = "persistInternalInvestigationCandidate";

  if (!args.preflight.preflightReady) {
    return {
      family: "investigation",
      status: "skipped_not_ready",
      candidateId: null,
      evidenceLinksWritten: null,
      candidatesWritten: null,
      blockedWriteReasons: args.preflight.blockers,
      skipReason: "Preflight blockers present.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  }

  const existingId = await findExisting({ userId: args.userId, db: args.db });
  if (existingId) {
    return {
      family: "investigation",
      status: "skipped_already_exists",
      candidateId: existingId,
      evidenceLinksWritten: null,
      candidatesWritten: 0,
      blockedWriteReasons: [],
      skipReason: "Existing internal [DEV FIXTURE] Investigation candidate found.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  }

  try {
    const result = await persistInvestigation({
      userId: args.userId,
      proposal: args.preflight.proposalPreview,
      packet: args.packet,
      db: args.db as never,
      now: args.now,
    });

    const candidateId = result.persistedInvestigationId;
    const candidatesWritten = result.payload.candidatesWritten;
    const evidenceLinksWritten = result.payload.evidenceLinksWritten;
    const blockedWriteReasons = result.payload.blockedWriteReasons;

    if (candidatesWritten > 0 && candidateId) {
      return {
        family: "investigation",
        status: "created",
        candidateId,
        evidenceLinksWritten,
        candidatesWritten,
        blockedWriteReasons,
        skipReason: null,
        errorMessage: null,
        persistenceHelper: helperName,
      };
    }

    if (candidateId && blockedWriteReasons.includes("DUPLICATE_CANDIDATE")) {
      return {
        family: "investigation",
        status: "skipped_already_exists",
        candidateId,
        evidenceLinksWritten,
        candidatesWritten,
        blockedWriteReasons,
        skipReason: "Persistence helper reported DUPLICATE_CANDIDATE.",
        errorMessage: null,
        persistenceHelper: helperName,
      };
    }

    return {
      family: "investigation",
      status: "skipped_helper_blocked",
      candidateId,
      evidenceLinksWritten,
      candidatesWritten,
      blockedWriteReasons,
      skipReason: "Persistence helper did not create a candidate.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  } catch (error: unknown) {
    return {
      family: "investigation",
      status: "error",
      candidateId: null,
      evidenceLinksWritten: null,
      candidatesWritten: null,
      blockedWriteReasons: [],
      skipReason: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      persistenceHelper: helperName,
    };
  }
}

async function executeFieldworkFixture(args: {
  userId: string;
  preflight: FieldworkFixturePreflight;
  packet: EvidencePacket;
  now: Date;
  db: PrismaClient;
  persistFieldwork?: typeof persistInternalFieldworkCandidate;
  findExisting?: typeof findExistingDevFixtureFieldworkId;
}): Promise<FamilyFixtureExecuteOutcome> {
  const persistFieldwork = args.persistFieldwork ?? persistInternalFieldworkCandidate;
  const findExisting = args.findExisting ?? findExistingDevFixtureFieldworkId;
  const helperName = "persistInternalFieldworkCandidate";

  if (!args.preflight.preflightReady) {
    return {
      family: "fieldwork",
      status: "skipped_not_ready",
      candidateId: null,
      evidenceLinksWritten: null,
      candidatesWritten: null,
      blockedWriteReasons: args.preflight.blockers,
      skipReason: "Preflight blockers present.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  }

  const existingId = await findExisting({ userId: args.userId, db: args.db });
  if (existingId) {
    return {
      family: "fieldwork",
      status: "skipped_already_exists",
      candidateId: existingId,
      evidenceLinksWritten: null,
      candidatesWritten: 0,
      blockedWriteReasons: [],
      skipReason: "Existing internal [DEV FIXTURE] Fieldwork candidate found.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  }

  try {
    const result = await persistFieldwork({
      userId: args.userId,
      proposal: args.preflight.proposalPreview,
      packet: args.packet,
      db: args.db as never,
      now: args.now,
    });

    const candidateId = result.persistedFieldworkAssignmentId;
    const candidatesWritten = result.payload.candidatesWritten;
    const evidenceLinksWritten = result.payload.evidenceLinksWritten;
    const blockedWriteReasons = result.payload.blockedWriteReasons;

    if (candidatesWritten > 0 && candidateId) {
      return {
        family: "fieldwork",
        status: "created",
        candidateId,
        evidenceLinksWritten,
        candidatesWritten,
        blockedWriteReasons,
        skipReason: null,
        errorMessage: null,
        persistenceHelper: helperName,
      };
    }

    if (candidateId && blockedWriteReasons.includes("DUPLICATE_CANDIDATE")) {
      return {
        family: "fieldwork",
        status: "skipped_already_exists",
        candidateId,
        evidenceLinksWritten,
        candidatesWritten,
        blockedWriteReasons,
        skipReason: "Persistence helper reported DUPLICATE_CANDIDATE.",
        errorMessage: null,
        persistenceHelper: helperName,
      };
    }

    return {
      family: "fieldwork",
      status: "skipped_helper_blocked",
      candidateId,
      evidenceLinksWritten,
      candidatesWritten,
      blockedWriteReasons,
      skipReason: "Persistence helper did not create a candidate.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  } catch (error: unknown) {
    return {
      family: "fieldwork",
      status: "error",
      candidateId: null,
      evidenceLinksWritten: null,
      candidatesWritten: null,
      blockedWriteReasons: [],
      skipReason: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      persistenceHelper: helperName,
    };
  }
}

async function executeModelUpdateFixture(args: {
  userId: string;
  preflight: ModelUpdateFixturePreflight;
  packet: EvidencePacket;
  now: Date;
  db: PrismaClient;
  persistModelUpdate?: typeof persistInternalModelUpdateCandidate;
  findExisting?: typeof findExistingDevFixtureModelUpdateId;
}): Promise<FamilyFixtureExecuteOutcome> {
  const persistModelUpdate = args.persistModelUpdate ?? persistInternalModelUpdateCandidate;
  const findExisting = args.findExisting ?? findExistingDevFixtureModelUpdateId;
  const helperName = "persistInternalModelUpdateCandidate";

  if (!args.preflight.preflightReady) {
    return {
      family: "model-update",
      status: "skipped_not_ready",
      candidateId: null,
      evidenceLinksWritten: null,
      candidatesWritten: null,
      blockedWriteReasons: args.preflight.blockers,
      skipReason: "Preflight blockers present.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  }

  const existingId = await findExisting({ userId: args.userId, db: args.db });
  if (existingId) {
    return {
      family: "model-update",
      status: "skipped_already_exists",
      candidateId: existingId,
      evidenceLinksWritten: null,
      candidatesWritten: 0,
      blockedWriteReasons: [],
      skipReason: "Existing internal [DEV FIXTURE] ModelUpdate candidate found.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  }

  try {
    const result = await persistModelUpdate({
      userId: args.userId,
      proposal: args.preflight.proposalPreview,
      packet: args.packet,
      db: args.db as never,
      now: args.now,
    });

    const candidateId = result.persistedModelUpdateId;
    const candidatesWritten = result.payload.candidatesWritten;
    const evidenceLinksWritten = result.payload.evidenceLinksWritten;
    const blockedWriteReasons = result.payload.blockedWriteReasons;

    if (candidatesWritten > 0 && candidateId) {
      return {
        family: "model-update",
        status: "created",
        candidateId,
        evidenceLinksWritten,
        candidatesWritten,
        blockedWriteReasons,
        skipReason: null,
        errorMessage: null,
        persistenceHelper: helperName,
      };
    }

    if (candidateId && blockedWriteReasons.includes("DUPLICATE_CANDIDATE")) {
      return {
        family: "model-update",
        status: "skipped_already_exists",
        candidateId,
        evidenceLinksWritten,
        candidatesWritten,
        blockedWriteReasons,
        skipReason: "Persistence helper reported DUPLICATE_CANDIDATE.",
        errorMessage: null,
        persistenceHelper: helperName,
      };
    }

    return {
      family: "model-update",
      status: "skipped_helper_blocked",
      candidateId,
      evidenceLinksWritten,
      candidatesWritten,
      blockedWriteReasons,
      skipReason: "Persistence helper did not create a candidate.",
      errorMessage: null,
      persistenceHelper: helperName,
    };
  } catch (error: unknown) {
    return {
      family: "model-update",
      status: "error",
      candidateId: null,
      evidenceLinksWritten: null,
      candidatesWritten: null,
      blockedWriteReasons: [],
      skipReason: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      persistenceHelper: helperName,
    };
  }
}

export async function runSeedLowerFamilyValidationFixturesPreflight(args: {
  userId: string;
  families?: LowerFamilyFixtureFamily[];
  now?: Date;
  db: PrismaClient;
  assemblePacket?: typeof assembleEvidencePacketV1;
}): Promise<LowerFamilyFixturePreflightReport> {
  const context = await buildPreflightContext(args);
  return toPreflightReport(context);
}

export async function runSeedLowerFamilyValidationFixtures(args: {
  userId: string;
  families?: LowerFamilyFixtureFamily[];
  execute?: boolean;
  now?: Date;
  db: PrismaClient;
  assemblePacket?: typeof assembleEvidencePacketV1;
  persistInvestigation?: typeof persistInternalInvestigationCandidate;
  persistFieldwork?: typeof persistInternalFieldworkCandidate;
  persistModelUpdate?: typeof persistInternalModelUpdateCandidate;
  findExistingInvestigation?: typeof findExistingDevFixtureInvestigationId;
  findExistingFieldwork?: typeof findExistingDevFixtureFieldworkId;
  findExistingModelUpdate?: typeof findExistingDevFixtureModelUpdateId;
}): Promise<LowerFamilyFixtureSeedReport> {
  const context = await buildPreflightContext(args);
  const preflight = toPreflightReport(context);

  if (!args.execute) {
    return preflight;
  }

  const investigationExecute = context.investigation
    ? await executeInvestigationFixture({
        userId: args.userId,
        preflight: context.investigation,
        packet: context.packet,
        now: context.now,
        db: args.db,
        persistInvestigation: args.persistInvestigation,
        findExisting: args.findExistingInvestigation,
      })
    : null;

  const fieldworkExecute = context.fieldwork
    ? await executeFieldworkFixture({
        userId: args.userId,
        preflight: context.fieldwork,
        packet: context.packet,
        now: context.now,
        db: args.db,
        persistFieldwork: args.persistFieldwork,
        findExisting: args.findExistingFieldwork,
      })
    : null;

  const modelUpdateExecute = context.modelUpdate
    ? await executeModelUpdateFixture({
        userId: args.userId,
        preflight: context.modelUpdate,
        packet: context.packet,
        now: context.now,
        db: args.db,
        persistModelUpdate: args.persistModelUpdate,
        findExisting: args.findExistingModelUpdate,
      })
    : null;

  const skippedFamilies: Array<{ family: LowerFamilyFixtureFamily; reason: string }> = [];
  const createdFamilies: LowerFamilyFixtureFamily[] = [];

  for (const outcome of [investigationExecute, fieldworkExecute, modelUpdateExecute]) {
    if (!outcome) {
      continue;
    }

    if (outcome.status === "created") {
      createdFamilies.push(outcome.family);
      continue;
    }

    if (outcome.skipReason) {
      skippedFamilies.push({
        family: outcome.family,
        reason: outcome.skipReason,
      });
    } else if (outcome.errorMessage) {
      skippedFamilies.push({
        family: outcome.family,
        reason: outcome.errorMessage,
      });
    }
  }

  const writesPerformed = createdFamilies.length > 0;

  return {
    ...preflight,
    dryRun: false,
    writesPerformed,
    executeMode: true,
    transactionIsolation: "per-family",
    investigationExecute,
    fieldworkExecute,
    modelUpdateExecute,
    skippedFamilies,
    laterValidationCommands: buildLaterValidationCommands({
      userId: args.userId,
      investigationId:
        investigationExecute?.candidateId &&
        (investigationExecute.status === "created" ||
          investigationExecute.status === "skipped_already_exists")
          ? investigationExecute.candidateId
          : null,
      fieldworkId:
        fieldworkExecute?.candidateId &&
        (fieldworkExecute.status === "created" ||
          fieldworkExecute.status === "skipped_already_exists")
          ? fieldworkExecute.candidateId
          : null,
      modelUpdateId:
        modelUpdateExecute?.candidateId &&
        (modelUpdateExecute.status === "created" ||
          modelUpdateExecute.status === "skipped_already_exists")
          ? modelUpdateExecute.candidateId
          : null,
    }),
    diagnosticMessage: buildExecuteDiagnosticMessage({
      createdFamilies,
      skippedFamilies,
      writesPerformed,
    }),
  };
}
