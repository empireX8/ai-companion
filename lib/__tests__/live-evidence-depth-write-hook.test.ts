import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  buildDepthSafeSurfacedEvidencePointerGraph,
  mergeSurfacedEvidenceDepthObjects,
  projectSurfacedEvidencePointerToOrvekObject,
  type SurfacedEvidencePointerRecord,
  type UnderstandingEvidenceLinkRow,
} from "../live-evidence-depth-linkage";
import { graphSlotFromUelMeta, uelMetaWithGraphSlot } from "../live-evidence-depth-write-contract";
import { buildSurfacedEvidencePointerId } from "../live-evidence-depth-write-path";
import {
  assessEvidenceDepthWriteHookInput,
  assessStoredPublishRationaleForEvidencePointer,
  buildSurfacedEvidencePointerCandidateFromPublishEvent,
  EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM,
  getEligibleEvidenceDepthLinksForSource,
  isModelUpdateMovementRationale,
  maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish,
  maybeMaterializeSurfacedEvidencePointerFromPublishEvent,
  type EvidenceDepthWriteHookLinkCandidate,
  type EvidenceDepthWriteHookPublishEvent,
} from "../live-evidence-depth-write-hook";
import { canUseLiveEvidenceInspectorDepthList } from "../orvek-v0/production/evidence-inspector-depth-parity";
import { EMPTY_ORVEK_DATA_API } from "../orvek-v0/empty-api";
import type { OrvekObject } from "../orvek-v0/orvek-types";

const NOW = new Date("2026-07-09T12:00:00.000Z");

const HONEST_RATIONALE =
  "Connects evening overwork to the missing stop point before commitments lock.";

const SOURCE_TEXT =
  "I keep working past the stop point even when I said I would not.";

const ELIGIBLE_LINK: EvidenceDepthWriteHookLinkCandidate = {
  targetType: "usermap_conclusion",
  targetId: "conclusion-1",
  role: "supports",
  graphSlot: "related",
  publicEligible: true,
  summary: "Supported by three journal captures in the same week.",
};

const BASE_EVENT: EvidenceDepthWriteHookPublishEvent = {
  userId: "user-1",
  materializedFrom: EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM.explicitPublishEvent,
  sourceObjectType: "pattern_claim",
  sourceObjectId: "claim-1",
  storedRationale: HONEST_RATIONALE,
  sourceText: SOURCE_TEXT,
  sourceOrigin: "Recent Pattern",
  surfacedAt: NOW,
  links: [ELIGIBLE_LINK],
};

const RELATED_TARGET: OrvekObject = {
  id: "conclusion-1",
  type: "map-object",
  title: "Evening stop point matters",
  summary: "Commitments lock before the body signals a stop.",
  whyItMatters: "Explains why overwork repeats after stated boundaries.",
};

function linkRow(input: {
  targetId: string;
  graphSlot?: "related" | "context";
  meta?: unknown;
  targetType?: UnderstandingEvidenceLinkRow["targetType"];
}): UnderstandingEvidenceLinkRow {
  return {
    sourceType: "pattern_claim",
    sourceId: "claim-1",
    targetType: input.targetType ?? "usermap_conclusion",
    targetId: input.targetId,
    role: input.graphSlot === "context" ? "context" : "supports",
    summary: null,
    meta: input.meta ?? (input.graphSlot ? uelMetaWithGraphSlot(input.graphSlot) : {}),
  };
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live evidence depth write hook", () => {
  it("creates/upserts SurfacedEvidencePointer via materializer for valid publish input", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "receipt-pattern-claim-1" });
    const createLink = vi.fn().mockResolvedValue({ id: "uel-1" });
    const db = { surfacedEvidencePointer: { upsert: vi.fn() } };

    const outcome = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
      BASE_EVENT,
      {
        now: () => NOW,
        db: db as never,
        upsertSurfacedEvidencePointer: upsert,
        createUnderstandingEvidenceLink: createLink,
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.pointerId).toBe("receipt-pattern-claim-1");
    expect(upsert).toHaveBeenCalledOnce();
    expect(createLink).toHaveBeenCalledOnce();
    expect(outcome.persistedPointerId).toBe("receipt-pattern-claim-1");
  });

  it("builds stable pointer ids from source identity, not index/title", () => {
    const candidate = buildSurfacedEvidencePointerCandidateFromPublishEvent(
      BASE_EVENT,
      [ELIGIBLE_LINK],
    );
    expect(
      buildSurfacedEvidencePointerId({
        sourceObjectType: candidate.sourceObjectType,
        sourceObjectId: candidate.sourceObjectId,
      }),
    ).toBe("receipt-pattern-claim-1");
    expect(candidate.sourceObjectId).toBe("claim-1");
  });

  it("accepts non-generic storedRationale as whyItMatters", () => {
    const assessment = assessStoredPublishRationaleForEvidencePointer({
      storedRationale: HONEST_RATIONALE,
      sourceText: SOURCE_TEXT,
    });
    expect(assessment.hookReady).toBe(true);
    expect(assessment.blockers).toEqual([]);
  });

  it("rejects generic storedRationale", () => {
    const assessment = assessStoredPublishRationaleForEvidencePointer({
      storedRationale: "Surfaced from your recent material.",
      sourceText: SOURCE_TEXT,
    });
    expect(assessment.hookReady).toBe(false);
    expect(assessment.blockers).toContain("generic_stored_rationale");
  });

  it("rejects missing storedRationale", () => {
    const assessment = assessEvidenceDepthWriteHookInput(
      { ...BASE_EVENT, storedRationale: "   " },
      [ELIGIBLE_LINK],
    );
    expect(assessment.hookReady).toBe(false);
    expect(assessment.blockers).toContain("missing_stored_rationale");
  });

  it("rejects storedRationale equal to sourceText", () => {
    const assessment = assessStoredPublishRationaleForEvidencePointer({
      storedRationale: SOURCE_TEXT,
      sourceText: SOURCE_TEXT,
    });
    expect(assessment.hookReady).toBe(false);
    expect(assessment.blockers).toContain("rationale_equals_source_text");
  });

  it("rejects publish events with no eligible links", async () => {
    const outcome = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent({
      ...BASE_EVENT,
      links: [],
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.assessment.blockers).toContain("missing_eligible_links");
  });

  it("excludes UEL rows missing graphSlot and blocks readiness when none remain", async () => {
    const resolution = await getEligibleEvidenceDepthLinksForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      linkRows: [
        linkRow({ targetId: "conclusion-1", meta: {} }),
        linkRow({ targetId: "conclusion-2", graphSlot: "related" }),
      ],
      checkPublicTargetEligibility: async () => true,
    });
    expect(resolution.excludedMissingGraphSlot).toBe(1);
    expect(resolution.eligible).toHaveLength(1);
    expect(resolution.eligible[0]?.targetId).toBe("conclusion-2");

    const outcome = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
      { ...BASE_EVENT, links: undefined },
      {
        findEligibleLinks: async () => [],
      },
    );
    expect(outcome.ok).toBe(false);
  });

  it("excludes unauthorized/private link targets", async () => {
    const resolution = await getEligibleEvidenceDepthLinksForSource({
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      linkRows: [
        linkRow({ targetId: "conclusion-private", graphSlot: "related" }),
        linkRow({ targetId: "conclusion-public", graphSlot: "related" }),
      ],
      checkPublicTargetEligibility: async ({ targetId }) =>
        targetId === "conclusion-public",
    });
    expect(resolution.excludedIneligible).toBe(1);
    expect(resolution.eligible.map((link) => link.targetId)).toEqual([
      "conclusion-public",
    ]);
  });

  it("does not write when all links are excluded", async () => {
    const upsert = vi.fn();
    const outcome = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
      {
        ...BASE_EVENT,
        links: [
          {
            ...ELIGIBLE_LINK,
            publicEligible: false,
          },
        ],
      },
      {
        now: () => NOW,
        resolveLinkPublicEligibility: async () => false,
        upsertSurfacedEvidencePointer: upsert,
        db: { surfacedEvidencePointer: { upsert: vi.fn() } } as never,
      },
    );
    expect(outcome.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts the same pointer for duplicate source instead of creating unstable ids", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ id: "receipt-pattern-claim-1" })
      .mockResolvedValueOnce({ id: "receipt-pattern-claim-1" });
    const deps = {
      now: () => NOW,
      db: { surfacedEvidencePointer: { upsert: vi.fn() } } as never,
      upsertSurfacedEvidencePointer: upsert,
      createUnderstandingEvidenceLink: vi.fn().mockResolvedValue({ id: "uel-1" }),
    };

    const first = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
      BASE_EVENT,
      deps,
    );
    const second = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
      BASE_EVENT,
      deps,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.pointerId).toBe(second.pointerId);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("preserves related/context graphSlot slots in UEL payloads", async () => {
    const createLink = vi.fn().mockResolvedValue({ id: "uel-1" });
    const outcome = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
      {
        ...BASE_EVENT,
        links: [
          ELIGIBLE_LINK,
          {
            targetType: "investigation",
            targetId: "inv-1",
            role: "context",
            graphSlot: "context",
            publicEligible: true,
          },
        ],
      },
      {
        now: () => NOW,
        db: { surfacedEvidencePointer: { upsert: vi.fn() } } as never,
        upsertSurfacedEvidencePointer: vi
          .fn()
          .mockResolvedValue({ id: "receipt-pattern-claim-1" }),
        createUnderstandingEvidenceLink: createLink,
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.uelLinkPayloads).toHaveLength(2);
    expect(graphSlotFromUelMeta(outcome.uelLinkPayloads[0]?.meta)).toBe("related");
    expect(graphSlotFromUelMeta(outcome.uelLinkPayloads[1]?.meta)).toBe("context");
  });

  it("hook-written fixture passes canUseLiveEvidenceInspectorDepthList with read linkage", async () => {
    const pointer: SurfacedEvidencePointerRecord = {
      id: "receipt-pattern-claim-1",
      userId: "user-1",
      sourceObjectType: "pattern_claim",
      sourceObjectId: "claim-1",
      sourceText: SOURCE_TEXT,
      sourceOrigin: "Recent Pattern",
      whyItMatters: HONEST_RATIONALE,
      whyResurfaced: null,
      surfacedAt: NOW,
      publicEligible: true,
      status: "active",
    };

    const graph = await buildDepthSafeSurfacedEvidencePointerGraph({
      userId: "user-1",
      pointers: [pointer],
      linkRows: [linkRow({ targetId: RELATED_TARGET.id, graphSlot: "related" })],
      deps: {
        checkPublicTargetEligibility: async () => true,
        hydrateLinkedTargetObject: async () => RELATED_TARGET,
      },
    });

    const merged = mergeSurfacedEvidenceDepthObjects(EMPTY_ORVEK_DATA_API, graph);
    expect(
      canUseLiveEvidenceInspectorDepthList(merged, graph.depthSafePointerIds),
    ).toBe(true);
    expect(merged.getObject(pointer.id)?.whyItMatters).toBe(HONEST_RATIONALE);
    expect(
      projectSurfacedEvidencePointerToOrvekObject({
        pointer,
        relatedIds: [RELATED_TARGET.id],
        contextIds: [],
      }).relatedIds,
    ).toEqual([RELATED_TARGET.id]);
  });

  it("does not change Today UI source files", () => {
    const todaySource = readSource("components/orvek-v0/pages/today.tsx");
    expect(todaySource.includes("live-evidence-depth-write-hook")).toBe(false);
    expect(todaySource.includes("SurfacedEvidencePointer")).toBe(false);
  });

  it("blocks model-update publish when only movement copy rationale exists", async () => {
    expect(
      isModelUpdateMovementRationale(
        "There is early evidence that energy drops after meetings.",
      ),
    ).toBe(true);

    const outcome = await maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish(
      {
        userId: "user-1",
        modelUpdateId: "mu-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: "There is early evidence that energy drops after meetings.",
        publishedAt: NOW,
      },
      {
        findSourceEvidence: async () => ({
          sourceText: SOURCE_TEXT,
          sourceOrigin: "Recent Pattern",
        }),
        findEligibleLinks: async () => [ELIGIBLE_LINK],
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.blockers).toContain("movement_copy_rationale");
  });

  it("materializes from model-update publish when stored surfacing rationale is injected", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "receipt-pattern-claim-1" });
    const outcome = await maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish(
      {
        userId: "user-1",
        modelUpdateId: "mu-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: "There is early evidence that energy drops after meetings.",
        publishedAt: NOW,
      },
      {
        now: () => NOW,
        db: { surfacedEvidencePointer: { upsert: vi.fn() } } as never,
        upsertSurfacedEvidencePointer: upsert,
        createUnderstandingEvidenceLink: vi.fn().mockResolvedValue({ id: "uel-1" }),
        findSourceEvidence: async () => ({
          sourceText: SOURCE_TEXT,
          sourceOrigin: "Recent Pattern",
        }),
        findEligibleLinks: async () => [ELIGIBLE_LINK],
        resolveStoredSurfacingRationale: async () => HONEST_RATIONALE,
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.pointer?.whyItMatters).toBe(HONEST_RATIONALE);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
