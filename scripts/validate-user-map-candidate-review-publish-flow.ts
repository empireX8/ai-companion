import prismadb from "../lib/prismadb";
import {
  parseValidateUserMapCandidateReviewPublishCliArgs,
  runValidateUserMapCandidateReviewPublishFlow,
} from "../lib/validate-user-map-candidate-review-publish-flow";

async function main(): Promise<void> {
  const parsed = parseValidateUserMapCandidateReviewPublishCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  const report = await runValidateUserMapCandidateReviewPublishFlow({
    userId: parsed.args.userId,
    candidateId: parsed.args.candidateId,
    dryRun: parsed.args.dryRun,
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
