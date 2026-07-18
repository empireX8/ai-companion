import {
  fetchTodayReentrySnapshot,
  hasTodayReentryContent,
  type TodayReentrySnapshot,
} from "../../today-reentry";
import {
  buildModelMovementDepthIndex,
  type ModelMovementDepthById,
  type ModelMovementDepthRecord,
} from "../../model-movement-report-contract";
import { fetchTodayMovementDepth } from "../../today-movement-depth";

const EMPTY_TODAY_REENTRY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

type TodayHydrationResult = {
  snapshot: TodayReentrySnapshot;
  movementDepthById: ModelMovementDepthById;
};

type TodayHydrationOptions = {
  maxAttempts?: number;
  maxLatestDepthAttempts?: number;
  delayMs?: number;
  fetchSnapshot?: () => Promise<TodayReentrySnapshot>;
  fetchMovementDepth?: () => Promise<ModelMovementDepthRecord[]>;
  wait?: (ms: number) => Promise<void>;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function needsRetry(
  snapshot: TodayReentrySnapshot,
  movementDepth: ModelMovementDepthRecord[],
): boolean {
  if (!hasTodayReentryContent(snapshot)) {
    return true;
  }

  const latestMovementId = snapshot.intelligenceUpdates[0]?.id ?? null;
  if (!latestMovementId) {
    return false;
  }

  return !movementDepth.some((item) => item.id === latestMovementId);
}

export async function hydrateTodayProductionData(
  options: TodayHydrationOptions = {},
): Promise<TodayHydrationResult> {
  const maxAttempts = options.maxAttempts ?? 4;
  const maxLatestDepthAttempts = options.maxLatestDepthAttempts ?? 8;
  const delayMs = options.delayMs ?? 500;
  const loadSnapshot = options.fetchSnapshot ?? fetchTodayReentrySnapshot;
  const loadMovementDepth = options.fetchMovementDepth ?? fetchTodayMovementDepth;
  const wait = options.wait ?? delay;

  let lastSnapshot = EMPTY_TODAY_REENTRY_SNAPSHOT;
  let lastMovementDepth: ModelMovementDepthRecord[] = [];

  for (let attempt = 0; attempt < maxLatestDepthAttempts; attempt += 1) {
    try {
      const [snapshot, movementDepth] = await Promise.all([
        loadSnapshot(),
        loadMovementDepth(),
      ]);

      lastSnapshot = snapshot;
      lastMovementDepth = movementDepth;

      if (!needsRetry(snapshot, movementDepth)) {
        return {
          snapshot,
          movementDepthById: buildModelMovementDepthIndex(movementDepth),
        };
      }

      if (!hasTodayReentryContent(snapshot) && attempt >= maxAttempts - 1) {
        return {
          snapshot,
          movementDepthById: buildModelMovementDepthIndex(movementDepth),
        };
      }
    } catch {
      lastSnapshot = EMPTY_TODAY_REENTRY_SNAPSHOT;
      lastMovementDepth = [];

      if (attempt >= maxAttempts - 1) {
        break;
      }
    }

    if (attempt < maxLatestDepthAttempts - 1) {
      await wait(delayMs * (attempt + 1));
    }
  }

  return {
    snapshot: lastSnapshot,
    movementDepthById: buildModelMovementDepthIndex(lastMovementDepth),
  };
}
