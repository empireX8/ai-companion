import { PHASE2_OBJECTIVITY_CONSTANTS } from "./constants";
import type { EvidencePacketItem } from "./types";

const HIGH_EMOTION_TEXT_RE =
  /\b(suicid(?:al|e)|panic(?:king|ked)?|panicked|overwhelmed|ashamed|worthless|hopeless|can't\s+cope|cannot\s+cope|spiral(?:ing)?|crisis|i\s+want\s+to\s+die|self\s*harm|dysregulat(?:ed|ion)|rage|furious)\b/i;

const HIGH_EMOTION_STATE_TAG_RE = /\b(overloaded|stressed)\b/i;
const HIGH_EMOTION_EVENT_TAG_RE = /\b(conflict|pressure|isolated|sleep_disrupted)\b/i;

export function detectHighEmotionSignalFromText(text: string | null | undefined): boolean {
  if (!text) return false;
  return HIGH_EMOTION_TEXT_RE.test(text);
}

export function detectHighEmotionSignalFromCheckIn(args: {
  stateTag?: string | null;
  eventTags?: string[];
  note?: string | null;
}): boolean {
  if (args.stateTag && HIGH_EMOTION_STATE_TAG_RE.test(args.stateTag)) {
    return true;
  }

  if (args.eventTags?.some((tag) => HIGH_EMOTION_EVENT_TAG_RE.test(tag))) {
    return true;
  }

  return detectHighEmotionSignalFromText(args.note);
}

export function computeHighEmotionDominance(items: EvidencePacketItem[]): {
  highEmotionCount: number;
  totalConsidered: number;
  dominanceRatio: number;
  dominant: boolean;
} {
  const considered = items.filter((item) => item.linkable || item.ownershipResolvable);
  const highEmotionCount = considered.filter((item) => item.highEmotionSignal).length;
  const totalConsidered = considered.length;
  const dominanceRatio =
    totalConsidered === 0 ? 0 : Number((highEmotionCount / totalConsidered).toFixed(4));

  return {
    highEmotionCount,
    totalConsidered,
    dominanceRatio,
    dominant:
      totalConsidered > 0 &&
      dominanceRatio >= PHASE2_OBJECTIVITY_CONSTANTS.HIGH_EMOTION_DOMINANCE_RATIO,
  };
}
