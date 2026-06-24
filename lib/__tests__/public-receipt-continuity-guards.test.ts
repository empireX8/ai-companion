import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEFERRED_RECEIPT_NAMESPACE_PREFIXES } from "../public-continuity-registry";

type ReceiptGuardCase = {
  label: string;
  filePath: string;
  requiredNamespaces: readonly string[];
};

const RECEIPT_GUARD_CASES: readonly ReceiptGuardCase[] = [
  {
    label: "actions page",
    filePath: "components/decisions/DecisionItemCard.tsx",
    requiredNamespaces: ["receipt-pattern"],
  },
  {
    label: "patterns page",
    filePath: "app/(root)/(routes)/patterns/page.tsx",
    requiredNamespaces: ["receipt-pattern", "receipt-tension"],
  },
  {
    label: "patterns detail page",
    filePath: "app/(root)/(routes)/patterns/[id]/page.tsx",
    requiredNamespaces: ["receipt-pattern"],
  },
  {
    label: "contradictions page",
    filePath: "app/(root)/(routes)/contradictions/page.tsx",
    requiredNamespaces: ["receipt-tension"],
  },
  {
    label: "contradictions detail page",
    filePath: "app/(root)/(routes)/contradictions/[id]/page.tsx",
    requiredNamespaces: ["receipt-tension"],
  },
];

function assertNoManualReceiptHrefTemplates(source: string) {
  expect(source).not.toContain("/library/receipt-pattern-${");
  expect(source).not.toContain("/library/receipt-tension-${");
}

function assertNoDeferredReceiptNamespaces(source: string) {
  for (const namespace of DEFERRED_RECEIPT_NAMESPACE_PREFIXES) {
    expect(source).not.toContain(namespace);
  }
}

describe("public receipt continuity guards", () => {
  it("enforces helper-based pattern/tension receipt links without manual templates", () => {
    for (const guardCase of RECEIPT_GUARD_CASES) {
      const source = readFileSync(guardCase.filePath, "utf8");

      expect(source, `${guardCase.label}: helper usage`).toContain(
        "buildPublicReceiptHref"
      );

      for (const namespace of guardCase.requiredNamespaces) {
        expect(source, `${guardCase.label}: namespace ${namespace}`).toContain(
          `namespace: "${namespace}"`
        );
      }

      assertNoManualReceiptHrefTemplates(source);
      assertNoDeferredReceiptNamespaces(source);
    }
  });
});
