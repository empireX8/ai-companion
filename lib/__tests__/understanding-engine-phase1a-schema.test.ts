import {
  FieldworkStatus,
  InvestigationSeedType,
  InvestigationStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConfidenceLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, "m"));
  if (!match) {
    throw new Error(`Model ${modelName} block not found in prisma/schema.prisma`);
  }
  return match[0];
}

describe("Phase 1A enum contracts", () => {
  it("locks UserMapConclusionStatus", () => {
    expect(new Set(Object.values(UserMapConclusionStatus))).toEqual(
      new Set(["hypothesis", "tentative", "emerging", "supported", "disputed", "superseded"])
    );
  });

  it("locks UserMapConclusionArea", () => {
    expect(new Set(Object.values(UserMapConclusionArea))).toEqual(
      new Set([
        "operating_logic",
        "state_ecology",
        "tension_architecture",
        "recovery_architecture",
        "meaning_system",
        "relational_field",
        "developmental_vector",
        "current_frontier",
      ])
    );
  });

  it("locks UserMapConfidenceLevel", () => {
    expect(new Set(Object.values(UserMapConfidenceLevel))).toEqual(
      new Set(["low", "medium", "high"])
    );
  });

  it("locks UserMapConclusionVisibility", () => {
    expect(new Set(Object.values(UserMapConclusionVisibility))).toEqual(
      new Set(["user_visible", "internal_only"])
    );
  });

  it("locks InvestigationStatus", () => {
    expect(new Set(Object.values(InvestigationStatus))).toEqual(
      new Set([
        "open",
        "gathering_evidence",
        "testing",
        "resolving",
        "resolved",
        "reopened",
        "abandoned",
      ])
    );
  });

  it("locks InvestigationSeedType", () => {
    expect(new Set(Object.values(InvestigationSeedType))).toEqual(
      new Set([
        "contradiction",
        "pattern",
        "state_switch",
        "user_curiosity",
        "action_failure",
        "fieldwork_result",
        "model_uncertainty",
        "user_correction",
      ])
    );
  });

  it("locks ModelUpdateType", () => {
    expect(new Set(Object.values(ModelUpdateType))).toEqual(
      new Set([
        "conclusion_added",
        "conclusion_strengthened",
        "conclusion_weakened",
        "conclusion_disputed",
        "conclusion_superseded",
        "investigation_opened",
        "investigation_progressed",
        "investigation_resolved",
        "investigation_reopened",
        "fieldwork_assigned",
        "fieldwork_completed",
        "action_outcome_recorded",
        "strategy_adjusted",
        "correction_applied",
        "link_detected",
      ])
    );
  });

  it("locks ModelUpdateVisibility", () => {
    expect(new Set(Object.values(ModelUpdateVisibility))).toEqual(
      new Set(["internal_only", "candidate", "user_visible"])
    );
  });

  it("locks FieldworkStatus", () => {
    expect(new Set(Object.values(FieldworkStatus))).toEqual(
      new Set(["assigned", "active", "completed", "dismissed", "expired"])
    );
  });

  it("locks UnderstandingLinkTargetType", () => {
    expect(new Set(Object.values(UnderstandingLinkTargetType))).toEqual(
      new Set([
        "usermap_conclusion",
        "investigation",
        "model_update",
        "fieldwork_assignment",
        "surfaced_action",
        "pattern_claim",
        "contradiction_node",
      ])
    );
  });

  it("locks UnderstandingLinkSourceType", () => {
    expect(new Set(Object.values(UnderstandingLinkSourceType))).toEqual(
      new Set([
        "pattern_claim",
        "pattern_claim_evidence",
        "contradiction_node",
        "contradiction_evidence",
        "profile_artifact",
        "evidence_span",
        "reference_item",
        "surfaced_action",
        "quick_check_in",
        "journal_entry",
        "session",
        "message",
        "timeline_aggregation",
        "import_record",
        "user_correction",
      ])
    );
  });

  it("locks UnderstandingLinkRole", () => {
    expect(new Set(Object.values(UnderstandingLinkRole))).toEqual(
      new Set([
        "supports",
        "contradicts",
        "context",
        "seed",
        "outcome",
        "correction",
        "temporal_anchor",
        "derived_from",
      ])
    );
  });
});

describe("Phase 1A schema model contracts", () => {
  it("adds the five Phase 1A models with user ownership", () => {
    const userMap = modelBlock("UserMapConclusion");
    const investigation = modelBlock("Investigation");
    const modelUpdate = modelBlock("ModelUpdate");
    const fieldwork = modelBlock("FieldworkAssignment");
    const link = modelBlock("UnderstandingEvidenceLink");

    expect(userMap).toMatch(/\buserId\s+String\b/);
    expect(investigation).toMatch(/\buserId\s+String\b/);
    expect(modelUpdate).toMatch(/\buserId\s+String\b/);
    expect(fieldwork).toMatch(/\buserId\s+String\b/);
    expect(link).toMatch(/\buserId\s+String\b/);
  });

  it("pins UserMapConclusion supersession self-relations with explicit names", () => {
    const userMap = modelBlock("UserMapConclusion");

    expect(userMap).toContain("supersededById");
    expect(userMap).toContain("supersedesId");
    expect(userMap).toContain('@relation("UserMapConclusionSupersededBy"');
    expect(userMap).toContain('@relation("UserMapConclusionSupersedes"');
    expect(userMap).toContain("onDelete: SetNull");
  });

  it("pins required Phase 1A indexes", () => {
    const userMap = modelBlock("UserMapConclusion");
    const investigation = modelBlock("Investigation");
    const modelUpdate = modelBlock("ModelUpdate");
    const fieldwork = modelBlock("FieldworkAssignment");
    const link = modelBlock("UnderstandingEvidenceLink");

    expect(userMap).toContain("@@index([userId, area, status])");
    expect(userMap).toContain("@@index([userId, confidenceScore])");
    expect(userMap).toContain("@@index([userId, updatedAt])");
    expect(userMap).toContain("@@index([userId, supersededById])");

    expect(investigation).toContain("@@index([userId, status, updatedAt])");
    expect(investigation).toContain(
      "@@index([userId, visibility, status, updatedAt])"
    );
    expect(investigation).toContain("@@index([userId, seedType, createdAt])");
    expect(investigation).toContain("@@index([userId, resolvedAt])");

    expect(modelUpdate).toContain("@@index([userId, visibility, createdAt])");
    expect(modelUpdate).toContain("@@index([userId, updateType, createdAt])");
    expect(modelUpdate).toContain("@@index([userId, affectedObjectType, affectedObjectId])");

    expect(fieldwork).toContain("@@index([userId, status, updatedAt])");
    expect(fieldwork).toContain("@@index([userId, linkedObjectType, linkedObjectId])");
    expect(fieldwork).toContain("@@index([userId, createdAt])");

    expect(link).toContain("@@index([userId, targetType, targetId])");
    expect(link).toContain("@@index([userId, sourceType, sourceId])");
    expect(link).toContain("@@index([userId, targetType, role])");
    expect(link).toContain("@@index([userId, createdAt])");
    expect(link).toContain("@@unique([userId, targetType, targetId, sourceType, sourceId, role])");
  });

  it("pins UserMapConclusion.visibility default for safe public exposure", () => {
    const userMap = modelBlock("UserMapConclusion");

    expect(userMap).toMatch(
      /\bvisibility\s+UserMapConclusionVisibility\s+@default\(user_visible\)/
    );
  });

  it("pins Investigation visibility default and nullable candidate lifecycle", () => {
    const investigation = modelBlock("Investigation");

    expect(investigation).toMatch(
      /\bvisibility\s+InvestigationVisibility\s+@default\(user_visible\)/
    );
    expect(investigation).toMatch(
      /\bcandidateLifecycleStatus\s+CandidateLifecycleStatus\?/
    );
  });

  it("keeps weight and confidenceContribution nullable for Phase 1A", () => {
    const link = modelBlock("UnderstandingEvidenceLink");

    expect(link).toMatch(/\bweight\s+Float\?/);
    expect(link).toMatch(/\bconfidenceContribution\s+Float\?/);
  });

  it("keeps import_record as a link-source contract value and preserves import models", () => {
    expect(schema).toMatch(/enum UnderstandingLinkSourceType[\s\S]*import_record/);
    expect(schema).toContain("model ImportUploadSession {");
    expect(schema).toContain("model ImportUploadChunk {");
  });

  it("keeps FieldworkAssignment structurally distinct from SurfacedAction", () => {
    const fieldwork = modelBlock("FieldworkAssignment");
    const surfacedAction = modelBlock("SurfacedAction");

    expect(fieldwork).toContain("prompt");
    expect(fieldwork).toContain("reason");
    expect(fieldwork).toContain("linkedObjectType");
    expect(fieldwork).toContain("linkedObjectId");

    expect(surfacedAction).not.toMatch(/\bprompt\b/);
    expect(surfacedAction).not.toMatch(/\breason\b/);
    expect(surfacedAction).toContain("templateId");
    expect(surfacedAction).toContain("bucket");
  });

  it("preserves existing core models required by additive framing", () => {
    const requiredModels = [
      "PatternClaim",
      "PatternClaimEvidence",
      "ContradictionNode",
      "ContradictionEvidence",
      "ProfileArtifact",
      "EvidenceSpan",
      "ReferenceItem",
      "SurfacedAction",
      "QuickCheckIn",
      "JournalEntry",
      "Session",
      "Message",
      "ImportUploadSession",
    ];

    for (const modelName of requiredModels) {
      expect(schema).toContain(`model ${modelName} {`);
    }
  });
});

describe("Phase 1A create-input coverage", () => {
  it("supports required create payload shape for each new model", () => {
    const now = new Date("2026-05-14T00:00:00.000Z");

    const userMapCreate: Prisma.UserMapConclusionUncheckedCreateInput = {
      id: "umc_1",
      userId: "user_1",
      area: "operating_logic",
      status: "hypothesis",
      title: "Pressure triggers appeasement",
      summary: "Early hypothesis from cross-source evidence.",
      confidenceScore: 0.3,
      confidenceLevel: "low",
      evidenceCount: 2,
      sourceDiversity: 2,
      timeSpreadDays: 3,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const investigationCreate: Prisma.InvestigationUncheckedCreateInput = {
      id: "inv_1",
      userId: "user_1",
      title: "Criticism-response mechanism",
      organizingQuestion: "What actually triggers shutdown after feedback?",
      status: "open",
      visibility: "user_visible",
      candidateLifecycleStatus: null,
      seedType: "contradiction",
      competingTheories: [
        { label: "theory_a", summary: "Workload-driven" },
        { label: "theory_b", summary: "Evaluation-driven" },
      ],
      evidenceNeeded: [
        { prompt: "Track body signal before shutdown" },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const modelUpdateCreate: Prisma.ModelUpdateUncheckedCreateInput = {
      id: "mu_1",
      userId: "user_1",
      updateType: "investigation_opened",
      visibility: "candidate",
      affectedObjectType: "investigation",
      affectedObjectId: "inv_1",
      userFacingSummary: "Active question opened.",
      isMeaningful: true,
      createdAt: now,
    };

    const fieldworkCreate: Prisma.FieldworkAssignmentUncheckedCreateInput = {
      id: "fw_1",
      userId: "user_1",
      prompt: "Notice body signal before shutdown.",
      reason: "Needed to test competing theories.",
      status: "assigned",
      linkedObjectType: "investigation",
      linkedObjectId: "inv_1",
      createdAt: now,
      updatedAt: now,
    };

    const linkCreate: Prisma.UnderstandingEvidenceLinkUncheckedCreateInput = {
      id: "uel_1",
      userId: "user_1",
      targetType: "investigation",
      targetId: "inv_1",
      sourceType: "import_record",
      sourceId: "import_upload_session_1",
      role: "seed",
      createdAt: now,
      weight: null,
      confidenceContribution: null,
    };

    expect(userMapCreate.userId).toBe("user_1");
    expect(investigationCreate.seedType).toBe("contradiction");
    expect(modelUpdateCreate.isMeaningful).toBe(true);
    expect(fieldworkCreate.status).toBe("assigned");
    expect(linkCreate.sourceType).toBe("import_record");
    expect(linkCreate.weight).toBeNull();
    expect(linkCreate.confidenceContribution).toBeNull();
  });
});
