import Link from "next/link";
import { BookOpen, HelpCircle, Split, TrendingUp, CheckSquare, Sparkles } from "lucide-react";

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
              A quick guide to the core concepts in Mind Lab.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Memories */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Memories</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Durable things you have told the assistant about yourself — your goals, preferences, constraints, and patterns.
              Confirmed memories are remembered across all future chats.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Save a memory when something is likely to matter in future conversations — a recurring goal,
              a constraint to work around, or a preference the assistant should always factor in.
              For example: &ldquo;I want to change careers in the next two years&rdquo; or &ldquo;I only have 30 minutes in the morning.&rdquo;
            </p>
            <Link
              href="/references"
              className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >
              View your memories →
            </Link>
          </section>

          {/* Sources */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Sources</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Saved external references — links, articles, or documents you have shared. Sources are saved for provenance
              but are not personal memories about you.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Save a source when you share a link or document you might want to refer back to later,
              or when you want to note where a piece of information came from.
              Unlike memories, sources describe external things — not your own goals or beliefs.
            </p>
          </section>

          {/* Tensions */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <Split className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Tensions</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Unresolved conflicts worth tracking — places where two things you believe or want seem to pull against each other.
              When a tension is relevant to what you are discussing, the assistant may use it to ask a better question.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Tensions are most useful when you find yourself going back and forth on something —
              wanting to take a risk but also wanting security, or holding two goals that cannot both be fully met.
              Tracking the conflict lets the assistant give more grounded advice over time instead of treating each conversation as isolated.
            </p>
            <Link
              href="/contradictions"
              className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >
              View your tensions →
            </Link>
          </section>

          {/* Forecasts */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Forecasts</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Saved expectations about future outcomes — predictions you have made and want to track over time.
              Only forecasts relevant to what you are discussing may shape planning-oriented conversations.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Save a forecast when you make a meaningful prediction you want to hold onto — a bet you are making,
              an outcome you are banking on, or an assumption that a future decision depends on.
              Forecasts matter most when you are planning ahead or revisiting something you expected to happen.
            </p>
            <Link
              href="/projections"
              className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >
              View your forecasts →
            </Link>
          </section>

          {/* Candidates */}
          <section className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Candidates</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              System suggestions that do not become active until you confirm them. When the assistant detects a possible
              memory or tension from something you said, it creates a candidate for you to review — not a final record.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">When to use:</span>{" "}
              Check your candidates after a meaningful conversation or after importing old chats.
              You will see what the system noticed and decide what is worth keeping.
            </p>

            <div className="mt-4 rounded-md border border-border/60 bg-background px-4 py-3">
              <p className="text-xs font-semibold text-foreground">What happens when you confirm or dismiss</p>
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Confirm a candidate memory</span> — it becomes an active memory.
                  The assistant will factor it in during future relevant conversations.
                </p>
                <p>
                  <span className="font-medium text-foreground">Dismiss a candidate memory</span> — it is rejected and will not
                  influence the assistant. It will not reappear.
                </p>
                <p>
                  <span className="font-medium text-foreground">Confirm a candidate tension</span> — it becomes a tracked tension.
                  The assistant may use it to ask better questions when that topic comes up.
                </p>
                <p>
                  <span className="font-medium text-foreground">Dismiss a candidate tension</span> — it is deleted.
                  Nothing is carried forward.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/references/candidates"
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Review candidate memories →
              </Link>
              <Link
                href="/contradictions/candidates"
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Review candidate tensions →
              </Link>
            </div>
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
                <span>When a candidate appears in chat, confirm it if it is accurate. Dismiss it if it is not. One click either way.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">3.</span>
                <span>Check{" "}
                  <Link href="/references/candidates" className="text-primary underline-offset-2 hover:underline">candidate memories</Link>
                  {" "}and{" "}
                  <Link href="/contradictions/candidates" className="text-primary underline-offset-2 hover:underline">candidate tensions</Link>
                  {" "}periodically to keep things accurate.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">4.</span>
                <span>Use forecasts when you are planning ahead or making a bet you want the assistant to remember.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-semibold text-foreground">5.</span>
                <span>Import old ChatGPT conversations later if you want to bring in prior context quickly.</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
