/**
 * Help — V1 documentation surface (P1-11)
 *
 * Covers the V1 product surfaces only: Chat, Patterns, History, Context, Memories, Import.
 * No Forecasts section. No Tensions section. No links to hidden internal routes.
 * Direct URL access only — not in the primary nav.
 */

import Link from "next/link";
import { BookOpen, HelpCircle, Brain, MessageSquare, Sparkles } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-8 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <HelpCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">How This Works</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A quick guide to the core concepts in MindLab.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Chat */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Chat</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              The primary way to interact with your AI companion. Each conversation is saved
              to your history and may contribute to your patterns and memories over time.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Use Chat for anything — thinking out loud, working through a problem, planning ahead,
              or just exploring an idea. The assistant learns from what you share across sessions.
            </p>
          </section>

          {/* Memories */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Memories</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Durable things you have told the assistant about yourself — your goals, preferences,
              constraints, and context. Confirmed memories are remembered across all future chats.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Save a memory when something is likely to matter in future conversations — a recurring goal,
              a constraint to work around, or a preference the assistant should always factor in.
              For example: &ldquo;I want to change careers in the next two years&rdquo; or &ldquo;I only have 30 minutes in the morning.&rdquo;
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Candidate memories stay pending until you review them. Confirmed memories continue to shape future chats.
            </p>
            <Link
              href="/memories"
              className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >
              Review candidate memories →
            </Link>
          </section>

          {/* Patterns */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Patterns</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Recurring themes that emerge from your conversations over time — tendencies, loops,
              and ways of thinking that appear repeatedly. Patterns are observed, not assigned as labels.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">How they work:</span>{" "}
              The system notices when similar themes come up across multiple sessions and surfaces them
              as candidate patterns for you to review. You can accept, pause, or dismiss any pattern.
              Early patterns are marked as tentative — they are signals, not settled conclusions.
            </p>
            <Link
              href="/patterns"
              className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >
              View your patterns →
            </Link>
          </section>

          {/* Import */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Import</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Bring in past conversations from other AI tools — like ChatGPT exports — to give the
              assistant more context about you without starting from scratch.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Import old chats if you have had meaningful prior conversations you want the assistant
              to learn from. Imported sessions appear in your history and can contribute to patterns.
            </p>
            <Link
              href="/import"
              className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >
              Import conversations →
            </Link>
          </section>

          {/* Getting started */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Your first week</h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              You do not need to set anything up. Start chatting and let the system build up naturally.
            </p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">1.</span>
                <span>Chat normally. The assistant will learn from what you share and respond with more context over time.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">2.</span>
                <span>When a memory candidate appears in chat, confirm it if accurate. Dismiss it if not.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">3.</span>
                <span>
                  Check{" "}
                  <Link href="/context" className="text-primary underline-offset-2 hover:underline">
                    Context
                  </Link>{" "}
                  periodically to see what the assistant knows about you.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">4.</span>
                <span>
                  Review{" "}
                  <Link href="/patterns" className="text-primary underline-offset-2 hover:underline">
                    Patterns
                  </Link>{" "}
                  once they start appearing — accept the ones that ring true, dismiss the ones that do not.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">5.</span>
                <span>Import old ChatGPT conversations if you want to bring in prior context quickly.</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
