"use client";

import { FormEvent, useState } from "react";

type ImportSummary = {
  sessionsCreated: number;
  messagesCreated: number;
  contradictionsCreated: number;
  errors: string[];
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || loading) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/chatgpt", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as ImportSummary;
      if (!response.ok) {
        setResult(payload);
        setError(payload.errors?.[0] ?? "Import failed");
        return;
      }

      setResult(payload);
    } catch {
      setError("Import failed");
    } finally {
      setLoading(false);
    }
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
          type="file"
          accept="application/json,.json,application/zip,.zip"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm"
          disabled={loading}
        />
        {file ? (
          <p className="text-sm text-muted-foreground">
            {file.name} ({fileSizeMb} MB)
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Upload & Import"}
        </button>
      </form>

      <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
        <p className="font-medium">When you upload a file:</p>
        <p>1. The archive is securely stored.</p>
        <p>2. Double processes it incrementally in the background.</p>
        <p>3. Sessions and messages are recreated inside Double.</p>
        <p>4. Contradictions, patterns, and references are detected automatically.</p>
        <p>5. You receive a structured summary when processing completes.</p>
        <p className="text-muted-foreground">
          You can leave this page — processing continues safely.
        </p>
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
            <div className="rounded border border-border p-2">
              Sessions Created: {result.sessionsCreated}
            </div>
            <div className="rounded border border-border p-2">
              Messages Imported: {result.messagesCreated}
            </div>
            <div className="rounded border border-border p-2">
              Contradictions Detected: {result.contradictionsCreated}
            </div>
          </div>
          <p>Your cognitive structure is now live.</p>
          <a href="/chat" className="block underline">
            → View Sessions
          </a>
          <a href="/contradictions" className="block underline">
            → Review Contradictions
          </a>
          <a href="/audit" className="block underline">
            → Open Weekly Audit
          </a>

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
