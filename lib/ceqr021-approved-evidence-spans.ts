/**
 * CEQR-021 — frozen lexical catalogs + code-owned approved evidence spans.
 *
 * Approved spans are complete propositions only. Lexically valid fragments
 * (isolated nouns/phrases) are intentionally excluded.
 */

import { createHash } from "crypto";

import {
  CEQR_021_CASE_SHA256,
  CEQR_021_CASES_AGGREGATE_SHA256,
} from "./ceqr021-constants";
import {
  hashCeqr019SyntheticCases,
  hashSyntheticCase,
} from "./contradiction-controlled-live-semantic-reproof";
import {
  LIVE_SYNTHETIC_CASES,
  type LiveSyntheticCase,
  type LiveSyntheticCaseId,
} from "./contradiction-live-provider-referee-proof";
import {
  LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
  LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16,
  enumerateValidLexicalBoundaries,
  hashSourceTextSha256,
  type LexicalBoundaryEntry,
  type EvidenceSpanSelection,
  isOffsetInsideSurrogatePair,
} from "./orvek-intelligence-kernel";

export const CEQR_021_SYNTHETIC_CASES: readonly LiveSyntheticCase[] =
  LIVE_SYNTHETIC_CASES;

export type ApprovedSpanKind =
  | "full_with_terminal_punct"
  | "full_without_terminal_punct";

export type Ceqr021ApprovedEvidenceSpan = {
  kind: ApprovedSpanKind;
  startBoundaryIndex: number;
  endBoundaryIndex: number;
  startOffset: number;
  endOffset: number;
  exactQuote: string;
  spanHashSha256: string;
};

export type Ceqr021FrozenSideCatalog = {
  side: "A" | "B";
  sourceText: string;
  sourceSha256: string;
  sourceUtf16Length: number;
  sourceCodePointLength: number;
  catalog: LexicalBoundaryEntry[];
  catalogSha256: string;
  withinSourceLimit: boolean;
  withinEntryLimit: boolean;
  approvedSpans: Ceqr021ApprovedEvidenceSpan[];
  approvedSpanSetSha256: string;
};

export type Ceqr021FrozenCaseCatalogs = {
  caseId: LiveSyntheticCaseId;
  caseSha256: string;
  sideA: Ceqr021FrozenSideCatalog;
  sideB: Ceqr021FrozenSideCatalog;
};

function codePointLength(sourceText: string): number {
  return [...sourceText].length;
}

export function hashLexicalBoundaryCatalog(
  catalog: readonly LexicalBoundaryEntry[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        catalog.map((entry) => ({
          boundaryIndex: entry.boundaryIndex,
          offset: entry.offset,
          category: entry.category,
        })),
      ),
    )
    .digest("hex");
}

export function hashApprovedEvidenceSpan(
  span: Omit<Ceqr021ApprovedEvidenceSpan, "spanHashSha256">,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: span.kind,
        startBoundaryIndex: span.startBoundaryIndex,
        endBoundaryIndex: span.endBoundaryIndex,
        startOffset: span.startOffset,
        endOffset: span.endOffset,
        exactQuote: span.exactQuote,
      }),
    )
    .digest("hex");
}

export function hashApprovedSpanSet(
  spans: readonly Ceqr021ApprovedEvidenceSpan[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        spans.map((span) => ({
          kind: span.kind,
          startBoundaryIndex: span.startBoundaryIndex,
          endBoundaryIndex: span.endBoundaryIndex,
          startOffset: span.startOffset,
          endOffset: span.endOffset,
          exactQuote: span.exactQuote,
        })),
      ),
    )
    .digest("hex");
}

/**
 * Code-generate the approved full-proposition span set for a one-sentence
 * synthetic source. Provider does not define the approved set.
 */
export function buildApprovedEvidenceSpansForSource(
  sourceText: string,
  catalog: readonly LexicalBoundaryEntry[] = enumerateValidLexicalBoundaries(
    sourceText,
  ),
): Ceqr021ApprovedEvidenceSpan[] {
  if (catalog.length < 2) return [];

  const spans: Ceqr021ApprovedEvidenceSpan[] = [];
  const full = {
    kind: "full_with_terminal_punct" as const,
    startBoundaryIndex: 0,
    endBoundaryIndex: catalog.length - 1,
    startOffset: 0,
    endOffset: sourceText.length,
    exactQuote: sourceText,
  };
  spans.push({ ...full, spanHashSha256: hashApprovedEvidenceSpan(full) });

  if (/[.!?]$/u.test(sourceText)) {
    const without = sourceText.slice(0, -1);
    const endBoundaryIndex = catalog.findIndex(
      (entry) => entry.offset === without.length,
    );
    if (endBoundaryIndex >= 0 && without.length > 0) {
      const candidate = {
        kind: "full_without_terminal_punct" as const,
        startBoundaryIndex: 0,
        endBoundaryIndex,
        startOffset: 0,
        endOffset: without.length,
        exactQuote: without,
      };
      spans.push({
        ...candidate,
        spanHashSha256: hashApprovedEvidenceSpan(candidate),
      });
    }
  }

  return spans;
}

export function buildFrozenSideCatalog(
  side: "A" | "B",
  sourceText: string,
): Ceqr021FrozenSideCatalog {
  const catalog = enumerateValidLexicalBoundaries(sourceText);
  const approvedSpans = buildApprovedEvidenceSpansForSource(sourceText, catalog);
  return {
    side,
    sourceText,
    sourceSha256: hashSourceTextSha256(sourceText),
    sourceUtf16Length: sourceText.length,
    sourceCodePointLength: codePointLength(sourceText),
    catalog,
    catalogSha256: hashLexicalBoundaryCatalog(catalog),
    withinSourceLimit:
      sourceText.length <= LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16,
    withinEntryLimit: catalog.length <= LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
    approvedSpans,
    approvedSpanSetSha256: hashApprovedSpanSet(approvedSpans),
  };
}

export function buildFrozenCaseCatalogs(
  synthetic: LiveSyntheticCase = CEQR_021_SYNTHETIC_CASES[0]!,
): Ceqr021FrozenCaseCatalogs {
  return {
    caseId: synthetic.id,
    caseSha256: hashSyntheticCase(synthetic),
    sideA: buildFrozenSideCatalog("A", synthetic.sideAText),
    sideB: buildFrozenSideCatalog("B", synthetic.sideBText),
  };
}

export function buildAllFrozenScenarioCatalogs(
  cases: readonly LiveSyntheticCase[] = CEQR_021_SYNTHETIC_CASES,
): Ceqr021FrozenCaseCatalogs[] {
  return cases.map((synthetic) => buildFrozenCaseCatalogs(synthetic));
}

/** Locked catalog hashes computed from authoritative enumeration. */
export const CEQR_021_FROZEN_CATALOG_SHA256 = {
  clear_contradiction_candidate: {
    A: "ba6e98ed03090c974c57515236271dda239cbc5cb0bdf94ed164d9acf3c2d811",
    B: "a0c2bee2034c18f422dc1127bb899637eb67071ae0ad0f960fc1ec1986495507",
  },
  compatible_contextual: {
    A: "6028552ac198da9669280b21aba326d385f972590c48cf4778c58f2747aa4231",
    B: "6028552ac198da9669280b21aba326d385f972590c48cf4778c58f2747aa4231",
  },
  ambiguous_insufficient: {
    A: "ea6340b18b82020cbca87b93dfa37e923143581c782786458150a5d5aee9fda6",
    B: "036106a7ae963da73324178f323039b981e830d425c6dda7db8c2b2bb82baa81",
  },
} as const satisfies Record<LiveSyntheticCaseId, { A: string; B: string }>;

export const CEQR_021_APPROVED_SPAN_SET_SHA256 = {
  clear_contradiction_candidate: {
    A: "e5fa8c66a288ccd700179bdfc81766b8964b0e2a1d7f49b729e2973059c002f1",
    B: "3910f0bb52fc0a1f907dec863a780763b195c83a234bb328b8f643440740c2a3",
  },
  compatible_contextual: {
    A: "03c5914f9ffea73ae20ebc30eb7b47abb336074b0fb982e6b951c7a0f76786f4",
    B: "c6a2464a80de3d142d714e8f61754119008011bc965fb1a2a6dfa502d8be13f3",
  },
  ambiguous_insufficient: {
    A: "d934bf0e7510568c5a65f8caa40e4a22bc00be12a79bb8f45bf71fe13788466c",
    B: "714306db55d492d16230cc3c7557f85b335811172fc06a30b69e8d16073cc735",
  },
} as const satisfies Record<LiveSyntheticCaseId, { A: string; B: string }>;

export const CEQR_021_SOURCE_SHA256 = {
  clear_contradiction_candidate: {
    A: "a1b0fdd2dd1e8d54e28b54c6ffb3ddac17d2dde9f080bd65b94a22b758442f8f",
    B: "32e9770c30a53399d11118c96d4e4f13b908c1c413041a81a3e68fd2018dfdc2",
  },
  compatible_contextual: {
    A: "a83319815e32d9389850f0248a530733463ac2da7f38e4981ea7c48aa7359fa8",
    B: "46af6a51e9dff521935f12bf9e9124abccbdbee0971092a3104765ff08cd057f",
  },
  ambiguous_insufficient: {
    A: "224d6efd6bd4c75015b0fc877f047209e054bbfb1f10fbc82e30ade571f66ed2",
    B: "f27a1891919d26080b00a6a8619e67caadd59c500f4af1c859a78a18fe0d237e",
  },
} as const satisfies Record<LiveSyntheticCaseId, { A: string; B: string }>;

export function assertCeqr021FrozenCaseHashes(
  cases: readonly LiveSyntheticCase[] = CEQR_021_SYNTHETIC_CASES,
): { ok: true } | { ok: false; mismatches: string[] } {
  const hashed = hashCeqr019SyntheticCases(cases);
  const mismatches: string[] = [];
  for (const id of Object.keys(CEQR_021_CASE_SHA256) as LiveSyntheticCaseId[]) {
    if (hashed.byId[id] !== CEQR_021_CASE_SHA256[id]) {
      mismatches.push(
        `${id}: expected ${CEQR_021_CASE_SHA256[id]} got ${hashed.byId[id]}`,
      );
    }
  }
  if (hashed.aggregateSha256 !== CEQR_021_CASES_AGGREGATE_SHA256) {
    mismatches.push(
      `aggregate: expected ${CEQR_021_CASES_AGGREGATE_SHA256} got ${hashed.aggregateSha256}`,
    );
  }
  if (cases.length !== 3) {
    mismatches.push(`length: expected 3 got ${cases.length}`);
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function assertCeqr021FrozenCatalogHashes(
  catalogs: readonly Ceqr021FrozenCaseCatalogs[] = buildAllFrozenScenarioCatalogs(),
): { ok: true } | { ok: false; mismatches: string[] } {
  const mismatches: string[] = [];
  for (const entry of catalogs) {
    const expected = CEQR_021_FROZEN_CATALOG_SHA256[entry.caseId];
    if (entry.sideA.catalogSha256 !== expected.A) {
      mismatches.push(
        `${entry.caseId}.A catalog: expected ${expected.A} got ${entry.sideA.catalogSha256}`,
      );
    }
    if (entry.sideB.catalogSha256 !== expected.B) {
      mismatches.push(
        `${entry.caseId}.B catalog: expected ${expected.B} got ${entry.sideB.catalogSha256}`,
      );
    }
    const approved = CEQR_021_APPROVED_SPAN_SET_SHA256[entry.caseId];
    if (entry.sideA.approvedSpanSetSha256 !== approved.A) {
      mismatches.push(
        `${entry.caseId}.A approved: expected ${approved.A} got ${entry.sideA.approvedSpanSetSha256}`,
      );
    }
    if (entry.sideB.approvedSpanSetSha256 !== approved.B) {
      mismatches.push(
        `${entry.caseId}.B approved: expected ${approved.B} got ${entry.sideB.approvedSpanSetSha256}`,
      );
    }
    if (!entry.sideA.withinSourceLimit || !entry.sideB.withinSourceLimit) {
      mismatches.push(`${entry.caseId}: source over UTF-16 limit`);
    }
    if (!entry.sideA.withinEntryLimit || !entry.sideB.withinEntryLimit) {
      mismatches.push(`${entry.caseId}: catalog over entry limit`);
    }
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function selectionIsApproved(
  side: Ceqr021FrozenSideCatalog,
  selection: EvidenceSpanSelection,
): Ceqr021ApprovedEvidenceSpan | null {
  return (
    side.approvedSpans.find(
      (span) =>
        span.startBoundaryIndex === selection.startBoundaryIndex &&
        span.endBoundaryIndex === selection.endBoundaryIndex,
    ) ?? null
  );
}

/** Prove no catalog entry lies inside an alphanumeric word token. */
export function catalogHasNoMidWordEntries(
  sourceText: string,
  catalog: readonly LexicalBoundaryEntry[],
): boolean {
  for (const entry of catalog) {
    const offset = entry.offset;
    if (offset === 0 || offset === sourceText.length) continue;
    if (isOffsetInsideSurrogatePair(sourceText, offset)) return false;
    const left = sourceText[offset - 1] ?? "";
    const right = sourceText[offset] ?? "";
    if (/[A-Za-z0-9]/u.test(left) && /[A-Za-z0-9]/u.test(right)) {
      return false;
    }
  }
  return true;
}

/** Prove no catalog entry splits a surrogate pair. */
export function catalogHasNoSurrogateSplits(
  sourceText: string,
  catalog: readonly LexicalBoundaryEntry[],
): boolean {
  return catalog.every(
    (entry) => !isOffsetInsideSurrogatePair(sourceText, entry.offset),
  );
}

/**
 * Prove every catalog offset remains a valid lexical boundary under the
 * combining-mark / surrogate policy. Membership already comes from
 * enumerateValidLexicalBoundaries; this re-validates each offset in isolation.
 */
export function catalogRespectsCombiningMarkPolicy(
  sourceText: string,
  catalog: readonly LexicalBoundaryEntry[],
): boolean {
  if (!catalogHasNoSurrogateSplits(sourceText, catalog)) return false;
  if (!catalogHasNoMidWordEntries(sourceText, catalog)) return false;
  for (const entry of catalog) {
    if (entry.offset < 0 || entry.offset > sourceText.length) return false;
    if (isOffsetInsideSurrogatePair(sourceText, entry.offset)) return false;
  }
  return true;
}

/**
 * Isolated noun / arbitrary phrase spans that must NOT be approved.
 * Used by offline adversarial tests.
 */
export function buildDisapprovedLexicalFragments(
  sourceText: string,
): Array<{ label: string; substring: string }> {
  const tokens = sourceText.match(/[A-Za-z]+/g) ?? [];
  const fragments: Array<{ label: string; substring: string }> = [];
  for (const token of tokens.slice(0, 3)) {
    if (token.length >= 4) {
      fragments.push({ label: `isolated_noun_or_verb:${token}`, substring: token });
    }
  }
  if (sourceText.includes(" ")) {
    const firstTwo = sourceText.split(/\s+/).slice(0, 2).join(" ");
    if (firstTwo.length > 0 && firstTwo.length < sourceText.length - 1) {
      fragments.push({ label: "partial_phrase", substring: firstTwo });
    }
  }
  return fragments;
}
