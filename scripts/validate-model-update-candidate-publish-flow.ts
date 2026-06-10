import prismadb from "../lib/prismadb";
import {
  parseValidateModelUpdateCandidatePublishCliArgs,
  runValidateModelUpdateCandidatePublishFlow,
} from "../lib/validate-model-update-candidate-publish-flow";

async function main(): Promise<void> {
  const parsed = parseValidateModelUpdateCandidatePublishCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  const report = await runValidateModelUpdateCandidatePublishFlow({
    userId: parsed.args.userId,
    candidateId: parsed.args.candidateId,
    dryRun: parsed.args.dryRun,
    db: prismadb,
  });

  if (!report.found) {
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
