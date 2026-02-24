import { describe, expect, it } from "vitest";

import {
  calculateProcessingProgress,
  shouldSkipConversationByCheckpoint,
} from "../import-upload-processor";

describe("import upload processor checkpoint behavior", () => {
  it("skips conversations below checkpoint", () => {
    expect(shouldSkipConversationByCheckpoint(0, 2)).toBe(true);
    expect(shouldSkipConversationByCheckpoint(1, 2)).toBe(true);
    expect(shouldSkipConversationByCheckpoint(2, 2)).toBe(false);
  });

  it("progress reaches 100 when work is complete", () => {
    expect(calculateProcessingProgress(20, true)).toBeGreaterThanOrEqual(30);
    expect(calculateProcessingProgress(20, true)).toBeLessThanOrEqual(95);
    expect(calculateProcessingProgress(20, false)).toBe(100);
  });
});
