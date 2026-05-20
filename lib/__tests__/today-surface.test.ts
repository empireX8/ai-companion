import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildTodaySurfacingCards,
  TODAY_SURFACING_ENDPOINTS,
  type TodayPatternsResponse,
  type TodayTopContradiction,
} from "../today-surface";
import {
  DEFERRED_RECEIPT_NAMESPACE_PREFIXES,
  PUBLIC_LINKED_DETAIL_FALLBACK_COPY,
} from "../public-continuity-registry";

function readTodayPageSource(): string {
  return readFileSync(join(process.cwd(), "app/(root)/page.tsx"), "utf8");
}

describe("today-surface link mapping", () => {
  it("maps latest journal entry to a library detail link when id exists", () => {
    const cards = buildTodaySurfacingCards({
      journalEntries: [
        {
          id: "journal-123",
          title: "Morning",
          body: "Grounded and steady.",
          createdAt: "2026-05-16T10:00:00.000Z",
          authoredAt: null,
        },
      ],
      contradictions: [],
      patterns: null,
    });

    expect(cards[0]?.kind).toBe("Recent Journal");
    expect(cards[0]?.detailHref).toBe("/library/journal-journal-123");
    expect(cards[0]?.receiptHref).toBeNull();
  });

  it("does not fabricate a journal detail link when id is missing", () => {
    const cards = buildTodaySurfacingCards({
      journalEntries: [
        {
          id: " ",
          title: "Untitled",
          body: "No id available.",
          createdAt: "2026-05-16T10:00:00.000Z",
          authoredAt: null,
        },
      ],
      contradictions: [],
      patterns: null,
    });

    expect(cards[0]?.kind).toBe("Recent Journal");
    expect(cards[0]?.detailHref).toBeNull();
    expect(cards[0]?.receiptHref).toBeNull();
  });

  it("maps pattern and tension links only when ids exist", () => {
    const contradictions: TodayTopContradiction[] = [
      {
        id: "tension-1",
        title: "Rest vs push",
        sideA: "Rest more",
        sideB: "Push harder",
        status: "open",
        lastEvidenceAt: "2026-05-16T09:00:00.000Z",
        lastTouchedAt: "2026-05-16T09:00:00.000Z",
      },
    ];
    const patterns: TodayPatternsResponse = {
      sections: [
        {
          claims: [
            {
              id: "pattern-1",
              summary: "I overcommit before deadlines",
              strengthLevel: "developing",
              evidenceCount: 3,
            },
          ],
        },
      ],
    };

    const cards = buildTodaySurfacingCards({
      journalEntries: [],
      contradictions,
      patterns,
    });

    const tensionCard = cards.find((card) => card.kind === "Active Tension");
    const patternCard = cards.find((card) => card.kind === "Recent Pattern");

    expect(tensionCard?.detailHref).toBe("/contradictions/tension-1");
    expect(tensionCard?.receiptHref).toBe("/library/receipt-tension-tension-1");
    expect(patternCard?.detailHref).toBe("/patterns/pattern-1");
    expect(patternCard?.receiptHref).toBe("/library/receipt-pattern-pattern-1");
  });

  it("does not create fake pattern/tension links or receipts when ids are missing", () => {
    const cards = buildTodaySurfacingCards({
      journalEntries: [],
      contradictions: [
        {
          id: "",
          title: "Rest vs push",
          sideA: "Rest more",
          sideB: "Push harder",
          status: "open",
          lastEvidenceAt: "2026-05-16T09:00:00.000Z",
          lastTouchedAt: "2026-05-16T09:00:00.000Z",
        },
      ],
      patterns: {
        sections: [
          {
            claims: [
              {
                id: " ",
                summary: "I overcommit before deadlines",
                strengthLevel: "developing",
                evidenceCount: 3,
              },
            ],
          },
        ],
      },
    });

    const tensionCard = cards.find((card) => card.kind === "Active Tension");
    const patternCard = cards.find((card) => card.kind === "Recent Pattern");

    expect(tensionCard?.detailHref).toBeNull();
    expect(tensionCard?.receiptHref).toBeNull();
    expect(patternCard?.detailHref).toBeNull();
    expect(patternCard?.receiptHref).toBeNull();
  });

  it("does not generate deferred receipt namespaces", () => {
    const cards = buildTodaySurfacingCards({
      journalEntries: [],
      contradictions: [
        {
          id: "tension-1",
          title: "Rest vs push",
          sideA: "Rest more",
          sideB: "Push harder",
          status: "open",
          lastEvidenceAt: "2026-05-16T09:00:00.000Z",
          lastTouchedAt: "2026-05-16T09:00:00.000Z",
        },
      ],
      patterns: {
        sections: [
          {
            claims: [
              {
                id: "pattern-1",
                summary: "I overcommit before deadlines",
                strengthLevel: "developing",
                evidenceCount: 3,
              },
            ],
          },
        ],
      },
    });

    const renderedHrefs = JSON.stringify(cards.map((card) => card.receiptHref));
    expect(renderedHrefs).toContain("receipt-pattern-pattern-1");
    expect(renderedHrefs).toContain("receipt-tension-tension-1");

    for (const namespace of DEFERRED_RECEIPT_NAMESPACE_PREFIXES) {
      expect(renderedHrefs).not.toContain(namespace);
    }
  });
});

describe("today-surface safety and honest copy", () => {
  it("uses only the expected public backend sources for today surfacing", () => {
    expect(TODAY_SURFACING_ENDPOINTS.journal).toBe("/api/journal/entries?limit=1");
    expect(TODAY_SURFACING_ENDPOINTS.contradiction).toBe(
      "/api/contradiction?top=3&mode=read_only"
    );
    expect(TODAY_SURFACING_ENDPOINTS.patterns).toBe("/api/patterns");
  });

  it("does not reference internal user-map APIs", () => {
    const source = readTodayPageSource();
    expect(source.includes("/api/internal/user-map/review-candidates")).toBe(
      false
    );
    expect(source.includes("/api/user-map")).toBe(false);
    expect(source.includes("internal_only")).toBe(false);
  });

  it("keeps honest placeholder and fallback copy", () => {
    const source = readTodayPageSource();
    expect(source.includes("Saving media is not wired yet.")).toBe(true);
    expect(source.includes("PUBLIC_LINKED_DETAIL_FALLBACK_COPY")).toBe(true);
    expect(PUBLIC_LINKED_DETAIL_FALLBACK_COPY).toBe(
      "No linked detail available yet."
    );
    expect(source.includes("No surfaced items yet.")).toBe(true);
    expect(source.includes("No intelligence updates yet.")).toBe(true);
    expect(source.includes("Loading intelligence updates…")).toBe(true);
  });

  it("does not derive receipt links via string replacement from detail href", () => {
    const source = readTodayPageSource();
    expect(source.includes(".replace(\"/patterns/\"")).toBe(false);
    expect(source.includes(".replace(\"/contradictions/\"")).toBe(false);
  });

  it("uses today intelligence-updates safe endpoint and avoids direct model-updates usage", () => {
    const source = readTodayPageSource();
    expect(source.includes("TODAY_INTELLIGENCE_UPDATES_ENDPOINT")).toBe(true);
    expect(source.includes("/api/model-updates")).toBe(false);
    expect(source.includes("/api/model-updates/[id]")).toBe(false);
  });

  it("renders intelligence-updates section as read-only without review/write/timeline coupling", () => {
    const source = readTodayPageSource();
    expect(source.includes("Intelligence updates")).toBe(true);
    expect(source.includes("Promote")).toBe(false);
    expect(source.includes("Publish")).toBe(false);
    expect(source.includes("Edit")).toBe(false);
    expect(source.includes("Delete")).toBe(false);
    expect(source.includes("/api/internal/user-map/review-candidates")).toBe(
      false
    );
    expect(source.includes("/internal/user-map/review")).toBe(false);
    expect(source.includes("/api/timeline")).toBe(false);
    expect(source.includes("/timeline")).toBe(false);
  });
});
