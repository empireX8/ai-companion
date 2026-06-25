import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EXPLORE_DRAFT_REVIEW_SECTION_LABEL,
  EXPLORE_PAGE_INTRO,
  EXPLORE_PAGE_SUBTITLE,
  EXPLORE_PAGE_TITLE,
  EXPLORE_PUBLISHED_MOVEMENT_SECTION_LABEL,
  EXPLORE_REENTRY_LINKS,
} from "../explore-surface";
import {
  EXPLORE_MOVEMENT_PUBLISHED_BADGE,
} from "../explore-session-model-updates";
import {
  EXPLORE_REVIEW_DRAFT_BADGE,
  EXPLORE_REVIEW_HAS_ITEMS_SUBCOPY,
} from "../explore-conversation-review";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("explore-surface copy", () => {
  it("uses governed Orvek Mind Model conversation language", () => {
    expect(EXPLORE_PAGE_TITLE).toBe("Explore");
    expect(EXPLORE_PAGE_SUBTITLE.toLowerCase()).toContain("mind model");
    expect(EXPLORE_PAGE_INTRO.toLowerCase()).toContain("grounded");
    expect(EXPLORE_PAGE_INTRO.toLowerCase()).not.toContain("chatbot");
    expect(EXPLORE_PAGE_INTRO.toLowerCase()).not.toContain("assistant");
  });

  it("keeps published and draft boundaries explicit in copy", () => {
    expect(EXPLORE_PUBLISHED_MOVEMENT_SECTION_LABEL).toContain("Published");
    expect(EXPLORE_DRAFT_REVIEW_SECTION_LABEL).toContain("Proposed");
    expect(EXPLORE_MOVEMENT_PUBLISHED_BADGE).toBe("Published");
    expect(EXPLORE_REVIEW_DRAFT_BADGE).toContain("Draft");
    expect(EXPLORE_REVIEW_HAS_ITEMS_SUBCOPY).toContain("review before applying");
  });

  it("exposes real re-entry links", () => {
    expect(EXPLORE_REENTRY_LINKS.map((link) => link.href)).toEqual([
      "/",
      "/your-map",
      "/what-changed",
      "/timeline",
      "/watch-for",
    ]);
  });
});

describe("explore surface wiring", () => {
  it("renders grounding hierarchy and inspector actions without internal fields", () => {
    const pageSource = readSource("app/(root)/(routes)/explore/page.tsx");
    const exploreSource = readSource("components/orvek-workbench/OrvekExplorePage.tsx");
    const movementSource = readSource("components/explore/ExploreModelMovementStrip.tsx");
    const reviewSource = readSource("components/explore/ExploreConversationReviewStrip.tsx");
    const inspectorSource = readSource("components/explore/ExploreInspectorAction.tsx");

    expect(pageSource).toContain("OrvekExplorePage");
    expect(exploreSource).toContain("EXPLORE_PAGE_INTRO");
    expect(exploreSource).toContain("ExploreModelMovementStrip");
    expect(exploreSource).toContain("ExploreConversationReviewStrip");
    expect(exploreSource).not.toContain("Open reflection");
    expect(exploreSource).not.toContain("beforeSummary");
    expect(exploreSource).not.toContain("internal_only");

    expect(movementSource).toContain("ExploreInspectorAction");
    expect(movementSource).toContain("EXPLORE_MOVEMENT_PUBLISHED_BADGE");
    expect(movementSource).toContain("EXPLORE_MOVEMENT_HAS_UPDATES_HEADLINE");
    expect(movementSource).not.toContain("model_update_candidate");

    expect(reviewSource).toContain("EXPLORE_REVIEW_DRAFT_BADGE");
    expect(reviewSource).not.toContain('objectType: "model_update"');
    expect(reviewSource).toContain("ExploreInspectorAction");

    expect(inspectorSource).toContain('objectType === "model_update"');
    expect(inspectorSource).toContain('sourceSurface: "explore"');
    expect(inspectorSource).not.toContain('objectType: "fieldwork"');
  });
});
