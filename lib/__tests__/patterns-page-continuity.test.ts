import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("patterns page continuity", () => {
  it("uses public receipt href helper and avoids manual receipt templates", () => {
    const source = readFileSync("app/(root)/(routes)/patterns/page.tsx", "utf8");

    expect(source).toContain("buildPublicReceiptHref");
    expect(source).toContain('namespace: "receipt-pattern"');
    expect(source).toContain('namespace: "receipt-tension"');
    expect(source).toContain("href={claimReceiptHref}");
    expect(source).toContain("href={keyTensionReceiptHref}");
    expect(source).not.toContain("href={`/library/receipt-pattern-${claim.id}`}");
    expect(source).not.toContain("href={`/library/receipt-tension-${keyTension.id}`}");
  });
});
