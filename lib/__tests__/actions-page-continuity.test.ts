import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("actions page related-object continuity", () => {
  it("uses public receipt helper and avoids manual claim-id href templates", () => {
    const source = readFileSync("app/(root)/(routes)/actions/page.tsx", "utf8");

    expect(source).toContain("buildPublicReceiptHref");
    expect(source).toContain('namespace: "receipt-pattern"');
    expect(source).toContain("href={receiptHref}");
    expect(source).not.toContain(
      "href={`/library/receipt-pattern-${action.linkedClaimId}`}"
    );
  });
});
