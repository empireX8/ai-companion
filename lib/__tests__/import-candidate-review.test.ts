import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prismadb", () => ({
  default: {},
}));

import {
  encodeImportCandidateReviewKey,
  listPendingImportCandidates,
  parseImportCandidateReviewKey,
} from "../import-candidate-review-query";
import {
  decideImportCandidate,
  ImportCandidateReviewError,
} from "../import-candidate-review-actions";
import {
  emptyImportReviewBatch,
  mapPendingImportPageToReviewBatch,
} from "../import-candidate-review-presentation";

const KAY_USER = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const TEST_USER = "user_import_review_test_isolated_001";
const OTHER_USER = "user_import_review_other_001";

function makePageDb(opts: {
  refs?: unknown[];
  contras?: unknown[];
  uploads?: unknown[];
}) {
  return {
    referenceItem: {
      findMany: vi.fn().mockResolvedValue(opts.refs ?? []),
    },
    contradictionNode: {
      findMany: vi.fn().mockResolvedValue(opts.contras ?? []),
    },
    importUploadSession: {
      findMany: vi.fn().mockResolvedValue(opts.uploads ?? []),
    },
  } as unknown as PrismaClient;
}

describe("import candidate review key encoding", () => {
  it("round-trips reference and contradiction keys", () => {
    const ref = encodeImportCandidateReviewKey({
      sourceTable: "ReferenceItem",
      id: "ref-1",
    });
    const contra = encodeImportCandidateReviewKey({
      sourceTable: "ContradictionNode",
      id: "cn-1",
    });
    expect(parseImportCandidateReviewKey(ref)).toEqual({
      sourceTable: "ReferenceItem",
      id: "ref-1",
    });
    expect(parseImportCandidateReviewKey(contra)).toEqual({
      sourceTable: "ContradictionNode",
      id: "cn-1",
    });
    expect(parseImportCandidateReviewKey("dev-exact-rt-ic1")).toBeNull();
  });
});

describe("listPendingImportCandidates", () => {
  it("returns only import-derived candidates and truthful totals", async () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const db = makePageDb({
      refs: [
        {
          id: "ref-a",
          type: "pattern",
          statement: "I reopen designs",
          confidence: "high",
          status: "candidate",
          sourceSessionId: "sess-1",
          sourceMessageId: "msg-1",
          createdAt: created,
          sourceMessage: { content: "I keep reopening the design" },
        },
      ],
      contras: [
        {
          id: "cn-a",
          type: "value_conflict",
          title: "Speed vs completeness",
          sideA: "Ship now",
          sideB: "Finish first",
          confidence: "medium",
          status: "candidate",
          sourceSessionId: "sess-2",
          sourceMessageId: "msg-2",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          sourceMessage: { content: "I want both" },
          evidence: [{ quote: "I want both speed and completeness" }],
        },
      ],
      uploads: [{ id: "upload-1" }],
    });

    const page = await listPendingImportCandidates({
      userId: TEST_USER,
      limit: 50,
      offset: 0,
      db,
    });

    expect(page.totalPendingCount).toBe(2);
    expect(page.candidates).toHaveLength(2);
    expect(page.sourceTables).toEqual(["ReferenceItem", "ContradictionNode"]);
    expect(page.candidates[0]!.provenance).toBe("import_derived_session");
    expect(page.candidates[0]!.sourceImportBatchId).toBe("upload-1");
    expect(page.candidates.every((c) => c.status === "candidate")).toBe(true);

    expect(db.referenceItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: TEST_USER,
          status: "candidate",
          sourceSession: { origin: "IMPORTED_ARCHIVE" },
        }),
      }),
    );
  });

  it("paginates with stable ordering and truthful total", async () => {
    const refs = Array.from({ length: 3 }, (_, i) => ({
      id: `ref-${i}`,
      type: "goal",
      statement: `Goal ${i}`,
      confidence: "low",
      status: "candidate",
      sourceSessionId: `sess-${i}`,
      sourceMessageId: null,
      createdAt: new Date(`2026-01-0${i + 1}T00:00:00.000Z`),
      sourceMessage: null,
    }));
    const db = makePageDb({ refs, contras: [], uploads: [] });
    const page = await listPendingImportCandidates({
      userId: TEST_USER,
      limit: 2,
      offset: 0,
      db,
    });
    expect(page.totalPendingCount).toBe(3);
    expect(page.candidates).toHaveLength(2);
    expect(page.candidates.map((c) => c.id)).toEqual(["ref-0", "ref-1"]);
  });

  it("does not include seed densograph ids", async () => {
    const page = await listPendingImportCandidates({
      userId: TEST_USER,
      db: makePageDb({ refs: [], contras: [], uploads: [] }),
    });
    const batch = mapPendingImportPageToReviewBatch(page);
    expect(batch.candidates).toEqual([]);
    expect(batch.candidates.some((c) => c.id.includes("dev-exact-rt"))).toBe(
      false,
    );
    expect(emptyImportReviewBatch().candidates).toEqual([]);
  });
});

describe("decideImportCandidate — isolated mutation mocks", () => {
  let refStatus = "candidate";
  let contraStatus = "candidate";
  let muCreates = 0;
  let uelCreates = 0;
  let txFailed = false;

  function makeActionDb(opts?: { failAfterStatus?: boolean }) {
    const state = {
      referenceItem: {
        findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
          if (where.userId !== TEST_USER) return null;
          if (where.id !== "ref-iso-1") return null;
          return {
            id: "ref-iso-1",
            status: refStatus,
            statement: "Isolated reference candidate",
            sourceSessionId: "sess-iso",
            sourceMessageId: "msg-iso",
            sourceSession: { origin: "IMPORTED_ARCHIVE" },
          };
        }),
        update: vi.fn(async ({ data }: { data: { status: string } }) => {
          if (opts?.failAfterStatus) {
            throw new Error("forced failure");
          }
          refStatus = data.status;
          return { id: "ref-iso-1", status: data.status };
        }),
      },
      contradictionNode: {
        findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
          if (where.userId !== TEST_USER) return null;
          if (where.id !== "cn-iso-1") return null;
          return {
            id: "cn-iso-1",
            status: contraStatus,
            title: "Isolated tension",
            sideA: "A",
            sideB: "B",
            sourceSessionId: "sess-iso",
            sourceMessageId: "msg-iso",
            sourceSession: { origin: "IMPORTED_ARCHIVE" },
          };
        }),
        update: vi.fn(async ({ data }: { data: { status: string } }) => {
          if (opts?.failAfterStatus) {
            throw new Error("forced failure");
          }
          contraStatus = data.status;
          return { id: "cn-iso-1", status: data.status };
        }),
      },
      evidenceSpan: {
        findMany: vi.fn().mockResolvedValue([{ id: "span-1" }]),
        findFirst: vi.fn().mockResolvedValue({ id: "span-1" }),
      },
      importUploadSession: {
        findMany: vi.fn().mockResolvedValue([{ id: "upload-iso" }]),
        findFirst: vi.fn().mockResolvedValue({ id: "upload-iso" }),
      },
      importUploadChunk: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      modelUpdate: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }: { data: { id?: string } }) => {
          muCreates += 1;
          return { id: data.id ?? `mu-${muCreates}` };
        }),
      },
      understandingEvidenceLink: {
        create: vi.fn(async () => {
          uelCreates += 1;
          return { id: `uel-${uelCreates}` };
        }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue({ id: "msg-iso" }),
      },
      session: {
        findFirst: vi.fn().mockResolvedValue({ id: "sess-iso" }),
      },
      userMapConclusion: { findFirst: vi.fn() },
      investigation: { findFirst: vi.fn() },
      fieldworkAssignment: { findFirst: vi.fn() },
      surfacedAction: { findFirst: vi.fn() },
      patternClaim: { findFirst: vi.fn() },
      patternClaimEvidence: { findFirst: vi.fn() },
      contradictionEvidence: { findFirst: vi.fn() },
      profileArtifact: { findFirst: vi.fn() },
      quickCheckIn: { findFirst: vi.fn() },
      journalEntry: { findFirst: vi.fn() },
    };

    const db = {
      ...state,
      $transaction: async (fn: (tx: typeof state) => Promise<unknown>) => {
        const snapshot = { refStatus, contraStatus, muCreates, uelCreates };
        try {
          return await fn(state);
        } catch (error) {
          // simulate rollback
          refStatus = snapshot.refStatus;
          contraStatus = snapshot.contraStatus;
          muCreates = snapshot.muCreates;
          uelCreates = snapshot.uelCreates;
          txFailed = true;
          throw error;
        }
      },
    };

    return db as unknown as PrismaClient;
  }

  beforeEach(() => {
    refStatus = "candidate";
    contraStatus = "candidate";
    muCreates = 0;
    uelCreates = 0;
    txFailed = false;
  });

  it("rejects cross-user access", async () => {
    const db = makeActionDb();
    await expect(
      decideImportCandidate({
        userId: OTHER_USER,
        reviewKey: "reference_item:ref-iso-1",
        decision: "accept",
        db,
      }),
    ).rejects.toBeInstanceOf(ImportCandidateReviewError);
  });

  it("persists reject without deleting the reference record", async () => {
    const db = makeActionDb();
    const result = await decideImportCandidate({
      userId: TEST_USER,
      reviewKey: "reference_item:ref-iso-1",
      decision: "reject",
      db,
    });
    expect(result.nextStatus).toBe("dismissed");
    expect(refStatus).toBe("dismissed");
    expect(result.materialisation).toBeNull();

    const again = await decideImportCandidate({
      userId: TEST_USER,
      reviewKey: "reference_item:ref-iso-1",
      decision: "reject",
      db,
    });
    expect(again.idempotent).toBe(true);
  });

  it("persists accept for reference without creating PatternClaim or ModelUpdate", async () => {
    const db = makeActionDb();
    const result = await decideImportCandidate({
      userId: TEST_USER,
      reviewKey: "reference_item:ref-iso-1",
      decision: "accept",
      db,
    });
    expect(result.nextStatus).toBe("active");
    expect(refStatus).toBe("active");
    expect(result.materialisation?.typedObjectType).toBe("ReferenceItem");
    expect(result.materialisation?.modelUpdateId).toBeNull();
    expect(
      result.materialisation?.gaps.some(
        (g) => g.code === "MODEL_UPDATE_TARGET_UNSUPPORTED",
      ),
    ).toBe(true);

    const again = await decideImportCandidate({
      userId: TEST_USER,
      reviewKey: "reference_item:ref-iso-1",
      decision: "accept",
      db,
    });
    expect(again.alreadyMaterialised).toBe(true);
    expect(again.idempotent).toBe(true);
  });

  it("accepts contradiction with lineage links and ModelUpdate; idempotent on retry", async () => {
    const db = makeActionDb();
    const result = await decideImportCandidate({
      userId: TEST_USER,
      reviewKey: "contradiction_node:cn-iso-1",
      decision: "accept",
      db,
    });
    expect(result.nextStatus).toBe("open");
    expect(contraStatus).toBe("open");
    expect(result.materialisation?.modelUpdateId).toBeTruthy();
    expect(result.materialisation?.evidenceLinksCreated).toBeGreaterThan(0);
    expect(muCreates).toBe(1);

    const again = await decideImportCandidate({
      userId: TEST_USER,
      reviewKey: "contradiction_node:cn-iso-1",
      decision: "accept",
      db,
    });
    expect(again.alreadyMaterialised).toBe(true);
    expect(muCreates).toBe(1);
  });

  it("rolls back on transaction failure with no partial model mutation", async () => {
    const db = makeActionDb({ failAfterStatus: true });
    await expect(
      decideImportCandidate({
        userId: TEST_USER,
        reviewKey: "reference_item:ref-iso-1",
        decision: "accept",
        db,
      }),
    ).rejects.toThrow("forced failure");
    expect(txFailed).toBe(true);
    expect(refStatus).toBe("candidate");
    expect(muCreates).toBe(0);
  });

  it("never targets Kay's real user id in isolated mutation fixtures", () => {
    expect(TEST_USER).not.toBe(KAY_USER);
    expect(OTHER_USER).not.toBe(KAY_USER);
  });
});

describe("presentation mapping — no seed leak", () => {
  it("maps DB candidates with provenance and never invents seed ic ids", () => {
    const batch = mapPendingImportPageToReviewBatch({
      candidates: [
        {
          id: "ref-1",
          sourceTable: "ReferenceItem",
          candidateType: "pattern",
          title: "Loop claim",
          claimOrSummary: "Loop claim",
          confidence: "high",
          status: "candidate",
          sourceImportBatchId: "upload-1",
          sourceSessionId: "sess-1",
          sourceMessageId: "msg-1",
          evidenceExcerpt: "raw words",
          createdAt: new Date("2026-01-01"),
          provenance: "import_derived_session",
          reviewKey: "reference_item:ref-1",
        },
      ],
      totalPendingCount: 1,
      limit: 50,
      offset: 0,
      sourceImportBatchIds: ["upload-1"],
      sourceTables: ["ReferenceItem", "ContradictionNode"],
    });

    expect(batch.candidates[0]!.id).toBe("reference_item:ref-1");
    expect(batch.candidates[0]!.candidateSourceTable).toBe("ReferenceItem");
    expect(batch.candidates[0]!.provenance).toBe("import_derived_session");
    expect(batch.totalPendingCount).toBe(1);
    expect(batch.candidates[0]!.id.includes("import-cand-ic")).toBe(false);
  });
});
