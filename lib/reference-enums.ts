import {
  ReferenceConfidence,
  ReferenceStatus,
  ReferenceType,
} from "@prisma/client";

export const REFERENCE_TYPES = Object.values(ReferenceType);
export const REFERENCE_CONFIDENCE = Object.values(ReferenceConfidence);
export const REFERENCE_STATUS = Object.values(ReferenceStatus);
