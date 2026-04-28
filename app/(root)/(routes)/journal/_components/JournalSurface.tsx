"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { BookText, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  JOURNAL_BODY_MAX_LENGTH,
  JOURNAL_TITLE_MAX_LENGTH,
  toJournalDisplayDate,
  toJournalPreview,
  type JournalEntryView,
} from "@/lib/journal-ui";

type EntryPayload = {
  title: string;
  body: string;
  authoredAt: string | null;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toApiPayload(
  title: string,
  body: string,
  authoredAtValue: string
): EntryPayload {
  return {
    title,
    body,
    authoredAt: authoredAtValue.trim().length > 0 ? new Date(authoredAtValue).toISOString() : null,
  };
}

async function fetchEntries(): Promise<JournalEntryView[]> {
  const response = await fetch("/api/journal/entries", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load entries.");
  }

  return (await response.json()) as JournalEntryView[];
}

async function fetchEntry(id: string): Promise<JournalEntryView> {
  const response = await fetch(`/api/journal/entries/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Entry not found.");
    }
    throw new Error("Failed to load entry.");
  }

  return (await response.json()) as JournalEntryView;
}

export function JournalSurface() {
  const [entries, setEntries] = useState<JournalEntryView[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newAuthoredAt, setNewAuthoredAt] = useState("");
  const [creatingEntry, setCreatingEntry] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryView | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editAuthoredAt, setEditAuthoredAt] = useState("");
  const [savingSelected, setSavingSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadEntries() {
    setLoadingEntries(true);
    setEntriesError(null);

    try {
      const data = await fetchEntries();
      setEntries(data);
    } catch (error) {
      setEntriesError(error instanceof Error ? error.message : "Failed to load entries.");
    } finally {
      setLoadingEntries(false);
    }
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  async function openEntry(id: string) {
    if (loadingSelected || deletingSelected || savingSelected) {
      return;
    }

    setSelectedEntryId(id);
    setSelectedError(null);
    setSaveError(null);
    setLoadingSelected(true);

    try {
      const entry = await fetchEntry(id);
      setSelectedEntry(entry);
      setEditTitle(entry.title ?? "");
      setEditBody(entry.body);
      setEditAuthoredAt(toDatetimeLocalValue(entry.authoredAt));
    } catch (error) {
      setSelectedEntry(null);
      setSelectedError(error instanceof Error ? error.message : "Failed to load entry.");
    } finally {
      setLoadingSelected(false);
    }
  }

  const canCreateEntry = !creatingEntry && newBody.trim().length > 0;

  async function onCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreateEntry) {
      return;
    }

    setCreatingEntry(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/journal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toApiPayload(newTitle, newBody, newAuthoredAt)),
      });

      const payload = (await response.json()) as JournalEntryView | { error?: string };
      if (!response.ok) {
        setCreateError(
          typeof payload === "object" && payload && "error" in payload && payload.error
            ? payload.error
            : "Could not create entry."
        );
        return;
      }

      const created = payload as JournalEntryView;
      setEntries((current) => [created, ...current]);
      setSelectedEntryId(created.id);
      setSelectedEntry(created);
      setEditTitle(created.title ?? "");
      setEditBody(created.body);
      setEditAuthoredAt(toDatetimeLocalValue(created.authoredAt));
      setNewTitle("");
      setNewBody("");
      setNewAuthoredAt("");
    } catch {
      setCreateError("Could not create entry.");
    } finally {
      setCreatingEntry(false);
    }
  }

  const canSaveSelected =
    !!selectedEntry && !savingSelected && !deletingSelected && editBody.trim().length > 0;

  async function onSaveSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEntryId || !canSaveSelected) {
      return;
    }

    setSavingSelected(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/journal/entries/${encodeURIComponent(selectedEntryId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toApiPayload(editTitle, editBody, editAuthoredAt)),
      });

      const payload = (await response.json()) as JournalEntryView | { error?: string };
      if (!response.ok) {
        setSaveError(
          typeof payload === "object" && payload && "error" in payload && payload.error
            ? payload.error
            : "Could not save entry."
        );
        return;
      }

      const updated = payload as JournalEntryView;
      setSelectedEntry(updated);
      setEntries((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      setSaveError("Could not save entry.");
    } finally {
      setSavingSelected(false);
    }
  }

  async function onDeleteSelected() {
    if (!selectedEntryId || deletingSelected || savingSelected) {
      return;
    }

    setDeletingSelected(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/journal/entries/${encodeURIComponent(selectedEntryId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setSaveError("Could not delete entry.");
        return;
      }

      setEntries((current) => current.filter((item) => item.id !== selectedEntryId));
      setSelectedEntryId(null);
      setSelectedEntry(null);
      setEditTitle("");
      setEditBody("");
      setEditAuthoredAt("");
    } catch {
      setSaveError("Could not delete entry.");
    } finally {
      setDeletingSelected(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookText className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Journal</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Save personal entries. Newest entries appear first.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-4">
            <form
              onSubmit={onCreateEntry}
              className="space-y-3 rounded-lg border border-border/40 bg-card px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-foreground">New entry</h2>
                <Button type="submit" size="sm" disabled={!canCreateEntry}>
                  {creatingEntry ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Save entry
                    </span>
                  )}
                </Button>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="journal-new-title" className="text-xs text-muted-foreground">
                  Title (optional)
                </label>
                <Input
                  id="journal-new-title"
                  value={newTitle}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTitle(event.target.value)}
                  maxLength={JOURNAL_TITLE_MAX_LENGTH}
                  placeholder="Entry title"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="journal-new-authored-at" className="text-xs text-muted-foreground">
                  Authored at (optional)
                </label>
                <Input
                  id="journal-new-authored-at"
                  type="datetime-local"
                  value={newAuthoredAt}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setNewAuthoredAt(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="journal-new-body" className="text-xs text-muted-foreground">
                    Body
                  </label>
                  <span className="text-[11px] text-muted-foreground/70">
                    {newBody.length}/{JOURNAL_BODY_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="journal-new-body"
                  rows={6}
                  value={newBody}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNewBody(event.target.value)}
                  maxLength={JOURNAL_BODY_MAX_LENGTH}
                  placeholder="Write your entry"
                  className="min-h-[140px] resize-y"
                />
              </div>

              {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
            </form>

            <section className="space-y-2">
              <div>
                <h2 className="text-sm font-medium text-foreground">Recent entries</h2>
                <p className="text-xs text-muted-foreground">Newest first.</p>
              </div>

              {loadingEntries ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-lg bg-muted/50" />
                  ))}
                </div>
              ) : entriesError ? (
                <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">{entriesError}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => void loadEntries()}>
                    Retry
                  </Button>
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/40 px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Save your first entry to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const isActive = selectedEntryId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => void openEntry(entry.id)}
                        className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                          isActive
                            ? "border-primary/30 bg-primary/5"
                            : "border-border/40 bg-card hover:border-border hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-medium text-foreground">
                            {entry.title?.trim() || "Untitled entry"}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground/70">
                            {toJournalDisplayDate(entry.authoredAt ?? entry.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {toJournalPreview(entry.body)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </section>

          <section className="rounded-lg border border-border/40 bg-card px-4 py-4">
            {!selectedEntryId ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border/40 px-4 text-center">
                <FileText className="h-5 w-5 text-muted-foreground/60" />
                <p className="mt-3 text-sm text-muted-foreground">Select an entry to view or edit.</p>
              </div>
            ) : loadingSelected ? (
              <div className="space-y-2">
                <div className="h-6 w-1/3 animate-pulse rounded bg-muted/50" />
                <div className="h-10 animate-pulse rounded bg-muted/50" />
                <div className="h-44 animate-pulse rounded bg-muted/50" />
              </div>
            ) : selectedError ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{selectedError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedEntryId && void openEntry(selectedEntryId)}
                >
                  Retry
                </Button>
              </div>
            ) : selectedEntry ? (
              <form onSubmit={onSaveSelected} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-foreground">Edit entry</h2>
                  <span className="text-[11px] text-muted-foreground/70">
                    {toJournalDisplayDate(selectedEntry.updatedAt)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="journal-edit-title" className="text-xs text-muted-foreground">
                    Title (optional)
                  </label>
                  <Input
                    id="journal-edit-title"
                    value={editTitle}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setEditTitle(event.target.value)}
                    maxLength={JOURNAL_TITLE_MAX_LENGTH}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="journal-edit-authored-at" className="text-xs text-muted-foreground">
                    Authored at (optional)
                  </label>
                  <Input
                    id="journal-edit-authored-at"
                    type="datetime-local"
                    value={editAuthoredAt}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setEditAuthoredAt(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="journal-edit-body" className="text-xs text-muted-foreground">
                      Body
                    </label>
                    <span className="text-[11px] text-muted-foreground/70">
                      {editBody.length}/{JOURNAL_BODY_MAX_LENGTH}
                    </span>
                  </div>
                  <Textarea
                    id="journal-edit-body"
                    rows={10}
                    value={editBody}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setEditBody(event.target.value)}
                    maxLength={JOURNAL_BODY_MAX_LENGTH}
                    className="min-h-[220px] resize-y"
                  />
                </div>

                {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}

                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={deletingSelected || savingSelected}
                    onClick={() => void onDeleteSelected()}
                  >
                    {deletingSelected ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Deleting...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </span>
                    )}
                  </Button>

                  <Button type="submit" size="sm" disabled={!canSaveSelected}>
                    {savingSelected ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                        Save changes
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
