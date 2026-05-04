"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Upload,
  FileText,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { PageHeader, SectionLabel } from "@/components/AppShell";

type UploadStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "processing"
  | "complete"
  | "failed"
  | "expired";

type ImportHistoryItem = {
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

type UploadStatusPayload = {
  status: UploadStatus;
  receivedChunks: number;
  totalChunks: number;
  processingProgress: number;
  processedConversations: number;
  processedMessages: number;
  resultSummary: {
    sessionsCreated: number;
    messagesCreated: number;
    contradictionsCreated: number;
    errors: string[];
  } | null;
  missingChunkIndexes: number[];
  error: string | null;
};

type UploadProgressState = {
  sessionId: string;
  filename: string;
  status: UploadStatus;
  progress: number;
  detail: string;
  error: string | null;
};

const CHUNK_BYTES = 2 * 1024 * 1024;

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(date);
}

function uploadStatusLabel(status: UploadStatus): string {
  if (status === "pending") return "Pending";
  if (status === "uploading") return "Uploading...";
  if (status === "uploaded") return "Uploaded";
  if (status === "processing") return "Processing...";
  if (status === "complete") return "Complete";
  if (status === "failed") return "Failed";
  return "Expired";
}

function uploadStatusColor(status: UploadStatus): string {
  if (status === "complete") return "text-cyan";
  if (status === "failed" || status === "expired") return "text-[hsl(12_80%_64%)]";
  return "text-meta";
}

function parseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Upload failed.";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }

  return payload as T;
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await fetch("/api/upload/history", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load import history.");
      }

      const payload = (await response.json()) as { items: ImportHistoryItem[] };
      setHistory(payload.items);
    } catch (error) {
      setHistory([]);
      setHistoryError(parseErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const pollUploadStatus = useCallback(async (sessionId: string, filename: string) => {
    let done = false;

    while (!done) {
      const response = await fetch(
        `/api/upload/status?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const payload = (await response.json()) as UploadStatusPayload | { error?: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Could not read upload status.");
      }

      const statusPayload = payload as UploadStatusPayload;

      const progress =
        statusPayload.status === "processing"
          ? Math.max(75, statusPayload.processingProgress)
          : statusPayload.status === "complete"
            ? 100
            : statusPayload.totalChunks > 0
              ? Math.round((statusPayload.receivedChunks / statusPayload.totalChunks) * 75)
              : 0;

      const detail =
        statusPayload.status === "processing"
          ? `Processing ${statusPayload.processedMessages.toLocaleString("en-GB")} messages`
          : statusPayload.status === "complete"
            ? `Complete · ${statusPayload.resultSummary?.sessionsCreated ?? 0} sessions imported`
            : statusPayload.status === "failed"
              ? statusPayload.error ?? "Processing failed"
              : `Uploaded ${statusPayload.receivedChunks}/${statusPayload.totalChunks} chunks`;

      setUploadState({
        sessionId,
        filename,
        status: statusPayload.status,
        progress,
        detail,
        error: statusPayload.error,
      });

      if (
        statusPayload.status === "complete" ||
        statusPayload.status === "failed" ||
        statusPayload.status === "expired"
      ) {
        done = true;
      } else {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 1200);
        });
      }
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadState({
        sessionId: "",
        filename: file.name,
        status: "pending",
        progress: 0,
        detail: "Preparing upload",
        error: null,
      });

      try {
        const totalChunks = Math.ceil(file.size / CHUNK_BYTES);
        const initPayload = await postJson<{ sessionId: string }>("/api/upload/init", {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          bytesTotal: file.size,
          chunkSize: CHUNK_BYTES,
          totalChunks,
        });

        setUploadState({
          sessionId: initPayload.sessionId,
          filename: file.name,
          status: "uploading",
          progress: 0,
          detail: `Uploading 0/${totalChunks} chunks`,
          error: null,
        });

        for (let index = 0; index < totalChunks; index += 1) {
          const start = index * CHUNK_BYTES;
          const end = Math.min(start + CHUNK_BYTES, file.size);
          const chunk = file.slice(start, end);

          const response = await fetch("/api/upload/chunk", {
            method: "POST",
            headers: {
              "x-session-id": initPayload.sessionId,
              "x-chunk-index": String(index),
              "Content-Type": "application/octet-stream",
            },
            body: chunk,
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(payload?.error ?? `Chunk ${index + 1} failed.`);
          }

          const progress = Math.round(((index + 1) / totalChunks) * 75);
          setUploadState({
            sessionId: initPayload.sessionId,
            filename: file.name,
            status: "uploading",
            progress,
            detail: `Uploading ${index + 1}/${totalChunks} chunks`,
            error: null,
          });
        }

        await postJson<{ status: "processing" }>("/api/upload/finalize", {
          sessionId: initPayload.sessionId,
        });

        setUploadState({
          sessionId: initPayload.sessionId,
          filename: file.name,
          status: "processing",
          progress: 80,
          detail: "Processing upload",
          error: null,
        });

        await pollUploadStatus(initPayload.sessionId, file.name);
        await refreshHistory();
      } catch (error) {
        setUploadState((current) => ({
          sessionId: current?.sessionId ?? "",
          filename: current?.filename ?? file.name,
          status: "failed",
          progress: current?.progress ?? 0,
          detail: "Upload failed",
          error: parseErrorMessage(error),
        }));
      } finally {
        setUploading(false);
      }
    },
    [pollUploadStatus, refreshHistory]
  );

  const onSelectFile = useCallback(
    (file: File | null) => {
      if (!file || uploading) {
        return;
      }

      void uploadFile(file);
    },
    [uploadFile, uploading]
  );

  const activeUpload = useMemo(() => uploadState, [uploadState]);

  return (
    <div
      className="px-12 py-10 max-w-[820px] mx-auto animate-fade-in"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (uploading) {
          return;
        }

        const file = event.dataTransfer.files?.[0] ?? null;
        onSelectFile(file);
      }}
    >
      <Link href="/account" className="inline-flex items-center gap-1.5 label-meta hover:text-white mb-6">
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Account
      </Link>
      <PageHeader eyebrow="Account · Sync" title="Import" meta="Bring external conversation history into MindLab" />

      <input
        ref={inputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          onSelectFile(file);
        }}
      />

      <section className="card-focal p-10 text-center mb-8">
        <div className="h-12 w-12 rounded-xl bg-[hsl(187_100%_50%/0.1)] border border-[hsl(187_100%_50%/0.3)] flex items-center justify-center mx-auto mb-4">
          <Upload className="h-5 w-5 text-cyan" strokeWidth={1.5} />
        </div>
        <div className="text-[16px] font-medium mb-1.5">Upload an export</div>
        <div className="text-[13.5px] text-meta max-w-[480px] mx-auto leading-relaxed mb-5">
          ChatGPT export (.zip), JSON export, or supported conversation archives. Uploads are chunked and processed on the backend.
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-5 h-10 rounded-md bg-cyan text-black text-[13px] font-medium disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Choose file"}
        </button>
        <div className="label-meta mt-4">or drop a file anywhere on this page</div>
      </section>

      <SectionLabel>In progress</SectionLabel>
      {activeUpload ? (
        <div className="card-surfaced p-5 mb-8">
          <div className="flex items-center gap-3 mb-3">
            {activeUpload.status === "failed" ? (
              <AlertTriangle className="h-4 w-4 text-[hsl(12_80%_64%)]" strokeWidth={1.5} />
            ) : activeUpload.status === "complete" ? (
              <Check className="h-4 w-4 text-cyan" strokeWidth={2} />
            ) : (
              <Loader2 className="h-4 w-4 text-cyan animate-spin" strokeWidth={1.5} />
            )}
            <div className="flex-1">
              <div className="text-[13.5px] truncate">{activeUpload.filename}</div>
              <div className={`label-meta mt-0.5 ${uploadStatusColor(activeUpload.status)}`}>
                {activeUpload.detail}
              </div>
              {activeUpload.error ? (
                <div className="label-meta mt-1 text-[hsl(12_80%_64%)]">{activeUpload.error}</div>
              ) : null}
            </div>
            <div className="font-mono text-[12.5px] text-cyan">{activeUpload.progress}%</div>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-cyan transition-[width]" style={{ width: `${Math.max(0, Math.min(100, activeUpload.progress))}%` }} />
          </div>
        </div>
      ) : (
        <div className="card-standard p-4 mb-8 text-[13px] text-meta">No active imports.</div>
      )}

      <SectionLabel>Import history</SectionLabel>
      {historyLoading ? (
        <div className="card-standard p-4 mb-8 text-[13px] text-meta">Loading import history...</div>
      ) : historyError ? (
        <div className="card-standard p-4 mb-8 text-[13px] text-[hsl(12_80%_64%)]">{historyError}</div>
      ) : history.length === 0 ? (
        <div className="card-standard p-4 mb-8 text-[13px] text-meta">No imports yet.</div>
      ) : (
        <div className="card-standard divide-y divide-white/[0.05] mb-8">
          {history.map((item) => (
            <div key={item.id} className="px-5 py-3.5 flex items-center gap-4">
              <FileText className="h-4 w-4 text-meta" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] truncate">{item.filename}</div>
                <div className="label-meta mt-0.5">
                  {formatHistoryDate(item.createdAt)} · {item.messagesCreated.toLocaleString("en-GB")} messages
                </div>
              </div>
              <div className={`label-meta inline-flex items-center gap-1.5 ${uploadStatusColor(item.status)}`}>
                {item.status === "complete" ? <Check className="h-3 w-3" strokeWidth={2} /> : null}
                {uploadStatusLabel(item.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-standard p-5">
        <div className="label-meta mb-2">What happens to imported material</div>
        <p className="text-[13.5px] leading-relaxed text-[hsl(216_11%_75%)]">
          Imported conversations are added to your Library as Explore-style sessions. Repeated language, themes, and tensions are surfaced over time and may appear in Patterns, Tensions, and Timeline. Nothing is shown publicly.
        </p>
      </div>
    </div>
  );
}
