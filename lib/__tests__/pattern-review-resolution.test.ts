import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, expect, it } from "vitest";

import type {
  AdjudicationGroup,
  ReviewResolutionRecord,
} from "../eval/eval-types";
import {
  loadMergedFaithfulnessDataset,
  loadMergedGroupedDataset,
  loadReviewResolutionRecords,
  promoteReviewResolutionsDetailed,
  promoteReviewResolutions,
  validateReviewResolutionRecord,
  writeReviewedFaithfulnessDataset,
  writeReviewedGroupedDataset,
} from "../eval/pattern-review-resolution";

function makeBaseGroup(overrides: Partial<AdjudicationGroup> = {}): AdjudicationGroup {
  return {
    id: "group-1",
    description: "base description",
    entries: [
      {
        text: "I avoid conflict when pressure rises",
        session_id: "s1",
        role: "user",
        source: "live_user",
      },
    ],
    expected_behavioral: true,
    expected_families: {
      trigger_condition: true,
      inner_critic: false,
      repetitive_loop: false,
      recovery_stabilizer: false,
    },
    expected_abstain: false,
    expected_quote_safe: true,
    ...overrides,
  };
}

function makeResolution(overrides: Partial<ReviewResolutionRecord> = {}): ReviewResolutionRecord {
  return {
    version: 1,
    sourceQueueRun: "2026-03-18T15:00:00.000Z",
    reviewedAt: "2026-03-18T16:00:00.000Z",
    reviewer: "reviewer-a",
    resolutionReason: "human reviewed",
    groupId: "group-1",
    status: "modified",
    groupedResolution: {
      description: "reviewed description",
      expected_behavioral: true,
      expected_families: {
        trigger_condition: false,
        inner_critic: true,
        repetitive_loop: false,
        recovery_stabilizer: false,
      },
      expected_abstain: false,
      expected_quote_safe: true,
    },
    faithfulnessResolutions: [
      {
        family: "inner_critic",
        visibleSummary: "Self-doubt shows up when you assess your own ability.",
        receiptQuotes: ["I doubt myself when I have to choose"],
        faithful: true,
        score: 0.91,
        rationale: "supported",
        parseStatus: "parsed",
      },
    ],
    ...overrides,
  };
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf-8");
}

describe("pattern review resolution", () => {
  it("validates required provenance fields", () => {
    expect(validateReviewResolutionRecord(makeResolution())).toBe(true);
    expect(
      validateReviewResolutionRecord({
        ...makeResolution(),
        reviewer: "",
      })
    ).toBe(false);
  });

  it("missing provenance fails validation at load time", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-resolution-invalid-"));
    const resolutionsPath = path.join(tempDir, "review-resolutions.jsonl");
    writeJsonl(resolutionsPath, [{ ...makeResolution(), sourceQueueRun: "" }]);

    expect(() => loadReviewResolutionRecords(resolutionsPath)).toThrow();
  });

  it("promotion is deterministic and duplicate resolutions do not create duplicate overlay rows", () => {
    const baseGroups = [makeBaseGroup()];
    const resolution = makeResolution();
    const resultA = promoteReviewResolutionsDetailed([resolution, resolution], baseGroups);
    const resultB = promoteReviewResolutionsDetailed([resolution, resolution], baseGroups);

    expect(resultA.groupedRows).toEqual(resultB.groupedRows);
    expect(resultA.faithfulnessRows).toEqual(resultB.faithfulnessRows);
    expect(resultA.groupedRows).toHaveLength(1);
    expect(resultA.faithfulnessRows).toHaveLength(1);
    expect(resultA.duplicateResolutionCount).toBe(1);
    expect(resultA.outcomes.some((outcome) => outcome.outcome === "grouped_and_faithfulness_promoted")).toBe(true);
  });

  it("rejected resolutions do not promote rows", () => {
    const result = promoteReviewResolutionsDetailed(
      [makeResolution({ status: "rejected", groupedResolution: undefined, faithfulnessResolutions: undefined })],
      [makeBaseGroup()]
    );

    expect(result.groupedRows).toEqual([]);
    expect(result.faithfulnessRows).toEqual([]);
    expect(result.rejectedResolutionCount).toBe(1);
    expect(result.outcomes[0]?.outcome).toBe("rejected_no_promotion");
  });

  it("confirmed and modified resolutions promote with provenance metadata", () => {
    const confirmed = makeResolution({ status: "confirmed" });
    const modified = makeResolution({
      reviewedAt: "2026-03-18T17:00:00.000Z",
      groupedResolution: {
        description: "newer reviewed description",
      },
    });
    const result = promoteReviewResolutions([confirmed, modified], [makeBaseGroup()]);

    expect(result.groupedRows[0]?.description).toBe("newer reviewed description");
    expect(result.groupedRows[0]?.reviewMetadata.reviewer).toBe("reviewer-a");
    expect(result.faithfulnessRows[0]?.reviewMetadata.sourceQueueRun).toBe("2026-03-18T15:00:00.000Z");
  });

  it("multi-family faithfulness resolutions promote multiple rows deterministically", () => {
    const result = promoteReviewResolutions(
      [
        makeResolution({
          faithfulnessResolutions: [
            {
              family: "trigger_condition",
              visibleSummary: "Pressure often pushes you toward avoidance.",
              receiptQuotes: ["I put things off"],
              faithful: false,
              score: 0.2,
              rationale: "not supported",
              parseStatus: "parsed",
            },
            {
              family: "inner_critic",
              visibleSummary: "Self-doubt shows up when you assess your own ability.",
              receiptQuotes: ["I doubt myself"],
              faithful: true,
              score: 0.9,
              rationale: "supported",
              parseStatus: "parsed",
            },
          ],
        }),
      ],
      [makeBaseGroup()]
    );

    expect(result.groupedRows).toHaveLength(1);
    expect(result.faithfulnessRows).toHaveLength(2);
    expect(result.faithfulnessRows.map((row) => row.family)).toEqual(["inner_critic", "trigger_condition"]);
  });

  it("classifies no-payload and missing-base-group resolutions explicitly", () => {
    const noPayload = promoteReviewResolutionsDetailed(
      [makeResolution({ groupedResolution: undefined, faithfulnessResolutions: undefined })],
      [makeBaseGroup()]
    );
    const missingBase = promoteReviewResolutionsDetailed(
      [makeResolution({ groupId: "missing-group" })],
      [makeBaseGroup()]
    );

    expect(noPayload.noPayloadCount).toBe(1);
    expect(noPayload.outcomes[0]?.outcome).toBe("no_explicit_payload");
    expect(missingBase.invalidMissingBaseGroupCount).toBe(1);
    expect(missingBase.outcomes.some((outcome) => outcome.outcome === "invalid_missing_base_group")).toBe(true);
  });

  it("counts superseded grouped and faithfulness rows explicitly", () => {
    const older = makeResolution({
      reviewedAt: "2026-03-18T16:00:00.000Z",
      groupedResolution: { description: "older description" },
      faithfulnessResolutions: [
        {
          family: "inner_critic",
          visibleSummary: "Self-doubt shows up when you assess your own ability.",
          receiptQuotes: ["older quote"],
          faithful: false,
          score: 0.2,
          rationale: "older",
          parseStatus: "parsed",
        },
      ],
    });
    const newer = makeResolution({
      reviewedAt: "2026-03-18T17:00:00.000Z",
      groupedResolution: { description: "newer description" },
      faithfulnessResolutions: [
        {
          family: "inner_critic",
          visibleSummary: "Self-doubt shows up when you assess your own ability.",
          receiptQuotes: ["newer quote"],
          faithful: true,
          score: 0.9,
          rationale: "newer",
          parseStatus: "parsed",
        },
      ],
    });

    const result = promoteReviewResolutionsDetailed([older, newer], [makeBaseGroup()]);

    expect(result.supersededGroupedCount).toBe(1);
    expect(result.supersededFaithfulnessCount).toBe(1);
    expect(result.groupedRows[0]?.description).toBe("newer description");
    expect(result.faithfulnessRows[0]?.receiptQuotes).toEqual(["newer quote"]);
  });

  it("reviewed overlays override base datasets deterministically and base files remain unchanged", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-resolution-merge-"));
    const baseGroupsPath = path.join(tempDir, "adjudication-groups.jsonl");
    const baseFaithfulnessPath = path.join(tempDir, "faithfulness-shadow-set.jsonl");
    const reviewedGroupsPath = path.join(tempDir, "adjudication-groups.reviewed.jsonl");
    const reviewedFaithfulnessPath = path.join(tempDir, "faithfulness-shadow-reviewed.jsonl");

    writeJsonl(baseGroupsPath, [makeBaseGroup()]);
    writeJsonl(baseFaithfulnessPath, [
      {
        groupId: "group-1",
        family: "inner_critic",
        visibleSummary: "old summary",
        receiptQuotes: ["old quote"],
        faithful: false,
        score: 0.1,
        rationale: "old",
        parseStatus: "parsed",
        shadowMode: true,
        usedForProductDecision: false,
      },
    ]);

    const baseGroupsBefore = fs.readFileSync(baseGroupsPath, "utf-8");
    const baseFaithfulnessBefore = fs.readFileSync(baseFaithfulnessPath, "utf-8");

    const promoted = promoteReviewResolutions([makeResolution()], [makeBaseGroup()]);
    writeReviewedGroupedDataset(promoted.groupedRows, reviewedGroupsPath);
    writeReviewedFaithfulnessDataset(promoted.faithfulnessRows, reviewedFaithfulnessPath);

    const mergedGroups = loadMergedGroupedDataset(baseGroupsPath, reviewedGroupsPath);
    const mergedFaithfulness = loadMergedFaithfulnessDataset(baseFaithfulnessPath, reviewedFaithfulnessPath);

    expect(mergedGroups[0]?.description).toBe("reviewed description");
    expect(mergedFaithfulness[0]?.visibleSummary).toBe(
      "Self-doubt shows up when you assess your own ability."
    );
    expect(fs.readFileSync(baseGroupsPath, "utf-8")).toBe(baseGroupsBefore);
    expect(fs.readFileSync(baseFaithfulnessPath, "utf-8")).toBe(baseFaithfulnessBefore);
  });

  it("repeated overlay writes are byte-stable", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-resolution-stable-"));
    const groupsA = path.join(tempDir, "groups-a.jsonl");
    const groupsB = path.join(tempDir, "groups-b.jsonl");
    const faithA = path.join(tempDir, "faith-a.jsonl");
    const faithB = path.join(tempDir, "faith-b.jsonl");
    const promoted = promoteReviewResolutions([makeResolution()], [makeBaseGroup()]);

    writeReviewedGroupedDataset(promoted.groupedRows, groupsA);
    writeReviewedGroupedDataset(promoted.groupedRows, groupsB);
    writeReviewedFaithfulnessDataset(promoted.faithfulnessRows, faithA);
    writeReviewedFaithfulnessDataset(promoted.faithfulnessRows, faithB);

    expect(fs.readFileSync(groupsA, "utf-8")).toBe(fs.readFileSync(groupsB, "utf-8"));
    expect(fs.readFileSync(faithA, "utf-8")).toBe(fs.readFileSync(faithB, "utf-8"));
  });
});
