import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildActiveQuestionDetailHref,
  buildLinkedObjectHref,
  buildYourMapDetailHref,
  buildWatchForDetailHref,
  toActiveQuestionListItem,
  toYourMapListItem,
  toWatchForListItem,
} from "../public-intelligence-safe-slice";

describe("Phase 3 public intelligence safe-slice helpers", () => {
  it("builds active-question, watch-for, and your-map detail hrefs only from real IDs", () => {
    expect(buildActiveQuestionDetailHref("inv-1")).toBe("/active-questions/inv-1");
    expect(buildWatchForDetailHref("fw-1")).toBe("/watch-for/fw-1");
    expect(buildYourMapDetailHref("umc-1")).toBe("/your-map/umc-1");

    expect(buildActiveQuestionDetailHref("   ")).toBeNull();
    expect(buildWatchForDetailHref("")).toBeNull();
    expect(buildYourMapDetailHref("")).toBeNull();
    expect(buildActiveQuestionDetailHref(undefined)).toBeNull();
    expect(buildWatchForDetailHref(null)).toBeNull();
    expect(buildYourMapDetailHref(undefined)).toBeNull();
  });

  it("maps linked object hrefs from real backend IDs only", () => {
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "investigation",
        linkedObjectId: "inv-9",
      })
    ).toBe("/active-questions/inv-9");
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-2",
      })
    ).toBe("/patterns/pc-2");
    expect(
      buildLinkedObjectHref({
        linkedObjectType: "contradiction_node",
        linkedObjectId: "cn-4",
      })
    ).toBe("/contradictions/cn-4");

    expect(
      buildLinkedObjectHref({
        linkedObjectType: "usermap_conclusion",
        linkedObjectId: "umc-1",
      })
    ).toBeNull();
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

  it("keeps unresolved linked targets in explicit non-link state", () => {
    const item = toWatchForListItem({
      id: "fw-8",
      prompt: "Watch for conflict spikes",
      reason: "Investigate trigger pattern",
      status: "active",
      linkedObjectType: "usermap_conclusion",
      linkedObjectId: "umc-internal-1",
      priority: 2,
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    expect(item).not.toBeNull();
    expect(item?.linkedObjectId).toBe("umc-internal-1");
    expect(item?.linkedObjectHref).toBeNull();
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

    const combined =
      `${activeQuestionsSource}\n` +
      `${activeQuestionDetailSource}\n` +
      `${watchForSource}\n` +
      `${watchForDetailSource}\n` +
      `${yourMapSource}\n` +
      `${yourMapDetailSource}`;
    expect(combined.includes("/api/internal/user-map/review-candidates")).toBe(false);
    expect(combined.includes("/internal/user-map/review")).toBe(false);
    expect(combined.includes("/api/user-map")).toBe(false);
    expect(combined.includes("internal_only")).toBe(false);
    expect(combined.includes("receipt-action-")).toBe(false);
  });
});
