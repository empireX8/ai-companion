import prismadb from "../lib/prismadb";
import { backfillImportedContradictionsForUser } from "../lib/contradiction-backfill";

type CliArgs = {
  userIds: string[];
  allUsers: boolean;
  limit?: number;
};

function parseArgs(argv: string[]): CliArgs {
  const userIds: string[] = [];
  let allUsers = false;
  let limit: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;

    if (arg === "--user-id" && argv[i + 1]) {
      userIds.push(argv[i + 1]!);
      i += 1;
      continue;
    }

    if (arg === "--all-users") {
      allUsers = true;
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

  return { userIds, allUsers, limit };
}

async function resolveTargetUserIds(args: CliArgs): Promise<string[]> {
  if (args.allUsers) {
    const rows = await prismadb.session.findMany({
      where: { origin: "IMPORTED_ARCHIVE" },
      select: { userId: true },
      orderBy: { userId: "asc" },
    });

    return [...new Set(rows.map((row) => row.userId))];
  }

  return [...new Set(args.userIds)];
}

export async function runBackfillImportedContradictionsCli(
  argv = process.argv.slice(2)
) {
  const args = parseArgs(argv);
  const userIds = await resolveTargetUserIds(args);

  if (userIds.length === 0) {
    throw new Error(
      "Provide --user-id <id> or --all-users to run the contradiction backfill."
    );
  }

  const total = {
    usersProcessed: 0,
    messagesScanned: 0,
    messagesWithDetections: 0,
    nodesCreated: 0,
    evidenceCreated: 0,
    reusedExistingNodes: 0,
    duplicateEvidenceSkips: 0,
    terminalCollisionSkips: 0,
  };

  for (const userId of userIds) {
    const result = await backfillImportedContradictionsForUser({
      userId,
      limit: args.limit,
      db: prismadb,
    });

    total.usersProcessed += 1;
    total.messagesScanned += result.messagesScanned;
    total.messagesWithDetections += result.messagesWithDetections;
    total.nodesCreated += result.nodesCreated;
    total.evidenceCreated += result.evidenceCreated;
    total.reusedExistingNodes += result.reusedExistingNodes;
    total.duplicateEvidenceSkips += result.duplicateEvidenceSkips;
    total.terminalCollisionSkips += result.terminalCollisionSkips;

    console.log(
      `[contradiction-backfill] user=${userId} scanned=${result.messagesScanned} with_detections=${result.messagesWithDetections} nodes_created=${result.nodesCreated} evidence_created=${result.evidenceCreated} reused=${result.reusedExistingNodes} duplicate_evidence_skips=${result.duplicateEvidenceSkips} terminal_collision_skips=${result.terminalCollisionSkips}`
    );
  }

  console.log(
    `[contradiction-backfill] total users=${total.usersProcessed} scanned=${total.messagesScanned} with_detections=${total.messagesWithDetections} nodes_created=${total.nodesCreated} evidence_created=${total.evidenceCreated} reused=${total.reusedExistingNodes} duplicate_evidence_skips=${total.duplicateEvidenceSkips} terminal_collision_skips=${total.terminalCollisionSkips}`
  );

  return total;
}

async function main(): Promise<void> {
  await runBackfillImportedContradictionsCli();
  await prismadb.$disconnect();
}

if (require.main === module) {
  main().catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await prismadb.$disconnect().catch(() => undefined);
    process.exitCode = 1;
  });
}
