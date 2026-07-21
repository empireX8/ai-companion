/**
 * CEQR-007 / CONTRADICTION-DUPLICATE-PREVENTION-001 — schema/migration contract.
 * ESM imports only. No require().
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CONTRADICTION-DUPLICATE-PREVENTION-001 schema/migration contract", () => {
  it("schema contains exact dual-side unique with mapped name", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).toMatch(
      /@@unique\(\[userId, sideASourceSpanId, sideBSourceSpanId\], map: "ContradictionNode_user_sideA_sideB_span_uniq"\)/,
    );
    expect(schema).toMatch(/CEQR-007/);
  });

  it("migration SQL creates the exact unique index", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260721140000_add_contradiction_exact_dual_side_unique/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "ContradictionNode_user_sideA_sideB_span_uniq"/,
    );
    expect(sql).toMatch(
      /ON "ContradictionNode"\("userId", "sideASourceSpanId", "sideBSourceSpanId"\)/,
    );
    expect(sql).not.toMatch(/\b(DELETE|UPDATE|INSERT|DROP TABLE)\b/i);
  });

  it("avoids CommonJS require calls in this test file", () => {
    const sourceText = readFileSync(
      join(
        process.cwd(),
        "lib/__tests__/contradiction-duplicate-prevention-schema.test.ts",
      ),
      "utf8",
    );
    expect(sourceText).not.toMatch(/(?:^|[^\w.$])require\s*\(\s*["'`]/m);
  });
});
