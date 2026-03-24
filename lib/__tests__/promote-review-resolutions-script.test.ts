import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-review-promotion-script-"));
const summaryPath = path.join(tempDir, "review-promotion-summary.json");

const mockedDetailedResult = {
  groupedRows: [
    {
      id: "group-1",
      description: "reviewed description",
      expected_behavioral: true,
      expected_families: {
        trigger_condition: true,
        inner_critic: false,
        repetitive_loop: false,
        recovery_stabilizer: false,
      },
      expected_abstain: false,
      expected_quote_safe: true,
      entries: [],
      reviewMetadata: {
        sourceQueueRun: "2026-03-18T15:00:00.000Z",
        reviewedAt: "2026-03-18T16:00:00.000Z",
        reviewer: "reviewer-a",
        resolutionReason: "human reviewed",
        resolutionStatus: "modified",
      },
    },
  ],
  faithfulnessRows: [
    {
      groupId: "group-1",
      family: "trigger_condition",
      visibleSummary: "Pressure often pushes you toward avoidance.",
      receiptQuotes: ["I put things off"],
      faithful: false,
      score: 0.2,
      rationale: "not supported",
      parseStatus: "parsed",
      shadowMode: true,
      usedForProductDecision: false,
      reviewMetadata: {
        sourceQueueRun: "2026-03-18T15:00:00.000Z",
        reviewedAt: "2026-03-18T16:00:00.000Z",
        reviewer: "reviewer-a",
        resolutionReason: "human reviewed",
        resolutionStatus: "modified",
      },
    },
  ],
  duplicateResolutionCount: 1,
  inputResolutionCount: 4,
  validResolutionCount: 3,
  rejectedResolutionCount: 1,
  noPayloadCount: 1,
  supersededGroupedCount: 2,
  supersededFaithfulnessCount: 1,
  invalidMissingBaseGroupCount: 1,
  outcomes: [
    {
      groupId: "group-1",
      reviewedAt: "2026-03-18T16:00:00.000Z",
      reviewer: "reviewer-a",
      status: "modified",
      outcome: "grouped_and_faithfulness_promoted",
    },
  ],
};

const writeSummaryMock = vi.fn((summary: Record<string, unknown>) => {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
});

vi.mock("../eval/pattern-review-resolution", () => ({
  DEFAULT_REVIEW_PROMOTION_SUMMARY_PATH: summaryPath,
  DEFAULT_REVIEW_RESOLUTIONS_PATH: "/tmp/review-resolutions.jsonl",
  DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH: "/tmp/faithfulness-shadow-reviewed.jsonl",
  DEFAULT_REVIEWED_GROUPED_DATASET_PATH: "/tmp/adjudication-groups.reviewed.jsonl",
  ensureReviewResolutionLog: vi.fn(),
  loadReviewResolutionRecords: vi.fn(() => []),
  promoteReviewResolutionsDetailed: vi.fn(() => mockedDetailedResult),
  writeReviewedFaithfulnessDataset: vi.fn(),
  writeReviewedGroupedDataset: vi.fn(),
  writeReviewPromotionSummary: writeSummaryMock,
}));

vi.mock("../../scripts/eval-patterns", () => ({
  loadGroupedDataset: vi.fn(() => []),
}));

describe("promote-review-resolutions script", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    writeSummaryMock.mockClear();
    if (fs.existsSync(summaryPath)) {
      fs.unlinkSync(summaryPath);
    }
  });

  it("writes deterministic summary hashes and surfaces important outcome counts", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runReviewPromotion } = await import("../../scripts/promote-review-resolutions");

    const resultA = runReviewPromotion();
    const firstSummary = fs.readFileSync(summaryPath, "utf8");
    const resultB = runReviewPromotion();
    const secondSummary = fs.readFileSync(summaryPath, "utf8");
    const parsedA = JSON.parse(firstSummary) as {
      outputHashes: Record<string, string>;
      duplicateResolutionCount: number;
      supersededGroupedCount: number;
      supersededFaithfulnessCount: number;
      invalidMissingBaseGroupCount: number;
    };
    const parsedB = JSON.parse(secondSummary) as {
      outputHashes: Record<string, string>;
      duplicateResolutionCount: number;
      supersededGroupedCount: number;
      supersededFaithfulnessCount: number;
      invalidMissingBaseGroupCount: number;
    };

    expect(resultA).toEqual(resultB);
    expect(parsedA.outputHashes).toEqual(parsedB.outputHashes);
    expect(parsedA.outputHashes.groupedOverlaySha256).toHaveLength(64);
    expect(parsedA.outputHashes.faithfulnessOverlaySha256).toHaveLength(64);
    expect(parsedA.outputHashes.summaryPayloadSha256).toHaveLength(64);
    expect(parsedA.duplicateResolutionCount).toBe(1);
    expect(parsedA.supersededGroupedCount).toBe(2);
    expect(parsedA.supersededFaithfulnessCount).toBe(1);
    expect(parsedA.invalidMissingBaseGroupCount).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(
      "[review-promotion] grouped=1 faithfulness=1 duplicates_ignored=1 rejected=1 no_payload=1 invalid_missing_base_group=1 superseded_grouped=2 superseded_faithfulness=1"
    );
  });
});
