/**
 * CEQR-021 post-commit freeze script (offline only).
 *
 * After the feature patch is reviewed and committed, this script:
 * - verifies clean worktree + exact feature branch
 * - records the exact feature commit SHA
 * - generates the final immutable frozen plan + SHA-256
 * - creates an UNARMED claim template only
 *
 * Does NOT: arm the claim, consume the claim, set live guards,
 * construct a provider, or execute the live runner.
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import {
  CEQR_021_BRANCH,
  CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME,
  CEQR_021_PENDING_EXECUTION_HEAD,
  CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME,
  CEQR_021_WORKTREE_PATH,
  assertCeqr021ExecutionTree,
  buildCeqr021FinalFrozenLivePlan,
  buildCeqr021PreLivePlanTemplate,
  ceqr021ReceiptDir,
  isGitWorkingTreeClean,
  readGitBranch,
  readGitHead,
  serializeCeqr021PreLivePlanTemplate,
  sha256Text,
  writeCeqr021UnarmedClaimTemplate,
} from "../lib/contradiction-schema-v4-controlled-live-proof";

function main(): void {
  const cwd = process.cwd();
  if (cwd !== CEQR_021_WORKTREE_PATH) {
    console.error(`Freeze requires cwd ${CEQR_021_WORKTREE_PATH} (got ${cwd}).`);
    process.exitCode = 3;
    return;
  }

  const branch = readGitBranch(cwd);
  if (branch !== CEQR_021_BRANCH) {
    console.error(`Freeze requires branch ${CEQR_021_BRANCH} (got ${branch}).`);
    process.exitCode = 3;
    return;
  }

  if (!isGitWorkingTreeClean(cwd)) {
    console.error("Freeze requires a clean working tree.");
    process.exitCode = 3;
    return;
  }

  const tree = assertCeqr021ExecutionTree({ cwd, phase: "pre_freeze" });
  if (!tree.ok) {
    console.error(tree.message);
    process.exitCode = 3;
    return;
  }

  const head = readGitHead(cwd);
  if (head === CEQR_021_PENDING_EXECUTION_HEAD) {
    console.error("HEAD cannot be the pending placeholder.");
    process.exitCode = 3;
    return;
  }

  const receiptDir = ceqr021ReceiptDir(cwd);
  if (!existsSync(receiptDir)) mkdirSync(receiptDir, { recursive: true });

  const template = buildCeqr021PreLivePlanTemplate(cwd);
  const { plan: frozenPlan, serialized } = buildCeqr021FinalFrozenLivePlan({
    cwd,
    committedExecutionHead: head,
  });
  const planSha256 = sha256Text(serialized);
  const planPath = join(receiptDir, CEQR_021_FINAL_FROZEN_LIVE_PLAN_FILENAME);
  if (existsSync(planPath)) {
    console.error(`Final frozen plan already exists at ${planPath}`);
    process.exitCode = 5;
    return;
  }
  writeFileSync(planPath, serialized, "utf8");

  const unarmedPath = join(receiptDir, CEQR_021_UNARMED_CLAIM_TEMPLATE_FILENAME);
  const written = writeCeqr021UnarmedClaimTemplate({
    claimPath: unarmedPath,
    frozenPlanSha256: planSha256,
    committedExecutionHead: head,
  });
  if (!written.ok) {
    console.error(written.message);
    process.exitCode = 5;
    return;
  }

  console.log("--- CEQR-021 POST-COMMIT FREEZE ---");
  console.log(JSON.stringify({
    committedExecutionHead: frozenPlan.committedExecutionHead,
    finalFrozenPlanPath: planPath,
    finalFrozenPlanSha256: planSha256,
    unarmedClaimTemplatePath: unarmedPath,
    armingState: written.claim.armingState,
    liveGuardsSet: false,
    providerConstructed: false,
    liveRunnerExecuted: false,
    productionReady: false,
  }, null, 2));
  console.log("Pre-live template identity (for comparison):");
  console.log(serializeCeqr021PreLivePlanTemplate(template).slice(0, 200) + "...");
}

main();
