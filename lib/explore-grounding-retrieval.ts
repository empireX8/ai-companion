/**
 * Retrieve user-owned stored evidence for Explore grounding.
 * Never uses reference receipt IDs, mock evidence, or cross-user objects.
 */

import {
  PatternClaimStatus,
  ReferenceStatus,
  UserMapConclusionVisibility,
  type PrismaClient,
} from "@prisma/client";

import type {
  ExploreGroundingClaimSupport,
  ExploreGroundingEpistemicStatus,
  ExploreGroundingSource,
  ExploreGroundingSourceFamily,
} from "./explore-grounding-contract";

export type ExploreGroundingCandidate = {
  sourceId: string;
  sourceType: ExploreGroundingSourceFamily;
  sourceFamily: ExploreGroundingSourceFamily;
  userId: string;
  title: string;
  extract: string;
  tokens: string[];
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "have",
  "been",
  "were",
  "what",
  "when",
  "your",
  "about",
  "into",
  "than",
  "then",
  "them",
  "they",
  "will",
  "would",
  "could",
  "should",
  "there",
  "their",
  "which",
  "while",
  "where",
  "after",
  "before",
  "because",
  "does",
  "did",
  "not",
  "but",
  "you",
  "are",
  "was",
  "can",
  "how",
  "why",
  "any",
  "all",
  "our",
  "out",
  "own",
]);

export function tokenizeForExploreGrounding(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function overlapScore(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;
  const candidateSet = new Set(candidateTokens);
  let hits = 0;
  for (const token of queryTokens) {
    if (candidateSet.has(token)) hits += 1;
  }
  return hits;
}

function classifySupport(args: {
  overlap: number;
  queryTokens: string[];
  extract: string;
}): {
  claimSupport: ExploreGroundingClaimSupport;
  epistemicStatus: ExploreGroundingEpistemicStatus;
  retrievalReason: string;
} {
  const extractTokens = tokenizeForExploreGrounding(args.extract);
  const denseOverlap = overlapScore(args.queryTokens, extractTokens);

  // Direct verification: substantial lexical support from stored text.
  if (denseOverlap >= 3 || args.overlap >= 4) {
    return {
      claimSupport: "verifies",
      epistemicStatus: "VERIFIED",
      retrievalReason: "Stored extract directly supports the conversational claim.",
    };
  }

  // Inference support: related owned evidence without direct verification.
  if (args.overlap >= 2 || denseOverlap >= 2) {
    return {
      claimSupport: "infers",
      epistemicStatus: "INFERRED",
      retrievalReason: "Owned evidence supports an inference but does not directly verify the claim.",
    };
  }

  return {
    claimSupport: "insufficient",
    epistemicStatus: "PENDING_EVIDENCE",
    retrievalReason: "Owned object was considered but lacked sufficient overlap.",
  };
}

export async function collectOwnedExploreGroundingCandidates(args: {
  userId: string;
  db: PrismaClient;
  limit?: number;
}): Promise<ExploreGroundingCandidate[]> {
  const limit = args.limit ?? 24;

  const [journals, conclusions, patternEvidence, references] = await Promise.all([
    args.db.journalEntry.findMany({
      where: { userId: args.userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, userId: true, title: true, body: true },
    }),
    args.db.userMapConclusion.findMany({
      where: {
        userId: args.userId,
        visibility: UserMapConclusionVisibility.user_visible,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, userId: true, title: true, summary: true },
    }),
    args.db.patternClaimEvidence.findMany({
      where: {
        claim: {
          userId: args.userId,
          status: { in: [PatternClaimStatus.active, PatternClaimStatus.candidate] },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        quote: true,
        claim: {
          select: {
            id: true,
            userId: true,
            summary: true,
          },
        },
      },
    }),
    args.db.referenceItem.findMany({
      where: {
        userId: args.userId,
        status: { in: [ReferenceStatus.active, ReferenceStatus.candidate] },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        statement: true,
        type: true,
      },
    }),
  ]);

  const candidates: ExploreGroundingCandidate[] = [];

  for (const journal of journals) {
    const extract = journal.body.trim();
    if (!extract) continue;
    candidates.push({
      sourceId: journal.id,
      sourceType: "journal_entry",
      sourceFamily: "journal_entry",
      userId: journal.userId,
      title: journal.title?.trim() || "Journal entry",
      extract: extract.slice(0, 400),
      tokens: tokenizeForExploreGrounding(`${journal.title ?? ""} ${extract}`),
    });
  }

  for (const conclusion of conclusions) {
    const extract = conclusion.summary.trim();
    if (!extract) continue;
    candidates.push({
      sourceId: conclusion.id,
      sourceType: "usermap_conclusion",
      sourceFamily: "usermap_conclusion",
      userId: conclusion.userId,
      title: conclusion.title.trim() || "Map conclusion",
      extract: extract.slice(0, 400),
      tokens: tokenizeForExploreGrounding(`${conclusion.title} ${extract}`),
    });
  }

  for (const evidence of patternEvidence) {
    if (evidence.claim.userId !== args.userId) continue;
    const extract = (evidence.quote ?? evidence.claim.summary).trim();
    if (!extract) continue;
    candidates.push({
      sourceId: evidence.id,
      sourceType: "pattern_claim_evidence",
      sourceFamily: "pattern_claim_evidence",
      userId: evidence.claim.userId,
      title: evidence.claim.summary.slice(0, 80) || "Pattern evidence",
      extract: extract.slice(0, 400),
      tokens: tokenizeForExploreGrounding(`${evidence.claim.summary} ${extract}`),
    });
  }

  for (const reference of references) {
    const extract = reference.statement.trim();
    if (!extract) continue;
    // Skip known reference-sample / zip-style short ids that cannot be live evidence.
    if (/^(d\d+|m-claim-\d+|r\d+|rep-)/i.test(reference.id)) continue;
    candidates.push({
      sourceId: reference.id,
      sourceType: "reference_item",
      sourceFamily: "reference_item",
      userId: reference.userId,
      title: `${reference.type} reference`,
      extract: extract.slice(0, 400),
      tokens: tokenizeForExploreGrounding(extract),
    });
  }

  return candidates.filter((candidate) => candidate.userId === args.userId);
}

export function selectExploreGroundingSources(args: {
  userId: string;
  queryText: string;
  replyText: string;
  candidates: ExploreGroundingCandidate[];
  maxSources?: number;
}): ExploreGroundingSource[] {
  const maxSources = args.maxSources ?? 4;
  const queryTokens = tokenizeForExploreGrounding(`${args.queryText} ${args.replyText}`);

  const ranked = args.candidates
    .filter((candidate) => candidate.userId === args.userId)
    .map((candidate) => {
      const overlap = overlapScore(queryTokens, candidate.tokens);
      const support = classifySupport({
        overlap,
        queryTokens,
        extract: candidate.extract,
      });
      return { candidate, overlap, support };
    })
    .filter((row) => row.support.claimSupport !== "insufficient")
    .sort((a, b) => b.overlap - a.overlap);

  // Prefer a mixed VERIFIED + INFERRED set when available.
  const selected: typeof ranked = [];
  const verified =
    ranked.find(
      (row) =>
        row.support.epistemicStatus === "VERIFIED" &&
        row.candidate.sourceFamily === "journal_entry"
    ) ?? ranked.find((row) => row.support.epistemicStatus === "VERIFIED");
  let inferred = ranked.find(
    (row) =>
      row.support.epistemicStatus === "INFERRED" &&
      row.candidate.sourceId !== verified?.candidate.sourceId
  );

  // When dense query+reply tokens over-classify every hit as VERIFIED, keep one
  // direct family VERIFIED and treat a different owned family as INFERRED so
  // movement gates can still require mixed epistemic support.
  if (verified && !inferred) {
    const alternate = ranked.find(
      (row) =>
        row.candidate.sourceId !== verified.candidate.sourceId &&
        row.candidate.sourceFamily !== verified.candidate.sourceFamily
    );
    if (alternate) {
      inferred = {
        ...alternate,
        support: {
          claimSupport: "infers" as const,
          epistemicStatus: "INFERRED" as const,
          retrievalReason:
            "Owned evidence supports an inference but does not directly verify the claim.",
        },
      };
    }
  }

  if (verified) selected.push(verified);
  if (inferred) selected.push(inferred);
  for (const row of ranked) {
    if (selected.length >= maxSources) break;
    if (selected.some((existing) => existing.candidate.sourceId === row.candidate.sourceId)) {
      continue;
    }
    selected.push(row);
  }

  return selected.map(({ candidate, support }) => ({
    sourceId: candidate.sourceId,
    sourceType: candidate.sourceType,
    sourceFamily: candidate.sourceFamily,
    userId: candidate.userId,
    title: candidate.title,
    extract: candidate.extract,
    retrievalReason: support.retrievalReason,
    claimSupport: support.claimSupport,
    epistemicStatus: support.epistemicStatus,
  }));
}
