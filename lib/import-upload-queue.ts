import { processChatImportSession } from "./import-upload-processor";
import {
  IMPORT_DIAGNOSTICS_UNAVAILABLE,
  combineResultErrorsWithDiagnostics,
  createEmptyImportRunDiagnostics,
  incrementReasonCodeCount,
  splitResultErrorsAndDiagnostics,
  toTopReasonCounts,
} from "./import-diagnostics";
import { patternBatchOrchestrator } from "./pattern-batch-orchestrator";
import { createPatternRerunDebugCollector } from "./pattern-rerun-debug";
import prismadb from "./prismadb";

const runningSessions = new Set<string>();

// P3-03: default post-import hook — triggers the canonical pattern detection
// batch pass for the user whose import just completed.
async function onImportComplete({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  const debugCollector = createPatternRerunDebugCollector();
  const patternResult = await patternBatchOrchestrator.runForUser({
    userId,
    trigger: "import",
    debugCollector,
  });
  const patternDiagnostics = debugCollector.buildDiagnostics();

  const session = await prismadb.importUploadSession.findUnique({
    where: { id: sessionId },
    select: { id: true, resultErrors: true },
  });
  if (!session) {
    return;
  }

  const persisted = splitResultErrorsAndDiagnostics(session.resultErrors);
  const diagnostics = persisted.diagnostics ?? createEmptyImportRunDiagnostics();
  diagnostics.patternDerivationTriggered = true;
  diagnostics.patternBehavioralAcceptedCount = patternDiagnostics.behavioralEntryCount;
  diagnostics.patternBehavioralRejectedCount = patternDiagnostics.rejectedEntryCount;
  diagnostics.topBehavioralRejectionReasons = toTopReasonCounts(
    patternDiagnostics.rejectionReasonCounts,
    5
  );
  diagnostics.patternRerunDiagnostics = patternDiagnostics;
  diagnostics.patternClaimsCreatedCount = patternResult.claimsCreated;
  diagnostics.patternClaimsSurfacedCount = IMPORT_DIAGNOSTICS_UNAVAILABLE;
  diagnostics.patternClaimsSuppressedCount = IMPORT_DIAGNOSTICS_UNAVAILABLE;
  diagnostics.suppressionReasons = IMPORT_DIAGNOSTICS_UNAVAILABLE;

  incrementReasonCodeCount(diagnostics, "pattern_derivation_triggered");
  incrementReasonCodeCount(diagnostics, "skipped_unavailable_without_refactor");
  if (patternResult.status === "failed") {
    incrementReasonCodeCount(diagnostics, "pattern_derivation_failed");
  }

  await prismadb.importUploadSession.update({
    where: { id: sessionId },
    data: {
      resultErrors: combineResultErrorsWithDiagnostics(persisted.errors, diagnostics),
    },
  });
}

export function enqueueImportProcessing(sessionId: string): void {
  if (runningSessions.has(sessionId)) {
    return;
  }

  runningSessions.add(sessionId);
  setTimeout(() => {
    void processChatImportSession({ sessionId, onImportComplete })
      .catch((error) => {
        console.log("[IMPORT_UPLOAD_PROCESSING_ERROR]", sessionId, error);
      })
      .finally(() => {
        runningSessions.delete(sessionId);
      });
  }, 0);
}
