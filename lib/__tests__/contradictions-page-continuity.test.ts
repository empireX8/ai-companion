import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contradictions page continuity", () => {
  it("uses public receipt href helper and avoids manual tension receipt templates", () => {
    const source = readFileSync("app/(root)/(routes)/contradictions/page.tsx", "utf8");

    expect(source).toContain("buildPublicReceiptHref");
    expect(source).toContain('namespace: "receipt-tension"');
    expect(source).toContain("href={receiptHref}");
    expect(source).not.toContain("href={`/library/receipt-tension-${item.id}`}");
  });
});
