import prismadb from "../lib/prismadb";
import {
  parseDiscoverInvestigationCandidateProposalCliArgs,
  runDiscoverInvestigationCandidateProposal,
} from "../lib/discover-investigation-candidate-proposal";

async function main(): Promise<void> {
  const parsed = parseDiscoverInvestigationCandidateProposalCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  const report = await runDiscoverInvestigationCandidateProposal({
    limit: parsed.args.limit,
    userIds: parsed.args.userIds,
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
