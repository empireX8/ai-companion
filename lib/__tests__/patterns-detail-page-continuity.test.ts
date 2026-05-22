import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("patterns detail page continuity", () => {
  it("uses public receipt href helper and avoids manual pattern receipt templates", () => {
    const source = readFileSync(
      "app/(root)/(routes)/patterns/[id]/page.tsx",
      "utf8"
    );

    expect(source).toContain("buildPublicReceiptHref");
    expect(source).toContain('namespace: "receipt-pattern"');
    expect(source).toContain("href={receiptHref}");
    expect(source).not.toContain("href={`/library/receipt-pattern-${claim.id}`}");
  });
});
