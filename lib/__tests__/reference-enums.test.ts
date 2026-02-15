import {
  ReferenceConfidence,
  ReferenceStatus,
  ReferenceType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  REFERENCE_CONFIDENCE,
  REFERENCE_STATUS,
  REFERENCE_TYPES,
} from "../reference-enums";

describe("reference enums", () => {
  it("matches Prisma enum values for type/status/confidence", () => {
    expect(new Set(REFERENCE_TYPES)).toEqual(new Set(Object.values(ReferenceType)));
    expect(new Set(REFERENCE_STATUS)).toEqual(new Set(Object.values(ReferenceStatus)));
    expect(new Set(REFERENCE_CONFIDENCE)).toEqual(
      new Set(Object.values(ReferenceConfidence))
    );
  });
});
