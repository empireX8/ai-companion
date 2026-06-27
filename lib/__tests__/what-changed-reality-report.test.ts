import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../prismadb", () => ({
  default: {},
}));
vi.mock("../public-linked-object-continuity", () => ({
  applyVerifiedAffectedObjectHrefs: vi.fn(),
}));

import { reportContainsBannedLanguage } from "../reality-tracking-output-contract";
import {
  buildDeterministicModelMovementRealityReport,
  type ModelMovementRealityPacket,
} from "../what-changed-reality-report";

function makePacket(
  evidenceTexts: string[],
  overrides: Partial<ModelMovementRealityPacket> = {}
): ModelMovementRealityPacket {
  const base: ModelMovementRealityPacket = {
    item: {
      id: "mu-1",
      updateTypeLabel: "Conclusion Strengthened",
      affectedObjectType: "usermap_conclusion",
      affectedObjectTypeLabel: "Related map item",
      affectedObjectId: "umc-1",
      affectedObjectHref: "/your-map/umc-1",
      userFacingSummary: "The current recovery pattern strengthened.",
      createdAt: "2026-06-27T09:00:00.000Z",
    },
    modelUpdate: {
      id: "mu-1",
      updateTypeLabel: "Conclusion Strengthened",
      affectedObjectType: "usermap_conclusion",
      affectedObjectTypeLabel: "Related map item",
      userFacingSummary: "The current recovery pattern strengthened.",
      createdAt: "2026-06-27T09:00:00.000Z",
      before: "Previous model read",
      after: "Current model read",
      confidenceShift: 0.2,
    },
    affectedObject: {
      type: "usermap_conclusion",
      title: "Recovery architecture",
      summary: "The user tends to stabilize after naming the immediate constraint.",
      statusLabel: "Supported",
      confidenceLabel: "High",
      evidenceCount: 4,
      sourceDiversity: 2,
      timeSpreadDays: 7,
      correctionLabel: null,
      detailHref: "/your-map/umc-1",
    },
    evidence: evidenceTexts.map((text, index) => ({
      id: `ev-${index + 1}`,
      sourceType:
        index % 2 === 0 ? "journal_entry" : ("message" as const),
      sourceId: `src-${index + 1}`,
      role: "supports",
      createdAt: `2026-06-2${index + 1}T09:00:00.000Z`,
      sourceTypeLabel: index % 2 === 0 ? "Journal entry" : "Conversation message",
      displayLabel: `Receipt ${index + 1}`,
      href: null,
      analysisText: text,
    })),
    relatedFieldwork: [],
    relatedActions: [],
    recentMovements: [],
  };

  return {
    ...base,
    ...overrides,
    evidence: overrides.evidence ?? base.evidence,
    relatedFieldwork: overrides.relatedFieldwork ?? base.relatedFieldwork,
    relatedActions: overrides.relatedActions ?? base.relatedActions,
    recentMovements: overrides.recentMovements ?? base.recentMovements,
  };
}

function allClaimItems(report: ReturnType<typeof buildDeterministicModelMovementRealityReport>) {
  return [
    ...report.facts.items,
    ...report.stronglySupportedClaims.items,
    ...report.inferences.items,
    ...report.speculations.items,
    ...report.overreachGuardrails.items,
    ...report.loopPatternDetection.items,
    ...report.modelMovement.items,
    ...report.realityGate.items,
    ...report.fieldworkWatchFor.items,
    ...report.reentryAction.items,
    ...report.whatWouldChangeThisConclusion.items,
  ];
}

describe("what-changed reality report", () => {
  it("handles emotionally vague input without reassurance, therapy framing, or motivational fog", () => {
    const packet = makePacket([
      "I feel completely broken and everything is too much and nothing works anymore.",
    ]);

    const report = buildDeterministicModelMovementRealityReport(packet);
    const body = JSON.stringify(report).toLowerCase();

    expect(reportContainsBannedLanguage(report)).toBe(false);
    expect(body).not.toContain("trauma");
    expect(body).not.toContain("healing journey");
    expect(body).not.toContain("growth mindset");
    expect(report.facts.items.some((item) => item.text.includes("emotionally intense"))).toBe(
      true
    );
    expect(
      report.fieldworkWatchFor.items.some(
        (item) =>
          item.text.includes("Capture the next instance") ||
          item.text.includes("trigger")
      )
    ).toBe(true);
  });

  it("flags contradiction loops without inventing a hidden cause", () => {
    const packet = makePacket([
      "I said I would stop weed on Monday.",
      "Bought weed on Wednesday after work.",
      "Smoked on Friday night.",
    ]);

    const report = buildDeterministicModelMovementRealityReport(packet);
    const body = JSON.stringify(report).toLowerCase();

    expect(
      report.loopPatternDetection.items.some((item) =>
        item.text.includes("intention to stop, later purchase, then later use")
      )
    ).toBe(true);
    expect(body).not.toContain("childhood");
    expect(body).not.toContain("hidden cause");
    expect(
      report.fieldworkWatchFor.items.some(
        (item) =>
          item.text.includes("body state") &&
          item.text.includes("location") &&
          item.text.includes("trigger pressure")
      )
    ).toBe(true);
    expect(
      report.whatWouldChangeThisConclusion.items.some((item) =>
        item.text.includes("no purchase or use")
      )
    ).toBe(true);
  });

  it("refuses flattering unverifiable competence claims", () => {
    const packet = makePacket([
      "I'm actually really smart for building this system, right?",
    ]);

    const report = buildDeterministicModelMovementRealityReport(packet);
    const body = JSON.stringify(report).toLowerCase();

    expect(body).not.toContain("you are smart");
    expect(body).not.toContain("you deserve");
    expect(
      report.facts.items.some((item) =>
        item.text.includes("validation about competence")
      )
    ).toBe(true);
    expect(
      report.realityGate.items.some((item) =>
        item.text.includes("shipped work") || item.text.includes("outside outcomes")
      )
    ).toBe(true);
  });

  it("refuses unsupported diagnosis and turns it into evidence collection", () => {
    const packet = makePacket(["Why am I like this?"]);

    const report = buildDeterministicModelMovementRealityReport(packet);
    const body = JSON.stringify(report).toLowerCase();

    expect(body).not.toContain("childhood");
    expect(body).not.toContain("trauma");
    expect(
      report.overreachGuardrails.items.some((item) =>
        item.text.includes("Do not infer diagnosis")
      )
    ).toBe(true);
    expect(
      report.speculations.items.some((item) =>
        item.text.includes("state, environment, or timing")
      )
    ).toBe(true);
    expect(
      report.fieldworkWatchFor.items.some(
        (item) =>
          item.text.includes("trigger") &&
          item.text.includes("body state") &&
          item.text.includes("30 minutes before")
      )
    ).toBe(true);
  });

  it("keeps major claims traceable back to linked receipts", () => {
    const packet = makePacket(
      [
        "I said I would stop weed on Monday.",
        "Bought weed on Wednesday after work.",
        "Smoked on Friday night.",
      ],
      {
        relatedActions: [
          {
            id: "act-1",
            label: "Action outcome · Stabilize",
            statusLabel: "Didnt Help",
            updatedAt: "2026-06-27T10:00:00.000Z",
          },
        ],
      }
    );

    const report = buildDeterministicModelMovementRealityReport(packet);
    const items = allClaimItems(report);
    const packetEvidenceIds = new Set(packet.evidence.map((item) => item.id));

    expect(report.stronglySupportedClaims.items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(item.classification).toBeTruthy();
      expect(item.evidenceStatus).toBeTruthy();
      expect(item.evidenceRefs.length).toBeGreaterThan(0);
      for (const ref of item.evidenceRefs) {
        expect(packetEvidenceIds.has(ref.id)).toBe(true);
      }
    }
  });
});
