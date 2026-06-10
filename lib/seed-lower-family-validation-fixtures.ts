import {
  InvestigationSeedType,
  ModelUpdateType,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

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
};

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

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === "--user-id" && argv[index + 1]) {
      userId = argv[index + 1]!.trim();
      index += 1;
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

    if (arg === "--execute") {
      return {
        ok: false,
        message:
          "--execute is not supported in Phase 1 dry-run preflight. Remove --execute and rerun.",
      };
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
    },
  };
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
      "No writes performed. Execute-mode seeding is not available in Phase 1."
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

export async function runSeedLowerFamilyValidationFixturesPreflight(args: {
  userId: string;
  families?: LowerFamilyFixtureFamily[];
  now?: Date;
  db: PrismaClient;
  assemblePacket?: typeof assembleEvidencePacketV1;
}): Promise<LowerFamilyFixturePreflightReport> {
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
    dryRun: true,
    writesPerformed: false,
    devFixtureOnly: true,
    naturalValidation: false,
    generatedAt: now.toISOString(),
    userId: args.userId,
    familiesRequested,
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
    diagnosticMessage: buildDiagnosticMessage({
      familiesRequested,
      investigation,
      fieldwork,
      modelUpdate,
    }),
  };
}
