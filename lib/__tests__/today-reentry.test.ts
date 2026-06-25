import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { SurfacedActionView } from "../actions-api";
import type { ActiveQuestionItem } from "../active-questions";
import { UserMapConclusionArea, UserMapConclusionStatus, UserMapConfidenceLevel } from "@prisma/client";
import type { TodayIntelligenceUpdateItem } from "../today-intelligence-updates";
import {
  TODAY_REENTRY_ENDPOINTS,
  TODAY_SECTION_ORDER,
  buildTodayAttentionRows,
  buildTodayBriefingMeta,
  buildTodayBriefingTitle,
  buildTodayChangeRows,
  buildTodayFieldworkRows,
  buildTodayOpenLoopRows,
  buildTodayReceiptCards,
  hasTodayReentryContent,
  pickTodayHeroItem,
  type TodayReentrySnapshot,
} from "../today-reentry";
import type { WatchForItem } from "../watch-for";

function readTodayPageSource(): string {
  const page = readFileSync(join(process.cwd(), "app/(root)/page.tsx"), "utf8");
  const orvek = readFileSync(
    join(process.cwd(), "components/orvek-workbench/OrvekTodayPage.tsx"),
    "utf8"
  );
  return `${page}\n${orvek}`;
}

function readTodayReentrySource(): string {
  return readFileSync(join(process.cwd(), "lib/today-reentry.ts"), "utf8");
}

function emptySnapshot(): TodayReentrySnapshot {
  return {
    surfacingCards: [],
    intelligenceUpdates: [],
    userMapConclusions: [],
    watchForItems: [],
    investigations: [],
    actions: [],
    timelineMovements: [],
  };
}

function movementItem(id: string): TodayIntelligenceUpdateItem {
  return {
    id,
    updateTypeLabel: "Strengthened",
    affectedObjectType: "pattern_claim",
    affectedObjectTypeLabel: "Pattern",
    affectedObjectId: "pattern-1",
    affectedObjectHref: "/patterns/pattern-1",
    userFacingSummary: "Evidence reinforced this pattern.",
    createdAt: "2026-06-20T10:00:00.000Z",
  };
}

describe("today-reentry hero priority", () => {
  it("prefers model movement over map conclusions and surfacing cards", () => {
    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      intelligenceUpdates: [movementItem("mu-1")],
      userMapConclusions: [
        {
          id: "map-1",
          title: "I need more rest",
          summary: "Supported by recent journal.",
          area: UserMapConclusionArea.state_ecology,
          status: UserMapConclusionStatus.supported,
          confidenceLevel: UserMapConfidenceLevel.medium,
          evidenceCount: 2,
          updatedAt: "2026-06-21T10:00:00.000Z",
        },
      ],
      surfacingCards: [
        {
          kind: "Active Tension",
          title: "Rest vs push",
          body: "Two sides in tension.",
          meta: "open",
          detailHref: "/contradictions/t-1",
          receiptHref: null,
        },
      ],
    };

    const hero = pickTodayHeroItem(snapshot);
    expect(hero?.movement?.id).toBe("mu-1");
    expect(hero?.selection?.tab).toBe("movement");
  });

  it("falls back to map conclusion when no movement exists", () => {
    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      userMapConclusions: [
        {
          id: "map-1",
          title: "I need more rest",
          summary: "Supported by recent journal.",
          area: UserMapConclusionArea.state_ecology,
          status: UserMapConclusionStatus.supported,
          confidenceLevel: UserMapConfidenceLevel.medium,
          evidenceCount: 2,
          updatedAt: "2026-06-21T10:00:00.000Z",
        },
      ],
    };

    const hero = pickTodayHeroItem(snapshot);
    expect(hero?.selection?.objectType).toBe("usermap_conclusion");
    expect(hero?.selection?.tab).toBe("evidence");
  });

  it("uses pattern/tension card before fieldwork and actions", () => {
    const watchFor: WatchForItem = {
      id: "wf-1",
      prompt: "Notice energy dips",
      reason: "Linked to recent journal.",
      status: "active",
      statusLabel: "Active",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "pattern-1",
      linkedObjectHref: "/patterns/pattern-1",
      createdAt: "2026-06-19T10:00:00.000Z",
      updatedAt: "2026-06-19T10:00:00.000Z",
    };

    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      surfacingCards: [
        {
          kind: "Recent Pattern",
          title: "I overcommit",
          body: "3 evidence receipts.",
          meta: "Strength · Medium",
          detailHref: "/patterns/pattern-1",
          receiptHref: "/library/receipt-pattern-pattern-1",
        },
      ],
      watchForItems: [watchFor],
      actions: [
        {
          id: "action-1",
          title: "Block recovery time",
          whySuggested: "Pattern signal is strong.",
          bucket: "stabilize",
          effort: "Low",
          linkedFamily: null,
          linkedFamilyLabel: null,
          linkedClaimId: "pattern-1",
          linkedClaimSummary: "I overcommit",
          linkedGoalId: null,
          linkedGoalStatement: null,
          linkedSourceLabel: "Pattern",
          status: "not_started",
          note: null,
          surfacedAt: "2026-06-18T10:00:00.000Z",
          updatedAt: "2026-06-18T10:00:00.000Z",
        } satisfies SurfacedActionView,
      ],
    };

    const hero = pickTodayHeroItem(snapshot);
    expect(hero?.selection?.objectType).toBe("pattern_claim");
  });

  it("returns null for an empty snapshot", () => {
    expect(pickTodayHeroItem(emptySnapshot())).toBeNull();
  });
});

describe("today-reentry attention rows", () => {
  it("builds rows only from review-oriented snapshot data and excludes hero duplicate", () => {
    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      intelligenceUpdates: [movementItem("mu-1"), movementItem("mu-2")],
      watchForItems: [
        {
          id: "wf-1",
          prompt: "Notice energy dips",
          reason: "Linked to recent journal.",
          status: "active",
          statusLabel: "Active",
          linkedObjectType: "pattern_claim",
          linkedObjectId: "pattern-1",
          linkedObjectHref: "/patterns/pattern-1",
          createdAt: "2026-06-19T10:00:00.000Z",
          updatedAt: "2026-06-19T10:00:00.000Z",
        },
      ],
      investigations: [
        {
          id: "inv-1",
          title: "Why do I stall before deadlines?",
          organizingQuestion: "What triggers the stall?",
          status: "open",
          statusLabel: "Open",
          createdAt: "2026-06-17T10:00:00.000Z",
          updatedAt: "2026-06-17T10:00:00.000Z",
        },
      ],
    };

    const hero = pickTodayHeroItem(snapshot);
    const rows = buildTodayAttentionRows(snapshot, hero);

    expect(rows.some((row) => row.id === "attention-movement-mu-2")).toBe(true);
    expect(rows.some((row) => row.id === hero?.id)).toBe(false);
    expect(rows.some((row) => row.id === "attention-fieldwork-wf-1")).toBe(false);
    expect(rows.some((row) => row.id === "attention-investigation-inv-1")).toBe(false);
  });

  it("routes fieldwork and open loops to dedicated section builders", () => {
    const investigation: ActiveQuestionItem = {
      id: "inv-1",
      title: "Why do I stall before deadlines?",
      organizingQuestion: "What triggers the stall?",
      status: "open",
      statusLabel: "Open",
      createdAt: "2026-06-17T10:00:00.000Z",
      updatedAt: "2026-06-17T10:00:00.000Z",
    };
    const watchFor: WatchForItem = {
      id: "wf-1",
      prompt: "Notice energy dips",
      reason: "Linked to recent journal.",
      status: "active",
      statusLabel: "Active",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "pattern-1",
      linkedObjectHref: "/patterns/pattern-1",
      createdAt: "2026-06-19T10:00:00.000Z",
      updatedAt: "2026-06-19T10:00:00.000Z",
    };

    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      watchForItems: [watchFor],
      investigations: [investigation],
    };

    const fieldworkRows = buildTodayFieldworkRows(snapshot, null);
    const openLoopRows = buildTodayOpenLoopRows(snapshot);

    expect(fieldworkRows[0]?.href).toBe("/watch-for/wf-1");
    expect(openLoopRows[0]?.href).toBe("/active-questions/inv-1");
    expect(openLoopRows[0]?.selection).toBeNull();
  });
});

describe("today-reentry briefing copy", () => {
  it("uses movement count headline when updates exist", () => {
    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      intelligenceUpdates: [movementItem("mu-1"), movementItem("mu-2")],
    };
    expect(buildTodayBriefingTitle(snapshot)).toBe("Your Mind Model moved in 2 places.");
  });

  it("uses sparse fallback title when only non-movement data exists", () => {
    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      surfacingCards: [
        {
          kind: "Recent Journal",
          title: "Morning",
          body: "Grounded.",
          meta: "recently",
          detailHref: "/library/journal-1",
          receiptHref: null,
        },
      ],
    };
    expect(buildTodayBriefingTitle(snapshot)).toBe("What matters now");
  });

  it("reports empty content honestly", () => {
    expect(hasTodayReentryContent(emptySnapshot())).toBe(false);
    expect(buildTodayBriefingMeta(emptySnapshot(), false)).toContain("Nothing surfaced yet");
  });
});

describe("today-reentry data safety", () => {
  it("uses public-safe re-entry endpoints only", () => {
    expect(TODAY_REENTRY_ENDPOINTS.intelligenceUpdates).toBe(
      "/api/today/intelligence-updates"
    );
    expect(TODAY_REENTRY_ENDPOINTS.userMapConclusions).toContain("/api/user-map/conclusions");
    expect(TODAY_REENTRY_ENDPOINTS.watchFor).toBe("/api/watch-for");
    expect(TODAY_REENTRY_ENDPOINTS.actions).toBe("/api/actions");
    expect(TODAY_REENTRY_ENDPOINTS.activeQuestions).toBe("/api/active-questions");
    expect(TODAY_REENTRY_ENDPOINTS.timelineModelLayers).toContain(
      "/api/timeline/model-layers"
    );
  });

  it("does not reference internal APIs or v0 mock data", () => {
    const source = readTodayReentrySource();
    expect(source.includes("/api/internal/")).toBe(false);
    expect(source.includes("internal_only")).toBe(false);
    expect(source.includes("beforeSummary")).toBe(false);
    expect(source.includes("afterSummary")).toBe(false);
    expect(source.includes("v0")).toBe(false);
    expect(source.includes("mock")).toBe(false);
  });

  it("does not expose internal candidate fields in re-entry helpers", () => {
    const source = readTodayReentrySource();
    expect(source).not.toContain("internalNotes");
    expect(source).not.toContain("sourceRunId");
    expect(source).not.toContain('status: "candidate"');
  });
});

describe("today-reentry hierarchy", () => {
  it("locks the Today section order for re-entry scanning", () => {
    expect(TODAY_SECTION_ORDER).toEqual([
      "primary",
      "attention",
      "changes",
      "fieldwork",
      "open_loops",
      "receipts",
      "capture",
    ]);
  });

  it("excludes the hero movement from change rows", () => {
    const snapshot: TodayReentrySnapshot = {
      ...emptySnapshot(),
      intelligenceUpdates: [movementItem("mu-1"), movementItem("mu-2")],
    };
    const hero = pickTodayHeroItem(snapshot);
    const changeRows = buildTodayChangeRows(snapshot, hero);

    expect(changeRows.map((item) => item.id)).toEqual(["mu-2"]);
  });

  it("builds receipt cards only from real receipt hrefs", () => {
    const cards = buildTodayReceiptCards({
      ...emptySnapshot(),
      surfacingCards: [
        {
          kind: "Recent Pattern",
          title: "I overcommit",
          body: "3 evidence receipts.",
          meta: "Strength · Medium",
          detailHref: "/patterns/pattern-1",
          receiptHref: "/library/receipt-pattern-pattern-1",
        },
        {
          kind: "Recent Journal",
          title: "Morning",
          body: "Grounded.",
          meta: "recently",
          detailHref: "/library/journal-1",
          receiptHref: null,
        },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.receiptHref).toContain("/library/receipt-");
  });
});

describe("today page re-entry wiring", () => {
  it("loads re-entry snapshot through the helper module", () => {
    const source = readTodayPageSource();
    expect(source).toContain("fetchTodayReentrySnapshot");
    expect(source).toContain("pickTodayHeroItem");
    expect(source).toContain("buildTodayAttentionRows");
    expect(source.includes("/api/user-map")).toBe(false);
    expect(source.includes("/api/timeline")).toBe(false);
    expect(source.includes("/api/model-updates")).toBe(false);
  });

  it("renders attention section and inspector selection affordances", () => {
    const source = readTodayPageSource();
    expect(source).toContain("Most consequential now");
    expect(source).toContain(">Now</SectionLabel>");
    expect(source).toContain("Recent model movement");
    expect(source).toContain("Receipts resurfaced");
    expect(source).toContain("buildTodayFieldworkRows");
    expect(source).toContain("buildTodayOpenLoopRows");
    expect(source).toContain("buildTodayChangeRows");
    expect(source).toContain("useOrvekInspector");
    expect(source).toContain('tab: "movement"');
    expect(source).toContain("See why it moved");
    expect(source.includes("TODAY_TIMELINE_MOVEMENT_LABEL")).toBe(false);
    expect(source.includes("lg:grid-cols-")).toBe(true);
  });

  it("clears loading in finally when fetching re-entry snapshot", () => {
    const source = readTodayPageSource();
    expect(source.includes("setIsLoadingSnapshot(true)")).toBe(true);
    expect(source.includes("} finally {")).toBe(true);
    expect(source.includes("setIsLoadingSnapshot(false)")).toBe(true);
  });
});
