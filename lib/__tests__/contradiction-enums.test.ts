import {
  ContradictionStatus,
  ContradictionType,
  ProbeRung,
  ReferenceConfidence,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  CONTRADICTION_CONFIDENCE,
  CONTRADICTION_STATUS,
  CONTRADICTION_TYPES,
  PROBE_RUNGS,
} from "../contradiction-enums";

describe("contradiction enums", () => {
  it("matches Prisma enum values", () => {
    expect(new Set(CONTRADICTION_TYPES)).toEqual(
      new Set(Object.values(ContradictionType))
    );
    expect(new Set(CONTRADICTION_STATUS)).toEqual(
      new Set(Object.values(ContradictionStatus))
    );
    expect(new Set(PROBE_RUNGS)).toEqual(new Set(Object.values(ProbeRung)));
    expect(new Set(CONTRADICTION_CONFIDENCE)).toEqual(
      new Set(Object.values(ReferenceConfidence))
    );
  });
});
