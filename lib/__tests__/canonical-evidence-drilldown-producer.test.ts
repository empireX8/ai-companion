/**
 * SUBSYS-003 Slice A producer proof (mocked row shapes).
 *
 * Fail-closed convention proven here: a direct evidence relationship whose
 * source does not resolve through the existing user-scoped source query is
 * omitted from the drill-down projection and from the browser-visible report
 * references. The canonical ModelUpdate detail itself is still returned, so an
 * orphaned or ineligible evidence row cannot downgrade the already-proven
 * SUBSYS-002 canonical Inspector reader. Canonical lineage corruption remains
 * the only condition that rejects the whole canonical detail.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  UnderstandingLinkTargetType,
} from "@prisma/client";

vi.mock("server-only", () => ({}));

const modelUpdateFindFirst = vi.fn();
const modelUpdateFindMany = vi.fn();
const proposalFindFirst = vi.fn();
const proposalFindMany = vi.fn();
const evidenceFindMany = vi.fn();
const userMapConclusionFindFirst = vi.fn();
const fieldworkAssignmentFindMany = vi.fn();
const surfacedActionFindMany = vi.fn();
const journalEntryFindMany = vi.fn();
const messageFindMany = vi.fn();
const messageFindFirst = vi.fn();
const journalEntryFindFirst = vi.fn();
const surfacedActionFindFirst = vi.fn();
const patternClaimFindFirst = vi.fn();
const contradictionNodeFindFirst = vi.fn();
const sessionFindFirst = vi.fn();
const readConceptMock = vi.fn();

vi.mock("../prismadb", () => ({
  default: {
    modelUpdate: {
      findFirst: (...args: unknown[]) => modelUpdateFindFirst(...args),
      findMany: (...args: unknown[]) => modelUpdateFindMany(...args),
    },
    exploreMovementProposal: {
      findFirst: (...args: unknown[]) => proposalFindFirst(...args),
      findMany: (...args: unknown[]) => proposalFindMany(...args),
    },
    understandingEvidenceLink: {
      findMany: (...args: unknown[]) => evidenceFindMany(...args),
    },
    userMapConclusion: {
      findFirst: (...args: unknown[]) => userMapConclusionFindFirst(...args),
      findMany: vi.fn(async () => []),
    },
    investigation: { findFirst: vi.fn(async () => null) },
    fieldworkAssignment: {
      findFirst: vi.fn(async () => null),
      findMany: (...args: unknown[]) => fieldworkAssignmentFindMany(...args),
    },
    patternClaim: {
      findFirst: (...args: unknown[]) => patternClaimFindFirst(...args),
      findMany: vi.fn(async () => []),
    },
    patternClaimEvidence: {
      findFirst: vi.fn(async () => null),
    },
    contradictionNode: {
      findFirst: (...args: unknown[]) => contradictionNodeFindFirst(...args),
      findMany: vi.fn(async () => []),
    },
    contradictionEvidence: {
      findFirst: vi.fn(async () => null),
    },
    profileArtifact: {
      findFirst: vi.fn(async () => null),
    },
    evidenceSpan: {
      findFirst: vi.fn(async () => null),
    },
    referenceItem: {
      findFirst: vi.fn(async () => null),
    },
    surfacedAction: {
      findFirst: (...args: unknown[]) => surfacedActionFindFirst(...args),
      findMany: (...args: unknown[]) => surfacedActionFindMany(...args),
    },
    journalEntry: {
      findFirst: (...args: unknown[]) => journalEntryFindFirst(...args),
      findMany: (...args: unknown[]) => journalEntryFindMany(...args),
    },
    message: {
      findFirst: (...args: unknown[]) => messageFindFirst(...args),
      findMany: (...args: unknown[]) => messageFindMany(...args),
    },
    quickCheckIn: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    session: {
      findFirst: (...args: unknown[]) => sessionFindFirst(...args),
      findMany: vi.fn(async () => []),
    },
    importUploadSession: {
      findFirst: vi.fn(async () => null),
    },
    importUploadChunk: {
      findFirst: vi.fn(async () => null),
    },
  },
}));

vi.mock("../current-understanding-product-projection", () => ({
  readCanonicalProductConceptForUser: (...args: unknown[]) =>
    readConceptMock(...args),
}));

vi.mock("../public-linked-object-continuity", () => ({
  applyVerifiedAffectedObjectHrefs: async ({ items }: { items: unknown[] }) =>
    items,
}));

import { deriveExploreMovementModelUpdateId } from "../explore-movement-proposal-provenance";
import {
  formatLinkedObjectType,
  formatModelUpdateType,
} from "../public-intelligence-safe-slice";
import { buildCanonicalEvidenceSelectionId } from "../canonical-inspector-evidence-projection";
import {
  buildDeterministicModelMovementRealityReport,
  buildWhatChangedInspectorDetail,
  type ModelMovementRealityPacket,
} from "../what-changed-reality-report";

const PROPOSAL_ID = "prop_canonical_evidence_drilldown";
const MODEL_UPDATE_ID = deriveExploreMovementModelUpdateId(PROPOSAL_ID);

/** Rows the authenticated user genuinely owns. Anything else is unresolvable. */
const OWNED_MESSAGE_ROWS = [
  {
    id: "msg-1",
    role: "user",
    content: "The user said they like tea again now.",
    createdAt: new Date("2026-07-28T12:01:00.000Z"),
    sessionId: "session-owned",
  },
  {
    id: "msg-shared",
    role: "user",
    content: "Shared source message body for dual relationships.",
    createdAt: new Date("2026-07-28T12:01:00.000Z"),
    sessionId: "session-owned",
  },
  {
    id: "msg-loop",
    role: "user",
    content: "Loop message body used for reopen identity.",
    createdAt: new Date("2026-07-28T12:01:00.000Z"),
    sessionId: "session-owned",
  },
];

const OWNED_JOURNAL_ROWS = [
  {
    id: "journal-owned",
    title: "Evening reflection",
    body: "Journal body authorised for Inspector disclosure.",
    authoredAt: new Date("2026-07-28T12:05:00.000Z"),
    createdAt: new Date("2026-07-28T12:05:00.000Z"),
  },
];

const OWNED_ACTION_ROWS = [
  {
    id: "action-owned",
    bucket: "follow_up",
    status: "open",
    note: "A recorded follow-up outcome note.",
    surfacedAt: new Date("2026-07-28T12:20:00.000Z"),
    updatedAt: new Date("2026-07-28T12:20:00.000Z"),
  },
];

function requestedIds(args: unknown): string[] {
  const where = (args as { where?: { id?: { in?: string[] } } } | undefined)
    ?.where;
  return where?.id?.in ?? [];
}

function resolveOwnedRows<TRow extends { id: string }>(
  rows: TRow[],
  args: unknown,
): TRow[] {
  const ids = requestedIds(args);
  return rows.filter((row) => ids.includes(row.id));
}

function canonicalProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    userId: "u1",
    status: ExploreMovementProposalStatus.published,
    authorityMode: ExploreMovementAuthorityMode.canonical_v1,
    modelUpdateId: MODEL_UPDATE_ID,
    canonicalConceptId: "concept_1",
    ...overrides,
  };
}

function canonicalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MODEL_UPDATE_ID,
    updateType: "conclusion_strengthened",
    affectedObjectType: UnderstandingLinkTargetType.canonical_concept_revision,
    affectedObjectId: "rev2",
    userFacingSummary: "I like tea again now",
    createdAt: new Date("2026-07-28T12:00:00.000Z"),
    beforeSummary: "I don't like tea anymore",
    afterSummary: "I like tea again now",
    confidenceDelta: null,
    internalNotes: null,
    canonicalConceptId: "concept_1",
    previousRevisionId: "rev1",
    resultingRevisionId: "rev2",
    exploreProposalId: PROPOSAL_ID,
    ...overrides,
  };
}

function directEvidence(overrides: Record<string, unknown> = {}) {
  return {
    id: "uel-direct-1",
    sourceType: "message",
    sourceId: "msg-1",
    role: "supports",
    summary: "Direct evidence summary",
    snippet: null,
    quote: null,
    weight: null,
    confidenceContribution: null,
    createdAt: new Date("2026-07-28T12:01:00.000Z"),
    ...overrides,
  };
}

function revisionEvidence(overrides: Record<string, unknown> = {}) {
  return {
    id: "uel-revision-1",
    sourceType: "message",
    sourceId: "msg-1",
    role: "supports",
    summary: "Revision evidence summary",
    snippet: null,
    quote: null,
    weight: null,
    confidenceContribution: null,
    createdAt: new Date("2026-07-28T12:02:00.000Z"),
    ...overrides,
  };
}

function canonicalConcept(options: {
  evidence?: Array<Record<string, unknown>>;
} = {}) {
  return {
    authorityType: "canonical_concept_revision",
    conceptId: "concept_1",
    currentRevisionId: "rev2",
    version: 2,
    title: "I like tea again now",
    summary: "I like tea again now",
    rationale: "The current revision reflects the accepted correction.",
    acceptedAt: "2026-07-28T12:00:00.000Z",
    evidence: options.evidence ?? [revisionEvidence()],
    revisionHistory: [
      {
        id: "rev1",
        version: 1,
        title: "I don't like tea anymore",
        summary: "I don't like tea anymore",
        rationale: null,
        acceptedAt: "2026-07-27T12:00:00.000Z",
      },
      {
        id: "rev2",
        version: 2,
        title: "I like tea again now",
        summary: "I like tea again now",
        rationale: "The current revision reflects the accepted correction.",
        acceptedAt: "2026-07-28T12:00:00.000Z",
      },
    ],
    movementHistory: [
      {
        modelUpdateId: MODEL_UPDATE_ID,
        exploreProposalId: PROPOSAL_ID,
        previousRevisionId: "rev1",
        resultingRevisionId: "rev2",
        updateType: "conclusion_strengthened",
        beforeSummary: "I don't like tea anymore",
        afterSummary: "I like tea again now",
        userFacingSummary: "I like tea again now",
        createdAt: "2026-07-28T12:00:00.000Z",
      },
    ],
  };
}

async function runCanonicalDetail(options: {
  directEvidence?: Array<Record<string, unknown>>;
  revisionEvidence?: Array<Record<string, unknown>>;
  rowOverrides?: Record<string, unknown>;
}) {
  modelUpdateFindFirst.mockResolvedValueOnce(
    canonicalRow(options.rowOverrides),
  );
  proposalFindMany.mockResolvedValueOnce([canonicalProposal()]);
  proposalFindFirst.mockResolvedValueOnce(canonicalProposal());
  evidenceFindMany.mockResolvedValueOnce(
    options.directEvidence ?? [directEvidence()],
  );
  const revision = (options.revisionEvidence ?? [revisionEvidence()]).map((item) => {
    const row: Record<string, unknown> = {
      ...(item as object as Record<string, unknown>),
    };
    if (row["createdAt"] == null) {
      row["createdAt"] = new Date("2026-07-28T12:02:00.000Z");
    }
    if (row["sourceId"] == null) row["sourceId"] = "msg-1";
    return row;
  });
  // Second UEL query: resulting-revision evidence (independent of public product evidence).
  evidenceFindMany.mockResolvedValueOnce(revision);
  readConceptMock.mockResolvedValueOnce(
    canonicalConcept({ evidence: [] }),
  );

  const detail = await buildWhatChangedInspectorDetail({
    userId: "u1",
    modelUpdateId: MODEL_UPDATE_ID,
  });

  expect(detail?.canonicalInspectorProjection).toBeDefined();
  return detail;
}

function expectNoConsumerWiring(value: unknown) {
  const item = value as Record<string, unknown>;
  expect(item.supporting).toBeUndefined();
  expect(item.conflicting).toBeUndefined();
  expect(item.contextIds).toBeUndefined();
  expect(item.relatedIds).toBeUndefined();
  expect(item.whatWouldChange).toBeUndefined();
  expect(item.returnSelectionId).toBeUndefined();
  expect(item.selectedEvidence).toBeUndefined();
  expect(item.backSelectionId).toBeUndefined();
}

describe("canonical evidence drilldown producer", () => {
  beforeEach(() => {
    modelUpdateFindFirst.mockReset();
    modelUpdateFindMany.mockReset();
    proposalFindFirst.mockReset();
    proposalFindMany.mockReset();
    evidenceFindMany.mockReset();
    userMapConclusionFindFirst.mockReset();
    fieldworkAssignmentFindMany.mockReset();
    surfacedActionFindMany.mockReset();
    journalEntryFindMany.mockReset();
    messageFindMany.mockReset();
    messageFindFirst.mockReset();
    journalEntryFindFirst.mockReset();
    surfacedActionFindFirst.mockReset();
    patternClaimFindFirst.mockReset();
    contradictionNodeFindFirst.mockReset();
    sessionFindFirst.mockReset();
    readConceptMock.mockReset();

    modelUpdateFindMany.mockResolvedValue([]);
    proposalFindFirst.mockResolvedValue(null);
    proposalFindMany.mockResolvedValue([canonicalProposal()]);
    evidenceFindMany.mockResolvedValue([]);
    userMapConclusionFindFirst.mockResolvedValue(null);
    fieldworkAssignmentFindMany.mockResolvedValue([]);
    surfacedActionFindMany.mockImplementation(async (args: unknown) =>
      resolveOwnedRows(OWNED_ACTION_ROWS, args),
    );
    journalEntryFindMany.mockImplementation(async (args: unknown) =>
      resolveOwnedRows(OWNED_JOURNAL_ROWS, args),
    );
    messageFindMany.mockImplementation(async (args: unknown) =>
      resolveOwnedRows(OWNED_MESSAGE_ROWS, args),
    );
    messageFindFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string; userId?: string } })?.where?.id;
      const userId = (args as { where?: { userId?: string } })?.where?.userId;
      if (userId && userId !== "u1") return null;
      return OWNED_MESSAGE_ROWS.find((row) => row.id === id) ?? null;
    });
    journalEntryFindFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string; userId?: string } })?.where?.id;
      const userId = (args as { where?: { userId?: string } })?.where?.userId;
      if (userId && userId !== "u1") return null;
      return OWNED_JOURNAL_ROWS.find((row) => row.id === id) ?? null;
    });
    surfacedActionFindFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string; userId?: string } })?.where?.id;
      const userId = (args as { where?: { userId?: string } })?.where?.userId;
      if (userId && userId !== "u1") return null;
      return OWNED_ACTION_ROWS.find((row) => row.id === id) ?? null;
    });
    patternClaimFindFirst.mockResolvedValue(null);
    contradictionNodeFindFirst.mockResolvedValue(null);
    sessionFindFirst.mockResolvedValue(null);
  });

  it("projects one drill-down per verified relationship without semantic fan-out", async () => {
    const detail = await runCanonicalDetail({
      directEvidence: [
        directEvidence({
          id: "uel-direct-a",
          sourceId: "msg-shared",
          summary: "Repeated safe summary",
        }),
        directEvidence({
          id: "uel-direct-b",
          sourceId: "msg-shared",
          summary: "Repeated safe summary",
        }),
      ],
      revisionEvidence: [
        revisionEvidence({
          id: "uel-revision-a",
          sourceId: "msg-shared",
          summary: "Repeated revision summary",
        }),
        revisionEvidence({
          id: "uel-revision-b",
          sourceId: "msg-shared",
          summary: "Repeated revision summary",
        }),
      ],
    });

    const projection = detail?.canonicalInspectorProjection;
    const direct = projection?.directMovementEvidence ?? [];
    const resulting = projection?.resultingRevisionEvidence ?? [];

    expect(direct).toHaveLength(2);
    expect(resulting).toHaveLength(2);
    expect(
      direct.map((item) => item.canonicalEvidenceDrilldown?.evidenceClass),
    ).toEqual(["direct_movement_evidence", "direct_movement_evidence"]);
    expect(
      resulting.map((item) => item.canonicalEvidenceDrilldown?.evidenceClass),
    ).toEqual(["resulting_revision_evidence", "resulting_revision_evidence"]);
    expect(
      new Set(
        direct.map((item) => item.canonicalEvidenceDrilldown?.selectionId),
      ).size,
    ).toBe(2);
    expect(
      new Set(
        resulting.map((item) => item.canonicalEvidenceDrilldown?.selectionId),
      ).size,
    ).toBe(2);

    for (const item of [...direct, ...resulting]) {
      expectNoConsumerWiring(item);
    }
    expectNoConsumerWiring(projection);

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("msg-shared");
    expect(serialized).not.toContain("uel-direct-");
    expect(serialized).not.toContain("uel-revision-");
    // Authorised source body may appear once per relationship as snippet; raw
    // relationship / source ids must not.
    expect(serialized).toContain("Shared source message body for dual relationships.");
  });

  it("keeps relationship-derived selection ids stable across reorder and insertion", async () => {
    const first = await runCanonicalDetail({
      directEvidence: [
        directEvidence({
          id: "uel-direct-stable-a",
          summary: "Stable direct A",
          createdAt: new Date("2026-07-28T12:01:00.000Z"),
        }),
        directEvidence({
          id: "uel-direct-stable-b",
          summary: "Stable direct B",
          createdAt: new Date("2026-07-28T12:00:00.000Z"),
        }),
      ],
      revisionEvidence: [
        revisionEvidence({
          id: "uel-revision-stable-a",
          summary: "Stable revision A",
        }),
        revisionEvidence({
          id: "uel-revision-stable-b",
          summary: "Stable revision B",
        }),
      ],
    });

    const second = await runCanonicalDetail({
      directEvidence: [
        directEvidence({
          id: "uel-direct-inserted",
          summary: "Inserted direct",
          createdAt: new Date("2026-07-28T12:02:00.000Z"),
        }),
        directEvidence({
          id: "uel-direct-stable-b",
          summary: "Stable direct B",
          createdAt: new Date("2026-07-28T12:00:00.000Z"),
        }),
        directEvidence({
          id: "uel-direct-stable-a",
          summary: "Stable direct A",
          createdAt: new Date("2026-07-28T12:01:00.000Z"),
        }),
      ],
      revisionEvidence: [
        revisionEvidence({
          id: "uel-revision-inserted",
          summary: "Inserted revision",
        }),
        revisionEvidence({
          id: "uel-revision-stable-b",
          summary: "Stable revision B",
        }),
        revisionEvidence({
          id: "uel-revision-stable-a",
          summary: "Stable revision A",
        }),
      ],
    });

    const expectedDirectA = buildCanonicalEvidenceSelectionId({
      modelUpdateId: MODEL_UPDATE_ID,
      evidenceClass: "direct_movement_evidence",
      relationshipId: "uel-direct-stable-a",
    });
    const expectedRevisionA = buildCanonicalEvidenceSelectionId({
      modelUpdateId: MODEL_UPDATE_ID,
      evidenceClass: "resulting_revision_evidence",
      relationshipId: "uel-revision-stable-a",
    });

    const firstDirectA =
      first?.canonicalInspectorProjection?.directMovementEvidence.find(
        (item) => item.canonicalEvidenceDrilldown?.selectionId === expectedDirectA,
      )?.canonicalEvidenceDrilldown?.selectionId;
    const secondDirectA =
      second?.canonicalInspectorProjection?.directMovementEvidence.find(
        (item) => item.canonicalEvidenceDrilldown?.selectionId === expectedDirectA,
      )?.canonicalEvidenceDrilldown?.selectionId;
    const firstRevisionA =
      first?.canonicalInspectorProjection?.resultingRevisionEvidence.find(
        (item) =>
          item.canonicalEvidenceDrilldown?.selectionId === expectedRevisionA,
      )?.canonicalEvidenceDrilldown?.selectionId;
    const secondRevisionA =
      second?.canonicalInspectorProjection?.resultingRevisionEvidence.find(
        (item) =>
          item.canonicalEvidenceDrilldown?.selectionId === expectedRevisionA,
      )?.canonicalEvidenceDrilldown?.selectionId;

    expect(firstDirectA).toMatch(/^canonical-evidence-[a-f0-9]{64}$/);
    expect(firstRevisionA).toMatch(/^canonical-evidence-[a-f0-9]{64}$/);
    expect(secondDirectA).toBe(firstDirectA);
    expect(secondRevisionA).toBe(firstRevisionA);
  });

  it("projects a direct relationship only when its owned message source resolves", async () => {
    const detail = await runCanonicalDetail({
      directEvidence: [
        directEvidence({
          id: "uel-resolved",
          sourceId: "msg-1",
          summary: "Resolved owned source summary",
        }),
        directEvidence({
          id: "uel-orphaned",
          sourceId: "msg-deleted-or-foreign",
          summary: "Orphaned source summary",
          createdAt: new Date("2026-07-28T12:02:00.000Z"),
        }),
      ],
    });

    const direct =
      detail?.canonicalInspectorProjection?.directMovementEvidence ?? [];

    expect(direct).toHaveLength(1);
    expect(direct[0]?.canonicalEvidenceDrilldown).toMatchObject({
      evidenceClass: "direct_movement_evidence",
      sourceTypeLabel: "Conversation message",
      summary: null,
      snippet: "The user said they like tea again now.",
      sourceDisclosure: "available",
      returnSelectionId: MODEL_UPDATE_ID,
      sourceOrigin: expect.stringContaining("Conversation message"),
    });

    // Fail closed by omitting the unsafe relationship, not by rejecting the
    // already-proven canonical ModelUpdate detail.
    expect(detail?.canonicalInspectorProjection).toBeDefined();
    expect(detail?.report).toBeDefined();

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("Orphaned source summary");
    expect(serialized).not.toContain("msg-deleted-or-foreign");
    expect(serialized).not.toContain("uel-orphaned");
  });

  it("does not treat a populated link summary or snippet as source verification", async () => {
    const detail = await runCanonicalDetail({
      directEvidence: [
        directEvidence({
          id: "uel-unverified",
          sourceId: "msg-foreign-user",
          summary: "Unverified summary must not become available",
          snippet: "Unverified snippet must not become available",
          quote: "RAW UNVERIFIED QUOTE MUST NOT LEAK",
        }),
      ],
    });

    const direct =
      detail?.canonicalInspectorProjection?.directMovementEvidence ?? [];

    expect(direct).toHaveLength(0);
    expect(
      detail?.report.facts.items.every((item) => item.evidenceRefs.length === 0),
    ).toBe(true);

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain(
      "Unverified summary must not become available",
    );
    expect(serialized).not.toContain(
      "Unverified snippet must not become available",
    );
    expect(serialized).not.toContain("RAW UNVERIFIED QUOTE MUST NOT LEAK");
    expect(serialized).not.toContain("msg-foreign-user");
    expect(serialized).not.toContain("uel-unverified");
  });

  it("applies the same eligibility rule to other source types and fails closed for unresolvable ones", async () => {
    const detail = await runCanonicalDetail({
      directEvidence: [
        directEvidence({
          id: "uel-journal-resolved",
          sourceType: "journal_entry",
          sourceId: "journal-owned",
          summary: "Journal link summary",
          createdAt: new Date("2026-07-28T12:05:00.000Z"),
        }),
        directEvidence({
          id: "uel-action-orphaned",
          sourceType: "surfaced_action",
          sourceId: "action-deleted",
          summary: "Orphaned action link summary",
          createdAt: new Date("2026-07-28T12:06:00.000Z"),
        }),
        directEvidence({
          id: "uel-reference-unresolvable",
          sourceType: "reference_item",
          sourceId: "reference-1",
          summary: "Unresolvable source type summary",
          createdAt: new Date("2026-07-28T12:07:00.000Z"),
        }),
      ],
    });

    const direct =
      detail?.canonicalInspectorProjection?.directMovementEvidence ?? [];

    expect(direct).toHaveLength(1);
    expect(direct[0]?.canonicalEvidenceDrilldown).toMatchObject({
      sourceType: "journal_entry",
      sourceTypeLabel: "Journal entry",
      summary: "Evening reflection",
      snippet: "Evening reflection\n\nJournal body authorised for Inspector disclosure.",
      sourceDisclosure: "available",
    });

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("Orphaned action link summary");
    expect(serialized).not.toContain("Unresolvable source type summary");
    expect(serialized).not.toContain("action-deleted");
    expect(serialized).not.toContain("reference-1");
    expect(serialized).not.toContain("journal-owned");
    expect(serialized).not.toContain("uel-journal-resolved");
    expect(serialized).not.toContain("Journal link summary");
  });

  it("keeps unavailable and redacted text private while preserving report context", async () => {
    modelUpdateFindMany.mockResolvedValueOnce([
      {
        id: "recent-movement-1",
        updateType: "conclusion_strengthened",
        userFacingSummary: "Another current-revision movement exists.",
        createdAt: new Date("2026-07-28T11:00:00.000Z"),
      },
    ]);
    fieldworkAssignmentFindMany.mockResolvedValueOnce([
      {
        id: "fieldwork-1",
        prompt: "Capture exact trigger",
        reason: "Because this needs a second live receipt",
        status: "active",
        updatedAt: new Date("2026-07-28T12:30:00.000Z"),
      },
    ]);
    patternClaimFindFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string } })?.where?.id;
      if (id === "pattern-candidate") {
        return {
          id: "pattern-candidate",
          summary: "Candidate pattern summary must stay redacted",
          status: "candidate",
          createdAt: new Date("2026-07-28T12:15:00.000Z"),
        };
      }
      return null;
    });
    sessionFindFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string; userId?: string } })?.where?.id;
      const userId = (args as { where?: { userId?: string } })?.where?.userId;
      if (userId && userId !== "u1") return null;
      if (id !== "session-owned") return null;
      return {
        id: "session-owned",
        label: "Owned conversation",
        surfaceType: null,
        startedAt: new Date("2026-07-28T12:10:00.000Z"),
        createdAt: new Date("2026-07-28T12:10:00.000Z"),
      };
    });

    const detail = await runCanonicalDetail({
      rowOverrides: {
        internalNotes:
          "movementRationale::Stored rationale survives sanitization.",
      },
      directEvidence: [
        directEvidence({
          id: "uel-unavailable",
          sourceType: "session",
          sourceId: "session-owned",
          summary: null,
          snippet: null,
          quote: "RAW QUOTE MUST NOT LEAK",
          createdAt: new Date("2026-07-28T12:10:00.000Z"),
        }),
        directEvidence({
          id: "uel-action",
          sourceType: "surfaced_action",
          sourceId: "action-owned",
          summary: "Action evidence summary",
          createdAt: new Date("2026-07-28T12:20:00.000Z"),
        }),
      ],
      revisionEvidence: [
        revisionEvidence({
          id: "uel-redacted-revision",
          sourceType: "pattern_claim",
          sourceId: "pattern-candidate",
          role: "supports",
          summary: "RAW REDACTED REVISION SUMMARY MUST NOT LEAK",
          snippet: "RAW REDACTED REVISION SNIPPET MUST NOT LEAK",
          createdAt: new Date("2026-07-28T12:15:00.000Z"),
        }),
      ],
    });

    const projection = detail?.canonicalInspectorProjection;
    const unavailable = projection?.directMovementEvidence.find(
      (item) =>
        item.canonicalEvidenceDrilldown?.sourceDisclosure === "unavailable",
    )?.canonicalEvidenceDrilldown;
    const redacted =
      projection?.resultingRevisionEvidence[0]?.canonicalEvidenceDrilldown;

    expect(unavailable).toMatchObject({
      sourceType: "session",
      summary: null,
      snippet: null,
      sourceDisclosure: "unavailable",
    });
    expect(redacted).toMatchObject({
      sourceType: "pattern_claim",
      summary: null,
      snippet: null,
      sourceDisclosure: "redacted",
    });
    expect(detail?.report.evidencePacketSummary.receiptCount).toBe(2);
    expect(detail?.report.evidencePacketSummary.fieldworkCount).toBe(1);
    expect(detail?.report.evidencePacketSummary.linkedDecisionCount).toBe(1);
    expect(detail?.report.evidencePacketSummary.recentMovementCount).toBe(1);

    const serialized = JSON.stringify(detail);
    expect(serialized).toContain(
      "Stored movement rationale: Stored rationale survives sanitization.",
    );
    expect(serialized).toContain("Capture exact trigger");
    expect(serialized).not.toContain("session-owned");
    expect(serialized).not.toContain("action-owned");
    expect(serialized).not.toContain("pattern-candidate");
    expect(serialized).not.toContain("uel-unavailable");
    expect(serialized).not.toContain("uel-action");
    expect(serialized).not.toContain("uel-redacted-revision");
    expect(serialized).not.toContain("RAW QUOTE MUST NOT LEAK");
    expect(serialized).not.toContain(
      "RAW REDACTED REVISION SUMMARY MUST NOT LEAK",
    );
    expect(serialized).not.toContain(
      "RAW REDACTED REVISION SNIPPET MUST NOT LEAK",
    );
    expect(serialized).not.toContain("Candidate pattern summary must stay redacted");
  });

  it("builds the deterministic report from the verified packet before sanitising evidence references", async () => {
    const RAW_TRIGGERING_QUOTE =
      "Everything is completely ruined and nothing works anymore.";
    const SAFE_MESSAGE_SUMMARY = "The user described a difficult evening.";
    const SAFE_ACTION_SUMMARY = "A follow-up outcome was recorded.";

    modelUpdateFindMany.mockResolvedValueOnce([
      {
        id: "recent-movement-1",
        updateType: "conclusion_strengthened",
        userFacingSummary: "Another current-revision movement exists.",
        createdAt: new Date("2026-07-28T11:00:00.000Z"),
      },
    ]);
    fieldworkAssignmentFindMany.mockResolvedValueOnce([
      {
        id: "fieldwork-1",
        prompt: "Capture exact trigger",
        reason: "Because this needs a second live receipt",
        status: "active",
        updatedAt: new Date("2026-07-28T12:30:00.000Z"),
      },
    ]);

    const detail = await runCanonicalDetail({
      rowOverrides: {
        internalNotes:
          "movementRationale::The user explicitly corrected the previous tea preference.",
      },
      directEvidence: [
        directEvidence({
          id: "uel-loop",
          sourceId: "msg-loop",
          summary: SAFE_MESSAGE_SUMMARY,
          snippet: null,
          quote: RAW_TRIGGERING_QUOTE,
          createdAt: new Date("2026-07-28T12:01:00.000Z"),
        }),
        directEvidence({
          id: "uel-action",
          sourceType: "surfaced_action",
          sourceId: "action-owned",
          summary: SAFE_ACTION_SUMMARY,
          createdAt: new Date("2026-07-28T12:20:00.000Z"),
        }),
      ],
    });

    // The raw packet the producer must reason over before sanitisation.
    const verifiedPacket: ModelMovementRealityPacket = {
      item: detail!.item,
      modelUpdate: {
        id: MODEL_UPDATE_ID,
        updateTypeLabel: formatModelUpdateType(
          "conclusion_strengthened" as never,
        ),
        affectedObjectType:
          UnderstandingLinkTargetType.canonical_concept_revision,
        affectedObjectTypeLabel: formatLinkedObjectType(
          UnderstandingLinkTargetType.canonical_concept_revision,
        ),
        userFacingSummary: "I like tea again now",
        createdAt: "2026-07-28T12:00:00.000Z",
        before: "I don't like tea anymore",
        after: "I like tea again now",
        confidenceShift: null,
        movementRationale:
          "The user explicitly corrected the previous tea preference.",
      },
      affectedObject: null,
      evidence: [
        {
          id: "uel-loop",
          sourceType: "message",
          sourceId: "msg-loop",
          role: "supports",
          createdAt: "2026-07-28T12:01:00.000Z",
          sourceTypeLabel: "Conversation message",
          displayLabel: "Conversation message",
          href: null,
          analysisText: RAW_TRIGGERING_QUOTE,
        },
        {
          id: "uel-action",
          sourceType: "surfaced_action",
          sourceId: "action-owned",
          role: "supports",
          createdAt: "2026-07-28T12:20:00.000Z",
          sourceTypeLabel: "Decision / action outcome",
          displayLabel:
            "Action outcome · Follow Up · Open · RAW OWNED ACTION NOTE MUST NOT LEAK",
          href: null,
          analysisText: SAFE_ACTION_SUMMARY,
        },
      ],
      relatedFieldwork: [
        {
          id: "fieldwork-1",
          prompt: "Capture exact trigger",
          reason: "Because this needs a second live receipt",
          statusLabel: "Active",
          updatedAt: "2026-07-28T12:30:00.000Z",
        },
      ],
      relatedActions: [
        {
          id: "action-owned",
          label: "RAW OWNED ACTION NOTE MUST NOT LEAK",
          statusLabel: "Open",
          updatedAt: "2026-07-28T12:20:00.000Z",
        },
      ],
      recentMovements: [
        {
          id: "recent-movement-1",
          updateTypeLabel: formatModelUpdateType(
            "conclusion_strengthened" as never,
          ),
          userFacingSummary: "Another current-revision movement exists.",
          createdAt: "2026-07-28T11:00:00.000Z",
        },
      ],
    };

    const preSanitisationReport =
      buildDeterministicModelMovementRealityReport(verifiedPacket);

    const sectionKeys = [
      "facts",
      "stronglySupportedClaims",
      "inferences",
      "speculations",
      "overreachGuardrails",
      "loopPatternDetection",
      "modelMovement",
      "realityGate",
      "fieldworkWatchFor",
      "reentryAction",
      "whatWouldChangeThisConclusion",
    ] as const;

    // Report meaning is produced before sanitisation: prose, sections,
    // classifications, counts and conclusions are identical to the report the
    // original verified packet produces.
    for (const key of sectionKeys) {
      expect(
        detail?.report[key].items.map((item) => ({
          text: item.text,
          classification: item.classification,
        })),
      ).toEqual(
        preSanitisationReport[key].items.map((item) => ({
          text: item.text,
          classification: item.classification,
        })),
      );
    }
    expect(detail?.report.evidencePacketSummary).toEqual(
      preSanitisationReport.evidencePacketSummary,
    );
    expect(detail?.report.modelMovement.before).toBe(
      preSanitisationReport.modelMovement.before,
    );
    expect(detail?.report.modelMovement.after).toBe(
      preSanitisationReport.modelMovement.after,
    );

    // The finding exists only because the raw quote was analysed. The
    // browser-safe summary deliberately does not carry the triggering wording.
    const emotionalFact =
      "At least one linked receipt uses emotionally intense or global language.";
    expect(
      preSanitisationReport.facts.items.some((item) => item.text === emotionalFact),
    ).toBe(true);
    expect(
      detail?.report.facts.items.some((item) => item.text === emotionalFact),
    ).toBe(true);
    expect(
      detail?.report.overreachGuardrails.items.some(
        (item) =>
          item.text ===
          "Emotional intensity here is not proof of a stable trait or explanation.",
      ),
    ).toBe(true);
    expect(SAFE_MESSAGE_SUMMARY).not.toMatch(
      /\b(everything|completely|ruined|nothing)\b/i,
    );

    // Browser-visible references carry opaque relationship-derived ids and
    // browser-safe labels only.
    const allRefs = sectionKeys.flatMap((key) =>
      detail!.report[key].items.flatMap((item) => item.evidenceRefs),
    );
    expect(allRefs.length).toBeGreaterThan(0);
    for (const ref of allRefs) {
      expect(ref.id).toMatch(/^canonical-evidence-[a-f0-9]{64}$/);
      expect(ref.sourceId).toBe(ref.id);
      expect(ref.href).toBeNull();
      expect(ref.label.length).toBeGreaterThan(0);
      expect(ref.label).not.toContain(RAW_TRIGGERING_QUOTE);
      expect(ref.label).not.toMatch(/uel-/);
    }

    const projectedSelectionIds = new Set(
      detail?.canonicalInspectorProjection?.directMovementEvidence.map(
        (item) => item.canonicalEvidenceDrilldown?.selectionId,
      ),
    );
    for (const ref of allRefs) {
      expect(projectedSelectionIds.has(ref.id)).toBe(true);
    }

    const serialized = JSON.stringify(detail);
    expect(serialized).toContain("Capture exact trigger");
    expect(serialized).toContain(
      "There is 1 other recent movement update on this object.",
    );
    expect(serialized).toContain(
      "A recorded action outcome is part of the context around this movement.",
    );
    expect(serialized).toContain(
      "Stored movement rationale: The user explicitly corrected the previous tea preference.",
    );
    expect(serialized).not.toContain(RAW_TRIGGERING_QUOTE);
    expect(serialized).not.toContain("RAW OWNED ACTION NOTE MUST NOT LEAK");
    expect(serialized).not.toContain("RAW LOOP MESSAGE CONTENT MUST NOT LEAK");
    expect(serialized).not.toContain("msg-loop");
    expect(serialized).not.toContain("action-owned");
    expect(serialized).not.toContain("uel-loop");
    expect(serialized).not.toContain("uel-action");
    expect(serialized).not.toContain("/messages/");
  });

  it("marks a claim unverified only when every reference is unsafe", async () => {
    const detail = await runCanonicalDetail({
      directEvidence: [
        directEvidence({
          id: "uel-all-unverified",
          sourceId: "msg-foreign-user",
          summary: "Only reference is unverified",
        }),
      ],
    });

    expect(
      detail?.canonicalInspectorProjection?.directMovementEvidence,
    ).toHaveLength(0);

    const movementClaim = detail?.report.modelMovement.items.find((item) =>
      item.text.startsWith("Stored movement summary:"),
    );
    expect(movementClaim?.text).toBe(
      "Stored movement summary: I like tea again now",
    );
    expect(movementClaim?.evidenceRefs).toEqual([]);
    expect(movementClaim?.evidenceStatus).toBe("UNVERIFIED");
  });

  it("leaves noncanonical ModelUpdate output outside the canonical producer", async () => {
    const noncanonicalId = "mu-noncanonical";
    modelUpdateFindFirst.mockResolvedValueOnce({
      id: noncanonicalId,
      updateType: "conclusion_strengthened",
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: "umc-1",
      userFacingSummary: "Noncanonical movement",
      createdAt: new Date("2026-07-28T12:00:00.000Z"),
      beforeSummary: "Before",
      afterSummary: "After",
      confidenceDelta: null,
      internalNotes: null,
      canonicalConceptId: null,
      previousRevisionId: null,
      resultingRevisionId: null,
      exploreProposalId: null,
    });
    proposalFindMany.mockResolvedValueOnce([]);
    proposalFindFirst.mockResolvedValueOnce(null);
    evidenceFindMany.mockResolvedValueOnce([
      directEvidence({
        id: "uel-noncanonical",
        sourceId: "msg-noncanonical",
        summary: "Noncanonical evidence summary",
      }),
    ]);
    userMapConclusionFindFirst.mockResolvedValueOnce({
      id: "umc-1",
      title: "Legacy conclusion",
      summary: "Legacy conclusion summary",
      status: "active",
      confidenceLevel: "medium",
      evidenceCount: 1,
      sourceDiversity: 1,
      timeSpreadDays: 1,
      lastUserCorrectionAt: null,
      lastUserCorrectionLabel: null,
      updatedAt: new Date("2026-07-28T12:00:00.000Z"),
    });

    const detail = await buildWhatChangedInspectorDetail({
      userId: "u1",
      modelUpdateId: noncanonicalId,
    });

    expect(detail?.canonicalInspectorProjection).toBeUndefined();
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("canonicalEvidenceDrilldown");
    expect(serialized).toContain("uel-noncanonical");
    expect(serialized).toContain("msg-noncanonical");
  });
});
