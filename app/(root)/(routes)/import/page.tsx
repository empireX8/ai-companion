"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { ImportHistoryPanel } from "./_components/ImportHistoryPanel";

type ImportSummary = {
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  errors: string[];
};

type UploadStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "processing"
  | "complete"
  | "failed"
  | "expired";

type UploadHistoryItem = {
  id: string;
  filename: string;
  status: UploadStatus;
  createdAt: string;
  finishedAt: string | null;
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  error: string | null;
};

type UploadHistoryAggregates = {
  candidateMemories: number;
  candidateTensions: number;
};

type UploadHistoryResponse = {
  items: UploadHistoryItem[];
  aggregates?: UploadHistoryAggregates;
};

type UploadStatusResponse = {
  status: "pending" | "uploading" | "uploaded" | "processing" | "complete" | "failed" | "expired";
  receivedChunks: number;
  totalChunks: number;
  processingProgress: number;
  processedConversations: number;
  processedMessages: number;
  resultSummary: ImportSummary | null;
  missingChunkIndexes: number[];
  error: string | null;
};

const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

const IMPORT_SESSION_STORAGE_KEY = "double:lastImportSessionId";

function saveSessionIdToStorage(id: string) {
  try {
    localStorage.setItem(IMPORT_SESSION_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

function loadSessionIdFromStorage(): string | null {
  try {
    return localStorage.getItem(IMPORT_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearSessionIdFromStorage() {
  try {
    localStorage.removeItem(IMPORT_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const stored = loadSessionIdFromStorage();
    if (stored) {
      setSessionId(stored);
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadCounts, setUploadCounts] = useState<{ uploaded: number; total: number }>({
    uploaded: 0,
    total: 0,
  });
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<UploadHistoryItem[]>([]);
  const [historyAggregates, setHistoryAggregates] = useState<UploadHistoryAggregates | null>(null);

  const loadImportHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/upload/history?limit=20", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as UploadHistoryResponse;
      setHistoryItems(payload.items ?? []);
      setHistoryAggregates(payload.aggregates ?? null);
    } catch {
      // best-effort for persistent summary
    }
  }, []);

  useEffect(() => {
    void loadImportHistory();
  }, [loadImportHistory]);

  const fileSizeMb = file ? (file.size / (1024 * 1024)).toFixed(2) : null;

  const failureText = (() => {
    if (!error) {
      return null;
    }

    const normalized = error.toLowerCase();
    if (
      normalized.includes("corrupt") ||
      normalized.includes("invalid zip") ||
      normalized.includes("encrypted")
    ) {
      return "This file appears to be invalid or encrypted. Please upload a standard ChatGPT export ZIP.";
    }

    if (
      normalized.includes("too large") ||
      normalized.includes("limit") ||
      normalized.includes("payload")
    ) {
      return "This export exceeds the current upload limit. We are processing large imports incrementally — try again or contact support if the issue persists.";
    }

    return error;
  })();

  const pollUntilDone = async (activeSessionId: string) => {
    while (true) {
      const statusResponse = await fetch(`/api/upload/status?sessionId=${encodeURIComponent(activeSessionId)}`);
      const statusPayload = (await statusResponse.json()) as UploadStatusResponse | { error?: string };

      if (!statusResponse.ok) {
        throw new Error((statusPayload as { error?: string }).error ?? "Failed to fetch import status");
      }

      const typedStatus = statusPayload as UploadStatusResponse;
      setUploadCounts({
        uploaded: typedStatus.receivedChunks,
        total: typedStatus.totalChunks,
      });

      if (typedStatus.status === "complete") {
        setResult(
          typedStatus.resultSummary ?? {
            sessionsCreated: 0,
            messagesCreated: 0,
            contradictionsCreated: 0,
            errors: [],
          }
        );
        setStatusText("Complete");
        clearSessionIdFromStorage();
        await loadImportHistory();
        return;
      }

      if (typedStatus.status === "failed" || typedStatus.status === "expired") {
        clearSessionIdFromStorage();
        throw new Error(typedStatus.error ?? "Import failed");
      }

      setStatusText(`Processing (${typedStatus.processingProgress}%)…`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  };

  const uploadChunkWithRetry = async ({
    activeSessionId,
    chunkIndex,
    chunk,
  }: {
    activeSessionId: string;
    chunkIndex: number;
    chunk: Blob;
  }) => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt += 1) {
      try {
        const checksum = await sha256Hex(chunk);
        const response = await fetch("/api/upload/chunk", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Session-Id": activeSessionId,
            "X-Chunk-Index": String(chunkIndex),
            "X-Checksum": checksum,
          },
          body: chunk,
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? `Chunk ${chunkIndex} upload failed`);
        }

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Chunk upload failed");
        if (attempt < MAX_CHUNK_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      }
    }

    throw lastError ?? new Error(`Chunk ${chunkIndex} upload failed`);
  };

  const runImport = async () => {
    if (loading) {
      return;
    }

    if (!file && sessionId) {
      // No file selected, just poll server status
      await pollUntilDone(sessionId);
      return;
    }

    if (!file) {
      return;
    }

    setLoading(true);
    setStatusText("Choosing file…");
    setResult(null);
    setError(null);

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const activeSessionId =
        sessionId ??
        (
          await (async () => {
            const initResponse = await fetch("/api/upload/init", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file.name,
                contentType: file.type || "application/octet-stream",
                bytesTotal: file.size,
                chunkSize: CHUNK_SIZE,
                totalChunks,
              }),
            });

            const initPayload = (await initResponse.json()) as { sessionId?: string; error?: string };
            if (!initResponse.ok || !initPayload.sessionId) {
              throw new Error(initPayload.error ?? "Failed to initialize upload session");
            }

            setSessionId(initPayload.sessionId);
            saveSessionIdToStorage(initPayload.sessionId);
            return initPayload.sessionId;
          })()
        );

      const statusResponse = await fetch(
        `/api/upload/status?sessionId=${encodeURIComponent(activeSessionId)}`
      );
      const statusPayload = (await statusResponse.json()) as UploadStatusResponse | { error?: string };
      if (!statusResponse.ok) {
        throw new Error((statusPayload as { error?: string }).error ?? "Failed to read upload status");
      }

      const typedStatus = statusPayload as UploadStatusResponse;
      const missingChunkIndexes =
        typedStatus.totalChunks === totalChunks
          ? typedStatus.missingChunkIndexes
          : Array.from({ length: totalChunks }, (_, index) => index);

      setUploadCounts({
        uploaded: typedStatus.receivedChunks,
        total: totalChunks,
      });

      for (const chunkIndex of missingChunkIndexes) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        setStatusText(`Uploading (${chunkIndex + 1}/${totalChunks})…`);
        await uploadChunkWithRetry({
          activeSessionId,
          chunkIndex,
          chunk,
        });
        setUploadCounts((prev) => ({
          uploaded: Math.min(prev.uploaded + 1, totalChunks),
          total: totalChunks,
        }));
      }

      setStatusText("Importing…");
      const finalizeResponse = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId }),
      });
      const finalizePayload = (await finalizeResponse.json()) as { error?: string };
      if (!finalizeResponse.ok) {
        throw new Error(finalizePayload.error ?? "Failed to finalize upload");
      }

      await pollUntilDone(activeSessionId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Import failed");
      setStatusText(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runImport();
  };

  const latestCompletedImport =
    historyItems.find((item) => item.status === "complete") ?? null;
  const summary = result
    ? {
        sessionsCreated: result.sessionsCreated,
        messagesCreated: result.messagesCreated,
        contradictionsCreated: result.contradictionsCreated,
      }
    : latestCompletedImport
      ? {
          sessionsCreated: latestCompletedImport.sessionsCreated,
          messagesCreated: latestCompletedImport.messagesCreated,
          contradictionsCreated: latestCompletedImport.contradictionsCreated,
        }
      : null;
  const completedAt =
    latestCompletedImport?.finishedAt ?? latestCompletedImport?.createdAt ?? null;
  const candidateMemories = historyAggregates?.candidateMemories;
  const candidateTensions = historyAggregates?.candidateTensions;

  return (
    <>
      <DomainListSlot>
        <ImportHistoryPanel />
      </DomainListSlot>
      <div className="h-full space-y-4 p-4">
      <h1 className="text-lg font-medium">Import Your ChatGPT History</h1>
      <p className="text-sm text-muted-foreground">
        Upload your ChatGPT export to bring in your conversation history and let MindLab
        surface memories and patterns automatically.
      </p>
      <section className="space-y-2 text-sm">
        <p className="font-medium">What happens during import:</p>
        <p>• Your conversations are ingested</p>
        <p>• Recurring patterns and themes are detected</p>
        <p>• Long-term goals, constraints, and preferences are extracted</p>
        <p>• Candidate memories are queued for your review</p>
        <p className="text-muted-foreground">
          Nothing is confirmed until you review it — no changes happen without your approval.
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border bg-card p-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium">Supported formats:</p>
          <p>ChatGPT export `.zip` (recommended) or `conversations.json`</p>
          <p>You do not need to extract the file yourself.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json,application/zip,.zip"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setSessionId(null);
            clearSessionIdFromStorage();
            setUploadCounts({ uploaded: 0, total: 0 });
            setResult(null);
            setError(null);
            setStatusText(null);
          }}
          className="hidden"
        />
        {file ? (
          <p className="text-sm text-muted-foreground">
            {file.name} ({fileSizeMb} MB)
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Choose file
          </button>
          <button
            type="submit"
            disabled={!file || loading}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
          >
            Start import
          </button>
          {sessionId && !loading && statusText !== "Complete" ? (
            <button
              type="button"
              onClick={() => {
                void runImport();
              }}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              {statusText?.startsWith("Uploading")
                ? "Continue Upload"
                : statusText?.startsWith("Processing")
                ? "Check Status"
                : "Resume"}
            </button>
          ) : null}
        </div>
        {statusText ? <p className="text-sm font-medium">{statusText}</p> : null}
        {loading ? (
          <p className="text-xs text-muted-foreground">
            Please keep this tab open until the import finishes.
          </p>
        ) : null}
        {uploadCounts.total > 0 ? (
          <p className="text-sm text-muted-foreground">
            Uploading ({uploadCounts.uploaded}/{uploadCounts.total})
          </p>
        ) : null}
      </form>

      <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
        <p className="font-medium">When you upload a file:</p>
        <p>1. The archive is securely stored.</p>
        <p>2. It is processed incrementally in the background.</p>
        <p>3. Sessions and messages are recreated inside MindLab.</p>
        <p>4. Patterns and memories are detected automatically.</p>
        <p>5. You receive a structured summary when processing completes.</p>
        <p className="text-muted-foreground">You can leave this page — processing continues safely.</p>
      </section>

      <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
        <h2 className="font-medium">How Your Data Is Handled</h2>
        <p>MindLab stores:</p>
        <p>• Derived insights (sessions, memories, patterns, goals)</p>
        <p>• Structured summaries built from your conversations</p>
        <p>Raw export archives are:</p>
        <p>• Retained temporarily for reprocessing purposes</p>
        <p>• Automatically deleted after a short retention period</p>
        <p>You can always request deletion of imported data.</p>
      </section>

      {loading ? (
        <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
          <h2 className="font-medium">Processing your archive…</h2>
          <p>This may take a few minutes for large exports.</p>
          <p>MindLab is:</p>
          <p>• Reconstructing sessions</p>
          <p>• Extracting long-term signals</p>
          <p>• Detecting patterns</p>
          <p>• Identifying candidate memories</p>
          <p>You will see a summary when it finishes.</p>
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{failureText}</p> : null}

      {summary ? (
        <section className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
          <h2 className="font-medium">{result ? "Import Complete" : "Latest import"}</h2>
          <p className="text-muted-foreground">
            {result
              ? "Most recent completed import:"
              : "This is your most recent completed import. Follow-up actions below are separate from upload."}
            {completedAt ? ` ${formatCompletedAt(completedAt)}` : result ? " just now" : ""}
          </p>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded border border-border p-2">Sessions Imported: {summary.sessionsCreated}</div>
            <div className="rounded border border-border p-2">Messages Imported: {summary.messagesCreated}</div>
            <div className="rounded border border-border p-2">
              Tensions Detected: {summary.contradictionsCreated}
            </div>
          </div>

          {(typeof candidateMemories === "number" || typeof candidateTensions === "number") ? (
            <div className="space-y-2 rounded border border-border p-3">
              <p className="font-medium text-foreground">Next steps</p>
              {typeof candidateTensions === "number" && candidateTensions > 0 ? (
                <Link href="/contradictions/candidates" className="block text-primary underline underline-offset-2">
                  → Review candidate tensions
                </Link>
              ) : null}
              {typeof candidateMemories === "number" && candidateMemories > 0 ? (
                <Link href="/references/candidates" className="block text-primary underline underline-offset-2">
                  → Review candidate memories
                </Link>
              ) : null}
              {typeof candidateMemories === "number" &&
              typeof candidateTensions === "number" &&
              candidateMemories === 0 &&
              candidateTensions === 0 ? (
                <p className="text-muted-foreground">No candidate items are waiting for review right now.</p>
              ) : null}
            </div>
          ) : null}

          <p className="pt-1 font-medium text-foreground">Explore</p>
          <Link href="/chat" className="block underline underline-offset-2">
            → View imported sessions / chat
          </Link>
          {summary.contradictionsCreated > 0 ? (
            <Link href="/contradictions" className="block underline underline-offset-2">
              → View tensions
            </Link>
          ) : null}
          <p className="pt-2 text-muted-foreground/70">
            Not sure what candidates, memories, or tensions mean?{" "}
            <Link href="/help" className="text-primary underline-offset-2 hover:underline">
              Read how it works →
            </Link>
          </p>

          {result?.errors.length ? (
            <div>
              <p className="font-medium">Errors</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {result.errors.map((item, index) => (
                  <li key={`${item}-${index}`} className="text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
    </>
  );
}
