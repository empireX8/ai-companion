import { describe, expect, it } from "vitest";

import type { SurfacedActionView } from "../actions-api";
import {
  enrichTimelineActivityEntry,
  mapActionsToTimelineEntries,
  mapInvestigationsToTimelineEntries,
  mapWatchForToTimelineEntries,
  modelChangeMatchesFilter,
  timelineEntryMatchesFilter,
} from "../timeline-semantic-layers";
import type { TimelineEntry } from "../timeline-surface";

describe("timeline semantic layers", () => {
  const windowStart = new Date("2026-05-01T00:00:00.000Z");

  it("maps fieldwork and investigation updates into semantic timeline entries", () => {
    const fieldwork = mapWatchForToTimelineEntries(
      [
        {
          id: "fw-1",
          prompt: "Watch for overload cues",
          reason: "Linked to recovery pattern",
          status: "active",
          statusLabel: "Active",
          linkedObjectType: "pattern_claim",
          linkedObjectId: "pc-1",
          linkedObjectHref: "/patterns/pc-1",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-18T10:00:00.000Z",
        },
      ],
      windowStart
    );

    const investigations = mapInvestigationsToTimelineEntries(
      [
        {
          id: "inv-1",
          title: "Why recovery slips after conflict",
          organizingQuestion: "What precedes overload?",
          status: "open",
          statusLabel: "Open",
          createdAt: "2026-05-09T09:00:00.000Z",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
      windowStart
    );

    expect(fieldwork[0]?.kind).toBe("fieldwork");
    expect(fieldwork[0]?.lane).toBe("fieldwork");
    expect(investigations[0]?.kind).toBe("investigation");
    expect(investigations[0]?.href).toBe("/active-questions/inv-1");
  });

  it("maps action status updates without inventing decision entities", () => {
    const action: SurfacedActionView = {
      id: "action-1",
      title: "Take a decompression window",
      whySuggested: "Recovery pattern is active",
      bucket: "stabilize",
      effort: "Low",
      linkedFamily: null,
      linkedFamilyLabel: null,
      linkedClaimId: "pc-1",
      linkedClaimSummary: "Recovery needs decompression",
      linkedGoalId: null,
      linkedGoalStatement: null,
      linkedSourceLabel: "Pattern",
      status: "helped",
      note: null,
      surfacedAt: "2026-05-10T09:00:00.000Z",
      updatedAt: "2026-05-18T10:00:00.000Z",
    };

    const entries = mapActionsToTimelineEntries([action], windowStart);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.selectableObjectType).toBe("pattern_claim");
    expect(entries[0]?.selectableObjectId).toBe("pc-1");
    expect(entries[0]?.lane).toBe("decisions_actions");
  });

  it("enriches legacy activity chips with semantic lanes", () => {
    const enriched = enrichTimelineActivityEntry({
      id: "journal-1",
      occurredAt: "2026-05-18T10:00:00.000Z",
      chip: "Journal",
      title: "Daily note",
      body: "Preview",
      href: "/library/journal-journal-1",
    });

    expect(enriched.kind).toBe("journal");
    expect(enriched.lane).toBe("receipts_activity");
  });

  it("filters stream items by semantic category", () => {
    const journalEntry: TimelineEntry = {
      id: "journal-1",
      occurredAt: "2026-05-18T10:00:00.000Z",
      chip: "Journal",
      title: "Daily note",
      body: "Preview",
      href: "/library/journal-journal-1",
      kind: "journal",
      lane: "receipts_activity",
    };

    expect(timelineEntryMatchesFilter(journalEntry, "evidence_receipts")).toBe(true);
    expect(timelineEntryMatchesFilter(journalEntry, "model_movement")).toBe(false);
    expect(modelChangeMatchesFilter("model_movement")).toBe(true);
    expect(modelChangeMatchesFilter("sessions_activity")).toBe(false);
  });

  it("keeps fieldwork entries on real detail pages without inspector object types", () => {
    const fieldwork = mapWatchForToTimelineEntries(
      [
        {
          id: "fw-1",
          prompt: "Watch for overload cues",
          reason: "Linked to recovery pattern",
          status: "active",
          statusLabel: "Active",
          linkedObjectType: "pattern_claim",
          linkedObjectId: "pc-1",
          linkedObjectHref: "/patterns/pc-1",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-18T10:00:00.000Z",
        },
      ],
      windowStart
    );

    expect(fieldwork[0]?.href).toBe("/watch-for/fw-1");
    expect(fieldwork[0]?.selectableObjectType).toBeNull();
  });
});
