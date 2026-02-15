import { describe, expect, it } from "vitest";

import { buildContradictionUrls } from "../nodes-api";

describe("nodes-api helpers", () => {
  it("builds activeish contradiction URLs", () => {
    expect(buildContradictionUrls("activeish")).toEqual([
      "/api/contradiction?status=open",
      "/api/contradiction?status=explored",
      "/api/contradiction?status=snoozed",
    ]);
  });

  it("builds single contradiction URL for explicit status", () => {
    expect(buildContradictionUrls("open")).toEqual(["/api/contradiction?status=open"]);
  });
});
