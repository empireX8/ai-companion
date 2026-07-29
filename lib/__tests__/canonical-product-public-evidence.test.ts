/**
 * Phase 5 correction — public evidence safety unit proofs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContradictionStatus,
  PatternClaimStatus,
  ReferenceStatus,
  Role,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
} from "@prisma/client";

import { projectCanonicalEvidenceForPublic } from "../canonical-product-public-evidence";
import { PUBLIC_EVIDENCE_LINKED_LABEL } from "../public-continuity-registry";

const ownershipMock = vi.fn();

vi.mock("../understanding-evidence-link-writer", () => ({
  verifyUnderstandingEvidenceLinkSourceOwnership: (...args: unknown[]) =>
    ownershipMock(...args),
}));

describe("canonical public evidence projector", () => {
  beforeEach(() => {
    ownershipMock.mockReset();
    ownershipMock.mockResolvedValue(true);
  });

  it("redacts pattern_claim candidates without exposing sourceId/snippet/quote", async () => {
    const db = {
      patternClaim: {
        findFirst: vi.fn(async () => ({
          id: "pc1",
          status: PatternClaimStatus.candidate,
        })),
      },
      contradictionNode: { findFirst: vi.fn() },
      profileArtifact: { findFirst: vi.fn() },
      referenceItem: { findFirst: vi.fn() },
      journalEntry: { findFirst: vi.fn() },
      quickCheckIn: { findFirst: vi.fn() },
      message: { findFirst: vi.fn() },
      session: { findFirst: vi.fn() },
    };

    const out = await projectCanonicalEvidenceForPublic({
      userId: "u1",
      db: db as never,
      evidence: [
        {
          id: "ev1",
          sourceType: UnderstandingLinkSourceType.pattern_claim,
          sourceId: "pc1",
          role: UnderstandingLinkRole.supports,
          summary: "secret candidate summary",
          snippet: "secret snippet",
          quote: "secret quote",
        },
      ],
    });

    expect(out).toHaveLength(1);
    expect(out[0]?.disclosure).toBe("redacted");
    expect(out[0]?.sourceId).toBeNull();
    expect(out[0]?.snippet).toBeNull();
    expect(out[0]?.quote).toBeNull();
    expect(out[0]?.sourceObjectHref).toBeNull();
    expect(JSON.stringify(out)).not.toContain("pc1");
    expect(JSON.stringify(out)).not.toContain("secret snippet");
    expect(JSON.stringify(out)).not.toContain("secret quote");
  });

  it("exposes pattern/contradiction via public continuity labels only", async () => {
    const db = {
      patternClaim: {
        findFirst: vi.fn(async () => ({
          id: "pc_ok",
          status: PatternClaimStatus.active,
        })),
      },
      contradictionNode: {
        findFirst: vi.fn(async () => ({
          id: "cn_ok",
          status: ContradictionStatus.open,
        })),
      },
      profileArtifact: { findFirst: vi.fn() },
      referenceItem: { findFirst: vi.fn() },
      journalEntry: { findFirst: vi.fn() },
      quickCheckIn: { findFirst: vi.fn() },
      message: { findFirst: vi.fn() },
      session: { findFirst: vi.fn() },
    };

    const out = await projectCanonicalEvidenceForPublic({
      userId: "u1",
      db: db as never,
      evidence: [
        {
          id: "ev-pc",
          sourceType: UnderstandingLinkSourceType.pattern_claim,
          sourceId: "pc_ok",
          role: UnderstandingLinkRole.supports,
          summary: "RAW UEL SUMMARY MUST NOT LEAK",
          snippet: "RAW UEL SNIPPET",
          quote: "RAW UEL QUOTE",
        },
        {
          id: "ev-cn",
          sourceType: UnderstandingLinkSourceType.contradiction_node,
          sourceId: "cn_ok",
          role: UnderstandingLinkRole.context,
          summary: "RAW CONTRADICTION SUMMARY",
          snippet: "RAW CONTRADICTION SNIPPET",
          quote: "RAW CONTRADICTION QUOTE",
        },
      ],
    });

    expect(out[0]).toMatchObject({
      disclosure: "public",
      sourceId: "pc_ok",
      summary: PUBLIC_EVIDENCE_LINKED_LABEL,
      snippet: null,
      quote: null,
      sourceObjectHref: "/patterns/pc_ok",
    });
    expect(out[1]).toMatchObject({
      disclosure: "public",
      sourceId: "cn_ok",
      summary: PUBLIC_EVIDENCE_LINKED_LABEL,
      snippet: null,
      quote: null,
      sourceObjectHref: "/contradictions/cn_ok",
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain("RAW UEL");
    expect(json).not.toContain("RAW CONTRADICTION");
    expect(json).not.toContain('href=""');
  });

  it("redacts profile, reference, journal, check-in, and message despite ownership", async () => {
    const db = {
      patternClaim: { findFirst: vi.fn() },
      contradictionNode: { findFirst: vi.fn() },
      profileArtifact: {
        findFirst: vi.fn(async () => ({ id: "pa1", status: "candidate" })),
      },
      referenceItem: {
        findFirst: vi.fn(async () => ({
          id: "ri1",
          status: ReferenceStatus.active,
        })),
      },
      journalEntry: {
        findFirst: vi.fn(async () => ({ id: "j1" })),
      },
      quickCheckIn: {
        findFirst: vi.fn(async () => ({ id: "qc1" })),
      },
      message: {
        findFirst: vi.fn(async () => ({
          id: "m1",
          role: Role.assistant,
        })),
      },
      session: { findFirst: vi.fn() },
    };

    const out = await projectCanonicalEvidenceForPublic({
      userId: "u1",
      db: db as never,
      evidence: [
        {
          id: "ev-pa",
          sourceType: UnderstandingLinkSourceType.profile_artifact,
          sourceId: "pa1",
          role: UnderstandingLinkRole.context,
          summary: "profile raw",
          snippet: "hidden",
          quote: "hidden quote",
        },
        {
          id: "ev-ri",
          sourceType: UnderstandingLinkSourceType.reference_item,
          sourceId: "ri1",
          role: UnderstandingLinkRole.context,
          summary: "ref raw",
          snippet: "hidden ref",
          quote: "hidden ref quote",
        },
        {
          id: "ev-j",
          sourceType: UnderstandingLinkSourceType.journal_entry,
          sourceId: "j1",
          role: UnderstandingLinkRole.supports,
          summary: "journal support raw",
          snippet: "journal snippet raw",
          quote: "RAW QUOTE MUST NOT LEAK",
        },
        {
          id: "ev-qc",
          sourceType: UnderstandingLinkSourceType.quick_check_in,
          sourceId: "qc1",
          role: UnderstandingLinkRole.supports,
          summary: "checkin raw",
          snippet: "checkin snippet",
          quote: "checkin quote raw",
        },
        {
          id: "ev-m",
          sourceType: UnderstandingLinkSourceType.message,
          sourceId: "m1",
          role: UnderstandingLinkRole.context,
          summary: "assistant context raw",
          snippet: "should not show",
          quote: "hidden reasoning",
        },
      ],
    });

    expect(out.every((row) => row.disclosure === "redacted")).toBe(true);
    expect(out.every((row) => row.sourceObjectHref === null)).toBe(true);
    expect(out.every((row) => row.sourceId === null)).toBe(true);
    expect(out.every((row) => row.snippet === null)).toBe(true);
    const json = JSON.stringify(out);
    expect(json).not.toContain("journal support raw");
    expect(json).not.toContain("journal snippet raw");
    expect(json).not.toContain("RAW QUOTE");
    expect(json).not.toContain("assistant context raw");
    expect(json).not.toContain("hidden reasoning");
    expect(json).not.toContain("j1");
    expect(json).not.toContain("m1");
  });

  it("fails closed on missing/cross-user evidence ownership", async () => {
    ownershipMock.mockResolvedValueOnce(false);
    const db = {
      patternClaim: { findFirst: vi.fn() },
      contradictionNode: { findFirst: vi.fn() },
      profileArtifact: { findFirst: vi.fn() },
      referenceItem: { findFirst: vi.fn() },
      journalEntry: { findFirst: vi.fn() },
      quickCheckIn: { findFirst: vi.fn() },
      message: { findFirst: vi.fn() },
      session: { findFirst: vi.fn() },
    };

    await expect(
      projectCanonicalEvidenceForPublic({
        userId: "u1",
        db: db as never,
        evidence: [
          {
            id: "ev",
            sourceType: UnderstandingLinkSourceType.journal_entry,
            sourceId: "j-missing",
            role: UnderstandingLinkRole.supports,
            summary: "x",
            snippet: "y",
            quote: "z",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BROKEN_CANONICAL_PROJECTION" });
  });
});
