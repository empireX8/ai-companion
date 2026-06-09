import prismadb from "../lib/prismadb";
import {
  parseDiscoverCandidateFamilyProposalsCliArgs,
  runDiscoverCandidateFamilyProposals,
} from "../lib/discover-candidate-family-proposals";

async function main(): Promise<void> {
  const parsed = parseDiscoverCandidateFamilyProposalsCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  const report = await runDiscoverCandidateFamilyProposals({
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
