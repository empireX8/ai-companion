import { processChatImportSession } from "./import-upload-processor";
import { patternBatchOrchestrator } from "./pattern-batch-orchestrator";

const runningSessions = new Set<string>();

// P3-03: default post-import hook — triggers the canonical pattern detection
// batch pass for the user whose import just completed.
async function onImportComplete(userId: string): Promise<void> {
  await patternBatchOrchestrator.runForUser({ userId, trigger: "import" });
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
