import prismadb from "../lib/prismadb";
import {
  parseCleanupLowerFamilyValidationFixturesCliArgs,
  runCleanupLowerFamilyValidationFixtures,
} from "../lib/cleanup-lower-family-validation-fixtures";

async function main(): Promise<void> {
  const parsed = parseCleanupLowerFamilyValidationFixturesCliArgs(
    process.argv.slice(2)
  );
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  if (parsed.args.execute) {
    process.stderr.write(
      [
        "WARNING: DEV-ONLY FIXTURE CLEANUP EXECUTE MODE",
        "This script deletes only rows marked with [DEV FIXTURE] or known fixture IDs.",
        "Protected non-fixture intelligence is never deleted.",
        "dryRun=false only when --execute is passed.",
        "",
      ].join("\n")
    );
  } else {
    process.stderr.write(
      [
        "WARNING: DEV-ONLY FIXTURE CLEANUP DRY-RUN",
        "No rows will be deleted.",
        "Re-run with --execute to apply cleanup.",
        "",
      ].join("\n")
    );
  }

  const report = await runCleanupLowerFamilyValidationFixtures({
    execute: parsed.args.execute,
    db: prismadb,
  });

  if (
    report.proposedDeletes.investigations +
      report.proposedDeletes.fieldworkAssignments +
      report.proposedDeletes.modelUpdates +
      report.proposedDeletes.evidenceLinks ===
      0 ||
    report.unknownRows.length > 0
  ) {
    process.exitCode = 1;
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
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
