import { describe, expect, it, vi } from "vitest";

import {
  assessSurfacedEvidencePointerMaterialization,
  buildSurfacedEvidencePointerId,
  buildUnderstandingEvidenceLinksForSurfacedPointer,
  isGenericSourceText,
  isUnstableSurfacedPointerId,
  materializeSurfacedEvidencePointerForUser,
  normalizeSurfacedEvidencePointerLinks,
  upsertSurfacedEvidencePointerRecord,
  type SurfacedEvidencePointerMaterializationInput,
  type SurfacedEvidencePointerWriterDb,
} from "../live-evidence-depth-write-path";
import { graphSlotFromUelMeta } from "../live-evidence-depth-write-contract";

const NOW = new Date("2026-07-08T21:00:00.000Z");

const BASE_INPUT: SurfacedEvidencePointerMaterializationInput = {
  userId: "user-1",
  sourceObjectType: "pattern_claim",
  sourceObjectId: "claim-1",
  sourceText: "I keep working past the stop point even when I said I would not.",
  sourceOrigin: "Recent Pattern",
  surfacedAt: NOW,
  whyItMatters:
    "Connects evening overwork to the missing stop point before commitments lock.",
  materializedFrom: "model_update_publish",
  links: [
    {
      targetType: "usermap_conclusion",
      targetId: "conclusion-1",
      role: "supports",
      graphSlot: "related",
      publicEligible: true,
      summary: "Supported by three journal captures in the same week.",
    },
  ],
};

describe("live evidence depth write path", () => {
  it("builds stable pointer ids from source identity", () => {
    expect(
      buildSurfacedEvidencePointerId({
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
      }),
    ).toBe("receipt-pattern-claim-1");
    expect(
      buildSurfacedEvidencePointerId({
        sourceObjectType: "contradiction_node",
        sourceObjectId: "node-1",
      }),
    ).toBe("receipt-tension-node-1");
  });

  it("rejects index/title-derived unstable pointer ids", () => {
    expect(isUnstableSurfacedPointerId("receipt-0-evening-stress")).toBe(true);
    expect(isUnstableSurfacedPointerId("receipt-pattern-claim-1")).toBe(false);
  });

  it("rejects generic sourceText strings", () => {
    expect(isGenericSourceText("Recent pattern.")).toBe(true);
    expect(isGenericSourceText("Related evidence.")).toBe(true);
    expect(isGenericSourceText("Evidence pointer.")).toBe(true);
    expect(isGenericSourceText("Surfaced from your recent material.")).toBe(true);
    expect(
      isGenericSourceText(
        "I keep working past the stop point even when I said I would not.",
      ),
    ).toBe(false);
  });

  it("materializes a valid pointer payload with required fields", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "receipt-pattern-claim-1" });
    const createLink = vi.fn().mockResolvedValue({ id: "uel-1" });
    const db = {
      surfacedEvidencePointer: { upsert: vi.fn() },
    } as unknown as SurfacedEvidencePointerWriterDb;

    const result = await materializeSurfacedEvidencePointerForUser(BASE_INPUT, {
      now: () => NOW,
      db,
      upsertSurfacedEvidencePointer: upsert,
      createUnderstandingEvidenceLink: createLink,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.pointerId).toBe("receipt-pattern-claim-1");
    expect(result.pointer.whyItMatters).toBe(BASE_INPUT.whyItMatters);
    expect(result.pointer.publicEligible).toBe(true);
    expect(result.pointer.materializedFrom).toBe("model_update_publish");
    expect(upsert).toHaveBeenCalledOnce();
    expect(createLink).toHaveBeenCalledOnce();
    expect(result.uelLinksWritten).toBe(1);
    expect(result.persistedPointerId).toBe("receipt-pattern-claim-1");
  });

  it("fails when whyItMatters is missing or generic", async () => {
    const missing = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      whyItMatters: "",
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) {
      return;
    }
    expect(missing.assessment.blockers).toContain("missing_why_it_matters");

    const generic = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      whyItMatters: "Surfaced from your recent material.",
    });
    expect(generic.ok).toBe(false);
    if (generic.ok) {
      return;
    }
    expect(generic.assessment.blockers).toContain("generic_why_it_matters");
  });

  it("fails when whyItMatters equals sourceText", async () => {
    const result = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      whyItMatters: BASE_INPUT.sourceText,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.assessment.blockers).toContain("why_it_matters_equals_source_text");
  });

  it("fails when sourceObjectType or sourceObjectId is missing", async () => {
    const missingType = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      sourceObjectType: "" as "pattern_claim",
    });
    expect(missingType.ok).toBe(false);
    if (missingType.ok) {
      return;
    }
    expect(missingType.assessment.blockers).toContain("missing_source_object_type");

    const missingId = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      sourceObjectId: "",
    });
    expect(missingId.ok).toBe(false);
    if (missingId.ok) {
      return;
    }
    expect(missingId.assessment.blockers).toContain("missing_source_object_id");
  });

  it("fails when no links are provided", async () => {
    const result = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      links: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.assessment.blockers).toContain("no_eligible_links");
  });

  it("excludes unauthorized/ineligible links during normalization", async () => {
    const normalized = await normalizeSurfacedEvidencePointerLinks({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      links: [
        {
          targetType: "investigation",
          targetId: "inv-internal",
          role: "context",
          graphSlot: "context",
          publicEligible: false,
        },
        {
          targetType: "usermap_conclusion",
          targetId: "conclusion-1",
          role: "supports",
          graphSlot: "related",
          publicEligible: true,
        },
      ],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.targetId).toBe("conclusion-1");
  });

  it("blocks materialization when all links are excluded", async () => {
    const result = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      links: [
        {
          targetType: "investigation",
          targetId: "inv-internal",
          role: "context",
          graphSlot: "context",
          publicEligible: false,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.assessment.blockers).toContain("no_eligible_links");
  });

  it("preserves graphSlot in UEL meta for related and context links", () => {
    const payloads = buildUnderstandingEvidenceLinksForSurfacedPointer({
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      links: [
        {
          sourceObjectType: "pattern_claim",
          sourceObjectId: "claim-1",
          targetType: "usermap_conclusion",
          targetId: "conclusion-1",
          role: "supports",
          graphSlot: "related",
          publicEligible: true,
        },
        {
          sourceObjectType: "pattern_claim",
          sourceObjectId: "claim-1",
          targetType: "investigation",
          targetId: "inv-1",
          role: "context",
          graphSlot: "context",
          publicEligible: true,
        },
      ],
    });

    expect(payloads).toHaveLength(2);
    expect(graphSlotFromUelMeta(payloads[0]?.meta)).toBe("related");
    expect(graphSlotFromUelMeta(payloads[1]?.meta)).toBe("context");
    expect(payloads[0]?.sourceType).toBe("pattern_claim");
    expect(payloads[0]?.sourceId).toBe("claim-1");
  });

  it("does not set publicEligible true unless pointer and eligible links pass", async () => {
    const dryRun = await materializeSurfacedEvidencePointerForUser(BASE_INPUT, {
      now: () => NOW,
    });
    expect(dryRun.ok).toBe(true);
    if (!dryRun.ok) {
      return;
    }
    expect(dryRun.pointer.publicEligible).toBe(true);

    const blocked = await materializeSurfacedEvidencePointerForUser({
      ...BASE_INPUT,
      links: [{ ...BASE_INPUT.links[0]!, publicEligible: false }],
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    expect(blocked.assessment.blockers).toContain("no_eligible_links");
  });

  it("does not create fallback links when input has none", async () => {
    const createLink = vi.fn();
    const result = await materializeSurfacedEvidencePointerForUser(
      { ...BASE_INPUT, links: [] },
      { createUnderstandingEvidenceLink: createLink },
    );
    expect(result.ok).toBe(false);
    expect(createLink).not.toHaveBeenCalled();
  });

  it("assessment rejects unstable pointer ids in explicit assessment path", () => {
    const assessment = assessSurfacedEvidencePointerMaterialization({
      pointer: {
        id: "receipt-0-evening-stress",
        userId: "user-1",
        pointerKind: "pattern",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        sourceText: BASE_INPUT.sourceText,
        sourceOrigin: BASE_INPUT.sourceOrigin,
        surfacedAt: NOW,
        whyItMatters: BASE_INPUT.whyItMatters,
      },
      links: [
        {
          sourceObjectType: "pattern_claim",
          sourceObjectId: "claim-1",
          targetType: "usermap_conclusion",
          targetId: "conclusion-1",
          role: "supports",
          graphSlot: "related",
          publicEligible: true,
        },
      ],
    });

    expect(assessment.materializationReady).toBe(false);
    expect(assessment.blockers).toContain("unstable_pointer_id");
  });

  it("upserts SurfacedEvidencePointer records via injected db", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "receipt-pattern-claim-1" });
    const db = {
      surfacedEvidencePointer: { upsert },
    } as unknown as SurfacedEvidencePointerWriterDb;

    const row = await upsertSurfacedEvidencePointerRecord({
      db,
      now: NOW,
      input: {
        id: "receipt-pattern-claim-1",
        userId: "user-1",
        pointerKind: "pattern",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
        sourceText: BASE_INPUT.sourceText,
        sourceOrigin: BASE_INPUT.sourceOrigin,
        whyItMatters: BASE_INPUT.whyItMatters,
        surfacedAt: NOW,
        publicEligible: true,
        materializedFrom: "test",
      },
    });

    expect(row.id).toBe("receipt-pattern-claim-1");
    expect(upsert).toHaveBeenCalledOnce();
    const call = upsert.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      userId_sourceObjectType_sourceObjectId: {
        userId: "user-1",
        sourceObjectType: "pattern_claim",
        sourceObjectId: "claim-1",
      },
    });
    expect(call?.create?.whyItMatters).toBe(BASE_INPUT.whyItMatters);
    expect(call?.create?.publicEligible).toBe(true);
  });
});
