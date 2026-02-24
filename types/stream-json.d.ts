declare module "stream-json" {
  import { Transform } from "node:stream";

  export function parser(): Transform;
}

declare module "stream-json/streamers/StreamArray" {
  import { Transform } from "node:stream";

  export function streamArray(): Transform;
}
