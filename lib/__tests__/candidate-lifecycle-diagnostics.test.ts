import { describe, expect, it } from "vitest";
import { CandidateLifecycleStatus } from "@prisma/client";

import {
  computeCandidateLifecycleDiagnostics,
  isStaleCandidate,
  normalizeForCandidateDedupe,
  parseCandidateLifecycleDiagnosticsCliArgs,
  resolveStaleCutoffDate,
} from "../candidate-lifecycle-diagnostics";

const NOW = new Date("2026-06-02T12:00:00.000Z");
const STALE_AFTER_DAYS = 7;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function baseInput(
  overrides: Partial<Parameters<typeof computeCandidateLifecycleDiagnostics>[0]> = {}
) {
  return {
    userId: "user-1",
    staleAfterDays: STALE_AFTER_DAYS,
    now: NOW,
    userMapConclusions: [],
    investigations: [],
    fieldworkAssignments: [],
    modelUpdates: [],
    ...overrides,
  };
}

describe("candidate lifecycle diagnostics", () => {
  describe("stale classification", () => {
    it("marks proposed older than cutoff as stale", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          investigations: [
            {
              id: "inv-stale",
              userId: "user-1",
              title: "Stale title",
              organizingQuestion: "Stale question",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              updatedAt: daysAgo(10),
            },
          ],
        })
      );

      const family = report.families.find((entry) => entry.family === "Investigation");
      expect(family?.staleCount).toBe(1);
      expect(family?.staleCandidates[0]?.id).toBe("inv-stale");
      expect(family?.staleCandidates[0]?.lifecycleStatus).toBe(
        CandidateLifecycleStatus.proposed
      );
      expect(family?.staleCandidates[0]?.ageDays).toBe(10);
    });

    it("marks held_for_more_evidence older than cutoff as stale", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          fieldworkAssignments: [
            {
              id: "fw-held",
              userId: "user-1",
              prompt: "Held prompt",
              reason: "Held reason",
              visibility: "internal_only",
              candidateLifecycleStatus:
                CandidateLifecycleStatus.held_for_more_evidence,
              linkedObjectType: "investigation",
              linkedObjectId: "inv-1",
              updatedAt: daysAgo(8),
            },
          ],
        })
      );

      const family = report.families.find(
        (entry) => entry.family === "FieldworkAssignment"
      );
      expect(family?.staleCount).toBe(1);
      expect(family?.staleCandidates[0]?.lifecycleStatus).toBe(
        CandidateLifecycleStatus.held_for_more_evidence
      );
    });

    it("handles cutoff edge predictably (exactly at cutoff is not stale)", () => {
      const cutoffDate = resolveStaleCutoffDate({
        now: NOW,
        staleAfterDays: STALE_AFTER_DAYS,
      });

      expect(
        isStaleCandidate({
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          updatedAt: cutoffDate,
          cutoffDate,
        })
      ).toBe(false);

      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          investigations: [
            {
              id: "inv-edge",
              userId: "user-1",
              title: "Edge title",
              organizingQuestion: "Edge question",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              updatedAt: cutoffDate,
            },
          ],
        })
      );

      const family = report.families.find((entry) => entry.family === "Investigation");
      expect(family?.staleCount).toBe(0);
    });

    it("excludes promoted, rejected, expired, superseded, and null lifecycle", () => {
      const excludedStatuses = [
        CandidateLifecycleStatus.promoted,
        CandidateLifecycleStatus.rejected,
        CandidateLifecycleStatus.expired,
        CandidateLifecycleStatus.superseded,
        null,
      ] as const;

      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          userMapConclusions: excludedStatuses.map((status, index) => ({
            id: `um-${index}`,
            userId: "user-1",
            area: "pattern",
            title: `Excluded ${index}`,
            summary: `Summary ${index}`,
            candidateLifecycleStatus: status,
            supersededById: null,
            updatedAt: daysAgo(30),
          })),
        })
      );

      const family = report.families.find(
        (entry) => entry.family === "UserMapConclusion"
      );
      expect(family?.staleCount).toBe(0);
      expect(family?.staleCandidates).toEqual([]);
    });
  });

  describe("family boundaries", () => {
    it("never stale-classifies ModelUpdate", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          modelUpdates: [
            {
              id: "mu-old",
              userId: "user-1",
              visibility: "internal_only",
              userFacingSummary: "Very old summary",
              affectedObjectType: "investigation",
              affectedObjectId: "inv-1",
              createdAt: daysAgo(90),
            },
          ],
        })
      );

      const family = report.families.find((entry) => entry.family === "ModelUpdate");
      expect(family?.staleCount).toBe(0);
      expect(family?.staleCandidates).toEqual([]);
    });

    it("ignores FieldworkAssignment.expiresAt for candidate staleness", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          fieldworkAssignments: [
            {
              id: "fw-fresh-updated",
              userId: "user-1",
              prompt: "Fresh prompt",
              reason: "Fresh reason",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              linkedObjectType: "investigation",
              linkedObjectId: "inv-1",
              expiresAt: daysAgo(1),
              updatedAt: NOW,
            },
          ],
        })
      );

      const family = report.families.find(
        (entry) => entry.family === "FieldworkAssignment"
      );
      expect(family?.staleCount).toBe(0);
    });
  });

  describe("duplicate clustering", () => {
    it("clusters UserMapConclusion duplicates with normalization and superseded filter", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          userMapConclusions: [
            {
              id: "um-1",
              userId: "user-1",
              area: "pattern",
              title: "  Duplicate   Title ",
              summary: "Duplicate summary",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              supersededById: null,
              updatedAt: daysAgo(1),
            },
            {
              id: "um-2",
              userId: "user-1",
              area: "pattern",
              title: "duplicate title",
              summary: "  duplicate   summary ",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              supersededById: null,
              updatedAt: daysAgo(2),
            },
            {
              id: "um-superseded",
              userId: "user-1",
              area: "pattern",
              title: "duplicate title",
              summary: "duplicate summary",
              candidateLifecycleStatus: CandidateLifecycleStatus.superseded,
              supersededById: "um-1",
              updatedAt: daysAgo(3),
            },
          ],
        })
      );

      const family = report.families.find(
        (entry) => entry.family === "UserMapConclusion"
      );
      expect(family?.duplicateClusterCount).toBe(1);
      expect(family?.duplicateClusters[0]?.candidateIds).toEqual(["um-1", "um-2"]);
      expect(family?.duplicateClusters[0]?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it("clusters Investigation duplicates", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          investigations: [
            {
              id: "inv-1",
              userId: "user-1",
              title: "Same Title",
              organizingQuestion: "Same question",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              updatedAt: daysAgo(1),
            },
            {
              id: "inv-2",
              userId: "user-1",
              title: "same   title",
              organizingQuestion: " same question ",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              updatedAt: daysAgo(2),
            },
          ],
        })
      );

      const family = report.families.find((entry) => entry.family === "Investigation");
      expect(family?.duplicateClusterCount).toBe(1);
      expect(family?.duplicateClusters[0]?.candidateIds).toEqual(["inv-1", "inv-2"]);
    });

    it("does not cluster Investigation rows with different lifecycle statuses", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          investigations: [
            {
              id: "inv-proposed",
              userId: "user-1",
              title: "same title",
              organizingQuestion: "same question",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              updatedAt: daysAgo(1),
            },
            {
              id: "inv-promoted",
              userId: "user-1",
              title: "same title",
              organizingQuestion: "same question",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
              updatedAt: daysAgo(2),
            },
          ],
        })
      );

      const family = report.families.find((entry) => entry.family === "Investigation");
      expect(family?.duplicateClusterCount).toBe(0);
    });

    it("clusters FieldworkAssignment duplicates", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          fieldworkAssignments: [
            {
              id: "fw-1",
              userId: "user-1",
              prompt: "Observe pattern",
              reason: "Need more evidence",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              linkedObjectType: "investigation",
              linkedObjectId: "inv-abc",
              updatedAt: daysAgo(1),
            },
            {
              id: "fw-2",
              userId: "user-1",
              prompt: " observe   pattern ",
              reason: "need more evidence",
              visibility: "internal_only",
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              linkedObjectType: "investigation",
              linkedObjectId: " inv-abc ",
              updatedAt: daysAgo(2),
            },
          ],
        })
      );

      const family = report.families.find(
        (entry) => entry.family === "FieldworkAssignment"
      );
      expect(family?.duplicateClusterCount).toBe(1);
      expect(family?.duplicateClusters[0]?.candidateIds).toEqual(["fw-1", "fw-2"]);
    });

    it("clusters ModelUpdate duplicates including direct-create style rows", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput({
          modelUpdates: [
            {
              id: "mu-1",
              userId: "user-1",
              visibility: "internal_only",
              userFacingSummary: "Model changed for investigation",
              affectedObjectType: "investigation",
              affectedObjectId: "inv-1",
              createdAt: daysAgo(1),
            },
            {
              id: "mu-2",
              userId: "user-1",
              visibility: "internal_only",
              userFacingSummary: " model   changed for investigation ",
              affectedObjectType: "investigation",
              affectedObjectId: "inv-1",
              createdAt: daysAgo(2),
            },
          ],
        })
      );

      const family = report.families.find((entry) => entry.family === "ModelUpdate");
      expect(family?.duplicateClusterCount).toBe(1);
      expect(family?.duplicateClusters[0]?.candidateIds).toEqual(["mu-1", "mu-2"]);
      expect(family?.duplicateClusters[0]?.lifecycleStatuses).toEqual([null, null]);
    });
  });

  describe("safety", () => {
    const sensitiveFixture = {
      userMapConclusions: [
        {
          id: "um-sensitive",
          userId: "user-1",
          area: "pattern",
          title: "SECRET_TITLE_XYZ_12345",
          summary: "SECRET_SUMMARY_ABC_67890",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          supersededById: null,
          updatedAt: daysAgo(10),
        },
        {
          id: "um-dup",
          userId: "user-1",
          area: "pattern",
          title: "secret_title_xyz_12345",
          summary: "secret_summary_abc_67890",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          supersededById: null,
          updatedAt: daysAgo(11),
        },
      ],
      investigations: [
        {
          id: "inv-sensitive",
          userId: "user-1",
          title: "RAW_EVIDENCE_SNIPPET_DO_NOT_LEAK",
          organizingQuestion: "QUOTE_FROM_MESSAGE_BODY_999",
          visibility: "internal_only",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          updatedAt: daysAgo(10),
        },
      ],
      fieldworkAssignments: [
        {
          id: "fw-sensitive",
          userId: "user-1",
          prompt: "INTERNAL_NOTES_PROMPT_LEAK",
          reason: "PROVENANCE_REASON_LEAK",
          visibility: "internal_only",
          candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
          linkedObjectType: "investigation",
          linkedObjectId: "inv-1",
          updatedAt: daysAgo(10),
        },
      ],
      modelUpdates: [
        {
          id: "mu-sensitive",
          userId: "user-1",
          visibility: "internal_only",
          userFacingSummary: "USER_FACING_SUMMARY_LEAK",
          affectedObjectType: "investigation",
          affectedObjectId: "inv-1",
          createdAt: daysAgo(10),
        },
      ],
    };

    it("does not include raw titles, summaries, prompts, or evidence text in report output", () => {
      const report = computeCandidateLifecycleDiagnostics(
        baseInput(sensitiveFixture)
      );
      const serialized = JSON.stringify(report);

      expect(serialized).not.toContain("SECRET_TITLE_XYZ_12345");
      expect(serialized).not.toContain("SECRET_SUMMARY_ABC_67890");
      expect(serialized).not.toContain("RAW_EVIDENCE_SNIPPET_DO_NOT_LEAK");
      expect(serialized).not.toContain("QUOTE_FROM_MESSAGE_BODY_999");
      expect(serialized).not.toContain("INTERNAL_NOTES_PROMPT_LEAK");
      expect(serialized).not.toContain("PROVENANCE_REASON_LEAK");
      expect(serialized).not.toContain("USER_FACING_SUMMARY_LEAK");
    });

    it("uses normalized dedupe helper without exposing full raw text in fingerprints", () => {
      expect(normalizeForCandidateDedupe("  Hello   World ")).toBe("hello world");

      const report = computeCandidateLifecycleDiagnostics(
        baseInput(sensitiveFixture)
      );
      for (const family of report.families) {
        for (const cluster of family.duplicateClusters) {
          expect(cluster.fingerprint).toMatch(/^[a-f0-9]{64}$/);
          expect(cluster.fingerprint).not.toContain("SECRET");
          expect(cluster.fingerprint).not.toContain("LEAK");
        }
      }
    });
  });

  describe("empty and no-issue cases", () => {
    it("returns zero counts and empty arrays cleanly", () => {
      const report = computeCandidateLifecycleDiagnostics(baseInput());

      expect(report.families).toHaveLength(4);
      for (const family of report.families) {
        expect(family.totalCount).toBe(0);
        expect(family.staleCount).toBe(0);
        expect(family.duplicateClusterCount).toBe(0);
        expect(family.staleCandidates).toEqual([]);
        expect(family.duplicateClusters).toEqual([]);
      }
    });
  });

  describe("CLI argument parsing", () => {
    it("requires --user-id and --stale-after-days", () => {
      expect(parseCandidateLifecycleDiagnosticsCliArgs([])).toEqual({
        ok: false,
        message: "Missing required --user-id argument.",
      });

      expect(
        parseCandidateLifecycleDiagnosticsCliArgs(["--user-id", "user-1"])
      ).toEqual({
        ok: false,
        message: "Missing required --stale-after-days argument.",
      });

      expect(
        parseCandidateLifecycleDiagnosticsCliArgs([
          "--user-id",
          "user-1",
          "--stale-after-days",
          "7",
        ])
      ).toEqual({
        ok: true,
        args: { userId: "user-1", staleAfterDays: 7 },
      });
    });
  });
});
