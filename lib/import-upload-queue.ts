import { processChatImportSession } from "./import-upload-processor";

const runningSessions = new Set<string>();

export function enqueueImportProcessing(sessionId: string): void {
  if (runningSessions.has(sessionId)) {
    return;
  }

  runningSessions.add(sessionId);
  setTimeout(() => {
    void processChatImportSession({ sessionId })
      .catch((error) => {
        console.log("[IMPORT_UPLOAD_PROCESSING_ERROR]", sessionId, error);
      })
      .finally(() => {
        runningSessions.delete(sessionId);
      });
  }, 0);
}
