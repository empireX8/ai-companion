/**
 * Pattern Claim Refresh + Longitudinal Merge Rules tests (P3-09)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  batchRefreshClaimsForUser,
  mergeStaleDuplicateClaims,
} from "../pattern-claim-refresh";

// ── Mock DB factory ───────────────────────────────────────────────────────────

type ClaimRow = {
  id: string;
  userId: string;
  patternType: string;
  summaryNorm: string;
  status: string;
  strengthLevel: string;
  createdAt: Date;
  needsReevaluation?: boolean;
};

type EvidenceRow = {
  id: string;
  claimId: string;
  sessionId: string | null;
};

let idSeq = 0;
const nextId = () => `row_${++idSeq}`;

function makeMockDb(opts: {
  claims?: ClaimRow[];
  evidence?: EvidenceRow[];
} = {}) {
  const claims: ClaimRow[] = opts.claims ?? [];
  const evidence: EvidenceRow[] = opts.evidence ?? [];

  const db = {
    patternClaim: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const statusFilter = (where.status as { in?: string[]; not?: string } | undefined);
        return claims.filter((c) => {
          if (c.userId !== where.userId) return false;
          if (statusFilter?.in) return statusFilter.in.includes(c.status);
          if (statusFilter?.not) return c.status !== statusFilter.not;
          if (typeof where.needsReevaluation === "boolean") {
            return (c.needsReevaluation ?? false) === where.needsReevaluation;
          }
          return true;
        });
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        claims.find((c) => c.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const idx = claims.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error(`claim ${where.id} not found`);
        claims[idx] = { ...claims[idx]!, ...data } as ClaimRow;
        return claims[idx]!;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: { in: string[] } };
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const id of where.id.in) {
          const idx = claims.findIndex((c) => c.id === id);
          if (idx !== -1) {
            claims[idx] = { ...claims[idx]!, ...data } as ClaimRow;
            count++;
          }
        }
        return { count };
      },
    },
    patternClaimEvidence: {
      findMany: async ({ where }: { where: { claimId?: string } }) =>
        evidence.filter((e) => !where.claimId || e.claimId === where.claimId),
      updateMany: async ({
        where,
        data,
      }: {
        where: { claimId: string };
        data: { claimId: string };
      }) => {
        for (const e of evidence) {
          if (e.claimId === where.claimId) {
            e.claimId = data.claimId;
          }
        }
        return { count: evidence.filter((e) => e.claimId === data.claimId).length };
      },
    },
    _claims: claims,
    _evidence: evidence,
  };

  return db as unknown as PrismaClient & {
    _claims: ClaimRow[];
    _evidence: EvidenceRow[];
  };
}

function makeClaim(overrides: Partial<ClaimRow> = {}): ClaimRow {
  return {
    id: nextId(),
    userId: "u1",
    patternType: "inner_critic",
    summaryNorm: "recurring self critical inner voice patterns",
    status: "candidate",
    strengthLevel: "tentative",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ── batchRefreshClaimsForUser ─────────────────────────────────────────────────

describe("batchRefreshClaimsForUser", () => {
  it("returns 0 evaluated and 0 advanced when user has no active claims", async () => {
    const db = makeMockDb();
    const result = await batchRefreshClaimsForUser({ userId: "u1", db });
    expect(result.claimsEvaluated).toBe(0);
    expect(result.claimsAdvanced).toBe(0);
  });

  it("skips frozen (paused/dismissed) claims", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({ id: "c1", status: "paused" }),
        makeClaim({ id: "c2", status: "dismissed" }),
      ],
      evidence: [{ id: "e1", claimId: "c1", sessionId: "s1" }],
    });
    const result = await batchRefreshClaimsForUser({ userId: "u1", db });
    expect(result.claimsEvaluated).toBe(0);
  });

  it("evaluates candidate and active claims", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({ id: "c1", status: "candidate" }),
        makeClaim({ id: "c2", status: "active" }),
      ],
      evidence: [],
    });
    const result = await batchRefreshClaimsForUser({ userId: "u1", db });
    expect(result.claimsEvaluated).toBe(2);
  });

  it("advances candidate to active when evidence meets threshold", async () => {
    const db = makeMockDb({
      claims: [makeClaim({ id: "c1", status: "candidate", strengthLevel: "tentative" })],
      evidence: [{ id: "e1", claimId: "c1", sessionId: "s1" }],
    });
    const result = await batchRefreshClaimsForUser({ userId: "u1", db });
    expect(result.claimsAdvanced).toBe(1);
    expect(db._claims[0]!.status).toBe("active");
  });

  it("does not re-advance an already established claim", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({ id: "c1", status: "active", strengthLevel: "established" }),
      ],
      evidence: [
        { id: "e1", claimId: "c1", sessionId: "s1" },
        { id: "e2", claimId: "c1", sessionId: "s2" },
        { id: "e3", claimId: "c1", sessionId: "s3" },
        { id: "e4", claimId: "c1", sessionId: "s1" },
        { id: "e5", claimId: "c1", sessionId: "s2" },
        { id: "e6", claimId: "c1", sessionId: "s3" },
        { id: "e7", claimId: "c1", sessionId: "s1" },
      ],
    });
    const result = await batchRefreshClaimsForUser({ userId: "u1", db });
    expect(result.claimsAdvanced).toBe(0);
  });

  it("reports correct userId in result", async () => {
    const db = makeMockDb({ claims: [makeClaim({ userId: "u42" })] });
    const result = await batchRefreshClaimsForUser({ userId: "u42", db });
    expect(result.userId).toBe("u42");
  });
});

// ── mergeStaleDuplicateClaims ─────────────────────────────────────────────────

describe("mergeStaleDuplicateClaims", () => {
  it("returns 0 merged when no duplicates exist", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({ id: "c1", patternType: "inner_critic", summaryNorm: "norm_a" }),
        makeClaim({ id: "c2", patternType: "inner_critic", summaryNorm: "norm_b" }),
      ],
    });
    const result = await mergeStaleDuplicateClaims({ userId: "u1", db });
    expect(result.mergedCount).toBe(0);
    expect(result.dismissedIds).toHaveLength(0);
  });

  it("dismisses the newer duplicate and keeps the older canonical", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({
          id: "c_old",
          summaryNorm: "same_norm",
          createdAt: new Date("2026-01-01"),
          status: "active",
        }),
        makeClaim({
          id: "c_new",
          summaryNorm: "same_norm",
          createdAt: new Date("2026-02-01"),
          status: "active",
        }),
      ],
    });
    const result = await mergeStaleDuplicateClaims({ userId: "u1", db });
    expect(result.mergedCount).toBe(1);
    expect(result.dismissedIds).toContain("c_new");
    // Canonical should NOT be dismissed
    const canonical = db._claims.find((c) => c.id === "c_old");
    expect(canonical?.status).not.toBe("dismissed");
  });

  it("re-attributes evidence from duplicate to canonical", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({ id: "c_old", summaryNorm: "same_norm", createdAt: new Date("2026-01-01") }),
        makeClaim({ id: "c_new", summaryNorm: "same_norm", createdAt: new Date("2026-02-01") }),
      ],
      evidence: [
        { id: "e1", claimId: "c_old", sessionId: "s1" },
        { id: "e2", claimId: "c_new", sessionId: "s2" },
      ],
    });
    await mergeStaleDuplicateClaims({ userId: "u1", db });
    // Evidence from c_new should now point to c_old
    const reattributed = db._evidence.filter((e) => e.claimId === "c_old");
    expect(reattributed).toHaveLength(2);
  });

  it("does not merge claims with different patternType", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({ id: "c1", patternType: "inner_critic", summaryNorm: "same_norm" }),
        makeClaim({ id: "c2", patternType: "repetitive_loop", summaryNorm: "same_norm" }),
      ],
    });
    const result = await mergeStaleDuplicateClaims({ userId: "u1", db });
    expect(result.mergedCount).toBe(0);
  });

  it("does not merge already-dismissed claims", async () => {
    const db = makeMockDb({
      claims: [
        makeClaim({ id: "c1", summaryNorm: "same_norm", status: "active" }),
        makeClaim({ id: "c2", summaryNorm: "same_norm", status: "dismissed" }),
      ],
    });
    // findMany filters out dismissed, so only c1 visible — no duplicate
    const result = await mergeStaleDuplicateClaims({ userId: "u1", db });
    expect(result.mergedCount).toBe(0);
  });
});
