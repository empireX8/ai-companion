"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type ImportSummary = {
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  errors: string[];
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

  return (
    <div className="h-full space-y-4 p-4">
      <h1 className="text-lg font-medium">Import Your ChatGPT History</h1>
      <p className="text-sm text-muted-foreground">
        Upload your ChatGPT export and let Double analyze your cognitive patterns,
        contradictions, goals, and constraints instantly.
      </p>
      <section className="space-y-2 text-sm">
        <p className="font-medium">Double will:</p>
        <p>• Ingest your conversations</p>
        <p>• Detect contradictions and unresolved tensions</p>
        <p>• Extract long-term goals, constraints, and preferences</p>
        <p>• Build your cognitive profile automatically</p>
        <p className="text-muted-foreground">
          This gives you immediate structured insight — no manual setup required.
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
        <p>2. Double processes it incrementally in the background.</p>
        <p>3. Sessions and messages are recreated inside Double.</p>
        <p>4. Contradictions, patterns, and references are detected automatically.</p>
        <p>5. You receive a structured summary when processing completes.</p>
        <p className="text-muted-foreground">You can leave this page — processing continues safely.</p>
      </section>

      <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
        <h2 className="font-medium">How Your Data Is Handled</h2>
        <p>Double stores:</p>
        <p>• Derived insights (sessions, contradictions, references, goals)</p>
        <p>• Structured summaries built from your conversations</p>
        <p>Raw export archives are:</p>
        <p>• Retained temporarily (default: 30 days)</p>
        <p>• Automatically deleted after that period unless you upgrade</p>
        <p>You can always request deletion of imported data.</p>
      </section>

      <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
        <p className="font-medium">Free tier:</p>
        <p>• Full import</p>
        <p>• Permanent structured insights</p>
        <p>• Temporary raw archive retention</p>
        <p className="font-medium">Paid tier (future expansion copy — keep subtle):</p>
        <p>• Extended raw archive retention</p>
        <p>• Reprocessing capability</p>
        <p>• Advanced archive search</p>
        <p>• Expanded storage limits</p>
      </section>

      {loading ? (
        <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
          <h2 className="font-medium">Processing your archive…</h2>
          <p>This may take a few minutes for large exports.</p>
          <p>Double is:</p>
          <p>• Reconstructing sessions</p>
          <p>• Extracting long-term signals</p>
          <p>• Detecting contradictions</p>
          <p>• Building your cognitive profile</p>
          <p>You’ll see a summary when it finishes.</p>
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{failureText}</p> : null}

      {result ? (
        <section className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
          <h2 className="font-medium">Import Complete</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded border border-border p-2">Sessions Created: {result.sessionsCreated}</div>
            <div className="rounded border border-border p-2">Messages Imported: {result.messagesCreated}</div>
            <div className="rounded border border-border p-2">
              Contradictions Detected: {result.contradictionsCreated}
            </div>
          </div>
          <p>Your cognitive structure is now live.</p>
          <Link href="/chat" className="block underline">
            → View Sessions
          </Link>
          <Link href="/contradictions" className="block underline">
            → Review Contradictions
          </Link>
          <Link href="/audit" className="block underline">
            → Open Weekly Audit
          </Link>

          {result.errors.length > 0 ? (
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
  );
}
