/**
 * Profile Derivation
 *
 * Rule-based extraction of profile claims (beliefs, goals, fears, etc.)
 * from user message text. Each extracted claim is upserted as a
 * ProfileArtifact and linked to an EvidenceSpan for auditability.
 */

import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { ProfileArtifactType } from "@prisma/client";

import prismadb from "./prismadb";

// ── Pattern registry ──────────────────────────────────────────────────────────

type PatternRule = {
  type: ProfileArtifactType;
  pattern: RegExp;
  confidence: number;
};

const RULES: PatternRule[] = [
  // GOAL
  {
    type: "GOAL",
    pattern: /\b(I want to|I need to|I'?m trying to|I hope to|I plan to|I aim to|I'?m working on|my goal is|I wish I could|I'?d like to|I'?m going to)\b/i,
    confidence: 0.7,
  },
  // FEAR / EMOTIONAL
  {
    type: "FEAR",
    pattern: /\b(I'?m afraid|I fear|I'?m scared|I'?m worried|I'?m anxious|I'?m nervous|I dread|my biggest fear|I hate when|terrifies me)\b/i,
    confidence: 0.75,
  },
  // IDENTITY
  {
    type: "IDENTITY",
    pattern: /\b(I am a|I'?m a|I consider myself|I identify as|as a person I|I'?ve always been a|I see myself as)\b/i,
    confidence: 0.65,
  },
  // BELIEF
  {
    type: "BELIEF",
    pattern: /\b(I believe that|I think that|I know that|I feel that|I'?m convinced|in my opinion|I understand that|I strongly believe)\b/i,
    confidence: 0.65,
  },
  // VALUE
  {
    type: "VALUE",
    pattern: /\b(I value|I care about|what matters to me|important to me|I prioritize|I believe in|means a lot to me)\b/i,
    confidence: 0.7,
  },
  // HABIT
  {
    type: "HABIT",
    pattern: /\b(I always|I never|I usually|I tend to|I often|every time I|I keep (doing|making|forgetting)|I can'?t stop|I consistently|I repeatedly)\b/i,
    confidence: 0.6,
  },
  // TRAIT
  {
    type: "TRAIT",
    pattern: /\b(I'?m (someone who|the type of person|naturally|inherently|basically)|I'?ve always (been|had)|my nature is|I'?m (very|quite|extremely|pretty) \w+)\b/i,
    confidence: 0.55,
  },
  // EMOTIONAL_PATTERN
  {
    type: "EMOTIONAL_PATTERN",
    pattern: /\b(I get (anxious|upset|angry|stressed|overwhelmed|depressed) when|I feel (empty|guilty|ashamed|proud|frustrated) (when|after|about)|my mood)\b/i,
    confidence: 0.65,
  },
  // RELATIONSHIP_PATTERN
  {
    type: "RELATIONSHIP_PATTERN",
    pattern: /\b(in my relationships|with (my partner|my family|my friends|people I|close to me)|I (trust|open up to|push away|avoid) people)\b/i,
    confidence: 0.6,
  },
];

// ── Claim normalization (for dedup) ───────────────────────────────────────────

export function normalizeClaimForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")   // strip punctuation
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);             // cap length
}

// ── Sentence extraction ───────────────────────────────────────────────────────

/**
 * Split text into sentences and return the sentence containing the match.
 * Falls back to a 200-char window around the match position.
 */
function extractSentence(text: string, matchIndex: number): string {
  // Simple sentence splitter on ., !, ?
  const sentences = text.split(/(?<=[.!?])\s+/);
  let pos = 0;
  for (const sentence of sentences) {
    if (pos + sentence.length >= matchIndex) {
      return sentence.trim().slice(0, 300);
    }
    pos += sentence.length + 1;
  }
  // fallback: window
  const start = Math.max(0, matchIndex - 20);
  const end = Math.min(text.length, matchIndex + 180);
  return text.slice(start, end).trim();
}

// ── Extraction ────────────────────────────────────────────────────────────────

export type ExtractedClaim = {
  type: ProfileArtifactType;
  claim: string;
  claimNorm: string;
  confidence: number;
};

/**
 * Apply all pattern rules against text and return unique extracted claims.
 * Multiple matches of the same type → deduplicated by normalized claim.
 */
export function extractProfileClaims(text: string): ExtractedClaim[] {
  if (text.length < 15) return [];

  const seen = new Set<string>();
  const results: ExtractedClaim[] = [];

  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (!match) continue;

    const claim = extractSentence(text, match.index);
    const claimNorm = normalizeClaimForDedup(claim);

    const dedupeKey = `${rule.type}:${claimNorm}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({ type: rule.type, claim, claimNorm, confidence: rule.confidence });
  }

  return results;
}

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * For each extracted claim:
 *  - Find existing ProfileArtifact by (userId, type, claimNorm) via unique index.
 *  - If found: update lastSeenAt and add the evidence link (idempotent).
 *  - If not found: create new artifact and evidence link.
 *
 * Returns the number of artifacts created (not updated).
 */
export async function upsertProfileClaims(
  {
    userId,
    claims,
    spanId,
    db = prismadb,
  }: {
    userId: string;
    claims: ExtractedClaim[];
    spanId: string;
    db?: PrismaClient;
  }
): Promise<number> {
  let created = 0;

  for (const { type, claim, claimNorm, confidence } of claims) {
    const existing = await db.profileArtifact.findUnique({
      where: { userId_type_claimNorm: { userId, type, claimNorm } },
      select: { id: true },
    });

    if (existing) {
      // Update lastSeenAt and add evidence link (ignore duplicate link constraint)
      await db.profileArtifact.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
      try {
        await db.profileArtifactEvidenceLink.create({
          data: { artifactId: existing.id, spanId },
        });
      } catch {
        // Duplicate link — idempotent, ignore
      }
    } else {
      await db.profileArtifact.create({
        data: {
          userId,
          type,
          claim,
          claimNorm,
          confidence,
          status: "candidate",
          evidenceLinks: {
            create: [{ spanId }],
          },
        },
      });
      created += 1;
    }
  }

  return created;
}

// ── Top-level processor ───────────────────────────────────────────────────────

/**
 * Extract profile claims from a single user message and persist them.
 * Ensures an EvidenceSpan exists for the message first.
 * All errors are swallowed — this is scaffolding, never blocking.
 *
 * Returns { spanId, claimsCreated } or null on failure.
 */
export async function processMessageForProfile(
  {
    userId,
    messageId,
    content,
    db = prismadb,
  }: {
    userId: string;
    messageId: string;
    content: string;
    db?: PrismaClient;
  }
): Promise<{ spanId: string; claimsCreated: number } | null> {
  if (content.length < 15) return null;

  try {
    const contentHash = createHash("sha256").update(content).digest("hex");

    // Idempotent span creation
    const existing = await db.evidenceSpan.findUnique({
      where: {
        messageId_charStart_charEnd_contentHash: {
          messageId,
          charStart: 0,
          charEnd: content.length,
          contentHash,
        },
      },
      select: { id: true },
    });
    let spanId: string;
    if (existing) {
      spanId = existing.id;
    } else {
      const created = await db.evidenceSpan.create({
        data: { userId, messageId, charStart: 0, charEnd: content.length, contentHash },
        select: { id: true },
      });
      spanId = created.id;
    }

    const claims = extractProfileClaims(content);
    if (claims.length === 0) return { spanId, claimsCreated: 0 };

    const claimsCreated = await upsertProfileClaims({ userId, claims, spanId, db });
    return { spanId, claimsCreated };
  } catch {
    return null;
  }
}
