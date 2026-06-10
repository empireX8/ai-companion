import prismadb from "../lib/prismadb";
import {
  parseSeedLowerFamilyValidationFixturesCliArgs,
  runSeedLowerFamilyValidationFixturesPreflight,
} from "../lib/seed-lower-family-validation-fixtures";

async function main(): Promise<void> {
  const parsed = parseSeedLowerFamilyValidationFixturesCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  process.stderr.write(
    [
      "WARNING: DEV-ONLY FIXTURE PREFLIGHT",
      "This script performs dry-run preflight only.",
      "writesPerformed=false; no candidate creation; no publish; no lifecycle mutation.",
      "naturalValidation=false; fixture-backed validation only.",
      "",
    ].join("\n")
  );

  const report = await runSeedLowerFamilyValidationFixturesPreflight({
    userId: parsed.args.userId,
    families: parsed.args.families,
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
