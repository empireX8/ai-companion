import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFERRED_RECEIPT_NAMESPACE_PREFIXES,
  PUBLIC_EVIDENCE_FALLBACK_COPY,
  PUBLIC_EVIDENCE_SOURCE_TYPES,
  PUBLIC_EVIDENCE_TARGET_TYPES,
  PUBLIC_LINKED_DETAIL_FALLBACK_COPY,
  PUBLIC_OBJECT_LINK_TYPES,
  PUBLIC_RECEIPT_NAMESPACE_PREFIXES,
  buildPublicObjectHref,
  buildPublicReceiptHref,
  isAllowedReceiptNamespace,
  isDeferredReceiptNamespace,
  isPublicEvidenceSourceType,
  isPublicEvidenceTargetType,
  isPublicObjectLinkType,
} from "../public-continuity-registry";

describe("public continuity registry", () => {
  it("keeps public object detail link types locked to the contracted allowlist", () => {
    expect([...PUBLIC_OBJECT_LINK_TYPES]).toEqual([
      "usermap_conclusion",
      "pattern_claim",
      "contradiction_node",
    ]);

    expect(isPublicObjectLinkType("usermap_conclusion")).toBe(true);
    expect(isPublicObjectLinkType("pattern_claim")).toBe(true);
    expect(isPublicObjectLinkType("contradiction_node")).toBe(true);
    expect(isPublicObjectLinkType("investigation")).toBe(false);
    expect(isPublicObjectLinkType("fieldwork_assignment")).toBe(false);
    expect(isPublicObjectLinkType("model_update")).toBe(false);
  });

  it("builds object hrefs only for allowlisted types and non-blank real IDs", () => {
    expect(
      buildPublicObjectHref({ type: "usermap_conclusion", id: " umc-1 " })
    ).toBe("/your-map/umc-1");
    expect(buildPublicObjectHref({ type: "pattern_claim", id: "pc-1" })).toBe(
      "/patterns/pc-1"
    );
    expect(
      buildPublicObjectHref({ type: "contradiction_node", id: "cn-1" })
    ).toBe("/contradictions/cn-1");

    expect(buildPublicObjectHref({ type: "pattern_claim", id: "   " })).toBeNull();
    expect(buildPublicObjectHref({ type: "Pattern Claim", id: "pc-1" })).toBeNull();
    expect(
      buildPublicObjectHref({ type: "pattern title should never become id", id: null })
    ).toBeNull();
  });

  it("keeps evidence continuity source and target allowlists exact", () => {
    expect([...PUBLIC_EVIDENCE_TARGET_TYPES]).toEqual(["usermap_conclusion"]);
    expect([...PUBLIC_EVIDENCE_SOURCE_TYPES]).toEqual([
      "pattern_claim",
      "contradiction_node",
    ]);

    expect(isPublicEvidenceTargetType("usermap_conclusion")).toBe(true);
    expect(isPublicEvidenceTargetType("pattern_claim")).toBe(false);
    expect(isPublicEvidenceSourceType("pattern_claim")).toBe(true);
    expect(isPublicEvidenceSourceType("contradiction_node")).toBe(true);
    expect(isPublicEvidenceSourceType("session")).toBe(false);
  });

  it("keeps production receipt namespaces locked to pattern and tension only", () => {
    expect([...PUBLIC_RECEIPT_NAMESPACE_PREFIXES]).toEqual([
      "receipt-pattern",
      "receipt-tension",
    ]);
    expect([...DEFERRED_RECEIPT_NAMESPACE_PREFIXES]).toEqual([
      "receipt-action",
      "receipt-user-map",
      "receipt-investigation",
      "receipt-fieldwork",
      "receipt-model-update",
    ]);

    expect(isAllowedReceiptNamespace("receipt-pattern-pattern-1")).toBe(true);
    expect(isAllowedReceiptNamespace("receipt-tension-tension-1")).toBe(true);
    expect(isAllowedReceiptNamespace("receipt-pattern-   ")).toBe(false);
    expect(isAllowedReceiptNamespace("receipt-action-action-1")).toBe(false);
    expect(isAllowedReceiptNamespace("receipt-user-map-umc-1")).toBe(false);
    expect(isAllowedReceiptNamespace("receipt-investigation-inv-1")).toBe(false);
    expect(isAllowedReceiptNamespace("receipt-fieldwork-fw-1")).toBe(false);
    expect(isAllowedReceiptNamespace("receipt-model-update-mu-1")).toBe(false);
  });

  it("identifies deferred receipt namespaces and does not build synthetic receipt hrefs", () => {
    expect(isDeferredReceiptNamespace("receipt-action-action-1")).toBe(true);
    expect(isDeferredReceiptNamespace("receipt-user-map-umc-1")).toBe(true);
    expect(isDeferredReceiptNamespace("receipt-investigation-inv-1")).toBe(true);
    expect(isDeferredReceiptNamespace("receipt-fieldwork-fw-1")).toBe(true);
    expect(isDeferredReceiptNamespace("receipt-model-update-mu-1")).toBe(true);
    expect(isDeferredReceiptNamespace("receipt-pattern-pattern-1")).toBe(false);

    expect(
      buildPublicReceiptHref({ namespace: "receipt-pattern", id: "pattern-1" })
    ).toBe("/library/receipt-pattern-pattern-1");
    expect(
      buildPublicReceiptHref({ namespace: "receipt-tension", id: "tension-1" })
    ).toBe("/library/receipt-tension-tension-1");
    expect(
      buildPublicReceiptHref({ namespace: "receipt-pattern", id: "   " })
    ).toBeNull();
  });

  it("centralizes exact public fallback copy", () => {
    expect(PUBLIC_LINKED_DETAIL_FALLBACK_COPY).toBe(
      "No linked detail available yet."
    );
    expect(PUBLIC_EVIDENCE_FALLBACK_COPY).toBe(
      "No linked evidence available yet."
    );
  });
  it("keeps raw understanding evidence-link API out of public UI continuity surfaces", () => {
    const publicSurfaceFiles = [
      "app/(root)/(routes)/your-map/[id]/page.tsx",
      "app/(root)/(routes)/active-questions/[id]/page.tsx",
      "app/(root)/(routes)/watch-for/page.tsx",
      "app/(root)/(routes)/watch-for/[id]/page.tsx",
      "app/(root)/(routes)/what-changed/page.tsx",
      "app/(root)/page.tsx",
      "app/(root)/(routes)/timeline/_components/TimelineSurface.tsx",
      "lib/public-evidence-continuity.ts",
      "lib/public-linked-object-continuity.ts",
      "lib/public-intelligence-safe-slice.ts",
    ];

    const combined = publicSurfaceFiles
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combined).not.toContain("/api/understanding/evidence-links");
  });
});
