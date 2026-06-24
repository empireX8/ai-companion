import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  fetchMapMovementPreview,
  fetchMapOpenQuestionsPreview,
  MAP_MOVEMENT_EMPTY_COPY,
  MAP_MOVEMENT_PREVIEW_LIMIT,
  MAP_MOVEMENT_SECTION_LABEL,
  MAP_OPEN_QUESTIONS_EMPTY_COPY,
  MAP_OPEN_QUESTIONS_PREVIEW_LIMIT,
  MAP_OPEN_QUESTIONS_SECTION_LABEL,
  toMapMovementRowTitle,
} from "../your-map-preview-surface";
import type { TodayIntelligenceUpdateItem } from "../today-intelligence-updates";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
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

describe("your-map-preview-surface", () => {
  it("uses public-safe movement and active-questions endpoints only", () => {
    const source = readSource("lib/your-map-preview-surface.ts");
    expect(source).toContain("TODAY_INTELLIGENCE_UPDATES_ENDPOINT");
    expect(source).toContain("ACTIVE_QUESTIONS_ENDPOINT");
    expect(source).not.toContain("/api/internal/");
    expect(source).not.toContain("beforeSummary");
    expect(source).not.toContain("afterSummary");
    expect(source).not.toContain("candidate");
    expect(source).not.toContain("mock");
  });

  it("caps preview lists for compact Map bands", () => {
    expect(MAP_MOVEMENT_PREVIEW_LIMIT).toBe(3);
    expect(MAP_OPEN_QUESTIONS_PREVIEW_LIMIT).toBe(4);
  });

  it("formats movement row titles from published-safe fields only", () => {
    expect(toMapMovementRowTitle(movementItem("mu-1"))).toBe("Strengthened · Pattern");
  });

  it("uses honest empty copy for movement and open questions", () => {
    expect(MAP_MOVEMENT_EMPTY_COPY).toContain("No recent");
    expect(MAP_MOVEMENT_EMPTY_COPY).toContain("movement");
    expect(MAP_OPEN_QUESTIONS_EMPTY_COPY).toContain("No active questions");
  });

  it("labels sections with governed Mind Model language", () => {
    expect(MAP_MOVEMENT_SECTION_LABEL).toContain("Mind Model movement");
    expect(MAP_OPEN_QUESTIONS_SECTION_LABEL).toContain("Needs more evidence");
  });

  it("does not expose fetch helpers that invent preview data", () => {
    expect(fetchMapMovementPreview).toBeTypeOf("function");
    expect(fetchMapOpenQuestionsPreview).toBeTypeOf("function");
    const source = readSource("lib/your-map-preview-surface.ts");
    expect(source).not.toContain("synthetic");
    expect(source).not.toContain("placeholder");
  });
});

describe("your-map preview bands wiring", () => {
  it("renders movement and open-question preview sections on Map", () => {
    const workbenchSource = readSource("components/your-map/YourMapWorkbench.tsx");
    const previewSource = readSource("components/your-map/YourMapPreviewBands.tsx");

    expect(workbenchSource).toContain("YourMapPreviewBands");
    expect(workbenchSource).toContain("YourMapMindContextPanel");
    expect(previewSource).toContain('testId="your-map-movement-preview"');
    expect(previewSource).toContain('testId="your-map-open-questions-preview"');
    expect(previewSource).toContain("fetchMapMovementPreview");
    expect(previewSource).toContain("fetchMapOpenQuestionsPreview");
    expect(previewSource).toContain('objectType: "model_update"');
    expect(previewSource).toContain('tab: "movement"');
    expect(previewSource).toContain("/active-questions/");
    expect(previewSource).not.toContain('objectType: "investigation"');
  });
});
