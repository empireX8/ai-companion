import type { OrvekObject } from "./orvek-v0/orvek-types";
import "./orvek-intelligence-object-authority";

/**
 * Preserve OrvekObject literal types when canonical source metadata is added.
 *
 * The runtime helper is intentionally generic because it also tags non-Orvek
 * projections. This more specific compile-time overload prevents valid
 * `OrvekObject.type` literals such as `model-update` and `investigation` from
 * widening to `string` at OrvekObject-producing call sites.
 */
declare module "./orvek-intelligence-object-authority" {
  export function withResolvedCanonicalSourceType<T extends OrvekObject>(
    object: T,
  ): T;
}
