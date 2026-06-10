import prismadb from "../lib/prismadb";
import {
  parseSeedLowerFamilyValidationFixturesCliArgs,
  runSeedLowerFamilyValidationFixtures,
} from "../lib/seed-lower-family-validation-fixtures";

async function main(): Promise<void> {
  const parsed = parseSeedLowerFamilyValidationFixturesCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  if (parsed.args.execute) {
    process.stderr.write(
      [
        "WARNING: DEV-ONLY FIXTURE EXECUTE MODE",
        "This script will create internal-only fixture candidates through persistence helpers.",
        "devFixtureOnly=true; naturalValidation=false; no publish; no promote.",
        "Per-family transaction isolation — one family failure does not block others.",
        "",
      ].join("\n")
    );
  } else {
    process.stderr.write(
      [
        "WARNING: DEV-ONLY FIXTURE PREFLIGHT",
        "This script performs dry-run preflight only.",
        "writesPerformed=false; no candidate creation; no publish; no lifecycle mutation.",
        "naturalValidation=false; fixture-backed validation only.",
        "",
      ].join("\n")
    );
  }

  const report = await runSeedLowerFamilyValidationFixtures({
    userId: parsed.args.userId,
    families: parsed.args.families,
    execute: parsed.args.execute,
    db: prismadb,
  });

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
