import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-replay-cli-"));
const artifactPath = path.join(tempDir, "persisted-claim-replay.json");

vi.mock("../pattern-claim-lifecycle", () => ({
  DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH: artifactPath,
  loadPersistedPatternClaimsForReplay: vi.fn(async () => []),
  runPersistedClaimReplayAudit: vi.fn(() => {
    const artifact = {
      results: [],
      inspectableResults: [],
      summary: {
        replayedClaims: 0,
        completeSupportBundles: 0,
        incompleteSupportBundles: 0,
        divergentClaims: 0,
        cleanMatchClaims: 0,
        cleanMatchPartialHistoricalStateClaims: 0,
        incompleteSupportBundleClaims: 0,
        summaryDriftClaims: 0,
        surfaceStateDriftClaims: 0,
        supportBundleDriftClaims: 0,
        multiDriftClaims: 0,
        summaryMismatchClaims: 0,
        surfacedMismatchClaims: 0,
        evidenceCountMismatchClaims: 0,
        thresholdMismatchClaims: 0,
        displaySafeMismatchClaims: 0,
        rationaleBundleMismatchClaims: 0,
        policyArtifactThresholdClaims: 0,
        constantFallbackThresholdClaims: 0,
        contradictionDriftClaims: 0,
        replaySurfacedClaims: 0,
        replaySuppressedClaims: 0,
        missingSummaryTextClaims: 0,
        missingEvidenceClaims: 0,
        missingReplayableQuotesClaims: 0,
        missingThresholdClaims: 0,
        missingRationaleBundleClaims: 0,
        missingDisplaySafeClaims: 0,
        divergenceReasonCounts: {
          summary_mismatch: 0,
          surfaced_mismatch: 0,
          evidence_count_mismatch: 0,
          threshold_mismatch: 0,
          display_safe_mismatch: 0,
          rationale_bundle_mismatch: 0,
          support_bundle_incomplete: 0,
        },
      },
    };
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    const payload = JSON.stringify(artifact, null, 2) + "\n";
    fs.writeFileSync(artifactPath, payload, "utf8");
    return {
      ...artifact,
      outputPath: artifactPath,
      artifactSha256: createHash("sha256").update(payload).digest("hex"),
    };
  }),
}));

describe("replay-persisted-pattern-claims CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(artifactPath)) {
      fs.unlinkSync(artifactPath);
    }
  });

  it("writes a deterministic empty-state artifact and prints zero-count summary", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runReplayPersistedPatternClaimsCli } = await import(
      "../../scripts/replay-persisted-pattern-claims"
    );

    const result = await runReplayPersistedPatternClaimsCli([]);

    expect(result.summary.replayedClaims).toBe(0);
    expect(result.summary.divergentClaims).toBe(0);
    expect(fs.existsSync(artifactPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(artifactPath, "utf8"))).toMatchObject({
      results: [],
      inspectableResults: [],
      summary: {
        replayedClaims: 0,
        completeSupportBundles: 0,
        incompleteSupportBundles: 0,
      },
    });
    expect(logSpy.mock.calls.map((call) => call[0])).toEqual([
      "[persisted-replay] claims=0",
      "[persisted-replay] complete=0 incomplete=0 divergent=0",
      "[persisted-replay] clean=0 partial_clean=0 incomplete_outcome=0",
      "[persisted-replay] summary_drift=0 surface_state_drift=0 support_bundle_drift=0 multi_drift=0",
      "[persisted-replay] threshold_sources policy_artifact=0 constant_fallback=0",
      "[persisted-replay] surfaced=0 suppressed=0 contradiction_drift=0",
      `[persisted-replay] artifact=${artifactPath}`,
      `[persisted-replay] sha256=${result.artifactSha256}`,
    ]);
  });

  it("surfaces database-unavailable failures explicitly without writing a destructive artifact", async () => {
    const lifecycle = await import("../pattern-claim-lifecycle");
    vi.mocked(lifecycle.loadPersistedPatternClaimsForReplay).mockRejectedValueOnce(
      new Error("Can't reach database server at localhost:5432")
    );
    const { runReplayPersistedPatternClaimsCli } = await import(
      "../../scripts/replay-persisted-pattern-claims"
    );

    await expect(runReplayPersistedPatternClaimsCli([])).rejects.toThrow(
      "Can't reach database server at localhost:5432"
    );
    expect(fs.existsSync(artifactPath)).toBe(false);
  });
});
