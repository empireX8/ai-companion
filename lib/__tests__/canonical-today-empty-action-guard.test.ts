import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("canonical Today empty action/card identity guard", () => {
  it("always renders the report card and labels actions/rows (no omission of reference elements)", () => {
    const today = readSource("components/orvek-v0-canonical/pages/today.tsx");
    // Report card must remain in the tree — providers supply title/meta/id.
    expect(today).not.toMatch(/today\.reportTitle\.trim\(\)\s*\?\s*\(/);
    expect(today).toContain("aria-label={today.reportTitle}");
    expect(today).toContain("aria-label={a.label}");
    expect(today).toContain("aria-label={`${row.kicker}: ${row.title}`}");
    expect(today).toContain("openReport(today.reportId)");
  });

  it("live provider refuses heroSelectionId as blank report identity", () => {
    const live = readSource("components/orvek-v0-canonical/live-provider.ts");
    expect(live).toContain("Never fall back to heroSelectionId");
    expect(live).toContain("reportTitle &&");
  });
});
