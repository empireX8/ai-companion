import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import authorityJson from "../../docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.json";
import {
  CANONICAL_CURRENT_TRUTH_OBJECTS,
  EvidenceLinkPairValidationError,
  INTELLIGENCE_OBJECT_AUTHORITY_CONTRACT_ID,
  NEVER_CANONICAL_CURRENT_TRUTH_OBJECTS,
  OWNERSHIP_VERIFIABLE_SOURCE_TYPES,
  PATTERN_TYPE_FAMILIES,
  RESERVED_NON_WRITABLE_SOURCE_TYPES,
  SEMANTIC_AUTHORITY_ROLES,
  SUPPORTED_EVIDENCE_LINK_PAIRS,
  assertCanonicalCurrentTruthObject,
  assertSupportedEvidenceLinkPair,
  canServeAsCanonicalCurrentTruth,
  isSupportedEvidenceLinkPair,
  profileArtifactMayOutrankCanonicalCurrent,
  withCanonicalSourceType,
} from "../orvek-intelligence-object-authority";
import {
  UnderstandingEvidenceLinkValidationError,
  createUnderstandingEvidenceLinkForUser,
  type UnderstandingEvidenceLinkWriterDb,
} from "../understanding-evidence-link-writer";

const ROOT = process.cwd();
const MD_PATH = join(
  ROOT,
  "docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.md",
);
const JSON_PATH = join(
  ROOT,
  "docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.json",
);

const REQUIRED_OBJECTS = [
  "Session",
  "Message",
  "JournalEntry",
  "QuickCheckIn",
  "ImportUploadSession",
  "ImportUploadChunk",
  "EvidenceSpan",
  "ReferenceItem",
  "ProfileArtifact",
  "PatternClaim",
  "PatternClaimEvidence",
  "ContradictionNode",
  "ContradictionEvidence",
  "UserMapConclusion",
  "Investigation",
  "FieldworkAssignment",
  "ExploreMovementProposal",
  "SurfacedAction",
  "ModelUpdate",
  "UnderstandingEvidenceLink",
  "SurfacedEvidencePointer",
  "CanonicalTodayComposition",
  "CanonicalModelMovementReport",
  "Decision",
  "Outcome",
  "UserFacingProjection",
] as const;

function createWriterDbMock(): UnderstandingEvidenceLinkWriterDb {
  return {
    userMapConclusion: { findFirst: vi.fn() },
    investigation: { findFirst: vi.fn() },
    modelUpdate: { findFirst: vi.fn() },
    fieldworkAssignment: { findFirst: vi.fn() },
    surfacedAction: { findFirst: vi.fn() },
    patternClaim: { findFirst: vi.fn() },
    contradictionNode: { findFirst: vi.fn() },
    patternClaimEvidence: { findFirst: vi.fn() },
    contradictionEvidence: { findFirst: vi.fn() },
    profileArtifact: { findFirst: vi.fn() },
    evidenceSpan: { findFirst: vi.fn() },
    referenceItem: { findFirst: vi.fn() },
    quickCheckIn: { findFirst: vi.fn() },
    journalEntry: { findFirst: vi.fn() },
    session: { findFirst: vi.fn() },
    message: { findFirst: vi.fn() },
    importUploadSession: { findFirst: vi.fn() },
    importUploadChunk: { findFirst: vi.fn() },
    understandingEvidenceLink: { create: vi.fn() },
  } as unknown as UnderstandingEvidenceLinkWriterDb;
}

describe("DEL-005 semantic authority contract", () => {
  it("Markdown and JSON authority matrices match on object roles", () => {
    const md = readFileSync(MD_PATH, "utf8");
    const json = JSON.parse(readFileSync(JSON_PATH, "utf8")) as typeof authorityJson;

    expect(json.contractId).toBe(INTELLIGENCE_OBJECT_AUTHORITY_CONTRACT_ID);
    expect(md).toContain(INTELLIGENCE_OBJECT_AUTHORITY_CONTRACT_ID);
    expect(md).toContain("Machine-readable twin");

    for (const object of json.objects) {
      expect(md).toContain(`### ${object.objectName}`);
      expect(md).toContain("`" + object.canonicalRole + "`");
      expect(object.canonicalRole).toBeTruthy();
      expect(SEMANTIC_AUTHORITY_ROLES).toContain(object.canonicalRole);
    }

    expect(json.objects.map((o) => o.objectName).sort()).toEqual(
      [...REQUIRED_OBJECTS].sort(),
    );
  });

  it("every required object has one declared canonical role", () => {
    const names = new Set(authorityJson.objects.map((o) => o.objectName));
    for (const required of REQUIRED_OBJECTS) {
      expect(names.has(required)).toBe(true);
      const row = authorityJson.objects.find((o) => o.objectName === required)!;
      expect(typeof row.canonicalRole).toBe("string");
      expect(row.canonicalRole.length).toBeGreaterThan(0);
    }
  });

  it("classifies ModelUpdate as movement ledger, not canonical current truth", () => {
    const row = authorityJson.objects.find((o) => o.objectName === "ModelUpdate")!;
    expect(row.canonicalRole).toBe("MODEL_MOVEMENT_LEDGER");
    expect(row.canBeCurrentTruth).toBe(false);
    expect(canServeAsCanonicalCurrentTruth("ModelUpdate")).toBe(false);
    expect(() => assertCanonicalCurrentTruthObject("ModelUpdate")).toThrow(
      /not canonical current-model truth/,
    );
  });

  it("classifies ExploreMovementProposal as proposal-only", () => {
    const row = authorityJson.objects.find(
      (o) => o.objectName === "ExploreMovementProposal",
    )!;
    expect(row.canonicalRole).toBe("INTERNAL_CANDIDATE_OR_PROPOSAL");
    expect(row.isCandidateOnly).toBe(true);
    expect(row.canBeCurrentTruth).toBe(false);
  });

  it("classifies SurfacedAction as action projection, not Decision", () => {
    const action = authorityJson.objects.find((o) => o.objectName === "SurfacedAction")!;
    const decision = authorityJson.objects.find((o) => o.objectName === "Decision")!;
    expect(action.canonicalRole).toBe("ACTION_PROJECTION");
    expect(decision.canonicalRole).toBe("DECISION");
    expect(decision.implementationStatus).toBe("RESERVED_FUTURE");
    expect(action.canBeCurrentTruth).toBe(false);
  });

  it("ProfileArtifact cannot independently outrank a governed canonical current object", () => {
    const row = authorityJson.objects.find((o) => o.objectName === "ProfileArtifact")!;
    expect(row.canBeCurrentTruth).toBe(false);
    expect(profileArtifactMayOutrankCanonicalCurrent()).toBe(false);
    expect(CANONICAL_CURRENT_TRUTH_OBJECTS).toContain("UserMapConclusion");
    expect(NEVER_CANONICAL_CURRENT_TRUTH_OBJECTS).toContain("ProfileArtifact");
  });

  it("PatternClaim remains pattern-strengthening intelligence with all five families", () => {
    const row = authorityJson.objects.find((o) => o.objectName === "PatternClaim")!;
    expect(row.canonicalRole).toBe("PATTERN_INTELLIGENCE");
    expect(row.canStrengthenAnotherObject).toBe(true);
    expect(row.canBeCurrentTruth).toBe(false);
    expect(authorityJson.patternFamilies).toEqual([...PATTERN_TYPE_FAMILIES]);
    expect(PATTERN_TYPE_FAMILIES).toHaveLength(5);
  });

  it("JSON and runtime evidence-link pair sets are exact full-set mirrors", () => {
    const jsonPairs = authorityJson.evidenceLinkSupportedPairs.map(
      (pair) => `${pair.sourceType}→${pair.targetType}`,
    );
    const runtimePairs = SUPPORTED_EVIDENCE_LINK_PAIRS.map(
      (pair) => `${pair.sourceType}→${pair.targetType}`,
    );

    expect(new Set(jsonPairs).size).toBe(jsonPairs.length);
    expect(new Set(runtimePairs).size).toBe(runtimePairs.length);
    expect([...jsonPairs].sort()).toEqual([...runtimePairs].sort());

    for (const pair of jsonPairs) {
      expect(runtimePairs).toContain(pair);
    }
    for (const pair of runtimePairs) {
      expect(jsonPairs).toContain(pair);
    }

    expect(jsonPairs.some((pair) => pair.startsWith("user_correction→"))).toBe(
      false,
    );
    expect(
      jsonPairs.some((pair) => pair.startsWith("timeline_aggregation→")),
    ).toBe(false);
    expect(RESERVED_NON_WRITABLE_SOURCE_TYPES).toEqual([
      "timeline_aggregation",
      "user_correction",
    ]);

    const md = readFileSync(MD_PATH, "utf8");
    expect(md).toContain("ownership-verify");
    expect(md).toContain("`user_correction`");
    expect(md).toContain("`timeline_aggregation`");
    expect(md).not.toMatch(/user_correction\s*→/);

    const writer = readFileSync(
      join(ROOT, "lib/understanding-evidence-link-writer.ts"),
      "utf8",
    );
    for (const sourceType of OWNERSHIP_VERIFIABLE_SOURCE_TYPES) {
      expect(writer).toContain(`case "${sourceType}"`);
      expect(
        SUPPORTED_EVIDENCE_LINK_PAIRS.some((pair) => pair.sourceType === sourceType),
      ).toBe(true);
    }

    expect(
      isSupportedEvidenceLinkPair({
        sourceType: "timeline_aggregation",
        targetType: "usermap_conclusion",
      }),
    ).toBe(false);
    expect(() =>
      assertSupportedEvidenceLinkPair({
        sourceType: "timeline_aggregation",
        targetType: "usermap_conclusion",
      }),
    ).toThrow(EvidenceLinkPairValidationError);
  });

  it("adapters can tag canonical source type without inventing truth", () => {
    const tagged = withCanonicalSourceType(
      { id: "x", type: "model-update" as const, title: "t" },
      "ModelUpdate",
    );
    expect(tagged.canonicalSourceType).toBe("ModelUpdate");
    expect(canServeAsCanonicalCurrentTruth("ModelUpdate")).toBe(false);
  });
});

describe("DEL-005 evidence-link runtime guards", () => {
  it("rejects unsupported source/target pairs before create", async () => {
    const db = createWriterDbMock();
    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "timeline_aggregation",
          sourceId: "agg-1",
          role: "supports",
        },
        db,
      }),
    ).rejects.toBeInstanceOf(EvidenceLinkPairValidationError);
    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects missing / cross-user targets", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue(null);
    db.patternClaim.findFirst = vi.fn().mockResolvedValue({ id: "claim-1" });

    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "foreign-or-missing",
          sourceType: "pattern_claim",
          sourceId: "claim-1",
          role: "supports",
        },
        db,
      }),
    ).rejects.toBeInstanceOf(UnderstandingEvidenceLinkValidationError);

    expect(db.userMapConclusion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-or-missing", userId: "user-1" },
      }),
    );
    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("rejects missing sources after pair validation", async () => {
    const db = createWriterDbMock();
    db.userMapConclusion.findFirst = vi.fn().mockResolvedValue({ id: "umc-1" });
    db.patternClaim.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      createUnderstandingEvidenceLinkForUser({
        userId: "user-1",
        input: {
          targetType: "usermap_conclusion",
          targetId: "umc-1",
          sourceType: "pattern_claim",
          sourceId: "missing-claim",
          role: "supports",
        },
        db,
      }),
    ).rejects.toBeInstanceOf(UnderstandingEvidenceLinkValidationError);
    expect(db.understandingEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("no writer in this delivery creates semantic authority without ownership checks", () => {
    const writer = readFileSync(
      join(ROOT, "lib/understanding-evidence-link-writer.ts"),
      "utf8",
    );
    expect(writer).toContain("assertSupportedEvidenceLinkPair");
    expect(writer).toContain("verifyUnderstandingEvidenceLinkTargetOwnership");
    expect(writer).toContain("verifyUnderstandingEvidenceLinkSourceOwnership");
  });
});
