type SalienceStatus = "open" | "snoozed" | "explored";

export type SalienceNode = {
  id: string;
  status: SalienceStatus;
  snoozeCount: number;
  evidenceCount: number;
  lastEvidenceAt: Date | null;
  lastTouchedAt: Date;
  snoozedUntil: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const statusBoost: Record<SalienceStatus, number> = {
  open: 2,
  explored: 1,
  snoozed: 0,
};

export function computeSalience(node: Omit<SalienceNode, "id" | "snoozedUntil">, now: Date): number {
  let weight = 0;

  weight += node.snoozeCount * 3;
  weight += Math.min(node.evidenceCount, 20);

  if (node.lastEvidenceAt) {
    const days = (now.getTime() - node.lastEvidenceAt.getTime()) / DAY_MS;
    weight += Math.max(0, 10 - days);
  }

  const touchedDays = (now.getTime() - node.lastTouchedAt.getTime()) / DAY_MS;
  if (touchedDays <= 7) {
    weight += 2;
  }

  weight += statusBoost[node.status];

  return weight;
}

export function isTop3Eligible(node: Pick<SalienceNode, "status" | "snoozedUntil">, now: Date): boolean {
  if (node.status === "snoozed" && node.snoozedUntil && node.snoozedUntil.getTime() > now.getTime()) {
    return false;
  }

  return true;
}
