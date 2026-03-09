import prismadb from "@/lib/prismadb";
import { scoreTokenOverlap } from "./memory-governance";

// Minimum token-overlap score for a forecast to be considered relevant.
const RELEVANCE_THRESHOLD = 1;

export type ForecastMemoryResult = {
  text: string;
  retrieved: number;
  relevant: number;
  injected: number;
};

/**
 * Fetch active forecasts (Projections), score each against the current turn's
 * query using lightweight token overlap on premise + drivers + outcomes, and
 * return the top `maxItems` relevant ones formatted for the system prompt.
 *
 * If no forecasts meet the relevance threshold, injects nothing.
 */
export async function getRelevantForecasts(
  userId: string,
  query: string,
  maxItems: number
): Promise<ForecastMemoryResult> {
  const rows = await prismadb.projection.findMany({
    where: {
      userId,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      premise: true,
      drivers: true,
      outcomes: true,
      confidence: true,
      createdAt: true,
    },
  });

  const retrieved = rows.length;
  if (retrieved === 0) {
    return { text: "", retrieved: 0, relevant: 0, injected: 0 };
  }

  const scored = rows.map((row) => {
    const searchText = [row.premise, ...row.drivers, ...row.outcomes].join(" ");
    return { row, score: scoreTokenOverlap(searchText, query) };
  });

  const passing = scored.filter((s) => s.score >= RELEVANCE_THRESHOLD);
  const relevant = passing.length;

  if (relevant === 0) {
    return { text: "", retrieved, relevant: 0, injected: 0 };
  }

  passing.sort((a, b) => b.score - a.score);
  const selected = passing.slice(0, maxItems).map((s) => s.row);
  const injected = selected.length;

  const lines = ["Active forecasts (user's stated predictions — treat as informative context):"];
  for (const row of selected) {
    const pct = Math.round(row.confidence * 100);
    lines.push(`- [${pct}%] ${row.premise}`);
    if (row.drivers.length > 0) {
      lines.push(`  Drivers: ${row.drivers.join("; ")}`);
    }
    if (row.outcomes.length > 0) {
      lines.push(`  Outcomes: ${row.outcomes.join("; ")}`);
    }
  }

  return { text: lines.join("\n"), retrieved, relevant, injected };
}
