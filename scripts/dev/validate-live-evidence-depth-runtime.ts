import prismadb from "../../lib/prismadb";
import {
  assessLiveEvidenceDepthFixtureSafety,
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
  parseLiveEvidenceDepthFixtureCliArgs,
  resolveLiveEvidenceDepthFixtureUserId,
  runLiveEvidenceDepthRuntimeFixture,
} from "../../lib/live-evidence-depth-runtime-fixture";

async function main(): Promise<void> {
  const parsed = parseLiveEvidenceDepthFixtureCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  const safety = assessLiveEvidenceDepthFixtureSafety();
  if (!safety.allowed) {
    console.error(
      [
        "REFUSED: live evidence depth runtime fixture is blocked by safety guards.",
        `Set ${EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV}=1 and use a local/test DATABASE_URL.`,
        `Blockers: ${safety.blockers.join(", ")}`,
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const resolvedUser = parsed.args.dryRun
    ? { ok: true as const, userId: parsed.args.userId?.trim() || "dry-run-user" }
    : resolveLiveEvidenceDepthFixtureUserId({
        userId: parsed.args.userId,
      });
  if (!resolvedUser.ok) {
    console.error(resolvedUser.message);
    process.exitCode = 1;
    return;
  }

  if (parsed.args.dryRun) {
    process.stderr.write(
      [
        "WARNING: LIVE EVIDENCE DEPTH FIXTURE DRY-RUN",
        "Safety guards passed. No DB writes will be performed.",
        "Re-run with --execute to seed → publish → read → Today gate validate.",
        "HTTP /api/today/evidence-pointers is not executed (Clerk auth); service path is used on execute.",
        "",
      ].join("\n"),
    );
  } else {
    process.stderr.write(
      [
        "WARNING: LIVE EVIDENCE DEPTH FIXTURE EXECUTE MODE",
        "This will seed deterministic dev-live-evidence-depth-* rows, publish via publishModelUpdateCandidate,",
        "validate read/linkage + Today gate (service route-equivalent), then cleanup unless --keep-data.",
        "",
      ].join("\n"),
    );
  }

  const report = await runLiveEvidenceDepthRuntimeFixture({
    userId: resolvedUser.userId,
    db: prismadb,
    dryRun: parsed.args.dryRun,
    keepData: parsed.args.keepData,
    verifyUnsafeFallback: parsed.args.verifyUnsafeFallback,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await prismadb.$disconnect();
    });
}
