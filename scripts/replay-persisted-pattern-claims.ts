import {
  DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH,
  loadPersistedPatternClaimsForReplay,
  runPersistedClaimReplayAudit,
} from "../lib/pattern-claim-lifecycle";

function parseArgs(argv: string[]): {
  outputPath?: string;
  claimIds: string[];
  limit?: number;
} {
  const claimIds: string[] = [];
  let outputPath: string | undefined;
  let limit: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1]!;
      i += 1;
      continue;
    }
    if (arg === "--claim-id" && argv[i + 1]) {
      claimIds.push(argv[i + 1]!);
      i += 1;
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]!);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      i += 1;
    }
  }

  return { outputPath, claimIds, limit };
}

export async function runReplayPersistedPatternClaimsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const claims = await loadPersistedPatternClaimsForReplay({
    claimIds: args.claimIds.length > 0 ? args.claimIds : undefined,
    limit: args.limit,
  });
  const result = runPersistedClaimReplayAudit({
    claims,
    outputPath: args.outputPath ?? DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH,
  });

  console.log(`[persisted-replay] claims=${result.summary.replayedClaims}`);
  console.log(
    `[persisted-replay] complete=${result.summary.completeSupportBundles} incomplete=${result.summary.incompleteSupportBundles} divergent=${result.summary.divergentClaims}`
  );
  console.log(
    `[persisted-replay] clean=${result.summary.cleanMatchClaims} partial_clean=${result.summary.cleanMatchPartialHistoricalStateClaims} incomplete_outcome=${result.summary.incompleteSupportBundleClaims}`
  );
  console.log(
    `[persisted-replay] summary_drift=${result.summary.summaryDriftClaims} surface_state_drift=${result.summary.surfaceStateDriftClaims} support_bundle_drift=${result.summary.supportBundleDriftClaims} multi_drift=${result.summary.multiDriftClaims}`
  );
  console.log(
    `[persisted-replay] threshold_sources policy_artifact=${result.summary.policyArtifactThresholdClaims} constant_fallback=${result.summary.constantFallbackThresholdClaims}`
  );
  console.log(
    `[persisted-replay] surfaced=${result.summary.replaySurfacedClaims} suppressed=${result.summary.replaySuppressedClaims} contradiction_drift=${result.summary.contradictionDriftClaims}`
  );
  if (result.inspectableResults.length > 0) {
    console.log("[persisted-replay] top_inspectable:");
    for (const replayResult of result.inspectableResults.slice(0, 5)) {
      console.log(
        `  - ${replayResult.claimId} outcome=${replayResult.replayOutcome} reasons=${replayResult.divergence.divergenceReasons.join(",") || "none"} missing=${replayResult.completeness.missingFields.join(",") || "none"}`
      );
    }
  }
  console.log(`[persisted-replay] artifact=${result.outputPath}`);
  console.log(`[persisted-replay] sha256=${result.artifactSha256}`);

  return result;
}

async function main(): Promise<void> {
  await runReplayPersistedPatternClaimsCli();
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
