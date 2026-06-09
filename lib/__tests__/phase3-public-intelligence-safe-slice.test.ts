import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildActiveQuestionDetailHref,
  buildLinkedObjectHref,
  buildWhatChangedAffectedObjectHref,
  buildYourMapDetailHref,
  buildWatchForDetailHref,
  toActiveQuestionListItem,
  toUserMapConclusionPublicApiDetailItem,
  toUserMapConclusionPublicApiListItem,
  toWhatChangedListItem,
  toYourMapListItem,
  toWatchForListItem,
  USER_MAP_CONCLUSION_PUBLIC_API_INTERNAL_FIELDS,
} from "../public-intelligence-safe-slice";
import { buildPublicObjectHref } from "../public-continuity-registry";

describe("Phase 3 public intelligence safe-slice helpers", () => {
  it("builds active-question, watch-for, and your-map detail hrefs only from real IDs", () => {
    expect(buildActiveQuestionDetailHref("inv-1")).toBe("/active-questions/inv-1");
    expect(buildWatchForDetailHref("fw-1")).toBe("/watch-for/fw-1");
    expect(buildYourMapDetailHref("umc-1")).toBe(
      buildPublicObjectHref({ type: "usermap_conclusion", id: "umc-1" })
    );

    expect(buildActiveQuestionDetailHref("   ")).toBeNull();
    expect(buildWatchForDetailHref("")).toBeNull();
    expect(buildYourMapDetailHref("")).toBeNull();
    expect(buildActiveQuestionDetailHref(undefined)).toBeNull();
    expect(buildWatchForDetailHref(null)).toBeNull();
    expect(buildYourMapDetailHref(undefined)).toBeNull();
  });

  it("maps what-changed affected-object links from allowlisted real IDs only", () => {
    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-1",
      })
    ).toBe(buildPublicObjectHref({ type: "usermap_conclusion", id: "umc-1" }));
    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-2",
      })
    ).toBe(buildPublicObjectHref({ type: "pattern_claim", id: "pc-2" }));
    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "contradiction_node",
        affectedObjectId: "cn-4",
      })
    ).toBe(buildPublicObjectHref({ type: "contradiction_node", id: "cn-4" }));
    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "investigation",
        affectedObjectId: "inv-9",
      })
    ).toBe(buildPublicObjectHref({ type: "investigation", id: "inv-9" }));
    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "fieldwork_assignment",
        affectedObjectId: "fw-9",
      })
    ).toBe(buildPublicObjectHref({ type: "fieldwork_assignment", id: "fw-9" }));

    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "model_update",
        affectedObjectId: "mu-1",
      })
    ).toBeNull();
    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "pattern_claim",
        affectedObjectId: "   ",
      })
    ).toBeNull();
  });

  it("maps linked object hrefs from real backend IDs only", () => {
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "usermap_conclusion",
        linkedObjectId: "umc-9",
      })
    ).toBe(buildPublicObjectHref({ type: "usermap_conclusion", id: "umc-9" }));
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-2",
      })
    ).toBe(buildPublicObjectHref({ type: "pattern_claim", id: "pc-2" }));
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "contradiction_node",
        linkedObjectId: "cn-4",
      })
    ).toBe(buildPublicObjectHref({ type: "contradiction_node", id: "cn-4" }));
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "investigation",
        linkedObjectId: "inv-1",
      })
    ).toBe(buildPublicObjectHref({ type: "investigation", id: "inv-1" }));
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "fieldwork_assignment",
        linkedObjectId: "fw-1",
      })
    ).toBe(buildPublicObjectHref({ type: "fieldwork_assignment", id: "fw-1" }));
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "model_update",
        linkedObjectId: "mu-1",
      })
    ).toBeNull();
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "surfaced_action",
        linkedObjectId: "sa-1",
      })
    ).toBeNull();
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "investigation",
        linkedObjectId: "   ",
      })
    ).toBeNull();
  });

  it("does not create fallback active-question rows from labels when ID is missing", () => {
    const item = toActiveQuestionListItem({
      id: "   ",
      title: "inv-from-title should never become an ID",
      organizingQuestion: "What changed?",
      status: "open",
      seedType: "user_curiosity",
      priority: null,
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).toBeNull();
  });

  it("does not create fallback watch-for rows from labels when ID is missing", () => {
    const item = toWatchForListItem({
      id: "",
      prompt: "watch-for fw-from-prompt should never become an ID",
      reason: "Need more observation",
      status: "assigned",
      linkedObjectType: "investigation",
      linkedObjectId: "inv-1",
      priority: null,
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).toBeNull();
  });

  it("does not create fallback your-map rows from labels when ID is missing", () => {
    const item = toYourMapListItem({
      id: "",
      title: "umc-from-title should never become an ID",
      summary: "No ID means no detail route.",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "low",
      evidenceCount: 0,
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).toBeNull();
  });

  it("maps public user-map API list items without internal lifecycle fields", () => {
    const item = toUserMapConclusionPublicApiListItem({
      id: "umc-1",
      title: "Published conclusion",
      summary: "Safe summary",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "medium",
      evidenceCount: 50,
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).toEqual({
      id: "umc-1",
      title: "Published conclusion",
      summary: "Safe summary",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "medium",
      evidenceCount: 50,
      updatedAt: "2026-05-17T10:00:00.000Z",
    });
    for (const field of USER_MAP_CONCLUSION_PUBLIC_API_INTERNAL_FIELDS) {
      expect(item).not.toHaveProperty(field);
    }
  });

  it("maps public user-map API detail items without internal lifecycle fields", () => {
    const item = toUserMapConclusionPublicApiDetailItem({
      id: "umc-1",
      title: "Published conclusion",
      summary: "Safe summary",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "medium",
      evidenceCount: 50,
      sourceDiversity: 8,
      timeSpreadDays: 14,
      createdAt: new Date("2026-05-10T08:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).toEqual({
      id: "umc-1",
      title: "Published conclusion",
      summary: "Safe summary",
      area: "operating_logic",
      status: "emerging",
      confidenceLevel: "medium",
      evidenceCount: 50,
      sourceDiversity: 8,
      timeSpreadDays: 14,
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-17T10:00:00.000Z",
    });
    for (const field of USER_MAP_CONCLUSION_PUBLIC_API_INTERNAL_FIELDS) {
      expect(item).not.toHaveProperty(field);
    }
  });

  it("does not create fallback what-changed rows from labels when ID is missing", () => {
    const item = toWhatChangedListItem({
      id: "",
      updateType: "strategy_adjusted",
      affectedObjectType: "usermap_conclusion",
      affectedObjectId: "umc-1",
      userFacingSummary: "mu-from-summary should never become an ID",
      createdAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).toBeNull();
  });

  it("keeps unresolved linked targets in explicit non-link state", () => {
    const item = toWatchForListItem({
      id: "fw-8",
      prompt: "Watch for conflict spikes",
      reason: "Investigate trigger pattern",
      status: "active",
      linkedObjectType: "investigation",
      linkedObjectId: "inv-still-fallback",
      priority: 2,
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).not.toBeNull();
    expect(item?.linkedObjectId).toBe("inv-still-fallback");
    expect(item?.linkedObjectHref).toBe(
      buildPublicObjectHref({ type: "investigation", id: "inv-still-fallback" })
    );
  });

  it("does not reference internal review APIs or forbidden receipt semantics in new public surfaces", () => {
    const activeQuestionsSource = readFileSync(
      path.join(
        process.cwd(),
        "app/(root)/(routes)/active-questions/page.tsx"
      ),
      "utf8"
    );
    const activeQuestionDetailSource = readFileSync(
      path.join(
        process.cwd(),
        "app/(root)/(routes)/active-questions/[id]/page.tsx"
      ),
      "utf8"
    );
    const watchForSource = readFileSync(
      path.join(process.cwd(), "app/(root)/(routes)/watch-for/page.tsx"),
      "utf8"
    );
    const watchForDetailSource = readFileSync(
      path.join(process.cwd(), "app/(root)/(routes)/watch-for/[id]/page.tsx"),
      "utf8"
    );
    const yourMapSource = readFileSync(
      path.join(process.cwd(), "app/(root)/(routes)/your-map/page.tsx"),
      "utf8"
    );
    const yourMapDetailSource = readFileSync(
      path.join(process.cwd(), "app/(root)/(routes)/your-map/[id]/page.tsx"),
      "utf8"
    );
    const whatChangedSource = readFileSync(
      path.join(process.cwd(), "app/(root)/(routes)/what-changed/page.tsx"),
      "utf8"
    );

    const combined =
      `${activeQuestionsSource}\n` +
      `${activeQuestionDetailSource}\n` +
      `${watchForSource}\n` +
      `${watchForDetailSource}\n` +
      `${yourMapSource}\n` +
      `${yourMapDetailSource}\n` +
      `${whatChangedSource}`;
    expect(combined.includes("/api/internal/user-map/review-candidates")).toBe(false);
    expect(combined.includes("/internal/user-map/review")).toBe(false);
    expect(combined.includes("/api/user-map")).toBe(false);
    expect(combined.includes("/api/model-updates/[id]")).toBe(false);
    expect(combined.includes("internal_only")).toBe(false);
    expect(combined.includes("receipt-action-")).toBe(false);
  });
});
