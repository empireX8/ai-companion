import {
  ContradictionStatus,
  ContradictionType,
  ProbeRung,
  ReferenceConfidence,
} from "@prisma/client";

export const CONTRADICTION_TYPES = Object.values(ContradictionType);
export const CONTRADICTION_STATUS = Object.values(ContradictionStatus);
export const PROBE_RUNGS = Object.values(ProbeRung);
export const CONTRADICTION_CONFIDENCE = Object.values(ReferenceConfidence);
