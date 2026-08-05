/**
 * SUBSYS-003 Slice A — unit proofs for authenticated Inspector evidence drill-down.
 *
 * In-memory fake db findFirst handlers only (no vi.mock on prisma).
 * Revision evidence createdAt ISO survival: canonical-model-projection integration.
 */

import { describe, expect, it, vi } from "vitest";
import {
  ContradictionStatus,
  PatternClaimStatus,
  ReferenceStatus,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

vi.mock("server-only", () => ({}));

import {
  buildCanonicalEvidenceSelectionId,
  projectCanonicalInspectorEvidenceDrilldown,
  type CanonicalInspectorEvidenceRelationshipInput,
} from "../canonical-inspector-evidence-projection";

const USER = "user_evidence_projection";
const MU = "mu_evidence_projection";
const REV = "rev_resulting";
const SRC_TIME = new Date("2026-03-10T14:30:00.000Z");
const REL_TIME = "2026-01-15T10:00:00.000Z";
const UEL_SUMMARY = "UEL SUMMARY MUST NEVER APPEAR IN DRILLDOWN";
const UEL_SNIPPET = "UEL SNIPPET MUST NEVER APPEAR IN DRILLDOWN";
const UEL_QUOTE = "UEL QUOTE MUST NEVER APPEAR IN DRILLDOWN";

type Db = Parameters<typeof projectCanonicalInspectorEvidenceDrilldown>[0]["db"];
type Rel = Partial<CanonicalInspectorEvidenceRelationshipInput>;
type Case = {
  name: string;
  rel: Rel;
  rows: Partial<Record<keyof Db, unknown>>;
  out: "null" | Record<string, unknown>;
  uel?: boolean;
};

const noop = async () => null;

function db(rows: Partial<Record<keyof Db, unknown>> = {}): Db {
  const base = () => ({ findFirst: noop });
  return {
    patternClaim: (rows.patternClaim as Db["patternClaim"]) ?? base(),
    patternClaimEvidence: (rows.patternClaimEvidence as Db["patternClaimEvidence"]) ?? base(),
    contradictionNode: (rows.contradictionNode as Db["contradictionNode"]) ?? base(),
    contradictionEvidence: (rows.contradictionEvidence as Db["contradictionEvidence"]) ?? base(),
    profileArtifact: (rows.profileArtifact as Db["profileArtifact"]) ?? base(),
    evidenceSpan: (rows.evidenceSpan as Db["evidenceSpan"]) ?? base(),
    referenceItem: (rows.referenceItem as Db["referenceItem"]) ?? base(),
    surfacedAction: (rows.surfacedAction as Db["surfacedAction"]) ?? base(),
    journalEntry: (rows.journalEntry as Db["journalEntry"]) ?? base(),
    quickCheckIn: (rows.quickCheckIn as Db["quickCheckIn"]) ?? base(),
    session: (rows.session as Db["session"]) ?? base(),
    message: (rows.message as Db["message"]) ?? base(),
    importUploadSession: (rows.importUploadSession as Db["importUploadSession"]) ?? base(),
    importUploadChunk: (rows.importUploadChunk as Db["importUploadChunk"]) ?? base(),
  };
}

function rel(overrides: Rel = {}): CanonicalInspectorEvidenceRelationshipInput {
  return {
    relationshipId: "rel_base",
    modelUpdateId: MU,
    userId: USER,
    evidenceClass: "direct_movement_evidence",
    targetType: UnderstandingLinkTargetType.model_update,
    targetId: MU,
    sourceType: UnderstandingLinkSourceType.message,
    sourceId: "msg_base",
    role: UnderstandingLinkRole.supports,
    relationshipCreatedAt: REL_TIME,
    returnSelectionId: MU,
    ...overrides,
  };
}

function msgRow(id: string, content: string, role = "user", createdAt: Date | null = SRC_TIME) {
  return { findFirst: async () => ({ id, role, content, createdAt }) };
}

function assertNoUel(value: unknown) {
  const s = JSON.stringify(value);
  for (const needle of [UEL_SUMMARY, UEL_SNIPPET, UEL_QUOTE, "UEL"]) {
    expect(s).not.toContain(needle);
  }
}

async function project(r: Rel, rows: Partial<Record<keyof Db, unknown>>, expectedRev?: string) {
  return projectCanonicalInspectorEvidenceDrilldown({
    relationship: rel(r),
    db: db(rows),
    expectedResultingRevisionId:
      r.targetType === UnderstandingLinkTargetType.canonical_concept_revision
        ? (expectedRev ?? REV)
        : undefined,
  });
}

describe("buildCanonicalEvidenceSelectionId", () => {
  it("is deterministic and canonical-evidence- prefixed", () => {
    const args = {
      modelUpdateId: MU,
      evidenceClass: "direct_movement_evidence" as const,
      relationshipId: "rel_a",
    };
    expect(buildCanonicalEvidenceSelectionId(args)).toBe(
      buildCanonicalEvidenceSelectionId(args),
    );
    expect(buildCanonicalEvidenceSelectionId(args)).toMatch(
      /^canonical-evidence-[a-f0-9]{64}$/,
    );
  });

  it("varies by relationship id", () => {
    const shared = { modelUpdateId: MU, evidenceClass: "direct_movement_evidence" as const };
    expect(
      buildCanonicalEvidenceSelectionId({ ...shared, relationshipId: "rel_one" }),
    ).not.toBe(buildCanonicalEvidenceSelectionId({ ...shared, relationshipId: "rel_two" }));
  });
});

describe("evidence class binding", () => {
  it("model_update → direct; matching revision → resulting; wrong target → null", async () => {
    const rows = { message: msgRow("m1", "text") };
    expect(
      (await project({ relationshipId: "r1", sourceId: "m1" }, rows))?.evidenceClass,
    ).toBe("direct_movement_evidence");
    expect(
      (
        await project(
          {
            relationshipId: "r2",
            sourceId: "m1",
            evidenceClass: "resulting_revision_evidence",
            targetType: UnderstandingLinkTargetType.canonical_concept_revision,
            targetId: REV,
          },
          rows,
        )
      )?.evidenceClass,
    ).toBe("resulting_revision_evidence");
    expect(
      await project(
        {
          relationshipId: "r3",
          sourceId: "m1",
          evidenceClass: "resulting_revision_evidence",
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: "rev_other",
        },
        rows,
      ),
    ).toBeNull();
  });
});

describe("source adapters", () => {
  const cases: Case[] = [
    {
      name: "message available (user + supports)",
      rel: { relationshipId: "r_msg", sourceId: "msg_ok", sourceType: "message", role: "supports" },
      rows: { message: msgRow("msg_ok", "Actual message body from source") },
      out: {
        sourceDisclosure: "available",
        snippet: "Actual message body from source",
        summary: null,
        sourceTypeLabel: "Conversation message",
      },
      uel: true,
    },
    { name: "message missing", rel: { sourceId: "missing" }, rows: {}, out: "null" },
    {
      name: "message assistant + supports → unavailable",
      rel: { sourceId: "msg_asst", role: "supports" },
      rows: { message: msgRow("msg_asst", "Assistant leak", "assistant") },
      out: { sourceDisclosure: "unavailable", snippet: null, summary: null },
    },
    {
      name: "pattern_claim active",
      rel: { sourceId: "pc_a", sourceType: "pattern_claim" },
      rows: {
        patternClaim: {
          findFirst: async () => ({
            id: "pc_a",
            summary: "Active pattern summary from source",
            status: PatternClaimStatus.active,
            createdAt: SRC_TIME,
          }),
        },
      },
      out: {
        sourceDisclosure: "available",
        snippet: "Active pattern summary from source",
        summary: "Active pattern summary from source",
      },
      uel: true,
    },
    {
      name: "pattern_claim candidate redacted",
      rel: { sourceId: "pc_c", sourceType: "pattern_claim" },
      rows: {
        patternClaim: {
          findFirst: async () => ({
            id: "pc_c",
            summary: "private",
            status: PatternClaimStatus.candidate,
            createdAt: SRC_TIME,
          }),
        },
      },
      out: { sourceDisclosure: "redacted", snippet: null, summary: null },
    },
    {
      name: "journal_entry title + body",
      rel: { sourceId: "j1", sourceType: "journal_entry" },
      rows: {
        journalEntry: {
          findFirst: async () => ({
            id: "j1",
            title: "Journal title from source",
            body: "Journal body from source",
            authoredAt: SRC_TIME,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
          }),
        },
      },
      out: {
        sourceDisclosure: "available",
        summary: "Journal title from source",
        snippet: "Journal title from source\n\nJournal body from source",
      },
      uel: true,
    },
    {
      name: "surfaced_action with note",
      rel: { sourceId: "sa1", sourceType: "surfaced_action" },
      rows: {
        surfacedAction: {
          findFirst: async () => ({
            id: "sa1",
            note: "Action note from source",
            bucket: "follow_up",
            status: "open",
            surfacedAt: SRC_TIME,
          }),
        },
      },
      out: { sourceDisclosure: "available", snippet: "Action note from source", summary: null },
      uel: true,
    },
    {
      name: "surfaced_action empty note",
      rel: { sourceId: "sa0", sourceType: "surfaced_action" },
      rows: {
        surfacedAction: {
          findFirst: async () => ({
            id: "sa0",
            note: "",
            bucket: "follow_up",
            status: "open",
            surfacedAt: SRC_TIME,
          }),
        },
      },
      out: { sourceDisclosure: "unavailable", snippet: null, summary: null },
    },
    {
      name: "session unavailable, title from label",
      rel: { sourceId: "s1", sourceType: "session" },
      rows: {
        session: {
          findFirst: async () => ({
            id: "s1",
            label: "Evening explore chat",
            surfaceType: "explore_chat",
            startedAt: SRC_TIME,
            createdAt: new Date("2026-02-01T00:00:00.000Z"),
          }),
        },
      },
      out: {
        sourceDisclosure: "unavailable",
        snippet: null,
        summary: null,
        title: "Evening explore chat",
      },
    },
    {
      name: "reference_item active",
      rel: { sourceId: "ref_a", sourceType: "reference_item" },
      rows: {
        referenceItem: {
          findFirst: async () => ({
            id: "ref_a",
            statement: "Reference statement from source",
            status: ReferenceStatus.active,
            createdAt: SRC_TIME,
          }),
        },
      },
      out: { sourceDisclosure: "available", snippet: "Reference statement from source" },
      uel: true,
    },
    {
      name: "reference_item candidate redacted",
      rel: { sourceId: "ref_c", sourceType: "reference_item" },
      rows: {
        referenceItem: {
          findFirst: async () => ({
            id: "ref_c",
            statement: "private",
            status: ReferenceStatus.candidate,
            createdAt: SRC_TIME,
          }),
        },
      },
      out: { sourceDisclosure: "redacted", snippet: null, summary: null },
    },
    {
      name: "contradiction_node open",
      rel: { sourceId: "cn_o", sourceType: "contradiction_node" },
      rows: {
        contradictionNode: {
          findFirst: async () => ({
            id: "cn_o",
            title: "Open contradiction title",
            status: ContradictionStatus.open,
            createdAt: SRC_TIME,
          }),
        },
      },
      out: {
        sourceDisclosure: "available",
        snippet: "Open contradiction title",
        summary: "Open contradiction title",
      },
      uel: true,
    },
    {
      name: "contradiction_node candidate redacted",
      rel: { sourceId: "cn_c", sourceType: "contradiction_node" },
      rows: {
        contradictionNode: {
          findFirst: async () => ({
            id: "cn_c",
            title: "private",
            status: ContradictionStatus.candidate,
            createdAt: SRC_TIME,
          }),
        },
      },
      out: { sourceDisclosure: "redacted", snippet: null, summary: null },
    },
    {
      name: "pattern_claim_evidence available",
      rel: { sourceId: "pce1", sourceType: "pattern_claim_evidence" },
      rows: {
        patternClaimEvidence: {
          findFirst: async () => ({
            id: "pce1",
            quote: "Pattern receipt quote from source",
            createdAt: SRC_TIME,
            claim: { status: PatternClaimStatus.active, summary: "Parent claim" },
          }),
        },
      },
      out: {
        sourceDisclosure: "available",
        snippet: "Pattern receipt quote from source",
        title: "Parent claim",
      },
      uel: true,
    },
    {
      name: "pattern_claim_evidence parent candidate redacted",
      rel: { sourceId: "pce_c", sourceType: "pattern_claim_evidence" },
      rows: {
        patternClaimEvidence: {
          findFirst: async () => ({
            id: "pce_c",
            quote: "private quote",
            createdAt: SRC_TIME,
            claim: { status: PatternClaimStatus.candidate, summary: "Candidate" },
          }),
        },
      },
      out: { sourceDisclosure: "redacted", snippet: null, summary: null },
    },
    {
      name: "contradiction_evidence available",
      rel: { sourceId: "ce1", sourceType: "contradiction_evidence" },
      rows: {
        contradictionEvidence: {
          findFirst: async () => ({
            id: "ce1",
            quote: "Signal receipt quote from source",
            createdAt: SRC_TIME,
            node: { status: ContradictionStatus.open },
          }),
        },
      },
      out: {
        sourceDisclosure: "available",
        snippet: "Signal receipt quote from source",
        sourceTypeLabel: "Signal receipt",
      },
      uel: true,
    },
    {
      name: "contradiction_evidence parent archived redacted",
      rel: { sourceId: "ce_a", sourceType: "contradiction_evidence" },
      rows: {
        contradictionEvidence: {
          findFirst: async () => ({
            id: "ce_a",
            quote: "private",
            createdAt: SRC_TIME,
            node: { status: ContradictionStatus.archived_tension },
          }),
        },
      },
      out: { sourceDisclosure: "redacted", snippet: null, summary: null },
    },
    {
      name: "profile_artifact active",
      rel: { sourceId: "pa1", sourceType: "profile_artifact" },
      rows: {
        profileArtifact: {
          findFirst: async () => ({
            id: "pa1",
            claim: "Active profile claim from source",
            status: "active",
            firstSeenAt: SRC_TIME,
            lastSeenAt: SRC_TIME,
          }),
        },
      },
      out: {
        sourceDisclosure: "available",
        snippet: "Active profile claim from source",
        summary: "Active profile claim from source",
      },
      uel: true,
    },
    {
      name: "profile_artifact superseded redacted",
      rel: { sourceId: "pa_s", sourceType: "profile_artifact" },
      rows: {
        profileArtifact: {
          findFirst: async () => ({
            id: "pa_s",
            claim: "private",
            status: "superseded",
            firstSeenAt: SRC_TIME,
            lastSeenAt: SRC_TIME,
          }),
        },
      },
      out: { sourceDisclosure: "redacted", snippet: null, summary: null },
    },
    {
      name: "evidence_span available with hash match",
      rel: { sourceId: "es1", sourceType: "evidence_span" },
      rows: {
        evidenceSpan: {
          findFirst: async () => {
            const content = "Prefix authorised span text suffix";
            const charStart = 7;
            const charEnd = 27;
            const slice = content.slice(charStart, charEnd);
            const { createHash } = await import("crypto");
            return {
              id: "es1",
              messageId: "m_span",
              charStart,
              charEnd,
              contentHash: createHash("sha256").update(slice).digest("hex"),
              createdAt: SRC_TIME,
              message: {
                id: "m_span",
                userId: USER,
                content,
                createdAt: SRC_TIME,
              },
            };
          },
        },
      },
      out: {
        sourceDisclosure: "available",
        snippet: "authorised span text",
        sourceTypeLabel: "Evidence span",
      },
      uel: true,
    },
    {
      name: "evidence_span hash mismatch unavailable",
      rel: { sourceId: "es_bad", sourceType: "evidence_span" },
      rows: {
        evidenceSpan: {
          findFirst: async () => ({
            id: "es_bad",
            messageId: "m_span",
            charStart: 0,
            charEnd: 5,
            contentHash: "deadbeef",
            createdAt: SRC_TIME,
            message: {
              id: "m_span",
              userId: USER,
              content: "hello world",
              createdAt: SRC_TIME,
            },
          }),
        },
      },
      out: { sourceDisclosure: "unavailable", snippet: null, summary: null },
    },
    {
      name: "quick_check_in with note",
      rel: { sourceId: "qc1", sourceType: "quick_check_in" },
      rows: {
        quickCheckIn: {
          findFirst: async () => ({
            id: "qc1",
            stateTag: "settled",
            note: "Check-in note from source",
            createdAt: SRC_TIME,
          }),
        },
      },
      out: {
        sourceDisclosure: "available",
        snippet: "Check-in note from source",
        title: "settled",
      },
      uel: true,
    },
    {
      name: "import_record session unavailable body",
      rel: { sourceId: "imp1", sourceType: "import_record" },
      rows: {
        importUploadSession: {
          findFirst: async () => ({
            id: "imp1",
            filename: "notes.txt",
            createdAt: SRC_TIME,
          }),
        },
      },
      out: {
        sourceDisclosure: "unavailable",
        snippet: null,
        summary: null,
        title: "notes.txt",
      },
    },
    {
      name: "import_record missing omit",
      rel: { sourceId: "imp_missing", sourceType: "import_record" },
      rows: {},
      out: "null",
    },
    { name: "timeline_aggregation omit", rel: { sourceType: "timeline_aggregation", sourceId: "t1" }, rows: {}, out: "null" },
    { name: "user_correction omit", rel: { sourceType: "user_correction", sourceId: "u1" }, rows: {}, out: "null" },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const result = await project(c.rel, c.rows);
      if (c.out === "null") {
        expect(result).toBeNull();
        return;
      }
      expect(result).toMatchObject(c.out);
      expect(result?.returnSelectionId).toBe(MU);
      expect(result?.sourceOrigin).toBeTruthy();
      expect(result?.sourceOrigin?.toLowerCase()).not.toContain("linked evidence");
      if (c.rel.sourceType === "message") expect(result?.title).toContain("Conversation message");
      if (c.uel) assertNoUel(result);
    });
  }
});

describe("recordedAt", () => {
  const sessionNullTime = {
    session: {
      findFirst: async () => ({
        id: "s_nt",
        label: "Untimed",
        surfaceType: null,
        startedAt: null,
        createdAt: null,
      }),
    },
  };

  it("source time beats relationshipCreatedAt; fallback; both null", async () => {
    expect(
      (await project({ sourceId: "m_t", relationshipCreatedAt: "2020-01-01T00:00:00.000Z" }, {
        message: msgRow("m_t", "probe"),
      }))?.recordedAt,
    ).toBe(SRC_TIME.toISOString());

    expect(
      (await project(
        { sourceId: "s_nt", sourceType: "session", relationshipCreatedAt: REL_TIME },
        sessionNullTime,
      ))?.recordedAt,
    ).toBe(REL_TIME);

    const bothNull = await project(
      { sourceId: "s_nt", sourceType: "session", relationshipCreatedAt: null },
      sessionNullTime,
    );
    expect(bothNull?.recordedAt).toBeNull();
    expect(bothNull?.recordedLabel).toBeNull();
  });
});

describe("UEL isolation", () => {
  it("uses source content only, never UEL summary/snippet/quote", async () => {
    void UEL_SUMMARY;
    void UEL_SNIPPET;
    void UEL_QUOTE;
    const result = await project(
      { relationshipId: "r_uel", sourceId: "m_iso" },
      { message: msgRow("m_iso", "Authoritative message content only") },
    );
    expect(result?.snippet).toBe("Authoritative message content only");
    assertNoUel(result);
  });
});
