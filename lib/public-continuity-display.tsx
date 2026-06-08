import React from "react";
import Link from "next/link";

import {
  formatPublicObjectLinkTypeLabel,
  resolvePublicLinkedObjectFallbackCopy,
  toNonEmptyPublicId,
} from "./public-continuity-registry";

type PublicLinkedObjectContinuityProps = {
  objectType: string | null | undefined;
  objectId: string | null | undefined;
  href: string | null | undefined;
  context: "model_update" | "linked_target";
  linkClassName?: string;
  containerClassName?: string;
};

export function PublicLinkedObjectContinuity({
  objectType,
  objectId,
  href,
  context,
  linkClassName = "label-meta text-cyan hover:underline",
  containerClassName = "label-meta text-meta",
}: PublicLinkedObjectContinuityProps) {
  const hasReference = Boolean(toNonEmptyPublicId(objectId));
  const linkLabel = formatPublicObjectLinkTypeLabel(objectType);

  if (hasReference && href) {
    return (
      <Link href={href} className={linkClassName}>
        {linkLabel}
      </Link>
    );
  }

  return (
    <div className={containerClassName}>
      {resolvePublicLinkedObjectFallbackCopy({
        hasObjectReference: hasReference,
        context,
      })}
    </div>
  );
}
