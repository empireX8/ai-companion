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
      <h1 className="text-lg font-medium">Import Chat Exports</h1>
      <p className="text-sm text-muted-foreground">
        Upload a ChatGPT JSON export. ZIP files are not supported in v1.
      </p>

      <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border bg-card p-4">
        <input
          type="file"
          accept=".json,application/json"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Importing..." : "Import"}
        </button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <section className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
          <h2 className="font-medium">Import summary</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded border border-border p-2">
              sessionsCreated: {result.sessionsCreated}
            </div>
            <div className="rounded border border-border p-2">
              messagesCreated: {result.messagesCreated}
            </div>
            <div className="rounded border border-border p-2">
              contradictionsCreated: {result.contradictionsCreated}
            </div>
          </div>

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
