import { describe, expect, it } from "vitest";

import type { PatternClaimView } from "../patterns-api";
import {
  assessBuildGoalStatement,
  buildCurrentPrioritySnapshot,
  selectEligibleBuildGoals,
  selectBuildForwardActionBlueprints,
  selectStabilizeActionBlueprints,
  syncSurfacedActions,
  updateSurfacedActionState,
  type VisibleGoalReference,
} from "../actions-v1";

function makeClaim(
  overrides: Partial<PatternClaimView> = {}
): PatternClaimView {
  return {
    id: overrides.id ?? "claim-1",
    patternType: overrides.patternType ?? "trigger_condition",
    summary: overrides.summary ?? "Default summary",
    status: overrides.status ?? "active",
    strengthLevel: overrides.strengthLevel ?? "developing",
    evidenceCount: overrides.evidenceCount ?? 3,
    sessionCount: overrides.sessionCount ?? 2,
    journalEvidenceCount: overrides.journalEvidenceCount ?? 0,
    journalDaySpread: overrides.journalDaySpread ?? 0,
    createdAt: overrides.createdAt ?? new Date("2026-04-10T09:00:00.000Z").toISOString(),
    updatedAt: overrides.updatedAt ?? new Date("2026-04-15T09:00:00.000Z").toISOString(),
    receipts: overrides.receipts ?? [],
    action: overrides.action ?? null,
  };
}

function makeGoal(
  overrides: Partial<VisibleGoalReference> = {}
): VisibleGoalReference {
  return {
    id: overrides.id ?? "goal-1",
    statement: overrides.statement ?? "I want to publish a short essay this month",
    createdAt: overrides.createdAt ?? new Date("2026-04-10T09:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-04-15T09:00:00.000Z"),
  };
}

function createMockDb() {
  const rows: Array<{
    id: string;
    userId: string;
    surfaceKey: string;
    templateId: string;
    bucket: "stabilize" | "build";
    linkedFamily:
      | "trigger_condition"
      | "inner_critic"
      | "repetitive_loop"
      | "contradiction_drift"
      | "recovery_stabilizer"
      | null;
    linkedClaimId: string | null;
    linkedGoalRefId: string | null;
    status: "not_started" | "done" | "helped" | "didnt_help";
    note: string | null;
    surfacedAt: Date;
    updatedAt: Date;
  }> = [];
  let counter = 1;

  return {
    rows,
    surfacedAction: {
      async findMany(args: {
        where: { userId: string; surfaceKey: { in: string[] } };
      }) {
        return rows.filter(
          (row) =>
            row.userId === args.where.userId &&
            args.where.surfaceKey.in.includes(row.surfaceKey)
        );
      },
      async create(args: {
        data: {
          userId: string;
          surfaceKey: string;
          templateId: string;
          bucket: "stabilize" | "build";
          linkedFamily:
            | "trigger_condition"
            | "inner_critic"
            | "repetitive_loop"
            | "contradiction_drift"
            | "recovery_stabilizer"
            | null;
          linkedClaimId: string | null;
          linkedGoalRefId: string | null;
          status: "not_started" | "done" | "helped" | "didnt_help";
        };
      }) {
        const now = new Date(`2026-04-16T10:00:0${counter}.000Z`);
        const row = {
          id: `action-${counter++}`,
          ...args.data,
          note: null,
          surfacedAt: now,
          updatedAt: now,
        };
        rows.push(row);
        return row;
      },
      async update(args: {
        where: { id: string };
        data: {
          templateId?: string;
          bucket?: "stabilize" | "build";
          linkedFamily?:
            | "trigger_condition"
            | "inner_critic"
            | "repetitive_loop"
            | "contradiction_drift"
            | "recovery_stabilizer"
            | null;
          linkedClaimId?: string | null;
          linkedGoalRefId?: string | null;
          status?: "not_started" | "done" | "helped" | "didnt_help";
          note?: string | null;
        };
      }) {
        const row = rows.find((entry) => entry.id === args.where.id);
        if (!row) {
          throw new Error("missing row");
        }
        Object.assign(row, args.data, {
          updatedAt: new Date(`2026-04-16T10:10:0${counter}.000Z`),
        });
        counter += 1;
        return row;
      },
      async findFirst(args: { where: { id: string; userId: string } }) {
        return (
          rows.find(
            (row) =>
              row.id === args.where.id && row.userId === args.where.userId
          ) ?? null
        );
      },
    },
  };
}

describe("buildCurrentPrioritySnapshot", () => {
  it("prefers active claims over candidates", () => {
    const snapshot = buildCurrentPrioritySnapshot([
      makeClaim({
        id: "candidate-1",
        status: "candidate",
        summary: "Candidate claim",
      }),
      makeClaim({
        id: "active-1",
        status: "active",
        summary: "Active claim",
      }),
    ]);

    expect(snapshot.totalActive).toBe(1);
    expect(snapshot.totalCandidate).toBe(1);
    expect(snapshot.featured.map((claim) => claim.id)).toEqual(["active-1"]);
  });
});

describe("selectStabilizeActionBlueprints", () => {
  it("maps live claims to family-specific stabilize actions", () => {
    const blueprints = selectStabilizeActionBlueprints([
      makeClaim({
        id: "claim-trigger",
        patternType: "trigger_condition",
        summary: "You agree quickly under pressure.",
        updatedAt: new Date("2026-04-16T09:00:00.000Z").toISOString(),
      }),
      makeClaim({
        id: "claim-critic",
        patternType: "inner_critic",
        summary: "Harsh self-talk spikes after mistakes.",
        updatedAt: new Date("2026-04-15T09:00:00.000Z").toISOString(),
      }),
    ]);

    expect(blueprints).toHaveLength(3);
    expect(
      blueprints.slice(0, 2).map((blueprint) => ({
        templateId: blueprint.templateId,
        linkedClaimId: blueprint.linkedClaimId,
        linkedFamily: blueprint.linkedFamily,
      }))
    ).toEqual(
      expect.arrayContaining([
        {
          templateId: "s4",
          linkedClaimId: "claim-trigger",
          linkedFamily: "trigger_condition",
        },
        {
          templateId: "s5",
          linkedClaimId: "claim-critic",
          linkedFamily: "inner_critic",
        },
      ])
    );
    expect(blueprints[2]?.templateId).toBe("s3");
  });

  it("prioritizes more recent live claims when families compete", () => {
    const blueprints = selectStabilizeActionBlueprints([
      makeClaim({
        id: "claim-older-trigger",
        patternType: "trigger_condition",
        summary: "You agree quickly under pressure.",
        strengthLevel: "established",
        updatedAt: new Date("2026-04-10T09:00:00.000Z").toISOString(),
      }),
      makeClaim({
        id: "claim-recent-critic",
        patternType: "inner_critic",
        summary: "Harsh self-talk spikes after mistakes.",
        strengthLevel: "developing",
        updatedAt: new Date("2026-04-16T09:00:00.000Z").toISOString(),
      }),
    ]);

    expect(blueprints[0]).toMatchObject({
      linkedClaimId: "claim-recent-critic",
      linkedFamily: "inner_critic",
      templateId: "s5",
    });
  });
});

describe("selectBuildForwardActionBlueprints", () => {
  it("rejects noisy pseudo-goals before build selection", () => {
    expect(
      assessBuildGoalStatement(
        "do i need to do that in the terminal? i can do that myself in the finder"
      )
    ).toMatchObject({
      eligible: false,
      reason: "question_like",
    });

    expect(
      assessBuildGoalStatement("I want to build a steadier sleep routine")
    ).toMatchObject({
      eligible: true,
      reason: "accepted",
    });
  });

  it("filters to eligible unique goals before surfacing build actions", () => {
    const eligible = selectEligibleBuildGoals([
      makeGoal({
        id: "goal-noisy",
        statement:
          "do i need to do that in the terminal? i can do that myself in the finder",
        updatedAt: new Date("2026-04-16T09:00:00.000Z"),
      }),
      makeGoal({
        id: "goal-1",
        statement: "I want to publish my essay this month",
        updatedAt: new Date("2026-04-15T09:00:00.000Z"),
      }),
      makeGoal({
        id: "goal-dup",
        statement: "I want to publish my essay this month",
        updatedAt: new Date("2026-04-14T09:00:00.000Z"),
      }),
    ]);

    expect(eligible.map((goal) => goal.id)).toEqual(["goal-1"]);
  });

  it("uses active goals to choose deterministic build actions", () => {
    const blueprints = selectBuildForwardActionBlueprints([
      makeGoal({
        id: "goal-share",
        statement: "I want to publish my essay this month",
      }),
      makeGoal({
        id: "goal-rest",
        statement: "I want to sleep better and protect my energy",
        updatedAt: new Date("2026-04-14T09:00:00.000Z"),
      }),
    ]);

    expect(blueprints).toHaveLength(3);
    expect(blueprints[0]).toMatchObject({
      templateId: "b1",
      linkedGoalId: "goal-share",
    });
    expect(blueprints[1]).toMatchObject({
      templateId: "b5",
      linkedGoalId: "goal-rest",
    });
    // round-robin gives the top goal a second slot rather than falling back to a generic card
    expect(blueprints[2]).toMatchObject({
      templateId: "b4",
      linkedGoalId: "goal-share",
    });
  });

  it("fills all slots from an eligible goal before falling back to generic cards", () => {
    const blueprints = selectBuildForwardActionBlueprints([
      makeGoal({
        id: "goal-valid",
        statement: "I want to rebuild a steadier morning routine",
      }),
      makeGoal({
        id: "goal-noisy",
        statement:
          "do i need to do that in the terminal? i can do that myself in the finder",
        updatedAt: new Date("2026-04-14T09:00:00.000Z"),
      }),
    ]);

    // noisy goal is filtered; the single eligible goal fills all 3 slots via round-robin
    expect(blueprints).toHaveLength(3);
    expect(blueprints.every((blueprint) => blueprint.linkedGoalId === "goal-valid")).toBe(true);
    // each slot uses a different template (no cloning)
    const templateIds = blueprints.map((blueprint) => blueprint.templateId);
    expect(new Set(templateIds).size).toBe(3);
  });

  it("caps weak single-goal coverage so fallback cards remain available", () => {
    const blueprints = selectBuildForwardActionBlueprints([
      makeGoal({
        id: "goal-weak",
        statement: "more confidence in social situations",
      }),
    ]);

    expect(blueprints).toHaveLength(3);
    expect(blueprints[0]?.linkedGoalId).toBe("goal-weak");
    expect(blueprints[1]?.linkedGoalId).toBeNull();
    expect(blueprints[2]?.linkedGoalId).toBeNull();
  });

  it("falls back to a stable default set when no active goals exist", () => {
    const blueprints = selectBuildForwardActionBlueprints([]);
    expect(blueprints.map((blueprint) => blueprint.templateId)).toEqual([
      "b2",
      "b4",
      "b5",
    ]);
    expect(blueprints.every((blueprint) => blueprint.linkedGoalId === null)).toBe(
      true
    );
  });
});

describe("surfaced action persistence", () => {
  it("creates, reuses, and updates persisted action state", async () => {
    const db = createMockDb();
    const blueprints = selectStabilizeActionBlueprints([
      makeClaim({
        id: "claim-loop",
        patternType: "repetitive_loop",
        summary: "The same thought loop keeps resurfacing.",
      }),
    ]);

    const first = await syncSurfacedActions(
      { userId: "user-1", blueprints },
      db
    );

    expect(first).toHaveLength(3);
    expect(db.rows).toHaveLength(3);
    expect(first[0]?.status).toBe("not_started");

    const updated = await updateSurfacedActionState(
      {
        actionId: first[0]!.id,
        userId: "user-1",
        status: "helped",
        note: "  Helped me interrupt the loop.  ",
      },
      db
    );

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("helped");
    expect(updated?.note).toBe("Helped me interrupt the loop.");

    const second = await syncSurfacedActions(
      { userId: "user-1", blueprints },
      db
    );

    expect(second[0]?.id).toBe(first[0]?.id);
    expect(second[0]?.status).toBe("helped");
    expect(second[0]?.note).toBe("Helped me interrupt the loop.");
  });
});
