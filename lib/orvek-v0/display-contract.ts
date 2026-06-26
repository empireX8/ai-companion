import type { OrvekDataApi } from "./data-provider";

export const ORVEK_DISPLAY_CONTRACT_PRODUCTION = "production" as const;

export type OrvekDisplayContract = typeof ORVEK_DISPLAY_CONTRACT_PRODUCTION;

export function isProductionDisplay(api: OrvekDataApi): boolean {
  return api.displayContract === ORVEK_DISPLAY_CONTRACT_PRODUCTION;
}

export function withProductionContract(api: OrvekDataApi): OrvekDataApi {
  return {
    ...api,
    displayContract: ORVEK_DISPLAY_CONTRACT_PRODUCTION,
  };
}

/** Shared class for actions that are visible but not wired in production yet. */
export const ORVEK_DEFERRED_ACTION_CLASS =
  "pointer-events-none opacity-45 cursor-not-allowed";
