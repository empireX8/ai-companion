"use client";

/**
 * Context — canonical V1 context surface (P1-04)
 *
 * Shows what the assistant currently knows about the user:
 *   - Active memories (count + list from /api/reference/list?status=active)
 *   - Patterns scope (active claim count from /api/patterns)
 *
 * V1 scope: read-only. No forecast framing. No tension/audit links.
 * No /projections, /contradictions, /audit references.
 * Language is honest: "What the assistant knows about you."
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, Brain, BookOpen } from "lucide-react";

// ── Quality filter ────────────────────────────────────────────────────────────

/**
 * Returns true if a memory statement is worth showing in the Context surface.
 * Excludes junk, technical output, and entries too short to be meaningful.
 */
function isQualityMemory(statement: string): boolean {
  const t = statement.trim();
  // Too short to carry meaning
  if (t.length < 20) return false;
  // Too few word-like tokens (catches single-word junk)
  const wordCount = (t.match(/\b\w{2,}\b/g) ?? []).length;
  if (wordCount < 4) return false;
  // High density of code/shell special characters
  const specialChars = (t.match(/[<>{}()[\]|\\=;:$#@!`]/g) ?? []).length;
  if (specialChars / t.length > 0.10) return false;
  // Looks like an error message or stack trace
  if (/\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/.test(t)) return false;
  // Looks like terminal/shell prompt output
  if (/^[$%#>]\s/.test(t) || /\n\s*[$%#>]\s/.test(t)) return false;
  // Looks like a VM or system log line
  if (/\b(?:WARN|ERROR|DEBUG|INFO)\b.*?:/.test(t)) return false;
  return true;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MemoryEntry = {
  id: string;
  statement: string;
  type: string;
  status: string;
  createdAt: string;
};

type PatternsResponse = {
  sections: Array<{
    claims: Array<{ status: string }>;
  }>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContextPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [activePatternCount, setActivePatternCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [listRes, patternsRes] = await Promise.all([
          fetch("/api/reference/list?status=active&limit=50", { cache: "no-store" }),
          fetch("/api/patterns", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (listRes.ok) {
          const data = (await listRes.json()) as MemoryEntry[] | { items: MemoryEntry[] };
          const items = Array.isArray(data) ? data : (data.items ?? []);
          const quality = items.filter((m) => isQualityMemory(m.statement));
          if (!cancelled) setMemories(quality);
        }
        if (patternsRes.ok) {
          const data = (await patternsRes.json()) as PatternsResponse;
          const count = data.sections?.reduce(
            (acc, s) => acc + s.claims.filter((c) => c.status === "active").length,
            0
          ) ?? 0;
          if (!cancelled) setActivePatternCount(count);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Context</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            What the assistant currently knows about you.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {/* Memories section */}
            <section className="rounded-lg border border-border/40 bg-card">
              <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Memories</h2>
                {memories.length > 0 && (
                  <span className="ml-auto rounded px-1.5 py-0.5 text-[11px] bg-primary/10 text-primary font-medium">
                    {memories.length} active
                  </span>
                )}
              </div>

              {memories.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No confirmed memories yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Memories are saved when you confirm them during a chat.
                  </p>
                </div>
              ) : (
                (() => {
                  // Group by type, cap total display at 40
                  const capped = memories.slice(0, 40);
                  const byType = new Map<string, MemoryEntry[]>();
                  for (const m of capped) {
                    const group = byType.get(m.type) ?? [];
                    group.push(m);
                    byType.set(m.type, group);
                  }
                  const typeOrder = ["goal", "preference", "constraint", "rule", "pattern", "assumption", "hypothesis"];
                  const sortedTypes = [...byType.keys()].sort(
                    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
                  );
                  return (
                    <div className="divide-y divide-border/30">
                      {sortedTypes.map((type) => (
                        <div key={type}>
                          <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                            {type}
                          </p>
                          <ul>
                            {byType.get(type)!.map((mem) => (
                              <li key={mem.id} className="px-4 py-2 border-t border-border/20 first:border-t-0">
                                <p className="text-sm text-foreground leading-snug">{mem.statement}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </section>

            {/* Patterns scope */}
            <section className="rounded-lg border border-border/40 bg-card">
              <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Patterns</h2>
                {activePatternCount > 0 && (
                  <span className="ml-auto rounded px-1.5 py-0.5 text-[11px] bg-primary/10 text-primary font-medium">
                    {activePatternCount} active
                  </span>
                )}
              </div>

              <div className="px-4 py-3">
                {activePatternCount === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active patterns yet. Patterns emerge from repeated themes across your conversations.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {activePatternCount} recurring pattern{activePatternCount !== 1 ? "s" : ""} have
                    been observed across your conversations.{" "}
                    <Link href="/patterns" className="text-primary underline-offset-2 hover:underline">
                      View patterns →
                    </Link>
                  </p>
                )}
              </div>
            </section>

            {/* Import nudge — honest about data source */}
            <p className="text-center text-[11px] text-muted-foreground/50">
              Context grows as you have more conversations. You can also{" "}
              <Link href="/import" className="text-primary/60 underline-offset-2 hover:underline">
                import past chats
              </Link>{" "}
              to bring in prior history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
