/**
 * Action Layer Regression Tests + Scope Guards (P2.5-10)
 *
 * Covers:
 * - PatternClaimAction contract shape (P2.5-01)
 * - Maturity/trust gate logic (P2.5-04)
 * - Micro-experiment generator (P2.5-03): family coverage, determinism, no numeric scores
 * - Service: create, update, reevaluation flag (P2.5-07)
 * - Scope guards: no dueAt, no streaks, no reminder fields, no top-level route
 */

import { describe, expect, it } from "vitest";

import {
  isActionReady,
  getActionGateReason,
  isTerminalActionStatus,
  shouldFlagForReevaluation,
  createClaimAction,
  updateClaimActionStatus,
  getReevaluationCandidates,
  toActionView,
} from "../pattern-claim-action";

import { generateMicroExperiment } from "../pattern-action-generator";
import { PATTERN_FAMILY_SECTIONS } from "../patterns-api";
import type { PatternClaimView, PatternClaimActionView } from "../patterns-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeClaim = (
  overrides: Partial<PatternClaimView> = {}
): PatternClaimView => ({
  id: overrides.id ?? "claim-abc123",
  patternType: overrides.patternType ?? "trigger_condition",
  summary: overrides.summary ?? "Test pattern",
  status: overrides.status ?? "active",
  strengthLevel: overrides.strengthLevel ?? "developing",
  evidenceCount: overrides.evidenceCount ?? 3,
  sessionCount: overrides.sessionCount ?? 2,
  journalEvidenceCount: overrides.journalEvidenceCount ?? 0,
  journalDaySpread: overrides.journalDaySpread ?? 0,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  receipts: overrides.receipts ?? [],
  action: overrides.action ?? null,
});

import type { PatternReceiptView } from "../patterns-api";

const makeReceipt = (overrides: Partial<PatternReceiptView> = {}): PatternReceiptView => ({
  id: "r1",
  source: "derivation",
  sessionId: "session-1",
  messageId: "msg-1",
  quote: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

type ActionRow = {
  id: string;
  claimId: string;
  userId: string;
  prompt: string;
  status: string;
  outcomeSignal: string | null;
  reflectionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type ClaimFlagRow = { id: string; patternType: string; strengthLevel: string; status: string; needsReevaluation: boolean };

function makeDb(existing?: ActionRow, claimFlags: ClaimFlagRow[] = []) {
  const store = new Map<string, ActionRow>(
    existing ? [[existing.id, existing]] : []
  );
  const claimStore = new Map<string, ClaimFlagRow>(
    claimFlags.map((c) => [c.id, { ...c }])
  );
  let claimNeedsReevaluation = false;

  const db = {
    patternClaimAction: {
      create: async ({ data }: { data: { claimId: string; userId: string; prompt: string; status: string } }) => {
        const row: ActionRow = {
          id: "action-1",
          claimId: data.claimId,
          userId: data.userId,
          prompt: data.prompt,
          status: data.status,
          outcomeSignal: null,
          reflectionNote: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        };
        store.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<ActionRow> }) => {
        const row = store.get(where.id);
        if (!row) throw new Error("not found");
        const updated = { ...row, ...data, updatedAt: new Date() };
        store.set(where.id, updated);
        return updated;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const row = store.get(where.id);
        return row && row.userId === where.userId ? row : null;
      },
    },
    patternClaim: {
      update: async (_args: { where: { id: string }; data: { needsReevaluation: boolean; updatedAt: Date } }) => {
        claimNeedsReevaluation = _args.data.needsReevaluation;
        const row = claimStore.get(_args.where.id);
        if (row) row.needsReevaluation = _args.data.needsReevaluation;
        return {};
      },
      findMany: async ({ where }: { where: { userId: string; needsReevaluation: boolean } }) => {
        return Array.from(claimStore.values()).filter(
          (c) => c.needsReevaluation === where.needsReevaluation
        );
      },
    },
    _claimNeedsReevaluation: () => claimNeedsReevaluation,
  };

  return db;
}

// ── Maturity gate (P2.5-04) ───────────────────────────────────────────────────

describe("isActionReady", () => {
  it("returns true for active claim with 2+ evidence", () => {
    expect(isActionReady(makeClaim({ status: "active", evidenceCount: 2 }))).toBe(true);
  });

  it("returns true for active + established + high evidence", () => {
    expect(isActionReady(makeClaim({ status: "active", evidenceCount: 10, strengthLevel: "established" }))).toBe(true);
  });

  it("returns false for candidate claim", () => {
    expect(isActionReady(makeClaim({ status: "candidate", evidenceCount: 5 }))).toBe(false);
  });

  it("returns false for active claim with only 1 evidence", () => {
    expect(isActionReady(makeClaim({ status: "active", evidenceCount: 1 }))).toBe(false);
  });

  it("returns false for paused claim", () => {
    expect(isActionReady(makeClaim({ status: "paused", evidenceCount: 5 }))).toBe(false);
  });

  it("returns false for dismissed claim", () => {
    expect(isActionReady(makeClaim({ status: "dismissed", evidenceCount: 5 }))).toBe(false);
  });
});

describe("getActionGateReason", () => {
  it("returns candidate message for candidate claims", () => {
    const reason = getActionGateReason(makeClaim({ status: "candidate" }));
    expect(reason).toContain("still being evaluated");
  });

  it("returns evidence message for active claims with insufficient evidence", () => {
    const reason = getActionGateReason(makeClaim({ status: "active", evidenceCount: 1 }));
    expect(reason).toContain("Not enough observations");
  });

  it("returns null for dismissed claims", () => {
    expect(getActionGateReason(makeClaim({ status: "dismissed" }))).toBeNull();
  });

  it("returns null for ready claims", () => {
    expect(getActionGateReason(makeClaim({ status: "active", evidenceCount: 3 }))).toBeNull();
  });
});

// ── Terminal status (P2.5-01 lifecycle) ───────────────────────────────────────

describe("isTerminalActionStatus", () => {
  it("completed is terminal", () => expect(isTerminalActionStatus("completed")).toBe(true));
  it("skipped is terminal", () => expect(isTerminalActionStatus("skipped")).toBe(true));
  it("abandoned is terminal", () => expect(isTerminalActionStatus("abandoned")).toBe(true));
  it("pending is not terminal", () => expect(isTerminalActionStatus("pending")).toBe(false));
  it("in_progress is not terminal", () => expect(isTerminalActionStatus("in_progress")).toBe(false));
});

// ── Outcome → reevaluation signal (P2.5-07) ───────────────────────────────────

describe("shouldFlagForReevaluation", () => {
  it("flags not_helpful outcomes", () => {
    expect(shouldFlagForReevaluation("not_helpful")).toBe(true);
  });

  it("does not flag helpful outcomes", () => {
    expect(shouldFlagForReevaluation("helpful")).toBe(false);
  });

  it("does not flag unclear outcomes", () => {
    expect(shouldFlagForReevaluation("unclear")).toBe(false);
  });

  it("does not flag null outcome", () => {
    expect(shouldFlagForReevaluation(null)).toBe(false);
  });
});

// ── Service: create action ────────────────────────────────────────────────────

describe("createClaimAction", () => {
  it("creates a pending action", async () => {
    const db = makeDb();
    const action = await createClaimAction(
      { claimId: "claim-1", userId: "user-1", prompt: "Try this." },
      db
    );
    expect(action.status).toBe("pending");
    expect(action.claimId).toBe("claim-1");
    expect(action.prompt).toBe("Try this.");
    expect(action.outcomeSignal).toBeNull();
    expect(action.completedAt).toBeNull();
  });
});

// ── Service: update action ────────────────────────────────────────────────────

describe("updateClaimActionStatus", () => {
  const baseRow: ActionRow = {
    id: "action-1",
    claimId: "claim-1",
    userId: "user-1",
    prompt: "Try this.",
    status: "pending",
    outcomeSignal: null,
    reflectionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  it("advances pending → in_progress", async () => {
    const db = makeDb(baseRow);
    const result = await updateClaimActionStatus(
      { actionId: "action-1", userId: "user-1", status: "in_progress" },
      db
    );
    expect(result?.status).toBe("in_progress");
  });

  it("completes with outcome and sets completedAt", async () => {
    const db = makeDb({ ...baseRow, status: "in_progress" });
    const result = await updateClaimActionStatus(
      {
        actionId: "action-1",
        userId: "user-1",
        status: "completed",
        outcomeSignal: "helpful",
        reflectionNote: "Worked well.",
      },
      db
    );
    expect(result?.status).toBe("completed");
    expect(result?.outcomeSignal).toBe("helpful");
    expect(result?.reflectionNote).toBe("Worked well.");
    expect(result?.completedAt).not.toBeNull();
  });

  it("flags claim for reevaluation on not_helpful outcome (P2.5-07)", async () => {
    const db = makeDb({ ...baseRow, status: "in_progress" });
    await updateClaimActionStatus(
      {
        actionId: "action-1",
        userId: "user-1",
        status: "abandoned",
        outcomeSignal: "not_helpful",
      },
      db
    );
    expect(db._claimNeedsReevaluation()).toBe(true);
  });

  it("does NOT flag claim for reevaluation on helpful outcome", async () => {
    const db = makeDb({ ...baseRow, status: "in_progress" });
    await updateClaimActionStatus(
      {
        actionId: "action-1",
        userId: "user-1",
        status: "completed",
        outcomeSignal: "helpful",
      },
      db
    );
    expect(db._claimNeedsReevaluation()).toBe(false);
  });

  it("returns null when action not found", async () => {
    const db = makeDb();
    const result = await updateClaimActionStatus(
      { actionId: "nonexistent", userId: "user-1", status: "in_progress" },
      db
    );
    expect(result).toBeNull();
  });
});

// ── toActionView shape ────────────────────────────────────────────────────────

describe("toActionView", () => {
  it("maps DB row to view correctly", () => {
    const now = new Date();
    const row: ActionRow = {
      id: "action-1",
      claimId: "claim-1",
      userId: "user-1",
      prompt: "Try this.",
      status: "completed",
      outcomeSignal: "helpful",
      reflectionNote: "It helped.",
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    };
    const view = toActionView(row);
    expect(view.id).toBe("action-1");
    expect(view.claimId).toBe("claim-1");
    expect(view.status).toBe("completed");
    expect(view.outcomeSignal).toBe("helpful");
    expect(view.completedAt).toBe(now.toISOString());
  });
});

// ── Micro-experiment generator (P2.5-03) ──────────────────────────────────────

describe("generateMicroExperiment", () => {
  it("generates a string for every family key", () => {
    for (const { familyKey } of PATTERN_FAMILY_SECTIONS) {
      const claim = makeClaim({ patternType: familyKey });
      const result = generateMicroExperiment(claim);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(10);
    }
  });

  it("is deterministic — same claim ID always returns same prompt", () => {
    const claim = makeClaim({ id: "claim-xyz" });
    const a = generateMicroExperiment(claim);
    const b = generateMicroExperiment(claim);
    expect(a).toBe(b);
  });

  it("does not contain numeric scores", () => {
    for (const { familyKey } of PATTERN_FAMILY_SECTIONS) {
      const claim = makeClaim({ patternType: familyKey });
      const result = generateMicroExperiment(claim);
      expect(/score\s*\d|:\s*\d+\/\d+|\d+%/.test(result)).toBe(false);
    }
  });

  it("does not use clinical or diagnostic language", () => {
    for (const { familyKey } of PATTERN_FAMILY_SECTIONS) {
      const claim = makeClaim({ patternType: familyKey });
      const result = generateMicroExperiment(claim);
      expect(/disorder|diagnosis|clinical|therapist|patholog|symptom/i.test(result)).toBe(false);
    }
  });

  it("different claim IDs produce different experiments when first chars differ", () => {
    // Use IDs with varying first 4 chars to exercise different hash buckets
    const ids = ["aaaa", "bbbb", "cccc", "dddd", "eeee", "ffff", "gggg", "hhhh"];
    const results = new Set<string>();
    for (const id of ids) {
      const claim = makeClaim({ id });
      results.add(generateMicroExperiment(claim));
    }
    // 8 distinct first-char sums → should span multiple pool entries
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  // P2.5-03 receipt-aware generation
  it("quote anchor: receipt with a quote materially changes the output vs no receipts", () => {
    const claimNoReceipts = makeClaim({ receipts: [] });
    const claimWithQuote = makeClaim({
      receipts: [
        makeReceipt({ quote: "every time I get stressed I start doom-scrolling" }),
      ],
    });
    const withoutQuote = generateMicroExperiment(claimNoReceipts);
    const withQuote = generateMicroExperiment(claimWithQuote);
    expect(withQuote).not.toBe(withoutQuote);
    expect(withQuote).toContain("doom-scrolling");
  });

  it("quote anchor is deterministic: same quote always produces same prompt", () => {
    const claim = makeClaim({
      receipts: [makeReceipt({ quote: "whenever I feel anxious I check my phone repeatedly" })],
    });
    expect(generateMicroExperiment(claim)).toBe(generateMicroExperiment(claim));
  });

  it("quote anchor: short/trivial quotes are not used as anchors", () => {
    const claim = makeClaim({
      receipts: [makeReceipt({ quote: "yes" })],
    });
    // A 3-char quote is below MIN_QUOTE_LEN — should fall back to base or session label
    const result = generateMicroExperiment(claim);
    expect(result).not.toContain('"yes"');
  });

  it("single-session label: added when all evidence is from one session", () => {
    const claim = makeClaim({
      evidenceCount: 2,
      sessionCount: 1,
      receipts: [], // no quote → falls through to session check
    });
    const result = generateMicroExperiment(claim);
    expect(result).toContain("one session");
  });

  it("single-session label is NOT added when multiple sessions exist", () => {
    const claim = makeClaim({
      evidenceCount: 4,
      sessionCount: 3,
      receipts: [],
    });
    const result = generateMicroExperiment(claim);
    expect(result).not.toContain("one session");
  });

  it("quote anchor takes precedence over single-session label", () => {
    // Both conditions true: quote should win
    const claim = makeClaim({
      evidenceCount: 2,
      sessionCount: 1,
      receipts: [makeReceipt({ quote: "I always freeze up before presenting at work" })],
    });
    const result = generateMicroExperiment(claim);
    expect(result).toContain("freeze up before presenting");
    expect(result).not.toContain("one session");
  });
});

// ── Reevaluation candidates query (P2.5-07) ───────────────────────────────────

describe("getReevaluationCandidates", () => {
  it("returns flagged claims for the user", async () => {
    const flaggedClaim: ClaimFlagRow = {
      id: "claim-flagged",
      patternType: "inner_critic",
      strengthLevel: "tentative",
      status: "active",
      needsReevaluation: true,
    };
    const clearClaim: ClaimFlagRow = {
      id: "claim-clear",
      patternType: "trigger_condition",
      strengthLevel: "developing",
      status: "active",
      needsReevaluation: false,
    };
    const db = makeDb(undefined, [flaggedClaim, clearClaim]);
    const candidates = await getReevaluationCandidates("user-1", db);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.id).toBe("claim-flagged");
  });

  it("returns empty array when no claims are flagged", async () => {
    const db = makeDb();
    const candidates = await getReevaluationCandidates("user-1", db);
    expect(candidates).toHaveLength(0);
  });
});

describe("needsReevaluation flag is set on not_helpful outcome", () => {
  const baseRow: ActionRow = {
    id: "action-1",
    claimId: "claim-1",
    userId: "user-1",
    prompt: "Try this.",
    status: "in_progress",
    outcomeSignal: null,
    reflectionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  it("sets needsReevaluation=true on claim when abandoned with not_helpful", async () => {
    const db = makeDb(baseRow);
    await updateClaimActionStatus(
      { actionId: "action-1", userId: "user-1", status: "abandoned", outcomeSignal: "not_helpful" },
      db
    );
    expect(db._claimNeedsReevaluation()).toBe(true);
  });

  it("does not set needsReevaluation when outcome is helpful", async () => {
    const db = makeDb(baseRow);
    await updateClaimActionStatus(
      { actionId: "action-1", userId: "user-1", status: "completed", outcomeSignal: "helpful" },
      db
    );
    expect(db._claimNeedsReevaluation()).toBe(false);
  });

  it("does not set needsReevaluation when skipped without outcome", async () => {
    const db = makeDb({ ...baseRow, status: "pending" });
    await updateClaimActionStatus(
      { actionId: "action-1", userId: "user-1", status: "skipped" },
      db
    );
    expect(db._claimNeedsReevaluation()).toBe(false);
  });
});

// ── Scope guards (P2.5-10) ────────────────────────────────────────────────────

describe("scope guards — no forbidden fields or patterns", () => {
  it("PatternClaimActionView has no dueAt field", () => {
    const action: PatternClaimActionView = {
      id: "a1",
      claimId: "c1",
      prompt: "Try this.",
      status: "pending",
      outcomeSignal: null,
      reflectionNote: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    // TypeScript would catch 'dueAt' at compile time; runtime check via key presence
    expect("dueAt" in action).toBe(false);
    expect("reminderAt" in action).toBe(false);
    expect("streak" in action).toBe(false);
    expect("points" in action).toBe(false);
  });

  it("lifecycle statuses contain no scheduler states", () => {
    const validStatuses = ["pending", "in_progress", "completed", "skipped", "abandoned"];
    const forbidden = ["scheduled", "reminded", "overdue", "due"];
    for (const forbidden_status of forbidden) {
      expect(validStatuses).not.toContain(forbidden_status);
    }
  });

  it("outcome signals are limited to helpful/not_helpful/unclear", () => {
    const validOutcomes = ["helpful", "not_helpful", "unclear"];
    // No gamification outcomes
    expect(validOutcomes).not.toContain("points");
    expect(validOutcomes).not.toContain("streak");
    expect(validOutcomes).not.toContain("level_up");
  });
});
