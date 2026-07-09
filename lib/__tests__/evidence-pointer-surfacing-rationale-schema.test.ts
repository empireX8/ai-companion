import {
  UnderstandingLinkSourceType,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260709140000_add_evidence_pointer_surfacing_rationale/migration.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, "m"));
  if (!match) {
    throw new Error(`Model ${modelName} block not found in prisma/schema.prisma`);
  }
  return match[0];
}

describe("EvidencePointerSurfacingRationale schema model contracts", () => {
  it("adds upstream rationale storage keyed by user + source identity", () => {
    const rationale = modelBlock("EvidencePointerSurfacingRationale");

    expect(rationale).toMatch(/\buserId\s+String\b/);
    expect(rationale).toMatch(/\brationale\s+String\b/);
    expect(rationale).not.toMatch(/\brationale\s+String\?/);
    expect(rationale).toMatch(/\bwhyResurfaced\s+String\?/);
    expect(rationale).toMatch(/\bauthoredFrom\s+String\?/);
    expect(rationale).toMatch(/\bsourceEvidenceId\s+String\?/);
  });

  it("pins one rationale row per source object per user", () => {
    const rationale = modelBlock("EvidencePointerSurfacingRationale");

    expect(rationale).toContain("@@unique([userId, sourceObjectType, sourceObjectId])");
    expect(rationale).toContain("@@index([userId, sourceObjectType, sourceObjectId])");
  });

  it("reuses UnderstandingLinkSourceType for durable source identity", () => {
    const rationale = modelBlock("EvidencePointerSurfacingRationale");

    expect(rationale).toMatch(/\bsourceObjectType\s+UnderstandingLinkSourceType\b/);
    expect(rationale).toMatch(/\bsourceObjectId\s+String\b/);
  });

  it("keeps graph edges on UnderstandingEvidenceLink, not on rationale rows", () => {
    const rationale = modelBlock("EvidencePointerSurfacingRationale");
    const pointer = modelBlock("SurfacedEvidencePointer");

    expect(rationale).not.toMatch(/\brelatedIds\b/);
    expect(rationale).not.toMatch(/\bcontextIds\b/);
    expect(pointer).not.toMatch(/\brelatedIds\b/);
  });
});

describe("EvidencePointerSurfacingRationale migration SQL contracts", () => {
  it("creates additive table with required columns and no destructive statements", () => {
    expect(migrationSql).toContain('CREATE TABLE "EvidencePointerSurfacingRationale"');
    expect(migrationSql).toContain('"rationale" TEXT NOT NULL');
    expect(migrationSql).toContain('"whyResurfaced" TEXT');
    expect(migrationSql).toContain('"authoredFrom" TEXT');
    expect(migrationSql).toContain('"meta" JSONB');
    expect(migrationSql).not.toMatch(/\bDROP\b/i);
    expect(migrationSql).not.toMatch(/\bALTER\b/i);
  });

  it("pins source lookup uniqueness in migration SQL", () => {
    expect(migrationSql).toContain(
      "EvidencePointerSurfacingRationale_userId_sourceObjectType_sourceObjectId_key",
    );
  });
});

describe("EvidencePointerSurfacingRationale create-input coverage", () => {
  it("supports required create payload shape without generic defaults", () => {
    const now = new Date("2026-07-09T14:00:00.000Z");

    const create: Prisma.EvidencePointerSurfacingRationaleUncheckedCreateInput = {
      userId: "user-1",
      sourceObjectType: UnderstandingLinkSourceType.pattern_claim,
      sourceObjectId: "claim-1",
      rationale:
        "Connects evening overwork to the missing stop point before commitments lock.",
      authoredFrom: "internal_review",
      createdAt: now,
      updatedAt: now,
    };

    expect(create.rationale).toContain("stop point");
    expect(create.sourceObjectType).toBe("pattern_claim");
  });
});
