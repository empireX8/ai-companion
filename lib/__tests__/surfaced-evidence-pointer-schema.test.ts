import {
  SurfacedEvidencePointerKind,
  SurfacedEvidencePointerStatus,
  SurfacedEvidencePointerSurface,
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
  "prisma/migrations/20260708194800_add_surfaced_evidence_pointer/migration.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, "m"));
  if (!match) {
    throw new Error(`Model ${modelName} block not found in prisma/schema.prisma`);
  }
  return match[0];
}

describe("SurfacedEvidencePointer enum contracts", () => {
  it("locks SurfacedEvidencePointerKind", () => {
    expect(new Set(Object.values(SurfacedEvidencePointerKind))).toEqual(
      new Set(["pattern", "tension", "journal"]),
    );
  });

  it("locks SurfacedEvidencePointerSurface", () => {
    expect(new Set(Object.values(SurfacedEvidencePointerSurface))).toEqual(
      new Set(["today_evidence_pointer"]),
    );
  });

  it("locks SurfacedEvidencePointerStatus", () => {
    expect(new Set(Object.values(SurfacedEvidencePointerStatus))).toEqual(
      new Set(["active", "expired", "dismissed", "hidden"]),
    );
  });
});

describe("SurfacedEvidencePointer schema model contracts", () => {
  it("adds SurfacedEvidencePointer with user ownership and first-class whyItMatters", () => {
    const pointer = modelBlock("SurfacedEvidencePointer");

    expect(pointer).toMatch(/\buserId\s+String\b/);
    expect(pointer).toMatch(/\bwhyItMatters\s+String\b/);
    expect(pointer).not.toMatch(/\bwhyItMatters\s+String\?/);
    expect(pointer).toMatch(/\bwhyResurfaced\s+String\?/);
    expect(pointer).toMatch(/\bpublicEligible\s+Boolean\s+@default\(false\)/);
    expect(pointer).toMatch(
      /\bstatus\s+SurfacedEvidencePointerStatus\s+@default\(active\)/,
    );
    expect(pointer).toMatch(
      /\bsurface\s+SurfacedEvidencePointerSurface\s+@default\(today_evidence_pointer\)/,
    );
  });

  it("uses stable caller-supplied id without cuid default", () => {
    const pointer = modelBlock("SurfacedEvidencePointer");

    expect(pointer).toMatch(/\bid\s+String\s+@id\b/);
    expect(pointer).not.toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
  });

  it("pins required indexes and one-pointer-per-source uniqueness", () => {
    const pointer = modelBlock("SurfacedEvidencePointer");

    expect(pointer).toContain("@@unique([userId, sourceObjectType, sourceObjectId])");
    expect(pointer).toContain("@@index([userId, status, surfacedAt])");
    expect(pointer).toContain("@@index([userId, publicEligible, status])");
    expect(pointer).toContain("@@index([userId, sourceObjectType, sourceObjectId])");
  });

  it("reuses UnderstandingLinkSourceType for durable source identity", () => {
    const pointer = modelBlock("SurfacedEvidencePointer");

    expect(pointer).toMatch(/\bsourceObjectType\s+UnderstandingLinkSourceType\b/);
    expect(pointer).toMatch(/\bsourceObjectId\s+String\b/);
  });

  it("keeps durable graph edges on UnderstandingEvidenceLink, not on pointer rows", () => {
    const pointer = modelBlock("SurfacedEvidencePointer");
    const link = modelBlock("UnderstandingEvidenceLink");

    expect(pointer).not.toMatch(/\brelatedIds\b/);
    expect(pointer).not.toMatch(/\bcontextIds\b/);
    expect(link).toMatch(/\bmeta\s+Json\?/);
  });
});

describe("SurfacedEvidencePointer migration SQL contracts", () => {
  it("creates additive table with required columns and no destructive statements", () => {
    expect(migrationSql).toContain('CREATE TABLE "SurfacedEvidencePointer"');
    expect(migrationSql).toContain('"whyItMatters" TEXT NOT NULL');
    expect(migrationSql).toContain('"whyResurfaced" TEXT');
    expect(migrationSql).toContain('"publicEligible" BOOLEAN NOT NULL DEFAULT false');
    expect(migrationSql).toContain('"materializedFrom" TEXT');
    expect(migrationSql).toContain('"meta" JSONB');
    expect(migrationSql).not.toMatch(/\bDROP\b/i);
    expect(migrationSql).not.toMatch(/\bALTER\b/i);
  });

  it("pins Today read and source lookup indexes in migration SQL", () => {
    expect(migrationSql).toContain(
      "SurfacedEvidencePointer_userId_status_surfacedAt_idx",
    );
    expect(migrationSql).toContain(
      "SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_key",
    );
    expect(migrationSql).toContain(
      "SurfacedEvidencePointer_userId_publicEligible_status_idx",
    );
  });
});

describe("SurfacedEvidencePointer create-input coverage", () => {
  it("supports required create payload shape without generic defaults", () => {
    const now = new Date("2026-07-08T19:48:00.000Z");

    const create: Prisma.SurfacedEvidencePointerUncheckedCreateInput = {
      id: "receipt-pattern-claim-1",
      userId: "user-1",
      pointerKind: "pattern",
      surface: "today_evidence_pointer",
      sourceObjectType: UnderstandingLinkSourceType.pattern_claim,
      sourceObjectId: "claim-1",
      sourceEvidenceId: "pce-1",
      sourceText: "I keep working past the stop point even when I said I would not.",
      sourceOrigin: "Recent Pattern",
      whyItMatters:
        "Connects evening overwork to the missing stop point before commitments lock.",
      publicEligible: true,
      status: "active",
      materializedFrom: "model_update_publish",
      surfacedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    expect(create.id).toBe("receipt-pattern-claim-1");
    expect(create.whyItMatters).toContain("stop point");
    expect(create.publicEligible).toBe(true);
    expect(create.sourceObjectType).toBe("pattern_claim");
  });
});
