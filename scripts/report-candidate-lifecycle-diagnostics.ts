import prismadb from "../lib/prismadb";
import {
  computeCandidateLifecycleDiagnostics,
  parseCandidateLifecycleDiagnosticsCliArgs,
} from "../lib/candidate-lifecycle-diagnostics";

async function main(): Promise<void> {
  const parsed = parseCandidateLifecycleDiagnosticsCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 1;
    return;
  }

  const { userId, staleAfterDays } = parsed.args;

  const [userMapConclusions, investigations, fieldworkAssignments, modelUpdates] =
    await Promise.all([
      prismadb.userMapConclusion.findMany({
        where: { userId },
        select: {
          id: true,
          userId: true,
          area: true,
          title: true,
          summary: true,
          candidateLifecycleStatus: true,
          supersededById: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      prismadb.investigation.findMany({
        where: { userId },
        select: {
          id: true,
          userId: true,
          title: true,
          organizingQuestion: true,
          visibility: true,
          candidateLifecycleStatus: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      prismadb.fieldworkAssignment.findMany({
        where: { userId },
        select: {
          id: true,
          userId: true,
          prompt: true,
          reason: true,
          visibility: true,
          candidateLifecycleStatus: true,
          linkedObjectType: true,
          linkedObjectId: true,
          expiresAt: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      prismadb.modelUpdate.findMany({
        where: { userId },
        select: {
          id: true,
          userId: true,
          visibility: true,
          userFacingSummary: true,
          affectedObjectType: true,
          affectedObjectId: true,
          createdAt: true,
        },
      }),
    ]);

  const report = computeCandidateLifecycleDiagnostics({
    userId,
    staleAfterDays,
    userMapConclusions,
    investigations,
    fieldworkAssignments,
    modelUpdates,
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
