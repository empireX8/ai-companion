import { describe, expect, it, vi } from "vitest";

import {
  assessLiveEvidenceDepthFixtureSafety,
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
} from "../live-evidence-depth-runtime-fixture";
import {
  assessSemanticTwinFixtureSafety,
  cleanupSemanticTwinRuntimeFixture,
  resolveSemanticTwinIds,
  seedSemanticTwinRuntimeFixture,
  SEMANTIC_TWIN_EXPECTED_TITLES,
  SEMANTIC_TWIN_MARKER,
  SEMANTIC_TWIN_PREFIX,
  twinId,
} from "../semantic-twin-runtime-fixture";

const LOCAL_ENV = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/companion",
  [EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV]: "1",
} as NodeJS.ProcessEnv;

const FIXTURE_USER_ID = "user_semantic_twin_fixture_test";

describe("semantic twin runtime fixture", () => {
  it("uses dev-semantic-twin ids and never reuses frozen fixture ids", () => {
    const ids = resolveSemanticTwinIds(FIXTURE_USER_ID);

    expect(SEMANTIC_TWIN_PREFIX).toBe("dev-semantic-twin");
    expect(SEMANTIC_TWIN_MARKER).toContain("devFixture:semantic-twin-runtime");

    const twinOwnedIds = [
      ids.sessionId,
      ...Object.values(ids.messageIds),
      ...Object.values(ids.evidenceSpanIds),
      ...Object.values(ids.patternClaimIds),
      ...Object.values(ids.conclusionIds),
      ...Object.values(ids.openInvestigationIds),
      ...Object.values(ids.resolvedInvestigationIds),
      ...Object.values(ids.fieldworkIds),
      ...Object.values(ids.modelUpdateIds),
    ];
    expect(twinOwnedIds.every((id) => id.startsWith(`${SEMANTIC_TWIN_PREFIX}-`))).toBe(true);
    expect(ids.surfacedPointerIds.every((id) => id.includes(SEMANTIC_TWIN_PREFIX))).toBe(true);

    for (const forbidden of ["d1", "rep-weekly", "mu-1", "r6", "aq-1", "inv-1"]) {
      expect(ids.allIds).not.toContain(forbidden);
      expect(twinId(FIXTURE_USER_ID, "model-update-mu-1")).not.toBe(forbidden);
    }
  });

  it("exports seed and cleanup functions", () => {
    expect(typeof seedSemanticTwinRuntimeFixture).toBe("function");
    expect(typeof cleanupSemanticTwinRuntimeFixture).toBe("function");
    expect(typeof resolveSemanticTwinIds).toBe("function");
  });

  it("refuses production-looking DATABASE_URL via shared safety gate", () => {
    const assessment = assessSemanticTwinFixtureSafety({
      ...LOCAL_ENV,
      DATABASE_URL: "postgresql://user:pass@prod.cluster.amazonaws.com:5432/companion",
    });

    expect(assessment.allowed).toBe(false);
    expect(assessment.blockers).toContain("production_database_url");
    expect(
      assessLiveEvidenceDepthFixtureSafety({
        ...LOCAL_ENV,
        DATABASE_URL: "postgresql://user:pass@prod.cluster.amazonaws.com:5432/companion",
      }).blockers,
    ).toContain("production_database_url");
  });

  it("lists distinctive reference titles for live gate checks", () => {
    expect(SEMANTIC_TWIN_EXPECTED_TITLES.length).toBeGreaterThan(10);
    expect(SEMANTIC_TWIN_EXPECTED_TITLES).toContain(
      "You often need visual expression before locking architecture.",
    );
    expect(SEMANTIC_TWIN_EXPECTED_TITLES).toContain(
      "Small public test — narrow version before reopening",
    );
  });

  it("cleanup targets marker-scoped rows without calling seed", async () => {
    const ids = resolveSemanticTwinIds(FIXTURE_USER_ID);
    const deleted: string[] = [];

    const db = {
      surfacedEvidencePointer: {
        deleteMany: vi.fn(async () => {
          deleted.push("pointers");
          return { count: 1 };
        }),
      },
      understandingEvidenceLink: {
        deleteMany: vi.fn(async () => ({ count: 2 })),
      },
      modelUpdate: {
        deleteMany: vi.fn(async (args: { where: { OR: unknown[] } }) => {
          expect(args.where.OR).toBeTruthy();
          deleted.push("modelUpdates");
          return { count: 3 };
        }),
      },
      patternClaimEvidence: {
        deleteMany: vi.fn(async () => ({ count: 4 })),
      },
      patternClaim: { deleteMany: vi.fn(async () => ({ count: 5 })) },
      userMapConclusion: {
        deleteMany: vi.fn(async (args: { where: { OR: unknown[] } }) => {
          expect(args.where.OR).toBeTruthy();
          return { count: 6 };
        }),
      },
      investigation: { deleteMany: vi.fn(async () => ({ count: 7 })) },
      fieldworkAssignment: { deleteMany: vi.fn(async () => ({ count: 8 })) },
      surfacedAction: { deleteMany: vi.fn(async () => ({ count: 9 })) },
      evidenceSpan: { deleteMany: vi.fn(async () => ({ count: 10 })) },
      message: { deleteMany: vi.fn(async () => ({ count: 11 })) },
      session: { deleteMany: vi.fn(async () => ({ count: 12 })) },
    };

    const outcome = await cleanupSemanticTwinRuntimeFixture({
      userId: FIXTURE_USER_ID,
      db: db as never,
      ids,
    });

    expect(outcome.deletedPointers).toBe(1);
    expect(outcome.deletedModelUpdates).toBe(3);
    expect(deleted).toContain("pointers");
    expect(deleted).toContain("modelUpdates");
  });
});
