import type { ModelMovementDepthRecord } from "./model-movement-report-contract";

export const TODAY_MOVEMENT_DEPTH_ENDPOINT = "/api/today/movement-depth";
export const TODAY_MOVEMENT_DEPTH_LIMIT = 10;

export type TodayMovementDepthResponse = {
  items: ModelMovementDepthRecord[];
};

export function buildTodayMovementDepthRequestUrl(ids?: string[]): string {
  if (!ids?.length) {
    return TODAY_MOVEMENT_DEPTH_ENDPOINT;
  }

  const params = new URLSearchParams();
  params.set("ids", ids.join(","));
  return `${TODAY_MOVEMENT_DEPTH_ENDPOINT}?${params.toString()}`;
}

export async function fetchTodayMovementDepth(
  ids?: string[],
): Promise<ModelMovementDepthRecord[]> {
  const response = await fetch(buildTodayMovementDepthRequestUrl(ids), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as Partial<TodayMovementDepthResponse>;
  return Array.isArray(payload.items) ? payload.items : [];
}
