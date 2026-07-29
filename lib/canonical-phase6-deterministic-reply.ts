/**
 * Phase 6 local/test-only deterministic chat reply after full context assembly.
 * Only active when the shared Phase 6 test seam guard approves.
 */

import { isPhase6TestSeamActive } from "./canonical-phase6-test-seam-guard";

export const ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY_ENV =
  "ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY" as const;

export const ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY_TEXT =
  "PHASE6_DETERMINISTIC_REPLY: context assembled; no paid provider call." as const;

export function phase6DeterministicReplyAllowed(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return isPhase6TestSeamActive(env);
}

export function buildPhase6DeterministicReply(userMessage: string): string {
  const trimmed = userMessage.trim().slice(0, 80);
  return `${ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY_TEXT} (re: ${trimmed})`;
}
