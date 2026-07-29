/**
 * Orvek Canonical Model Authority V1 — Phase 1 schema/migration contract.
 * Static assertions only. No runtime publication/UI behaviour.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CanonicalConceptBindingRole,
  CanonicalConceptDomain,
  CanonicalConceptLifecycleStatus,
  CanonicalConceptSourceType,
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  CanonicalRevisionStatus,
  ExploreMovementAuthorityMode,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migrationSql = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260727211500_add_canonical_model_authority_v1/migration.sql",
  ),
  "utf8",
);

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, "m"));
  if (!match) {
    throw new Error(`Model ${modelName} block not found in prisma/schema.prisma`);
  }
  return match[0];
}

describe("Canonical Model Authority V1 — enum contracts", () => {
  it("locks ExploreMovementAuthorityMode", () => {
    expect(new Set(Object.values(ExploreMovementAuthorityMode))).toEqual(
      new Set(["legacy", "canonical_v1"]),
    );
  });

  it("locks CanonicalConceptLifecycleStatus", () => {
    expect(new Set(Object.values(CanonicalConceptLifecycleStatus))).toEqual(
      new Set(["active"]),
    );
  });

  it("locks CanonicalConceptDomain", () => {
    expect(new Set(Object.values(CanonicalConceptDomain))).toEqual(
      new Set([
        "operating_logic",
        "state_ecology",
        "tension_architecture",
        "recovery_architecture",
        "meaning_system",
        "relational_field",
        "developmental_vector",
        "current_frontier",
        "unknown",
      ]),
    );
  });

  it("locks CanonicalConceptSourceType", () => {
    expect(new Set(Object.values(CanonicalConceptSourceType))).toEqual(
      new Set([
        "usermap_conclusion",
        "pattern_claim",
        "contradiction_node",
        "reference_item",
        "profile_artifact",
      ]),
    );
  });

  it("locks CanonicalConceptBindingRole", () => {
    expect(new Set(Object.values(CanonicalConceptBindingRole))).toEqual(
      new Set(["legacy_seed", "related_interpretation"]),
    );
  });

  it("locks CanonicalRevisionStatus without superseded", () => {
    expect(new Set(Object.values(CanonicalRevisionStatus))).toEqual(
      new Set(["hypothesis", "tentative", "emerging", "supported", "disputed"]),
    );
    expect(Object.values(CanonicalRevisionStatus)).not.toContain("superseded");
  });

  it("locks CanonicalRevisionOperation", () => {
    expect(new Set(Object.values(CanonicalRevisionOperation))).toEqual(
      new Set(["registered", "strengthen"]),
    );
  });

  it("locks CanonicalRevisionDecisionSource", () => {
    expect(new Set(Object.values(CanonicalRevisionDecisionSource))).toEqual(
      new Set(["legacy_registration", "explore_proposal"]),
    );
  });

  it("extends UnderstandingLinkTargetType with canonical_concept_revision", () => {
    expect(Object.values(UnderstandingLinkTargetType)).toContain(
      "canonical_concept_revision",
    );
  });
});

describe("Canonical Model Authority V1 — model / relation contracts", () => {
  it("pins CanonicalConcept current-revision composite relation and uniques", () => {
    const block = modelBlock("CanonicalConcept");
    expect(block).toContain('@relation("CanonicalConceptCurrentRevision"');
    expect(block).toMatch(
      /fields:\s*\[\s*currentRevisionId\s*,\s*id\s*\]/,
    );
    expect(block).toMatch(/references:\s*\[\s*id\s*,\s*conceptId\s*\]/);
    expect(block).toContain("@@unique([id, userId])");
    expect(block).toContain("@@unique([userId, registrationKey])");
    expect(block).toContain("@@unique([currentRevisionId, id])");
  });

  it("pins CanonicalConceptRevision lineage and ownership uniques", () => {
    const block = modelBlock("CanonicalConceptRevision");
    expect(block).toContain("previousRevisionId");
    expect(block).toContain("createdFromProposalId");
    expect(block).toContain("@@unique([id, conceptId])");
    expect(block).toContain("@@unique([id, userId])");
    expect(block).toContain("@@unique([id, conceptId, userId])");
    expect(block).toContain("@@unique([conceptId, version])");
    expect(block).toMatch(/previousRevisionId\s+String\?\s+@unique/);
    expect(block).toMatch(/createdFromProposalId\s+String\?\s+@unique/);
  });

  it("pins CanonicalConceptSourceBinding dual uniques", () => {
    const block = modelBlock("CanonicalConceptSourceBinding");
    expect(block).toContain("@@unique([userId, sourceType, sourceId])");
    expect(block).toContain("@@unique([conceptId, sourceType, sourceId])");
  });

  it("pins ExploreMovementProposal additive authority fields and singular modelUpdate", () => {
    const block = modelBlock("ExploreMovementProposal");
    expect(block).toContain("authorityMode");
    expect(block).toContain("ExploreMovementAuthorityMode");
    expect(block).toContain("@default(legacy)");
    expect(block).toContain("expectedCurrentRevisionId");
    expect(block).toContain("expectedLegacySnapshotHash");
    expect(block).toContain("canonicalConceptId");
    expect(block).toContain("revisionOperation");
    expect(block).toMatch(
      /modelUpdate\s+ModelUpdate\?\s+@relation\("ModelUpdateExploreProposal"\)/,
    );
    expect(block).not.toMatch(
      /modelUpdates\s+ModelUpdate\[\]\s+@relation\("ModelUpdateExploreProposal"\)/,
    );
    expect(block).toContain("@@unique([id, userId])");
  });

  it("pins ModelUpdate additive lineage fields and singular resulting relation", () => {
    const block = modelBlock("ModelUpdate");
    expect(block).toContain("canonicalConceptId");
    expect(block).toContain("previousRevisionId");
    expect(block).toMatch(/resultingRevisionId\s+String\?\s+@unique/);
    expect(block).toMatch(/exploreProposalId\s+String\?\s+@unique/);
    expect(block).toContain('@relation("ModelUpdateCanonicalConcept"');
    expect(block).toContain('@relation("ModelUpdatePreviousRevision"');
    expect(block).toContain('@relation("ModelUpdateResultingRevision"');
    expect(block).toContain('@relation("ModelUpdateExploreProposal"');

    const revision = modelBlock("CanonicalConceptRevision");
    expect(revision).toMatch(
      /resultingModelUpdate\s+ModelUpdate\?\s+@relation\("ModelUpdateResultingRevision"\)/,
    );
  });
});

describe("Canonical Model Authority V1 — migration SQL contracts", () => {
  it("includes proposal authority CHECKs, revision shape/range CHECKs, and both triggers", () => {
    expect(migrationSql).toContain(
      "ExploreMovementProposal_expectation_mutex_check",
    );
    expect(migrationSql).toContain(
      "ExploreMovementProposal_authority_mode_check",
    );
    expect(migrationSql).toContain(
      "CanonicalConceptRevision_evidenceCount_nonneg_check",
    );
    expect(migrationSql).toContain(
      "CanonicalConceptRevision_confidenceScore_range_check",
    );
    expect(migrationSql).toContain("CanonicalConceptRevision_shape_v1_check");
    expect(migrationSql).toContain("canonical_revision_immutable_guard");
    expect(migrationSql).toContain("canonical_concept_revision_is_immutable");
    expect(migrationSql).toContain("model_update_canonical_lineage_guard");
    expect(migrationSql).toContain("model_update_explore_proposal_not_canonical");
    expect(migrationSql).toContain(
      "ALTER TYPE \"UnderstandingLinkTargetType\" ADD VALUE 'canonical_concept_revision'",
    );
  });
});
