import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TimelineStateSummary } from "../timeline-aggregation";
import {
  buildTimelineRequestUrl,
  hasEnoughCheckInsForRhythm,
  mapTimelineEntries,
  type TimelineResponse,
} from "../timeline-surface";
import {
  buildTimelineModelLayersRequestUrl,
  buildTimelineStreamItems,
  TIMELINE_ACTIVITY_SECTION_LABEL,
  TIMELINE_MODEL_CHANGE_CHIP,
} from "../timeline-model-layers";
import { PUBLIC_LINKED_DETAIL_FALLBACK_COPY } from "../public-continuity-registry";

function makeSummary(totalCheckIns = 0): TimelineStateSummary {
  return {
    window: "30d",
    totalCheckIns,
    rhythms: {
      totalCount: totalCheckIns,
      topStateTags: [],
      topEventTags: [],
      lastCheckInAt: null,
    },
    repeatedSignals: {
      repeatedStateTags: [],
      repeatedEventTags: [],
      repeatedPairs: [],
      rankedItems: [],
    },
    links: [],
    recentStates: [],
    topEventTags: [],
  };
}

function makePayload(overrides: Partial<TimelineResponse> = {}): TimelineResponse {
  return {
    checkIns: [],
    importedActivity: [],
    stateSummary: makeSummary(),
    appActivity: [],
    journalEntries: [],
    ...overrides,
  };
}

describe("timeline-surface link safety", () => {
  it("maps activity items to concrete library detail links when real IDs exist", () => {
    const payload = makePayload({
      checkIns: [
        {
          id: "checkin-1",
          stateTag: "stressed",
          eventTags: ["pressure"],
          note: "deadline pressure",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
      journalEntries: [
        {
          id: "journal-1",
          title: "Daily note",
          preview: "Journal preview",
          bodyLength: 14,
          authoredAt: null,
          createdAt: "2026-05-11T10:00:00.000Z",
          updatedAt: "2026-05-11T10:00:00.000Z",
        },
      ],
      appActivity: [
        {
          id: "app-explore-1",
          label: "Explore run",
          preview: "Explore preview",
          messageCount: 2,
          startedAt: "2026-05-12T10:00:00.000Z",
          surfaceType: "explore_chat",
        },
        {
          id: "app-journal-1",
          label: "Journal run",
          preview: "Journal chat preview",
          messageCount: 2,
          startedAt: "2026-05-13T10:00:00.000Z",
          surfaceType: "journal_chat",
        },
      ],
      importedActivity: [
        {
          id: "imported-1",
          label: "Imported",
          preview: "Imported preview",
          messageCount: 5,
          startedAt: "2026-05-14T10:00:00.000Z",
        },
      ],
    });

    const entries = mapTimelineEntries(payload);

    expect(entries.find((entry) => entry.id === "checkin-1")?.href).toBe(
      "/library/checkin-checkin-1"
    );
    expect(entries.find((entry) => entry.id === "journal-1")?.href).toBe(
      "/library/journal-journal-1"
    );
    expect(entries.find((entry) => entry.id === "app-explore-1")?.href).toBe(
      "/library/explore-app-explore-1"
    );
    expect(entries.find((entry) => entry.id === "app-journal-1")?.href).toBe(
      "/library/jchat-app-journal-1"
    );
    expect(entries.find((entry) => entry.id === "imported-1")?.href).toBe(
      "/library/media-imported-1"
    );
  });

  it("does not fabricate fallback links when source IDs are missing", () => {
    const payload = makePayload({
      checkIns: [
        {
          id: " ",
          stateTag: "stable",
          eventTags: [],
          note: null,
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
      journalEntries: [
        {
          id: "",
          title: "Looks like a pattern summary",
          preview: "pattern-like text",
          bodyLength: 17,
          authoredAt: null,
          createdAt: "2026-05-11T10:00:00.000Z",
          updatedAt: "2026-05-11T10:00:00.000Z",
        },
      ],
      appActivity: [
        {
          id: "",
          label: "Looks like a contradiction label",
          preview: "tension-like text",
          messageCount: 1,
          startedAt: "2026-05-12T10:00:00.000Z",
          surfaceType: "explore_chat",
        },
      ],
      importedActivity: [
        {
          id: "",
          label: "Imported",
          preview: "Imported preview",
          messageCount: 5,
          startedAt: "2026-05-14T10:00:00.000Z",
        },
      ],
    });

    const entries = mapTimelineEntries(payload);

    expect(entries.every((entry) => entry.href === null)).toBe(true);
  });

  it("keeps timeline links constrained to public library detail routes", () => {
    const entries = mapTimelineEntries(
      makePayload({
        checkIns: [
          {
            id: "checkin-9",
            stateTag: "stressed",
            eventTags: ["pressure"],
            note: null,
            createdAt: "2026-05-10T10:00:00.000Z",
            updatedAt: "2026-05-10T10:00:00.000Z",
          },
        ],
      })
    );

    for (const entry of entries) {
      expect(entry.href?.startsWith("/library/") ?? false).toBe(true);
      expect(entry.href?.includes("/api/internal/user-map/review-candidates") ?? false).toBe(false);
      expect(entry.href?.includes("/api/user-map") ?? false).toBe(false);
      expect(entry.href?.startsWith("/patterns/") ?? false).toBe(false);
      expect(entry.href?.startsWith("/contradictions/") ?? false).toBe(false);
    }
  });
});

describe("timeline-surface rhythm honesty", () => {
  it("uses a minimum check-in threshold before showing rhythm summaries", () => {
    expect(hasEnoughCheckInsForRhythm(0)).toBe(false);
    expect(hasEnoughCheckInsForRhythm(1)).toBe(false);
    expect(hasEnoughCheckInsForRhythm(2)).toBe(false);
    expect(hasEnoughCheckInsForRhythm(3)).toBe(true);
  });

  it("requests only the public timeline API for rhythm/activity payloads", () => {
    const url = buildTimelineRequestUrl("30d");

    expect(url.startsWith("/api/timeline?")).toBe(true);
    expect(url.includes("includeAppActivity=true")).toBe(true);
    expect(url.includes("includeJournalEntries=true")).toBe(true);
    expect(url.includes("/api/internal/user-map/review-candidates")).toBe(false);
    expect(url.includes("/api/user-map")).toBe(false);
  });

  it("requests model movement from additive timeline model-layers endpoint, not model-updates", () => {
    const url = buildTimelineModelLayersRequestUrl("30d");

    expect(url).toBe("/api/timeline/model-layers?window=30d");
    expect(url.includes("/api/model-updates")).toBe(false);
    expect(url.includes("/api/internal/user-map/review-candidates")).toBe(false);
  });

  it("merges activity and model changes into one chronological stream", () => {
    const stream = buildTimelineStreamItems({
      activity: [
        {
          id: "journal-1",
          occurredAt: "2026-05-11T10:00:00.000Z",
          chip: "Journal",
          title: "Daily note",
          body: "Journal preview",
          href: "/library/journal-journal-1",
        },
      ],
      modelLayers: [
        {
          id: "mu-1",
          updateTypeLabel: "Conclusion Strengthened",
          affectedObjectType: "usermap_conclusion",
          affectedObjectTypeLabel: "Related map item",
          affectedObjectId: "umc-1",
          affectedObjectHref: "/your-map/umc-1",
          userFacingSummary: "A stable recovery pattern strengthened.",
          createdAt: "2026-05-12T10:00:00.000Z",
        },
      ],
    });

    expect(stream).toHaveLength(2);
    expect(stream[0]?.kind).toBe("model_change");
    expect(stream[1]?.kind).toBe("activity");
  });

  it("removes seeded rhythm rendering and keeps honest rhythm copy in timeline UI", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "app/(root)/(routes)/timeline/_components/TimelineSurface.tsx"
      ),
      "utf8"
    );

    expect(source.includes("RhythmGraph")).toBe(false);
    expect(source.includes("Based on check-ins in this window.")).toBe(true);
    expect(source.includes("Not enough check-ins to show a rhythm yet.")).toBe(
      true
    );
  });

  it("integrates model changes into activity stream with coherent section labels and no unwired affordances", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "app/(root)/(routes)/timeline/_components/TimelineSurface.tsx"
      ),
      "utf8"
    );

    expect(source.includes("TIMELINE_PAGE_META")).toBe(true);
    expect(source.includes("TIMELINE_SIGNALS_SECTION_LABEL")).toBe(true);
    expect(source.includes("TIMELINE_ACTIVITY_SECTION_LABEL")).toBe(true);
    expect(source.includes("TIMELINE_ACTIVITY_EMPTY_COPY")).toBe(true);
    expect(source.includes("TIMELINE_MODEL_CHANGE_CHIP")).toBe(true);
    expect(TIMELINE_ACTIVITY_SECTION_LABEL).toBe("Activity & changes");
    expect(TIMELINE_MODEL_CHANGE_CHIP).toBe("Model change");
    expect(source.includes("buildTimelineStreamItems")).toBe(true);
    expect(source.includes("Model movement")).toBe(false);
    expect(source.includes("No model movement in this window.")).toBe(false);
    expect(source.includes("Connected activity")).toBe(false);
    expect(source.includes("Possible links</SectionLabel>")).toBe(false);
    expect(source.includes("ChevronRight")).toBe(false);
    expect(source.includes("PUBLIC_LINKED_DETAIL_FALLBACK_COPY")).toBe(true);
    expect(PUBLIC_LINKED_DETAIL_FALLBACK_COPY).toBe("Source unavailable.");
    expect(source.includes("PublicLinkedObjectContinuity")).toBe(true);
    expect(source.includes("Linked target:")).toBe(false);
    expect(source.includes("Promote")).toBe(false);
    expect(source.includes("Publish")).toBe(false);
    expect(source.includes("Edit")).toBe(false);
    expect(source.includes("Delete")).toBe(false);
    expect(source.includes("/api/model-updates")).toBe(false);
    expect(source.includes("/api/internal/user-map/review-candidates")).toBe(
      false
    );
    expect(source.includes("/internal/user-map/review")).toBe(false);
    expect(source.includes("receipt-action-")).toBe(false);
    expect(source.includes(".replace(\"/patterns/\"")).toBe(false);
    expect(source.includes(".replace(\"/contradictions/\"")).toBe(false);
  });
});
