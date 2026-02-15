import type { ProbeRung } from "@prisma/client";

export type EscalationNode = {
  snoozeCount: number;
  avoidanceCount: number;
  timesSurfaced: number;
  lastEscalatedAt: Date | null;
  lastTouchedAt: Date;
  lastEvidenceAt: Date | null;
};

const ESCALATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function computeEscalationLevel(node: EscalationNode, now: Date): number {
  void now;
  let level = 0;

  if (node.snoozeCount >= 2) {
    level = Math.max(level, 1);
  }
  if (node.snoozeCount >= 4) {
    level = Math.max(level, 2);
  }
  if (node.avoidanceCount >= 2) {
    level = Math.max(level, 2);
  }
  if (node.timesSurfaced >= 6) {
    level = Math.max(level, 3);
  }
  if (node.timesSurfaced >= 10) {
    level = Math.max(level, 4);
  }

  return Math.min(level, 4);
}

export function computeRecommendedRung(level: number): ProbeRung {
  if (level <= 0) {
    return "rung1_gentle_mirror";
  }
  if (level === 1) {
    return "rung2_explicit_contradiction";
  }
  if (level === 2) {
    return "rung3_evidence_pressure";
  }
  if (level === 3) {
    return "rung4_forced_choice_framing";
  }

  return "rung5_structured_probe_offer";
}

export function shouldEscalate(
  previousLevel: number,
  nextLevel: number,
  lastEscalatedAt: Date | null,
  now: Date
): boolean {
  if (nextLevel <= previousLevel) {
    return false;
  }

  if (!lastEscalatedAt) {
    return true;
  }

  return now.getTime() - lastEscalatedAt.getTime() >= ESCALATION_COOLDOWN_MS;
}
