import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicLinkedObjectContinuity } from "../public-continuity-display";
import {
  PUBLIC_LINKED_DETAIL_FALLBACK_COPY,
  PUBLIC_LINKED_OBJECT_UNAVAILABLE_COPY,
} from "../public-continuity-registry";

describe("PublicLinkedObjectContinuity", () => {
  it("renders a type label link when a verified public href exists", () => {
    const html = renderToStaticMarkup(
      <PublicLinkedObjectContinuity
        objectType="pattern_claim"
        objectId="pc-1"
        href="/patterns/pc-1"
        context="model_update"
      />
    );

    expect(html).toContain('href="/patterns/pc-1"');
    expect(html).toContain("Related pattern");
    expect(html).not.toMatch(/>pc-1</);
    expect(html).not.toContain("snippet");
    expect(html).not.toContain("internalNotes");
  });

  it("renders model-update unavailable copy when reference exists without href", () => {
    const html = renderToStaticMarkup(
      <PublicLinkedObjectContinuity
        objectType="usermap_conclusion"
        objectId="umc-hidden"
        href={null}
        context="model_update"
      />
    );

    expect(html).toContain(PUBLIC_LINKED_OBJECT_UNAVAILABLE_COPY);
    expect(html).not.toContain("umc-hidden");
  });

  it("renders source-unavailable copy for linked-target context without href", () => {
    const html = renderToStaticMarkup(
      <PublicLinkedObjectContinuity
        objectType="investigation"
        objectId="inv-12"
        href={null}
        context="linked_target"
      />
    );

    expect(html).toContain(PUBLIC_LINKED_DETAIL_FALLBACK_COPY);
    expect(html).not.toContain("inv-12");
  });

  it("renders source-unavailable copy when no object reference exists", () => {
    const html = renderToStaticMarkup(
      <PublicLinkedObjectContinuity
        objectType="investigation"
        objectId={null}
        href={null}
        context="linked_target"
      />
    );

    expect(html).toContain(PUBLIC_LINKED_DETAIL_FALLBACK_COPY);
  });
});
