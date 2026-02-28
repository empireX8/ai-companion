"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { type EvidenceDetail, fetchEvidenceById } from "@/lib/nodes-api";

const TYPE_LABEL: Record<string, string> = {
  BELIEF: "Belief",
  VALUE: "Value",
  GOAL: "Goal",
  FEAR: "Fear",
  IDENTITY: "Identity",
  TRAIT: "Trait",
  HABIT: "Habit",
  TOPIC: "Topic",
  RELATIONSHIP_PATTERN: "Relationship",
  EMOTIONAL_PATTERN: "Emotional",
  COGNITIVE_PATTERN: "Cognitive",
};

const STATUS_STYLE: Record<string, string> = {
  candidate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  superseded: "bg-muted text-muted-foreground",
};

export default function EvidenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<EvidenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchEvidenceById(id);
      if (!data) {
        setNotFound(true);
      } else {
        setDetail(data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          href="/evidence"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Evidence library
        </Link>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : notFound ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Evidence span not found.
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-destructive">
            Failed to load. Please try again.
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="mb-1 text-xl font-bold">Evidence Span</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {detail.sessionLabel ? (
                  <span>{detail.sessionLabel}</span>
                ) : (
                  <span className="italic">Unnamed session</span>
                )}
                <span>·</span>
                <span>{detail.origin === "IMPORTED_ARCHIVE" ? "Imported" : "Native"}</span>
                <span>·</span>
                <span>{new Date(detail.createdAt).toLocaleString()}</span>
                <span>·</span>
                <span className="font-mono text-[10px]">
                  chars {detail.charStart}–{detail.charEnd}
                </span>
              </div>
            </div>

            {/* Content */}
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Captured text
              </h2>
              <blockquote className="rounded-lg border-l-4 border-primary/40 bg-card px-4 py-3 text-sm leading-relaxed">
                {detail.content}
              </blockquote>
            </section>

            {/* Profile claims */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Profile claims derived from this span
              </h2>

              {detail.artifacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No profile claims extracted.</p>
              ) : (
                <div className="space-y-3">
                  {detail.artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {TYPE_LABEL[artifact.type] ?? artifact.type}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLE[artifact.status] ?? STATUS_STYLE.candidate
                          }`}
                        >
                          {artifact.status}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          confidence {Math.round(artifact.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-sm">{artifact.claim}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Provenance */}
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Provenance
              </h2>
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">Message ID</dt>
                  <dd className="font-mono text-xs">{detail.messageId}</dd>
                </div>
                {detail.sessionId && (
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Session ID</dt>
                    <dd className="font-mono text-xs">{detail.sessionId}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">Span ID</dt>
                  <dd className="font-mono text-xs">{detail.id}</dd>
                </div>
              </dl>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
